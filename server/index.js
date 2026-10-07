if (process.env.NODE_ENV === 'test') {
    require('dotenv').config({ path: '.env.test' });
} else {
    require('dotenv').config();
}

// Phase 3: refuse unsafe production DB configuration before anything else
const { assertProductionDatabase, assertProductionSecurity } = require('./config/productionGuards');
try {
    assertProductionDatabase();
    assertProductionSecurity();
} catch (guardErr) {
    console.error('[productionGuards]', guardErr.message);
    process.exit(1);
}

// Mandatory JWT signing secret. Requiring this module fails fast with a clear
// message when JWT_SECRET is missing/weak (ephemeral random secret in test env).
const JWT_SECRET = require('./config/jwtSecret');

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

function normalizeOrigin(value) {
    const raw = String(value || '').trim();
    if (!raw || raw === '*') return raw;
    try {
        return new URL(raw).origin;
    } catch (_) {
        return raw.replace(/\/$/, '');
    }
}

const configuredCorsOrigins = String(process.env.CORS_ORIGIN || '')
    .split(',')
    .map(normalizeOrigin)
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

// Keep browser origins explicit in production. In addition to CORS_ORIGIN, accept
// common deployment variables and the current Quizmoto Render frontend. This avoids
// a stale CORS_ORIGIN breaking the platform after a frontend host migration while
// still refusing arbitrary *.onrender.com origins.
const deploymentFrontendOrigins = [
    process.env.FRONTEND_URL,
    process.env.CLIENT_URL,
    process.env.PUBLIC_FRONTEND_URL,
    process.env.VITE_FRONTEND_URL,
    'https://quizmoto-frontend.onrender.com'
].map(normalizeOrigin).filter(Boolean);

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
const allowedCorsOrigins = new Set([
    ...configuredCorsOrigins,
    ...deploymentFrontendOrigins
]);
if (renderExternalOrigin) allowedCorsOrigins.add(renderExternalOrigin);

const corsOrigin = (origin, callback) => {
    // Native/mobile clients, health checks and server-to-server requests may not
    // include an Origin header. Browser origins must match the configured list,
    // a known deployed frontend, or the backend's own public Render origin.
    const normalizedRequestOrigin = normalizeOrigin(origin);
    if (!origin || allowDevelopmentWildcard || allowedCorsOrigins.has(normalizedRequestOrigin)) {
        return callback(null, true);
    }
    logger.warn('cors_origin_rejected', {
        module: 'http',
        origin: normalizedRequestOrigin || String(origin || '')
    });
    return callback(new Error('Origin is not allowed by CORS'));
};

// A SCORM player is served from the backend itself and saves progress back to the
// same host. Custom API domains (for example api.lmsgen.in) may not equal
// RENDER_EXTERNAL_URL, so accept an Origin whose host exactly matches the effective
// request host. This preserves the explicit cross-origin allowlist for every other
// browser origin while keeping same-host SCORM commits working after domain changes.
function isSameHostBrowserOrigin(req, origin) {
    if (!origin) return false;
    try {
        const originHost = new URL(origin).host.toLowerCase();
        const requestHost = String(
            req.headers['x-forwarded-host'] || req.headers.host || ''
        ).split(',')[0].trim().toLowerCase();
        return Boolean(originHost && requestHost && originHost === requestHost);
    } catch (_) {
        return false;
    }
}

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

// Helmet, with the directives that conflict with this product's document
// responses disabled (see boot report for the full analysis):
// - contentSecurityPolicy: every HTML/JS document this server emits already
//   carries its own precise CSP via res.setHeader (play shell, SCORM content
//   files, flipbook reader), including explicit frame-ancestors allowlists.
//   Helmet's default (script-src 'self', frame-ancestors 'self') would break
//   inline player scripts and contradict the intentional embed policies.
// - frameguard: X-Frame-Options: SAMEORIGIN contradicts the routes' own
//   frame-ancestors directives (flipbook reader allows '*', preview embeds
//   allow any https/http ancestor). Browsers honor frame-ancestors over
//   X-Frame-Options anyway; sending both would be contradictory.
// - crossOriginOpenerPolicy: the default 'same-origin' severs window.opener
//   for the cross-origin LMS popup flow (play.js notifyOpener/notifyParentExit
//   postMessage back to the frontend). 'same-origin-allow-popups' keeps the
//   opener link while still isolating popups opened by the player itself.
// - crossOriginResourcePolicy: the default 'same-origin' would block
//   cross-origin <img> loads of backend-hosted assets (template thumbnails,
//   flipbook pages, SCORM assets) from the LMS frontend. This backend is an
//   asset server by design, so the directive is disabled.
// Trade-off: we lose helmet's generic XSS/framing defaults, but every rendered
// document already sets a tailored policy; JSON API responses gain the rest
// (HSTS, nosniff, referrer policy, etc.).
app.use(helmet({
    contentSecurityPolicy: false,
    frameguard: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: false
}));

