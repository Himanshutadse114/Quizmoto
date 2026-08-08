const jwt = require('jsonwebtoken');

const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
if (isProduction && !process.env.JWT_SECRET) {
    const err = new Error('JWT_SECRET is required for Live Quiz authentication in production');
    err.code = 'PROD_JWT_SECRET_MISSING';
    throw err;
}

// Tests and local development retain the historical fallback so fixtures do not
// need production secrets. Production is forced to use an explicit secret above.
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

/**
 * Pure, isolated authorization service to decouple JWT verification
 * and role-checks from Socket.IO handlers.
 */
class SessionTokenService {
    /**
     * Verifies a host JWT token.
     * @param {string} token
     * @returns {number|null} The host's userId, or null if invalid
     */
    static verifyHostToken(token) {
        if (!token) return null;
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            return decoded.userId;
        } catch (err) {
            return null;
        }
    }

    /**
     * Verifies a player JWT token (created upon join_room).
     * @param {string} token
     * @returns {Object|null} The decoded player payload { sessionId, nickname, playerId }, or null if invalid
     */
    static verifyPlayerToken(token) {
        if (!token) return null;
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return null;
        }
    }

    /**
     * Generates a persistent token for a player joining a session.
     * @param {number} sessionId
     * @param {number} playerId
     * @param {string} nickname
     * @returns {string} Signed JWT
     */
    static generatePlayerToken(sessionId, playerId, nickname) {
        return jwt.sign(
            { sessionId, nickname, playerId },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
    }
}

module.exports = SessionTokenService;
