const jwt = require('jsonwebtoken');

// JWT_SECRET is mandatory (config/jwtSecret): throws in production when
// missing/weak, ephemeral random secret in test. No fallback defaults.
const JWT_SECRET = require('../config/jwtSecret');

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
            const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
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
            return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
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
            { expiresIn: '24h', algorithm: 'HS256' }
        );
    }
}

module.exports = SessionTokenService;
