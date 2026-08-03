/**
 * Phase 2 client session reducer.
 * Pure functions only — apply events only when stateVersion is newer.
 * Opt-in via VITE_NEW_SESSION_ENGINE; live pages are not required to use this yet.
 */

export const initialSessionState = {
    sessionId: null,
    pin: null,
    role: null,
    status: 'lobby',
    state: 'LOBBY',
    stateVersion: 0,
    currentQuestionIndex: -1,
    activeRoundId: null,
    question: null,
    score: 0,
    lastErrorCode: null,
    serverTimeSkewMs: 0,
    needsRecovery: false,
    lastCommandId: null
};

export function sessionReducer(state = initialSessionState, action) {
    if (!action || !action.type) return state;

    switch (action.type) {
        case 'SESSION_RESET':
            return { ...initialSessionState, ...action.payload };

        case 'SESSION_HYDRATE_FROM_RECOVERY': {
            const payload = action.payload || {};
            const incomingVersion = Number(payload.stateVersion || 0);
            if (incomingVersion < Number(state.stateVersion || 0)) {
                return state;
            }
            return {
                ...state,
                sessionId: payload.sessionId ?? state.sessionId,
                pin: payload.pin ?? state.pin,
                role: payload.role ?? state.role,
                status: payload.status ?? state.status,
                state: payload.state ?? state.state,
                stateVersion: incomingVersion,
                currentQuestionIndex:
                    payload.currentQuestionIndex != null
                        ? payload.currentQuestionIndex
                        : state.currentQuestionIndex,
                activeRoundId: payload.activeRoundId ?? state.activeRoundId,
                question:
                    payload.payload?.question ||
                    payload.payload?.currentQuestion ||
                    state.question,
                score: payload.payload?.score != null ? payload.payload.score : state.score,
                lastErrorCode: payload.lastErrorCode ?? null,
                needsRecovery: false
            };
        }

        case 'SESSION_EVENT': {
            const { stateVersion, status, state: nextState, payload } = action.payload || {};
            const incomingVersion = Number(stateVersion);
            if (!Number.isFinite(incomingVersion)) return state;
            if (incomingVersion <= Number(state.stateVersion || 0)) {
                return state; // ignore stale / duplicate
            }
            return {
                ...state,
                stateVersion: incomingVersion,
                status: status != null ? status : state.status,
                state: nextState != null ? nextState : state.state,
                currentQuestionIndex:
                    payload?.questionIndex != null
                        ? payload.questionIndex
                        : state.currentQuestionIndex,
                activeRoundId: payload?.activeRoundId ?? state.activeRoundId,
                question: payload?.question != null ? payload.question : state.question,
                needsRecovery: false
            };
        }

        case 'SESSION_COMMAND_ACK': {
            const ack = action.payload || {};
            if (ack.ok && ack.stateVersion != null) {
                const incomingVersion = Number(ack.stateVersion);
                if (incomingVersion > Number(state.stateVersion || 0)) {
                    return {
                        ...state,
                        stateVersion: incomingVersion,
                        state: ack.toState || state.state,
                        lastCommandId: ack.commandId || state.lastCommandId,
                        needsRecovery: false
                    };
                }
            }
            if (ack.code === 'SESSION_STATE_CONFLICT') {
                return { ...state, needsRecovery: true };
            }
            return state;
        }

        case 'SESSION_MARK_NEEDS_RECOVERY':
            return { ...state, needsRecovery: true };

        case 'SESSION_SET_SCORE':
            return { ...state, score: action.payload };

        case 'SESSION_SET_SKEW':
            return { ...state, serverTimeSkewMs: Number(action.payload) || 0 };

        default:
            return state;
    }
}

export function selectIsStaleEvent(state, incomingStateVersion) {
    return Number(incomingStateVersion) <= Number(state.stateVersion || 0);
}

/** Create a new client command id (UUID v4). */
export function newCommandId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
