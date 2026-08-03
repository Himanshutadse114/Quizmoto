const { expect } = require('chai');
const { connectDB } = require('../config/database');
const { seedTestFixtures, clearDatabase } = require('./fixtures');
const { GameSession } = require('../models/GameSession');
const SessionWatchdogService = require('../services/SessionWatchdogService');

describe('SessionWatchdogService (Phase 2)', function () {
    this.timeout(20000);

    let host;
    let quiz;

    before(async () => {
        await connectDB();
    });

    beforeEach(async () => {
        const fixtures = await seedTestFixtures();
        host = fixtures.host;
        quiz = fixtures.quiz;
    });

    after(async () => {
        await clearDatabase();
    });

    it('skips when feature flag off and force is false', async () => {
        const result = await SessionWatchdogService.scan();
        expect(result.skipped).to.equal(true);
        expect(result.code).to.equal('FEATURE_DISABLED');
    });

    it('remediates stuck STARTING to PAUSED', async () => {
        const session = await GameSession.create({
            pin: String(Math.floor(100000 + Math.random() * 900000)),
            quizId: quiz.id,
            hostId: host.id,
            status: 'lobby',
            state: 'STARTING',
            stateVersion: 1,
            stateEnteredAt: new Date(Date.now() - 120000)
        });

        const result = await SessionWatchdogService.scan({
            force: true,
            timeoutMs: 1000
        });

        expect(result.scanned).to.be.at.least(1);
        const hit = result.remediated.find((r) => r.sessionId === session.id);
        expect(hit).to.not.equal(undefined);
        expect(hit.toState).to.equal('PAUSED');

        await session.reload();
        expect(session.state).to.equal('PAUSED');
        expect(session.lastErrorCode).to.equal('WATCHDOG_STARTING_TIMEOUT');
    });

    it('remediates stuck QUESTION_LOCKED to ANSWER_REVEAL', async () => {
        const session = await GameSession.create({
            pin: String(Math.floor(100000 + Math.random() * 900000)),
            quizId: quiz.id,
            hostId: host.id,
            status: 'question',
            state: 'QUESTION_LOCKED',
            stateVersion: 4,
            stateEnteredAt: new Date(Date.now() - 120000)
        });

        const result = await SessionWatchdogService.scan({
            force: true,
            timeoutMs: 1000
        });

        const hit = result.remediated.find((r) => r.sessionId === session.id);
        expect(hit).to.not.equal(undefined);
        expect(hit.toState).to.equal('ANSWER_REVEAL');

        await session.reload();
        expect(session.state).to.equal('ANSWER_REVEAL');
        expect(session.status).to.equal('result');
    });

    it('ignores sessions still within timeout window', async () => {
        const session = await GameSession.create({
            pin: String(Math.floor(100000 + Math.random() * 900000)),
            quizId: quiz.id,
            hostId: host.id,
            status: 'lobby',
            state: 'STARTING',
            stateVersion: 1,
            stateEnteredAt: new Date() // just entered
        });

        const result = await SessionWatchdogService.scan({
            force: true,
            timeoutMs: 60000
        });

        const hit = result.remediated.find((r) => r.sessionId === session.id);
        expect(hit).to.equal(undefined);

        await session.reload();
        expect(session.state).to.equal('STARTING');
    });
});
