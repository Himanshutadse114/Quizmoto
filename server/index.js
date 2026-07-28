require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { connectDB } = require('./config/database');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

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
        console.log('Socket.IO Redis Adapter connected 🚀');
    }).catch(err => {
        console.error('Socket.IO Redis Adapter connection failed:', err);
    });
}

// Middleware (Enhanced for Debugging)
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
    });
    next();
});

app.use(cors({
    origin: (origin, callback) => {
        // Reflect origin to satisfy credentials: true
        callback(null, true);
    },
    credentials: true
}));

app.use(express.json());



// DB Connection & Start Server
const startServer = async () => {
    // Health Check / Root Route (Moved here for better visibility)
    app.get(['/api', '/api/', '/health'], (req, res) => {
        res.json({ 
            message: 'Kahoot Awareness Backend is running 🚀', 
            status: 'healthy',
            timestamp: new Date().toISOString()
        });
    });

    try {
        await connectDB();

        // Routes
        app.use('/api/auth', require('./routes/auth'));
        app.use('/api/player', require('./routes/playerAuth'));
        app.use('/api/quizzes', require('./routes/quizzes'));

        // Socket.io Logic
        const socketHandlers = require('./services/socketHandlers');
        socketHandlers(io);

        const PORT = process.env.PORT || 5001;
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

startServer();
