const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { GameSession, Player } = require('../models/GameSession');
const { Quiz, Question } = require('../models/Quiz');
const SessionTokenService = require('../services/SessionTokenService');
const SessionRecoveryService = require('../services/SessionRecoveryService');

const recoveryLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many recovery requests, try again shortly' }
});

/**
 * Resolve auth from Authorization Bearer token.
 * Supports host JWT ({ userId }) and player session JWT ({ sessionId, playerId, nickname }).
 */
function resolveAuth(req) {
    const header = req.header('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim();
    if (!token) {
        return { error: 'NO_TOKEN', status: 401, message: 'No token, authorization denied' };
    }

    const hostId = SessionTokenService.verifyHostToken(token);
    if (hostId) {
        return { roleHint: 'host', hostId, token };
    }

    const playerClaims = SessionTokenService.verifyPlayerToken(token);
    if (playerClaims && playerClaims.sessionId != null) {
        return { roleHint: 'player', playerClaims, token };
    }

    return { error: 'INVALID_TOKEN', status: 401, message: 'Token is not valid' };
}

/**
 * GET /api/sessions/:id/recovery
 * Canonical reconnect endpoint (Phase 2).
 *
 * Auth: Bearer host JWT or player session JWT.
 * Optional query: role=host|player (must match token capability).
 */
router.get('/:id/recovery', recoveryLimiter, async (req, res) => {
    try {
        const auth = resolveAuth(req);
        if (auth.error) {
            return res.status(auth.status).json({ code: auth.error, message: auth.message });
        }

        const sessionId = parseInt(req.params.id, 10);
        if (!Number.isFinite(sessionId) || sessionId <= 0) {
            return res.status(400).json({ code: 'INVALID_SESSION_ID', message: 'Invalid session id' });
        }

        const requestedRole = (req.query.role || auth.roleHint || '').toLowerCase();
        if (requestedRole !== 'host' && requestedRole !== 'player') {
            return res.status(400).json({
                code: 'INVALID_ROLE',
                message: 'role must be host or player'
            });
        }

        if (requestedRole === 'host' && auth.roleHint !== 'host') {
            return res.status(403).json({
                code: 'FORBIDDEN',
                message: 'Host token required for host recovery'
            });
        }
        if (requestedRole === 'player' && auth.roleHint !== 'player') {
            return res.status(403).json({
                code: 'FORBIDDEN',
                message: 'Player token required for player recovery'
            });
        }

        // Load presence alongside the session. Player recovery never serializes
        // other players, while host recovery can reconstruct answer counts and
        // distribution after a refresh/reconnect.
        const session = await GameSession.findByPk(sessionId, {
            include: [{ model: Player, as: 'players' }]
        });
        if (!session) {
            return res.status(404).json({ code: 'SESSION_NOT_FOUND', message: 'Session not found' });
        }

        if (requestedRole === 'host' && Number(session.hostId) !== Number(auth.hostId)) {
            return res.status(403).json({
                code: 'FORBIDDEN',
                message: 'Not the host of this session'
            });
        }

        let player = null;
        if (requestedRole === 'player') {
            if (Number(auth.playerClaims.sessionId) !== Number(session.id)) {
                return res.status(403).json({
                    code: 'FORBIDDEN',
                    message: 'Player token does not match this session'
                });
            }

            player = await Player.findOne({
                where: {
                    sessionId: session.id,
                    id: auth.playerClaims.playerId
                }
            });

            if (!player && auth.playerClaims.nickname) {
                player = await Player.findOne({
                    where: {
                        sessionId: session.id,
                        nickname: auth.playerClaims.nickname
                    }
                });
            }

            if (!player) {
                return res.status(404).json({
                    code: 'PLAYER_NOT_FOUND',
                    message: 'Player not found in this session'
                });
            }
        }

        const quiz = await Quiz.findByPk(session.quizId, {
            include: [{ model: Question, as: 'questions' }],
            order: [[{ model: Question, as: 'questions' }, 'id', 'ASC']]
        });

        if (!quiz) {
            return res.status(404).json({ code: 'QUIZ_NOT_FOUND', message: 'Quiz not found' });
        }

        const body = SessionRecoveryService.buildCanonicalRecovery({
            role: requestedRole,
            session,
            quiz,
            player,
            serverTime: Date.now()
        });

        return res.json(body);
    } catch (err) {
        console.error('Session recovery error:', err);
        if (err.code === 'INVALID_ROLE' || err.code === 'PLAYER_REQUIRED') {
            return res.status(400).json({ code: err.code, message: err.message });
        }
        return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Recovery failed' });
    }
});

module.exports = router;
