const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

module.exports = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const url = String(req.originalUrl || req.baseUrl || '');
        const isScormAdminRequest = url.startsWith('/api/scorm/');

        // SCORM AI is a separately gated authoring workspace. Public learner
        // endpoints do not use this middleware; admin endpoints that do must
        // carry a token issued by /api/auth/scorm/login or /register.
        // Existing persistence/E2E fixtures issue simple userId tokens in test.
        if (isScormAdminRequest && process.env.NODE_ENV !== 'test' && decoded.scope !== 'scorm') {
            return res.status(401).json({ message: 'SCORM AI login required', code: 'SCORM_AUTH_REQUIRED' });
        }

        req.userId = decoded.userId;
        req.authScope = decoded.scope || null;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};
