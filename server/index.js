if (process.env.NODE_ENV === 'test') {
    require('dotenv').config({ path: '.env.test' });
} else {
    require('dotenv').config();
}

// Phase 3: refuse unsafe production DB configuration before anything else
const { assertProductionDatabase } = require('./config/productionGuards');
try {
    assertProductionDatabase();
} catch (guardErr) {
    console.error('[productionGuards]', guardErr.message);
    process.exit(1);
}

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { connectDB } = require('./config/database');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const logger = require('./utils/logger');
const Metrics = require('./utils/metrics');

const app = express();
const server = http.createServer(app);

const configuredCorsOrigins = String(process.env.CORS_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
const allowDevelopmentWildcard = !isProduction && (
    configuredCorsOrigins.length === 0 || configuredCorsOrigins.includes('*')
);

if (isProduction && (
    configuredCorsOrigins.length === 0 || configuredCorsOrigins.includes('*')
)) {
    console.error('[productionGuards] Production requires an explicit CORS_ORIGIN allowlist');
    process.exit(1);
}

// SCORM learner content is served by this backend and posts its progress back to
// /api/scorm/session on the same Render origin. Browsers send an Origin header on
// POST requests even when they are same-origin, so the backend must allow its own
// public origin in addition to the frontend allowlist. RENDER_EXTERNAL_URL follows
// service renames automatically and avoids hard-coding a Render hostname.
let renderExternalOrigin = '';
try {
    const renderExternalUrl = String(process.env.RENDER_EXTERNAL_URL || '').trim();
    if (renderExternalUrl) renderExternalOrigin = new URL(renderExternalUrl).origin;
} catch (_) {
    renderExternalOrigin = '';
}
const allowedCorsOrigins = new Set(configuredCorsOrigins);
if (renderExternalOrigin) allowedCorsOrigins.add(renderExternalOrigin);

const corsOrigin = (origin, callback) => {
    // Native/mobile clients, health checks and server-to-server requests may not
    // include an Origin header. Browser origins must match the configured list
    // or the backend's own public Render origin.
    if (!origin || allowDevelopmentWildcard || allowedCorsOrigins.has(origin)) {
        return callback(null, true);
    }
    return callback(new Error('Origin is not allowed by CORS'));
};

const io = new Server(server, {
    cors: {
        origin: corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true
    },
    // Mobile / flaky networks: avoid aggressive disconnects mid-quiz
    pingInterval: 10000,
    pingTimeout: 45000,
    connectTimeout: 20000
});

// Redis adapter is intentionally opt-in. Live Quiz timers/lease ownership are
// currently hardened for a single backend process; do not imply multi-instance
// safety merely because REDIS_URL exists.
if (process.env.REDIS_URL && process.env.SOCKET_REDIS_ADAPTER_ENABLED === '1') {
    try {
        const { createClient } = require('redis');
        const { createAdapter } = require('@socket.io/redis-adapter');

        const pubClient = createClient({ url: process.env.REDIS_URL });
        const subClient = pubClient.duplicate();

        Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
            io.adapter(createAdapter(pubClient, subClient));
            logger.info('socket_redis_adapter_connected', { module: 'socket' });
        }).catch(err => {
            logger.error('socket_redis_adapter_failed', { module: 'socket', error: err.message });
        });
    } catch (err) {
        logger.error('socket_redis_adapter_unavailable', {
            module: 'socket',
            error: err.message
        });
    }
}

// Structured HTTP access log (P3-T08) + metrics (P3-T09)
app.use((req, res, next) => {
    req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.http(req, res, duration);
        Metrics.recordHttp(res.statusCode, duration);
    });
    next();
});

