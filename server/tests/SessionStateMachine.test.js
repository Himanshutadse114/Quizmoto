const { expect } = require('chai');
const {
    SessionStateMachine,
    SESSION_STATES,
    TERMINAL_STATES,
    TRANSIENT_STATES
} = require('../services/SessionStateMachine');

describe('SessionStateMachine (Phase 2)', () => {
    it('exposes the full canonical state list', () => {
        expect(SessionStateMachine.getStates()).to.deep.equal(SESSION_STATES);
        expect(SESSION_STATES).to.include.members(['LOBBY', 'STARTING', 'QUESTION_OPEN', 'FINISHED']);
    });

    it('allows LOBBY -> STARTING', () => {
        const r = SessionStateMachine.canTransition('LOBBY', 'STARTING');
        expect(r.allowed).to.equal(true);
    });

    it('rejects LOBBY -> QUESTION_OPEN (no skip)', () => {
        const r = SessionStateMachine.canTransition('LOBBY', 'QUESTION_OPEN');
        expect(r.allowed).to.equal(false);
        expect(r.reason).to.equal('TRANSITION_NOT_ALLOWED');
    });

    it('rejects transitions from FINISHED', () => {
        const r = SessionStateMachine.canTransition('FINISHED', 'LOBBY');
        expect(r.allowed).to.equal(false);
        expect(r.reason).to.equal('TERMINAL_STATE');
    });

    it('rejects no-op same-state transitions', () => {
        const r = SessionStateMachine.canTransition('LOBBY', 'LOBBY');
        expect(r.allowed).to.equal(false);
        expect(r.reason).to.equal('NO_OP_TRANSITION');
    });

    it('assertTransition throws with code on invalid path', () => {
        try {
            SessionStateMachine.assertTransition('LOBBY', 'FINISHED');
            expect.fail('should have thrown');
        } catch (e) {
            expect(e.code).to.equal('TRANSITION_NOT_ALLOWED');
            expect(e.fromState).to.equal('LOBBY');
            expect(e.toState).to.equal('FINISHED');
        }
    });

    it('maps legacy status to V2 state', () => {
        expect(SessionStateMachine.fromLegacyStatus('lobby')).to.equal('LOBBY');
        expect(SessionStateMachine.fromLegacyStatus('question')).to.equal('QUESTION_OPEN');
        expect(SessionStateMachine.fromLegacyStatus('result')).to.equal('ANSWER_REVEAL');
        expect(SessionStateMachine.fromLegacyStatus('finished')).to.equal('FINISHED');
    });

    it('maps V2 state back to legacy status for dual-write', () => {
        expect(SessionStateMachine.toLegacyStatus('STARTING')).to.equal('lobby');
        expect(SessionStateMachine.toLegacyStatus('QUESTION_OPEN')).to.equal('question');
        expect(SessionStateMachine.toLegacyStatus('LEADERBOARD')).to.equal('result');
        expect(SessionStateMachine.toLegacyStatus('FINISHED')).to.equal('finished');
    });

    it('identifies terminal and transient states', () => {
        TERMINAL_STATES.forEach((s) => expect(SessionStateMachine.isTerminal(s)).to.equal(true));
        TRANSIENT_STATES.forEach((s) => expect(SessionStateMachine.isTransient(s)).to.equal(true));
        expect(SessionStateMachine.isTransient('LOBBY')).to.equal(false);
    });

    it('lists allowed next states for STARTING', () => {
        const next = SessionStateMachine.getAllowedNext('STARTING');
        expect(next).to.include.members(['QUESTION_COUNTDOWN', 'PAUSED', 'CANCELLED']);
        expect(next).to.not.include('QUESTION_OPEN');
    });
});