app.use((req, res, next) => cors({
    origin: (origin, callback) => {
        if (isSameHostBrowserOrigin(req, origin)) return callback(null, true);
        return corsOrigin(origin, callback);
    },
    credentials: true
})(req, res, next));

// Reject abusive authentication/AI bursts before parsing large JSON bodies.
// Account-level limiters still run after authentication; this IP layer protects
// CPU and memory when the caller has no valid token at all.
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.SENSITIVE_INGRESS_15M_LIMIT || 120),
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        if (process.env.NODE_ENV === 'test' || String(req.method).toUpperCase() !== 'POST') return true;
        const url = String(req.originalUrl || req.url || '');
        return !(url.startsWith('/api/auth/')
            || url === '/api/quizzes/generate-ai'
            || url.startsWith('/api/scorm/author/'));
    },
    message: {
        message: 'Too many sensitive requests from this network. Please wait and try again.',
        code: 'SENSITIVE_INGRESS_RATE_LIMITED'
    }
}));

// Large-payload JSON endpoints (base64 ZIPs / data URLs). This dispatcher runs
// BEFORE the tight global parser so the 50mb budget applies to exactly these
// routes; body-parser marks the request parsed (req._body), so the global pass
// below skips them. Raw binary uploads (SCORM ZIP via express.raw, author
// chunks) carry their own route-level limits and never reach these parsers.
// Verified: no other route legitimately needs >1mb — auth/account/player
// payloads are a few KB; session/xapi/campaign payloads are small JSON; the
// video upload metadata is header-based; session.js already sets its own 2mb.
const LARGE_JSON_BODY_PATTERNS = [
    /^\/api\/scorm\/packages\/upload-json$/, // {zipBase64} SCORM package import (<=100mb)
    /^\/api\/scorm\/awareness-gallery\/central\/upload$/, // {zipBase64} central template ZIP
    /^\/api\/scorm\/awareness-gallery\/central\/[^/]+\/thumbnail$/, // {dataUrl} central thumbnail
    /^\/api\/scorm\/awareness-gallery\/mine\/[^/]+\/image$/, // {dataUrl} template image replace
    /^\/api\/scorm\/author\/(analyze|generate)$/, // {fileBase64} AI-authoring source doc (<=100mb)
    /^\/api\/scorm\/flipbooks\/[^/]+\/pages$/ // {dataUrl} flipbook page image (direct-upload fallback)
];
const largeJsonParser = express.json({ limit: '50mb' });
app.use((req, res, next) => {
    const method = String(req.method || '').toUpperCase();
    if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') return next();
    if (LARGE_JSON_BODY_PATTERNS.some((re) => re.test(req.path))) {
        return largeJsonParser(req, res, next);
    }
    next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

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

        // Assignment metadata was added after the original SCORM schema shipped.
        // sequelize.sync() intentionally does not alter long-lived production tables,
        // so apply only the additive columns that are missing.
        try {
            const { ensurePlatformSchema } = require('./services/scorm/ScormPlatformMigrationService');
            const migration = await ensurePlatformSchema();
            if (migration.changed) {
                logger.info('scorm_platform_schema_upgraded', { module: 'scorm', changes: migration.changes });
            }
        } catch (migrationErr) {
            logger.error('scorm_platform_schema_upgrade_failed', { module: 'scorm', error: migrationErr.message });
            throw migrationErr;
        }

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

        // Crash recovery for awareness email campaigns. A campaign left in
        // 'sending' when the process died would otherwise look live forever and
        // could double-send if an operator resumes it blindly. Park each one as
        // 'stopped' with the progress snapshot in lastError. Never auto-resume
        // sending here. A failure in this block must never prevent boot.
        try {
            const ScormAwarenessEmailCampaign = require('./models/scorm/ScormAwarenessEmailCampaign');
            const stuck = await ScormAwarenessEmailCampaign.findAll({ where: { status: 'sending' } });
            for (const campaign of stuck) {
                const sent = Number(campaign.sentCount || 0);
                const failed = Number(campaign.failedCount || 0);
                campaign.status = 'stopped';
                campaign.endedAt = new Date();
                campaign.lastError =
                    `Server restarted during delivery; sent=${sent} failed=${failed} — review before re-sending`;
                await campaign.save();
            }
            if (stuck.length > 0) {
                logger.info('awareness_email_campaign_crash_recovery', {
                    module: 'awareness',
                    recovered: stuck.length
                });
            }
        } catch (recoveryErr) {
            logger.warn('awareness_email_campaign_crash_recovery_failed', {
                module: 'awareness',
                error: recoveryErr.message
            });
        }

        if (process.env.NODE_ENV === 'test') {
            const { seedTestFixtures } = require('./tests/fixtures');
            await seedTestFixtures();
        }

        app.use('/api/auth', require('./routes/auth'));
        app.use('/api/account', require('./routes/account'));
        app.use('/api/player', require('./routes/playerAuth'));
        app.use('/api/quizzes', require('./routes/quizzes'));
        app.use('/api/sessions', require('./routes/sessions'));
        app.use('/api/jobs', require('./routes/jobs'));
        app.use('/api/metrics', require('./routes/metrics'));

        // Public learner identity/dashboard API is intentionally separate from
        // the SCORM administrator middleware. Every learner operation has its own
        // assignment-bound JWT checks in ScormLearnerAuthService.
        app.use('/api/scorm-learner', require('./routes/scormLearner'));

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
        // routes/scorm/runtime.js itself. Resolve the same workspace identity used
        // by HTTP middleware so co-admin sockets cannot fall back to a separate
        // userId partition and tokens cannot subscribe to another workspace's course.
        try {
            const jwt = require('jsonwebtoken');
            const User = require('./models/User');
            const { ScormCourse } = require('./models/scorm');
            const { getAccessRole } = require('./services/scorm/ScormAccessService');
            const { resolveWorkspaceContext } = require('./services/scorm/ScormWorkspaceService');
            const { assertActiveAccount } = require('./services/AccountProfileService');
            // JWT_SECRET comes from server/config/jwtSecret.js (required at the top
            // of this file); no fallback is used anywhere in this process.
            io.on('connection', (socket) => {
                socket.on('join_scorm_course', async (payload) => {
                    try {
                        const courseId = payload && payload.courseId;
                        const token = payload && payload.token;
                        if (!courseId || !token) return;
                        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
                        if (!decoded?.userId || decoded.scope !== 'scorm') return;
                        const user = assertActiveAccount(await User.findByPk(decoded.userId));
                        if (Number(decoded.authVersion || 0) !== Number(user.authVersion || 0)) return;
                        const role = await getAccessRole(user.email);
                        if (!role) return;
                        const workspaceContext = await resolveWorkspaceContext({ user, role });
                        const course = await ScormCourse.findOne({
                            where: { id: courseId, hostId: workspaceContext.hostId },
                            attributes: ['id']
                        });
                        if (!course) return;

                        socket.join(`scorm_course_${courseId}`);
                        socket.data = {
                            ...(socket.data || {}),
                            scormCourseId: courseId,
                            scormHostId: workspaceContext.hostId,
                            scormActorUserId: user.id,
                            scormRole: workspaceContext.role
                        };
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

        // Global error-handling middleware (4 args). Registered after every
        // route so any next(err) — e.g. from the asyncHandler wrappers or a DB
        // blip mid-request — lands here instead of crashing the process or
        // hanging the socket. Stack traces are only exposed outside production.
        // eslint-disable-next-line no-unused-vars
        app.use((err, req, res, next) => {
            logger.error('unhandled_request_error', {
                module: 'http',
                method: req.method,
                url: req.originalUrl,
                error: err && err.message,
                stack: err && err.stack
            });
            if (res.headersSent) return next(err);
            const rawStatus = Number(err && err.status);
            const status = rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;
            const body = status >= 500
                ? { error: 'Internal server error' }
                : { error: (err && err.message) || 'Bad request' };
            if (String(process.env.NODE_ENV || '').toLowerCase() !== 'production') {
                body.message = err && err.message;
                body.stack = err && err.stack;
            }
            res.status(status).json(body);
        });

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
