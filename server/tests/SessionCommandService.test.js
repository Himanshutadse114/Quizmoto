const { expect } = require('chai');
const crypto = require('crypto');
const { sequelize } = require('../config/database');
const { connectDB } = require('../config/database');
const { GameSession, SessionEvent, IdempotencyRecord } = require('../models/GameSession');
const { seedTestFixtures, clearDatabase } = require('./fixtures');
const SessionCommandService = require('../services/SessionCommandService');

describe('SessionCommandService (Phase 2)', function () {
    this.timeout(15000);

    let host;
    let quiz;
    let session;

    before(async () => {
        await connectDB();
    });

    beforeEach(async () => {
        const fixtures = await seedTestFixtures();
        host = fixtures.host;
        quiz = fixtures.quiz;
        session = await GameSession.create({
            pin: String(Math.floor(100000 + Math.random() * 900000)),
            quizId: quiz.id,
            hostId: host.id,
            status: 'lobby',
            state: 'LOBBY',
            stateVersion: 0
        });
    });

    after(async () => {
        await clearDatabase();
    });

    function cmd(overrides = {}) {
        return {
            commandId: crypto.randomUUID(),
            commandType: 'START_SESSION',
            sessionId: session.id,
            expectedStateVersion: 0,
            toState: 'STARTING',
            actorId: String(host.id),
            actorType: 'host',
            force: true,
            ...overrides
        };
    }

    it('accepts LOBBY -> STARTING and dual-writes legacy status', async () => {
        const result = await SessionCommandService.execute(cmd());
        expect(result.ok).to.equal(true);
        expect(result.code).to.equal('ACCEPTED');
        expect(result.fromState).to.equal('LOBBY');
        expect(result.toState).to.equal('STARTING');
        expect(result.stateVersion).to.equal(1);
        expect(result.legacyStatus).to.equal('lobby');

        await session.reload();
        expect(session.state).to.equal('STARTING');
        expect(Number(session.stateVersion)).to.equal(1);
        expect(session.status).to.equal('lobby');
        expect(Number(session.lastEventSequence)).to.equal(1);

        const events = await SessionEvent.findAll({ where: { sessionId: session.id } });
        expect(events).to.have.length(1);
        expect(events[0].eventType).to.equal('START_SESSION');
    });

    it('rejects invalid transition LOBBY -> QUESTION_OPEN', async () => {
        const result = await SessionCommandService.execute(cmd({
            toState: 'QUESTION_OPEN',
            commandType: 'BAD_SKIP'
        }));
        expect(result.ok).to.equal(false);
        expect(result.code).to.equal('TRANSITION_NOT_ALLOWED');

        await session.reload();
        expect(session.state).to.equal('LOBBY');
        expect(Number(session.stateVersion)).to.equal(0);
    });

    it('rejects stale expectedStateVersion (SESSION_STATE_CONFLICT)', async () => {
        await SessionCommandService.execute(cmd());
        const result = await SessionCommandService.execute(cmd({
            commandId: crypto.randomUUID(),
            expectedStateVersion: 0,
            toState: 'QUESTION_COUNTDOWN',
            commandType: 'OPEN'
        }));
        expect(result.ok).to.equal(false);
        expect(result.code).to.equal('SESSION_STATE_CONFLICT');
        expect(result.currentStateVersion).to.equal(1);
    });

    it('replays the same commandId without applying twice (idempotent)', async () => {
        const commandId = crypto.randomUUID();
        const first = await SessionCommandService.execute(cmd({ commandId }));
        expect(first.ok).to.equal(true);
        expect(first.stateVersion).to.equal(1);

        const second = await SessionCommandService.execute(cmd({ commandId }));
        expect(second.ok).to.equal(true);
        expect(second.replay).to.equal(true);
        expect(second.code).to.equal('DUPLICATE');
        expect(second.result.stateVersion).to.equal(1);

        await session.reload();
        expect(Number(session.stateVersion)).to.equal(1);

        const records = await IdempotencyRecord.findAll({ where: { commandId } });
        expect(records).to.have.length(1);
    });

    it('rejects commandId reused with a different payload', async () => {
        const commandId = crypto.randomUUID();
        await SessionCommandService.execute(cmd({ commandId }));

        const result = await SessionCommandService.execute(cmd({
            commandId,
            toState: 'CANCELLED',
            commandType: 'CANCEL',
            expectedStateVersion: 1
        }));
        // First call already stored hash for STARTING; reuse with different toState
        expect(result.ok).to.equal(false);
        expect(result.code).to.equal('IDEMPOTENCY_KEY_REUSED');
    });

    it('openQuestion creates a Round and moves STARTING -> QUESTION_OPEN', async () => {
        await SessionCommandService.execute(cmd());
        const result = await SessionCommandService.openQuestion({
            commandId: crypto.randomUUID(),
            sessionId: session.id,
            expectedStateVersion: 1,
            actorId: String(host.id),
            questionIndex: 0,
            force: true
        });
        expect(result.ok).to.equal(true);
        expect(result.toState).to.equal('QUESTION_OPEN');
        expect(result.activeRoundId).to.be.a('string');
        expect(result.legacyStatus).to.equal('question');

        await session.reload();
        expect(session.status).to.equal('question');
        expect(session.currentQuestionIndex).to.equal(0);
        expect(session.activeRoundId).to.equal(result.activeRoundId);
    });

    it('returns FEATURE_DISABLED when flag is off and force is false', async () => {
        // force defaults false; env NEW_SESSION_ENGINE unset => disabled
        const result = await SessionCommandService.execute({
            commandId: crypto.randomUUID(),
            commandType: 'START_SESSION',
            sessionId: session.id,
            expectedStateVersion: 0,
            toState: 'STARTING',
            actorId: String(host.id)
        });
        expect(result.ok).to.equal(false);
        expect(result.code).to.equal('FEATURE_DISABLED');
    });
});
