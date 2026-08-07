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

const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const io = new Server(server, {
    cors: {
        origin: CORS_ORIGIN,
        methods: ["GET", "POST"]
    }
});

// Redis Adapter for Horizontal Scaling (Optional)
if (process.env.REDIS_URL) {
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
    origin: (origin, callback) => {
        callback(null, true);
    },
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const startServer = async () => {
    app.get(['/api', '/api/', '/health'], (req, res) => {
        res.json({
            message: 'Kahoot Awareness Backend is running 🚀',
            status: 'healthy',
            timestamp: new Date().toISOString()
        });
    });

    try {
        await connectDB();

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

        // SCORM World live roster (Wave 2)
        try {
            const ScormRealtime = require('./services/scorm/ScormRealtime');
            ScormRealtime.setIO(io);
        } catch (e) {
            logger.warn('scorm_realtime_init_failed', { module: 'scorm', error: e.message });
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
