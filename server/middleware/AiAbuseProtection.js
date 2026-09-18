const rateLimit = require('express-rate-limit');

function envLimit(name, fallback) {
    const parsed = Number(process.env[name]);
    return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : fallback;
}

function aiRateLimit({ name, envName, limit, windowMs = 60 * 60 * 1000 }) {
    return rateLimit({
        windowMs,
        limit: envLimit(envName, limit),
        standardHeaders: true,
        legacyHeaders: false,
        skip: () => process.env.NODE_ENV === 'test',
        keyGenerator: (req) => `${name}:user:${req.authenticatedUserId || req.userId || 'unauthenticated'}`,
        handler: (_req, res) => res.status(429).json({
            message: 'Too many AI requests. Please wait before trying again.',
            code: 'AI_RATE_LIMITED'
        })
    });
}

const aiCourseLimiter = aiRateLimit({ name: 'course', envName: 'AI_COURSE_HOURLY_LIMIT', limit: 6 });
const aiQuizLimiter = aiRateLimit({ name: 'quiz', envName: 'AI_QUIZ_HOURLY_LIMIT', limit: 20 });
const aiAnalysisLimiter = aiRateLimit({ name: 'analysis', envName: 'AI_ANALYSIS_HOURLY_LIMIT', limit: 10 });
const aiUploadLimiter = aiRateLimit({ name: 'upload', envName: 'AI_UPLOAD_HOURLY_LIMIT', limit: 30 });
const aiHealthLimiter = aiRateLimit({ name: 'health', envName: 'AI_HEALTH_HOURLY_LIMIT', limit: 6 });

module.exports = {
    aiCourseLimiter,
    aiQuizLimiter,
    aiAnalysisLimiter,
    aiUploadLimiter,
    aiHealthLimiter
};
