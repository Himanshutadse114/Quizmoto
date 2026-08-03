/**
 * Pure session state machine (Phase 2).
 * No DB, Socket.IO, or global mutable state.
 */

const SESSION_STATES = Object.freeze([
    'CREATED',
    'LOBBY',
    'STARTING',
    'QUESTION_COUNTDOWN',
    'QUESTION_OPEN',
    'QUESTION_LOCKED',
    'ANSWER_REVEAL',
    'LEADERBOARD',
    'NEXT_ROUND_READY',
    'PAUSED',
    'FINISHING',
    'FINISHED',
    'CANCELLED'
]);

/** Allowed transitions: fromState -> Set of toStates */
const ALLOWED_TRANSITIONS = Object.freeze({
    CREATED: Object.freeze(['LOBBY', 'CANCELLED']),
    LOBBY: Object.freeze(['STARTING', 'CANCELLED']),
    STARTING: Object.freeze(['QUESTION_COUNTDOWN', 'PAUSED', 'CANCELLED']),
    QUESTION_COUNTDOWN: Object.freeze(['QUESTION_OPEN', 'PAUSED']),
    QUESTION_OPEN: Object.freeze(['QUESTION_LOCKED', 'PAUSED']),
    QUESTION_LOCKED: Object.freeze(['ANSWER_REVEAL', 'PAUSED']),
    ANSWER_REVEAL: Object.freeze(['LEADERBOARD', 'NEXT_ROUND_READY', 'FINISHED', 'FINISHING']),
    LEADERBOARD: Object.freeze(['NEXT_ROUND_READY', 'FINISHED', 'PAUSED', 'FINISHING']),
    NEXT_ROUND_READY: Object.freeze(['QUESTION_COUNTDOWN', 'FINISHED', 'PAUSED', 'FINISHING']),
    PAUSED: Object.freeze([
        'LOBBY',
        'STARTING',
        'QUESTION_COUNTDOWN',
        'QUESTION_OPEN',
        'QUESTION_LOCKED',
        'ANSWER_REVEAL',
        'LEADERBOARD',
        'NEXT_ROUND_READY',
        'CANCELLED'
    ]),
    FINISHING: Object.freeze(['FINISHED']),
    FINISHED: Object.freeze([]),
    CANCELLED: Object.freeze([])
});

/** Map legacy status values to approximate V2 states */
const LEGACY_STATUS_TO_STATE = Object.freeze({
    lobby: 'LOBBY',
    question: 'QUESTION_OPEN',
    result: 'ANSWER_REVEAL',
    finished: 'FINISHED'
});

/** Map V2 states back to legacy status for dual-write */
const STATE_TO_LEGACY_STATUS = Object.freeze({
    CREATED: 'lobby',
    LOBBY: 'lobby',
    STARTING: 'lobby',
    QUESTION_COUNTDOWN: 'question',
    QUESTION_OPEN: 'question',
    QUESTION_LOCKED: 'question',
    ANSWER_REVEAL: 'result',
    LEADERBOARD: 'result',
    NEXT_ROUND_READY: 'result',
    PAUSED: 'lobby',
    FINISHING: 'finished',
    FINISHED: 'finished',
    CANCELLED: 'finished'
});

const TERMINAL_STATES = Object.freeze(['FINISHED', 'CANCELLED']);

const TRANSIENT_STATES = Object.freeze(['STARTING', 'QUESTION_LOCKED', 'FINISHING']);

class SessionStateMachine {
    static getStates() {
        return SESSION_STATES;
    }

    static isValidState(state) {
        return SESSION_STATES.includes(state);
    }

    static isTerminal(state) {
        return TERMINAL_STATES.includes(state);
    }

    static isTransient(state) {
        return TRANSIENT_STATES.includes(state);
    }

    /**
     * @param {string} fromState
     * @param {string} toState
     * @returns {{ allowed: boolean, reason?: string }}
     */
    static canTransition(fromState, toState) {
        if (!this.isValidState(fromState)) {
            return { allowed: false, reason: 'INVALID_FROM_STATE' };
        }
        if (!this.isValidState(toState)) {
            return { allowed: false, reason: 'INVALID_TO_STATE' };
        }
        if (fromState === toState) {
            return { allowed: false, reason: 'NO_OP_TRANSITION' };
        }
        if (this.isTerminal(fromState)) {
            return { allowed: false, reason: 'TERMINAL_STATE' };
        }
        const allowed = ALLOWED_TRANSITIONS[fromState] || [];
        if (!allowed.includes(toState)) {
            return { allowed: false, reason: 'TRANSITION_NOT_ALLOWED' };
        }
        return { allowed: true };
    }

    /**
     * Assert transition or throw a structured error object (pure; no throw of Error subclass required).
     * @returns {{ fromState: string, toState: string }}
     */
    static assertTransition(fromState, toState) {
        const result = this.canTransition(fromState, toState);
        if (!result.allowed) {
            const err = new Error(`Invalid session transition ${fromState} -> ${toState}: ${result.reason}`);
            err.code = result.reason || 'TRANSITION_NOT_ALLOWED';
            err.fromState = fromState;
            err.toState = toState;
            throw err;
        }
        return { fromState, toState };
    }

    static fromLegacyStatus(status) {
        return LEGACY_STATUS_TO_STATE[status] || 'LOBBY';
    }

    static toLegacyStatus(state) {
        return STATE_TO_LEGACY_STATUS[state] || 'lobby';
    }

    static getAllowedNext(fromState) {
        if (!this.isValidState(fromState)) return [];
        return [...(ALLOWED_TRANSITIONS[fromState] || [])];
    }
}

module.exports = {
    SessionStateMachine,
    SESSION_STATES,
    ALLOWED_TRANSITIONS,
    LEGACY_STATUS_TO_STATE,
    STATE_TO_LEGACY_STATUS,
    TERMINAL_STATES,
    TRANSIENT_STATES
};
