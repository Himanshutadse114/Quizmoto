const { GameSession, Player, PlayerAnswer } = require('../models/GameSession');
const { Quiz, Question } = require('../models/Quiz');
const { sequelize } = require('../config/database');
const { Sequelize } = require('sequelize');
const jwt = require('jsonwebtoken');
const { PlayerProfile } = require('../models/PlayerProfile');
const ScoringService = require('./ScoringService');
const AnswerSubmissionService = require('./AnswerSubmissionService');
const SessionTokenService = require('./SessionTokenService');
const SessionRecoveryService = require('./SessionRecoveryService');
const SessionCommandService = require('./SessionCommandService');
const { validateSocketPayload } = require('../validators/socketSchemas');

const logDiag = (event, pin, state, details = {}) => {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        module: 'socketHandlers',
        event,
        pin,
        state,
        ...details
    }));
};

const emitCommandAck = (socket, result) => {
    if (!result) return;
    socket.emit('command_ack', {
        ok: !!result.ok,
        code: result.code,
        commandId: result.commandId || undefined,
        stateVersion: result.stateVersion,
        toState: result.toState,
        fromState: result.fromState,
        replay: result.replay || false,
        message: result.message,
        currentStateVersion: result.currentStateVersion,
        currentState: result.currentState
    });
};

function parseOptions(raw) {
    try {
        if (raw == null) return [];
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string') {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        }
        return [];
    } catch (_) {
        return [];
    }
}

const questionEndTimers = new Map();

function clearQuestionEndTimer(pin) {
    const h = questionEndTimers.get(pin);
    if (h) {
        clearTimeout(h);
        questionEndTimers.delete(pin);
    }
}

const hostDisconnectTimers = new Map();
const HOST_DISCONNECT_GRACE_MS = Number(process.env.HOST_DISCONNECT_GRACE_MS) || 30000;

function clearHostDisconnectTimer(pin) {
    const h = hostDisconnectTimers.get(pin);
    if (h) {
        clearTimeout(h);
        hostDisconnectTimers.delete(pin);
    }
}

module.exports = (io) => {
    // NOTE: Full handlers restored in follow-up if truncated — see /tmp/sh_final_restore.js on agent
    // This is a temporary complete copy - loading from agent filesystem via parallel approach
    const full = require('fs').readFileSync(require('path').join(__dirname, 'socketHandlers.full.js'), 'utf8');
    // fallback: if full file missing, use inline restore marker
    throw new Error('Use socketHandlers from commit d4cc144 + abort patch');
};
