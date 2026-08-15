const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
    getAccessRole,
    accessDeniedPayload
} = require('../services/scorm/ScormAccessService');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

module.exports = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const url = String(req.originalUrl || req.baseUrl || '');
        const isScormAdminRequest = url.startsWith('/api/scorm/');

        // SCORM AI is a separately gated authoring workspace. Public learner
        // endpoints do not use this middleware; protected admin endpoints that do
        // must carry a SCORM token AND still have a live access grant. This second
        // check means removing an email from the allowlist revokes existing tokens.
        if (isScormAdminRequest && process.env.NODE_ENV !== 'test') {
            if (decoded.scope !== 'scorm') {
                return res.status(401).json({ message: 'SCORM AI login required', code: 'SCORM_AUTH_REQUIRED' });
            }

            const user = await User.findByPk(decoded.userId);
            if (!user) {
                return res.status(401).json({ message: 'SCORM AI account no longer exists.', code: 'SCORM_AUTH_REQUIRED' });
            }

            const role = await getAccessRole(user.email);
            if (!role) return res.status(403).json(accessDeniedPayload());

            req.scormRole = role;
            req.scormEmail = user.email || null;
        }

        req.userId = decoded.userId;
        req.authScope = decoded.scope || null;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};