app.use(cors({
    origin: corsOrigin,
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const startServer = async () => {
    app.get(['/api', '/api/', '/health'], (req, res) => {
        res.json({
            message: 'Kahoot Awareness Backend is running',
            status: 'healthy',
            timestamp: new Date().toISOString()
        });
    });

    try {
        await connectDB();

        // Historical admin previews used to create a new registration per click.
        // Compact them once at boot so production data is clean after deployment.
        if (process.env.NODE_ENV !== 'test') {
            try {
                const { cleanupPreviewRegistrations } = require('./services/scorm/ScormPreviewService');
                const cleanup = await cleanupPreviewRegistrations();
                if (cleanup.removedDuplicates > 0) {
                    logger.info('scorm_preview_duplicates_cleaned', {
                        module: 'scorm',
                        removed: cleanup.removedDuplicates,
                        courses: cleanup.coursesChecked
                    });
                }
            } catch (e) {
                logger.warn('scorm_preview_cleanup_failed', { module: 'scorm', error: e.message });
            }
        }

        if (process.env.NODE_ENV === 'test') {
            const { seedTestFixtures } = require('./tests/fixtures');
            await seedTestFixtures();
        }

        app.use('/api/auth', require('./routes/auth'));
        app.use('/api/player', require('./routes/playerAuth'));
        app.use('/api/quizzes', require('./routes/quizzes'));
        app.use('/api/sessions', require('./routes/sessions'));
        app.use('/api/jobs', require('./routes/jobs'));
        app.use('/api/metrics', require('./routes/metrics'));

        // SCORM World LMS (flag-gated inside router — returns 404 when SCORM_LMS=false)
        app.use('/api/scorm', require('./routes/scorm'));

        if (process.env.NODE_ENV === 'test') {
            app.use('/api/test-only', require('./routes/testOnly'));
        }

        const socketHandlers = require('./services/socketHandlers');
        socketHandlers(io);

        // SCORM World live roster
        try {
            const ScormRealtime = require('./services/scorm/ScormRealtime');
            ScormRealtime.setIO(io);
        } catch (e) {
            logger.warn('scorm_realtime_init_failed', { module: 'scorm', error: e.message });
        }

        // SCORM admin tracking rooms. Runtime commit/finish events are emitted by
        // routes/scorm/runtime.js itself. Do not monkey-patch Runtime.commit here:
        // the previous two-argument wrapper silently discarded the third
        // buffered `values` argument containing location, score and interactions.
        try {
            const jwt = require('jsonwebtoken');
            const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
            io.on('connection', (socket) => {
                socket.on('join_scorm_course', (payload) => {
                    try {
                        const courseId = payload && payload.courseId;
                        const token = payload && payload.token;
                        if (!courseId || !token) return;
                        const decoded = jwt.verify(token, JWT_SECRET);
                        if (!decoded || !decoded.userId) return;
                        socket.join(`scorm_course_${courseId}`);
                        socket.data = { ...(socket.data || {}), scormCourseId: courseId, scormHostId: decoded.userId };
                        socket.emit('scorm_course_joined', { courseId });
                    } catch (_) {
                        try { socket.emit('error', 'SCORM course join failed'); } catch (__) {}
                    }
                });
                socket.on('leave_scorm_course', (payload) => {
                    try {
                        const courseId = (payload && payload.courseId) || (socket.data && socket.data.scormCourseId);
                        if (courseId) socket.leave(`scorm_course_${courseId}`);
                    } catch (_) {}
                });
            });
        } catch (e) {
            logger.warn('scorm_wave2_hooks_failed', { module: 'scorm', error: e.message });
        }

        const SessionWatchdogService = require('./services/SessionWatchdogService');
        SessionWatchdogService.startPeriodic(
            Number(process.env.SESSION_WATCHDOG_INTERVAL_MS) || 15000
        );

        const PORT = process.env.PORT || 5001;
        server.listen(PORT, '0.0.0.0', () => {
            logger.info('server_listening', { module: 'http', port: PORT });
        });
    } catch (err) {
        logger.error('server_start_failed', { module: 'http', error: err.message, stack: err.stack });
        process.exit(1);
    }
};

startServer();

const externalUrl = process.env.RENDER_EXTERNAL_URL;
if (externalUrl) {
    const https = require('https');
    setInterval(() => {
        https.get(`${externalUrl}/health`).on('error', (err) => {
            logger.warn('keepalive_ping_error', { module: 'http', error: err.message });
        });
    }, 14 * 60 * 1000);
}