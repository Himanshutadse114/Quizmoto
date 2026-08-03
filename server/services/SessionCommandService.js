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
     * Execute a single state-changing command against a session.
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

        return this._runPipeline({
            commandId,
            commandType,
            sessionId,
            pin,
            expectedStateVersion,
            actorId,
            actorType,
            correlationId,
            steps: [{ toState, payload, eventType: commandType }]
        });
    }

    /**
     * Host start_question equivalent: advance to QUESTION_OPEN with a new Round.
     * Applies the legal multi-step path from the current V2/legacy state.
     * One commandId covers the whole pipeline (idempotent double-click safe).
     */
    static async executeStartQuestion(params) {
        const {
            commandId,
            sessionId,
            pin,
            expectedStateVersion,
            actorId,
            actorType = 'host',
            questionIndex,
            questionStartTime,
            force = false
        } = params;

        if (!force && !this.isEnabled()) {
            return {
                ok: false,
                code: 'FEATURE_DISABLED',
                message: 'new_session_engine is disabled'
            };
        }

        if (!commandId || !actorId || questionIndex == null) {
            return {
                ok: false,
                code: 'VALIDATION_ERROR',
                message: 'commandId, actorId, and questionIndex are required'
            };
        }

        // Resolve current state first (read-only) to build the step list
        const where = sessionId != null ? { id: sessionId } : { pin: String(pin) };
        const session = await GameSession.findOne({ where });
        if (!session) {
            return { ok: false, code: 'SESSION_NOT_FOUND' };
        }

        const fromState = session.state || SessionStateMachine.fromLegacyStatus(session.status);

        if (fromState === 'QUESTION_OPEN' || fromState === 'QUESTION_COUNTDOWN') {
            return {
                ok: false,
                code: 'ALREADY_IN_PROGRESS',
                fromState,
                stateVersion: Number(session.stateVersion || 0)
            };
        }

        const startTime = questionStartTime || (Date.now() + 3000);
        const openPayload = {
            createRound: true,
            questionIndex,
            questionStartTime: startTime,
            questionOpensAt: startTime
        };

        /** @type {Array<{toState: string, payload?: object, eventType: string}>} */
        let steps = [];

        if (fromState === 'LOBBY' || fromState === 'CREATED') {
            steps = [
                { toState: 'STARTING', eventType: 'START_SESSION', payload: {} },
                { toState: 'QUESTION_COUNTDOWN', eventType: 'QUESTION_COUNTDOWN', payload: { questionIndex } },
                { toState: 'QUESTION_OPEN', eventType: 'OPEN_QUESTION', payload: openPayload }
            ];
        } else if (
            fromState === 'ANSWER_REVEAL' ||
            fromState === 'LEADERBOARD' ||
            fromState === 'NEXT_ROUND_READY' ||
            fromState === 'PAUSED'
        ) {
            // Normalize toward next round then open
            if (fromState === 'ANSWER_REVEAL') {
                steps.push({ toState: 'NEXT_ROUND_READY', eventType: 'NEXT_ROUND_READY', payload: {} });
            } else if (fromState === 'LEADERBOARD') {
                steps.push({ toState: 'NEXT_ROUND_READY', eventType: 'NEXT_ROUND_READY', payload: {} });
            } else if (fromState === 'PAUSED') {
                // Resume into next-round ready then open
                steps.push({ toState: 'NEXT_ROUND_READY', eventType: 'RESUME_TO_NEXT', payload: {} });
            }
            steps.push(
                { toState: 'QUESTION_COUNTDOWN', eventType: 'QUESTION_COUNTDOWN', payload: { questionIndex } },
                { toState: 'QUESTION_OPEN', eventType: 'OPEN_QUESTION', payload: openPayload }
            );
        } else {
            return {
                ok: false,
                code: 'TRANSITION_NOT_ALLOWED',
                fromState,
                message: `Cannot start question from ${fromState}`
            };
        }

        return this._runPipeline({
            commandId,
            commandType: 'START_QUESTION',
            sessionId: session.id,
            pin: session.pin,
            expectedStateVersion,
            actorId,
            actorType,
            correlationId: commandId,
            steps
        });
    }

    /**
     * Host end_question equivalent: QUESTION_OPEN -> QUESTION_LOCKED -> ANSWER_REVEAL.
     */
    static async executeEndQuestion(params) {
        const {
            commandId,
            sessionId,
            pin,
            expectedStateVersion,
            actorId,
            actorType = 'host',
            force = false
        } = params;

        if (!force && !this.isEnabled()) {
            return {
                ok: false,
                code: 'FEATURE_DISABLED',
                message: 'new_session_engine is disabled'
            };
        }

        if (!commandId || !actorId) {
            return {
                ok: false,
                code: 'VALIDATION_ERROR',
                message: 'commandId and actorId are required'
            };
        }

        const where = sessionId != null ? { id: sessionId } : { pin: String(pin) };
        const session = await GameSession.findOne({ where });
        if (!session) {
            return { ok: false, code: 'SESSION_NOT_FOUND' };
        }

        const fromState = session.state || SessionStateMachine.fromLegacyStatus(session.status);
        if (fromState !== 'QUESTION_OPEN' && fromState !== 'QUESTION_LOCKED') {
            return {
                ok: false,
                code: 'TRANSITION_NOT_ALLOWED',
                fromState,
                message: `Cannot end question from ${fromState}`
            };
        }

        const steps = [];
        if (fromState === 'QUESTION_OPEN') {
            steps.push({ toState: 'QUESTION_LOCKED', eventType: 'LOCK_QUESTION', payload: {} });
        }
        steps.push({ toState: 'ANSWER_REVEAL', eventType: 'REVEAL_ANSWER', payload: {} });

        return this._runPipeline({
            commandId,
            commandType: 'END_QUESTION',
            sessionId: session.id,
            pin: session.pin,
            expectedStateVersion,
            actorId,
            actorType,
            correlationId: commandId,
            steps
        });
    }

    /**
     * Host end_game: transition to FINISHED from an allowed non-terminal state.
     */
    static async executeEndGame(params) {
        const {
            commandId,
            sessionId,
            pin,
            expectedStateVersion,
            actorId,
            actorType = 'host',
            force = false
        } = params;

        if (!force && !this.isEnabled()) {
            return {
                ok: false,
                code: 'FEATURE_DISABLED',
                message: 'new_session_engine is disabled'
            };
        }

        if (!commandId || !actorId) {
            return {
                ok: false,
                code: 'VALIDATION_ERROR',
                message: 'commandId and actorId are required'
            };
        }

        const where = sessionId != null ? { id: sessionId } : { pin: String(pin) };
        const session = await GameSession.findOne({ where });
        if (!session) {
            return { ok: false, code: 'SESSION_NOT_FOUND' };
        }

        const fromState = session.state || SessionStateMachine.fromLegacyStatus(session.status);
        if (SessionStateMachine.isTerminal(fromState)) {
            return {
                ok: false,
                code: 'TERMINAL_STATE',
                fromState,
                stateVersion: Number(session.stateVersion || 0)
            };
        }

        // Prefer a legal path into FINISHED
        const steps = [];
        if (fromState === 'QUESTION_OPEN') {
            steps.push(
                { toState: 'QUESTION_LOCKED', eventType: 'LOCK_QUESTION', payload: {} },
                { toState: 'ANSWER_REVEAL', eventType: 'REVEAL_ANSWER', payload: {} }
            );
        } else if (fromState === 'QUESTION_LOCKED') {
            steps.push({ toState: 'ANSWER_REVEAL', eventType: 'REVEAL_ANSWER', payload: {} });
        }

        const mid = steps.length
            ? steps[steps.length - 1].toState
            : fromState;

        if (mid === 'ANSWER_REVEAL' || mid === 'LEADERBOARD' || mid === 'NEXT_ROUND_READY') {
            steps.push(
                { toState: 'FINISHING', eventType: 'FINISHING', payload: {} },
                { toState: 'FINISHED', eventType: 'FINISH_GAME', payload: {} }
            );
        } else if (mid === 'LOBBY' || mid === 'STARTING' || mid === 'PAUSED') {
            steps.push({ toState: 'CANCELLED', eventType: 'CANCEL_GAME', payload: {} });
        } else if (mid === 'FINISHING') {
            steps.push({ toState: 'FINISHED', eventType: 'FINISH_GAME', payload: {} });
        } else {
            return {
                ok: false,
                code: 'TRANSITION_NOT_ALLOWED',
                fromState,
                message: `Cannot end game from ${fromState}`
            };
        }

        return this._runPipeline({
            commandId,
            commandType: 'END_GAME',
            sessionId: session.id,
            pin: session.pin,
            expectedStateVersion,
            actorId,
            actorType,
            correlationId: commandId,
            steps
        });
    }

    static async startSession(params) {
        return this.execute({
            ...params,
            commandType: params.commandType || 'START_SESSION',
            toState: 'STARTING'
        });
    }

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
        return this.execute({
            ...params,
            commandType: params.commandType || 'FINISH_GAME',
            toState: params.toState || 'FINISHED'
        });
    }

    /**
     * Apply one or more transitions under a single commandId (one idempotency record).
     * @private
     */
    static async _runPipeline({
        commandId,
        commandType,
        sessionId,
        pin,
        expectedStateVersion,
        actorId,
        actorType = 'host',
        correlationId = null,
        steps
    }) {
        const requestHash = hashRequest({
            commandType,
            sessionId,
            pin,
            expectedStateVersion,
            steps: steps.map((s) => ({ toState: s.toState, payload: s.payload || {} }))
        });

        try {
            return await sequelize.transaction(async (t) => {
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

                let fromState = session.state || SessionStateMachine.fromLegacyStatus(session.status);
                if (!session.state) {
                    session.state = fromState;
                }
                let currentVersion = Number(session.stateVersion || 0);

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

                const applied = [];
                let activeRoundId = session.activeRoundId;
                const initialFrom = fromState;

                for (const step of steps) {
                    const transition = SessionStateMachine.canTransition(fromState, step.toState);
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
                                toState: step.toState,
                                appliedSteps: applied
                            }
                        });
                    }

                    currentVersion += 1;
                    const now = new Date();
                    const payload = step.payload || {};

                    session.state = step.toState;
                    session.stateVersion = currentVersion;
                    session.stateEnteredAt = now;
                    session.status = SessionStateMachine.toLegacyStatus(step.toState);
                    session.lastErrorCode = null;

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

                    if (payload.createRound) {
                        activeRoundId = newId();
                        await Round.create({
                            sessionId: session.id,
                            roundId: activeRoundId,
                            questionIndex: payload.questionIndex != null
                                ? payload.questionIndex
                                : session.currentQuestionIndex,
                            status: step.toState,
                            opensAt: payload.questionOpensAt ? new Date(payload.questionOpensAt) : null,
                            closesAt: payload.questionClosesAt ? new Date(payload.questionClosesAt) : null
                        }, { transaction: t });
                        session.activeRoundId = activeRoundId;
                    }

                    const nextSequence = Number(session.lastEventSequence || 0) + 1;
                    session.lastEventSequence = nextSequence;
                    await session.save({ transaction: t });

                    const eventId = newId();
                    await SessionEvent.create({
                        sessionId: session.id,
                        sequence: nextSequence,
                        eventType: step.eventType || commandType,
                        stateVersion: currentVersion,
                        roundId: activeRoundId || null,
                        actorType,
                        actorId: String(actorId),
                        payloadJson: {
                            eventId,
                            fromState,
                            toState: step.toState,
                            ...payload
                        },
                        correlationId: correlationId || commandId
                    }, { transaction: t });

                    applied.push({
                        fromState,
                        toState: step.toState,
                        stateVersion: currentVersion,
                        eventId
                    });
                    fromState = step.toState;
                }

                const finalStep = applied[applied.length - 1];
                const successPayload = {
                    ok: true,
                    code: 'ACCEPTED',
                    sessionId: session.id,
                    pin: session.pin,
                    fromState: initialFrom,
                    toState: finalStep.toState,
                    stateVersion: finalStep.stateVersion,
                    legacyStatus: session.status,
                    activeRoundId: activeRoundId || null,
                    lastEventSequence: Number(session.lastEventSequence),
                    eventId: finalStep.eventId,
                    appliedSteps: applied,
                    questionIndex: session.currentQuestionIndex,
                    questionStartTime: session.questionStartTime
                        ? session.questionStartTime.getTime()
                        : null,
                    serverTime: new Date().toISOString()
                };

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
