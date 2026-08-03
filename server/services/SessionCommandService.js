const crypto = require('crypto');
const { sequelize } = require('../config/database');
const {
    GameSession,
    Round,
    SessionEvent,
    IdempotencyRecord
} = require('../models/GameSession');
const { SessionStateMachine } = require('./SessionStateMachine');
const { featureFlags } = require('../config/featureFlags');

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function hashRequest(payload) {
    return crypto
        .createHash('sha256')
        .update(JSON.stringify(payload || {}))
        .digest('hex')
        .slice(0, 64);
}

function newId() {
    return crypto.randomUUID();
}

/**
 * Transactional session command executor (Phase 2).
 * Used only when NEW_SESSION_ENGINE is enabled (or when callers pass force: true in tests).
 * Dual-writes legacy `status` so old clients remain compatible during rollout.
 */
class SessionCommandService {
    static isEnabled() {
        return featureFlags.newSessionEngine;
    }

    /**
     * Execute a state-changing command against a session.
     *
     * @param {Object} params
     * @param {string} params.commandId - Client-generated UUID (idempotency key)
     * @param {string} params.commandType - e.g. START_SESSION, LOCK_QUESTION, FINISH_GAME
     * @param {number|string} params.sessionId - GameSession primary key
     * @param {string} [params.pin] - Optional pin lookup if sessionId not used alone
     * @param {number|null} params.expectedStateVersion - Optimistic concurrency; null skips check
     * @param {string} params.toState - Target V2 state
     * @param {string} params.actorId - Host/player identity string
     * @param {string} [params.actorType='host']
     * @param {Object} [params.payload={}] - Extra fields (e.g. questionIndex)
     * @param {string} [params.correlationId]
     * @param {boolean} [params.force=false] - Bypass feature flag (tests only)
     * @returns {Promise<Object>} Result envelope
     */
    static async execute(params) {
        const {
            commandId,
            commandType,
            sessionId,
            pin,
            expectedStateVersion,
            toState,
            actorId,
            actorType = 'host',
            payload = {},
            correlationId = null,
            force = false
        } = params;

        if (!force && !this.isEnabled()) {
            return {
                ok: false,
                code: 'FEATURE_DISABLED',
                message: 'new_session_engine is disabled'
            };
        }

        if (!commandId || !commandType || !toState || !actorId) {
            return {
                ok: false,
                code: 'VALIDATION_ERROR',
                message: 'commandId, commandType, toState, and actorId are required'
            };
        }

        if (!SessionStateMachine.isValidState(toState)) {
            return {
                ok: false,
                code: 'INVALID_TO_STATE',
                message: `Unknown target state: ${toState}`
            };
        }

        const requestHash = hashRequest({
            commandType,
            sessionId,
            pin,
            expectedStateVersion,
            toState,
            payload
        });

        try {
            return await sequelize.transaction(async (t) => {
                // 1. Idempotency: same commandId returns original result
                const existing = await IdempotencyRecord.findOne({
                    where: { commandId },
                    transaction: t,
                    lock: t.LOCK.UPDATE
                });

                if (existing) {
                    if (existing.requestHash && existing.requestHash !== requestHash) {
                        return {
                            ok: false,
                            code: 'IDEMPOTENCY_KEY_REUSED',
                            message: 'commandId was reused with a different payload'
                        };
                    }
                    return {
                        ok: true,
                        code: existing.resultCode === 'ACCEPTED' ? 'DUPLICATE' : existing.resultCode,
                        replay: true,
                        result: existing.resultPayload
                    };
                }

                // 2. Load and lock session
                const where = sessionId != null ? { id: sessionId } : { pin: String(pin) };
                const session = await GameSession.findOne({
                    where,
                    transaction: t,
                    lock: t.LOCK.UPDATE
                });

                if (!session) {
                    return this._reject(t, {
                        commandId,
                        actorId,
                        sessionId: sessionId || 0,
                        commandType,
                        requestHash,
                        resultCode: 'SESSION_NOT_FOUND',
                        resultPayload: { ok: false, code: 'SESSION_NOT_FOUND' }
                    });
                }

                // Ensure V2 fields are initialized from legacy if needed
                let fromState = session.state || SessionStateMachine.fromLegacyStatus(session.status);
                if (!session.state) {
                    session.state = fromState;
                }
                const currentVersion = Number(session.stateVersion || 0);

                // 3. Optimistic concurrency
                if (expectedStateVersion != null && Number(expectedStateVersion) !== currentVersion) {
                    return this._reject(t, {
                        commandId,
                        actorId,
                        sessionId: session.id,
                        commandType,
                        requestHash,
                        resultCode: 'SESSION_STATE_CONFLICT',
                        resultPayload: {
                            ok: false,
                            code: 'SESSION_STATE_CONFLICT',
                            currentStateVersion: currentVersion,
                            currentState: fromState
                        }
                    });
                }

                // 4. State machine validation
                const transition = SessionStateMachine.canTransition(fromState, toState);
                if (!transition.allowed) {
                    return this._reject(t, {
                        commandId,
                        actorId,
                        sessionId: session.id,
                        commandType,
                        requestHash,
                        resultCode: transition.reason || 'TRANSITION_NOT_ALLOWED',
                        resultPayload: {
                            ok: false,
                            code: transition.reason || 'TRANSITION_NOT_ALLOWED',
                            fromState,
                            toState
                        }
                    });
                }

                // 5. Apply transition + dual-write legacy status
                const newVersion = currentVersion + 1;
                const now = new Date();
                const legacyStatus = SessionStateMachine.toLegacyStatus(toState);

                session.state = toState;
                session.stateVersion = newVersion;
                session.stateEnteredAt = now;
                session.status = legacyStatus;
                session.lastErrorCode = null;

                // Optional timing / round bookkeeping from payload
                if (payload.questionIndex != null) {
                    session.currentQuestionIndex = payload.questionIndex;
                }
                if (payload.questionStartTime != null) {
                    session.questionStartTime = new Date(payload.questionStartTime);
                }
                if (payload.questionOpensAt != null) {
                    session.questionOpensAt = new Date(payload.questionOpensAt);
                }
                if (payload.questionClosesAt != null) {
                    session.questionClosesAt = new Date(payload.questionClosesAt);
                }

                let activeRoundId = session.activeRoundId;
                if (payload.createRound) {
                    activeRoundId = newId();
                    await Round.create({
                        sessionId: session.id,
                        roundId: activeRoundId,
                        questionIndex: payload.questionIndex != null
                            ? payload.questionIndex
                            : session.currentQuestionIndex,
                        status: toState,
                        opensAt: payload.questionOpensAt ? new Date(payload.questionOpensAt) : null,
                        closesAt: payload.questionClosesAt ? new Date(payload.questionClosesAt) : null
                    }, { transaction: t });
                    session.activeRoundId = activeRoundId;
                } else if (payload.roundId) {
                    activeRoundId = payload.roundId;
                    session.activeRoundId = activeRoundId;
                }

                const nextSequence = Number(session.lastEventSequence || 0) + 1;
                session.lastEventSequence = nextSequence;

                await session.save({ transaction: t });

                // 6. Event ledger
                const eventId = newId();
                await SessionEvent.create({
                    sessionId: session.id,
                    sequence: nextSequence,
                    eventType: commandType,
                    stateVersion: newVersion,
                    roundId: activeRoundId || null,
                    actorType,
                    actorId: String(actorId),
                    payloadJson: {
                        eventId,
                        fromState,
                        toState,
                        ...payload
                    },
                    correlationId: correlationId || commandId
                }, { transaction: t });

                const successPayload = {
                    ok: true,
                    code: 'ACCEPTED',
                    sessionId: session.id,
                    pin: session.pin,
                    fromState,
                    toState,
                    stateVersion: newVersion,
                    legacyStatus,
                    activeRoundId: activeRoundId || null,
                    lastEventSequence: nextSequence,
                    eventId,
                    serverTime: now.toISOString()
                };

                // 7. Persist idempotency record
                await IdempotencyRecord.create({
                    commandId,
                    actorId: String(actorId),
                    sessionId: session.id,
                    commandType,
                    requestHash,
                    resultCode: 'ACCEPTED',
                    resultPayload: successPayload,
                    expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS)
                }, { transaction: t });

                return successPayload;
            });
        } catch (err) {
            // Unique constraint on commandId under race → treat as duplicate lookup
            if (err && (err.name === 'SequelizeUniqueConstraintError' || err.code === 'SQLITE_CONSTRAINT')) {
                const existing = await IdempotencyRecord.findOne({ where: { commandId } });
                if (existing) {
                    return {
                        ok: true,
                        code: 'DUPLICATE',
                        replay: true,
                        result: existing.resultPayload
                    };
                }
            }
            return {
                ok: false,
                code: 'INTERNAL_ERROR',
                message: err.message || 'Command failed'
            };
        }
    }

    /**
     * Convenience: LOBBY -> STARTING (start session accepted).
     */
    static async startSession(params) {
        return this.execute({
            ...params,
            commandType: params.commandType || 'START_SESSION',
            toState: 'STARTING'
        });
    }

    /**
     * STARTING -> QUESTION_COUNTDOWN or QUESTION_OPEN after first round prepared.
     */
    static async openQuestion(params) {
        const toState = params.toState || 'QUESTION_OPEN';
        return this.execute({
            ...params,
            commandType: params.commandType || 'OPEN_QUESTION',
            toState,
            payload: {
                createRound: true,
                questionIndex: params.questionIndex,
                questionStartTime: params.questionStartTime || Date.now(),
                questionOpensAt: params.questionOpensAt,
                questionClosesAt: params.questionClosesAt,
                ...(params.payload || {})
            }
        });
    }

    static async lockQuestion(params) {
        return this.execute({
            ...params,
            commandType: params.commandType || 'LOCK_QUESTION',
            toState: 'QUESTION_LOCKED'
        });
    }

    static async revealAnswer(params) {
        return this.execute({
            ...params,
            commandType: params.commandType || 'REVEAL_ANSWER',
            toState: 'ANSWER_REVEAL'
        });
    }

    static async finishGame(params) {
        // Prefer FINISHING then FINISHED; allow direct FINISHED from reveal/leaderboard paths
        return this.execute({
            ...params,
            commandType: params.commandType || 'FINISH_GAME',
            toState: params.toState || 'FINISHED'
        });
    }

    /**
     * Record a rejected command for audit/idempotency (still stores the commandId).
     * @private
     */
    static async _reject(t, {
        commandId,
        actorId,
        sessionId,
        commandType,
        requestHash,
        resultCode,
        resultPayload
    }) {
        try {
            await IdempotencyRecord.create({
                commandId,
                actorId: String(actorId),
                sessionId,
                commandType,
                requestHash,
                resultCode,
                resultPayload,
                expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS)
            }, { transaction: t });
        } catch (_) {
            // ignore unique races on reject path
        }
        return resultPayload;
    }
}

module.exports = SessionCommandService;
