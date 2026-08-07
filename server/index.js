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
    },
    // Mobile / flaky networks: avoid aggressive disconnects mid-quiz
    pingInterval: 10000,
    pingTimeout: 45000,
    connectTimeout: 20000
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

app.set('trust proxy', 1);

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: CORS_ORIGIN,
    credentials: true
}));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        Metrics.httpRequest(req.method, req.path, res.statusCode, Date.now() - start);
        logger.info('http_request', {
            module: 'http',
            method: req.method,
            path: req.path,
            status: res.statusCode,
            durationMs: Date.now() - start
        });
    });
    next();
});

app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/api/metrics', (req, res) => res.json(Metrics.snapshot()));

const authRoutes = require('./routes/auth');
const quizRoutes = require('./routes/quizzes');
const reportRoutes = require('./routes/reports');
const jobRoutes = require('./routes/jobs');
const scormRoutes = require('./routes/scorm');

app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/scorm', scormRoutes);

require('./services/socketHandlers')(io);

// SCORM realtime (host roster) — same process, separate event names
try {
    const ScormRealtime = require('./services/scorm/ScormRealtime');
    ScormRealtime.attach(io);
} catch (e) {
    logger.warn('scorm_realtime_attach_skipped', { module: 'scorm', error: e.message });
}

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();
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
