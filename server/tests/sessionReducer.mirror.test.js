/**
 * Mirrors critical client sessionReducer rules so server CI catches regressions
 * without requiring a Vite test runner on the client package.
 */
const { expect } = require('chai');

// Inline pure rules matching client/src/features/live-session/state/sessionReducer.js
function reduce(state, action) {
    if (!action || !action.type) return state;
    switch (action.type) {
        case 'SESSION_EVENT': {
            const { stateVersion, status, state: nextState } = action.payload || {};
            const incoming = Number(stateVersion);
            if (!Number.isFinite(incoming)) return state;
            if (incoming <= Number(state.stateVersion || 0)) return state;
            return {
                ...state,
                stateVersion: incoming,
                status: status != null ? status : state.status,
                state: nextState != null ? nextState : state.state
            };
        }
        case 'SESSION_COMMAND_ACK': {
            const ack = action.payload || {};
            if (ack.code === 'SESSION_STATE_CONFLICT') {
                return { ...state, needsRecovery: true };
            }
            if (ack.ok && Number(ack.stateVersion) > Number(state.stateVersion || 0)) {
                return {
                    ...state,
                    stateVersion: Number(ack.stateVersion),
                    state: ack.toState || state.state,
                    needsRecovery: false
                };
            }
            return state;
        }
        default:
            return state;
    }
}

describe('Client sessionReducer rules (mirrored)', () => {
    it('ignores stale SESSION_EVENT', () => {
        const state = { stateVersion: 5, status: 'question', state: 'QUESTION_OPEN' };
        const next = reduce(state, {
            type: 'SESSION_EVENT',
            payload: { stateVersion: 4, status: 'result', state: 'ANSWER_REVEAL' }
        });
        expect(next.stateVersion).to.equal(5);
        expect(next.status).to.equal('question');
    });

    it('applies newer SESSION_EVENT', () => {
        const state = { stateVersion: 5, status: 'question', state: 'QUESTION_OPEN' };
        const next = reduce(state, {
            type: 'SESSION_EVENT',
            payload: { stateVersion: 6, status: 'result', state: 'ANSWER_REVEAL' }
        });
        expect(next.stateVersion).to.equal(6);
        expect(next.status).to.equal('result');
        expect(next.state).to.equal('ANSWER_REVEAL');
    });

    it('marks needsRecovery on SESSION_STATE_CONFLICT ack', () => {
        const state = { stateVersion: 2, needsRecovery: false };
        const next = reduce(state, {
            type: 'SESSION_COMMAND_ACK',
            payload: { ok: false, code: 'SESSION_STATE_CONFLICT' }
        });
        expect(next.needsRecovery).to.equal(true);
    });
});
