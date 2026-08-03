/**
 * Phase 2 reliability acceptance suite (Blueprint §4.14).
 * Runs with force:true on command paths so NEW_SESSION_ENGINE need not be on in env.
 * Live default remains flag OFF.
 */
const { expect } = require('chai');
const crypto = require('crypto');
const { connectDB } = require('../config/database');
const { seedTestFixtures, clearDatabase } = require('./fixtures');
const { GameSession, Player, PlayerAnswer, IdempotencyRecord } = require('../models/GameSession');
const SessionCommandService = require('../services/SessionCommandService');
const SessionWatchdogService = require('../services/SessionWatchdogService');
const AnswerSubmissionService = require('../services/AnswerSubmissionService');
const HostLeaseService = require('../services/HostLeaseService');
const SessionRecoveryService = require('../services/SessionRecoveryService');
const { Quiz, Question } = require('../models/Quiz');

describe('Phase 2 Reliability Acceptance (P2-T11)', function () {
    this.timeout(30000);

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

    async function createLobbySession(overrides = {}) {
        return GameSession.create({
            pin: String(Math.floor(100000 + Math.random() * 900000)),
            quizId: quiz.id,
            hostId: host.id,
            status: 'lobby',
            state: 'LOBBY',
            stateVersion: 0,
            currentQuestionIndex: -1,
            ...overrides
        });
    }

    it('A1: host double-start with same commandId applies once (idempotent)', async () => {
        const session = await createLobbySession();
        const commandId = crypto.randomUUID();

        const first = await SessionCommandService.executeStartQuestion({
            commandId,
            sessionId: session.id,
            actorId: String(host.id),
            questionIndex: 0,
            force: true
        });
        expect(first.ok).to.equal(true);
        expect(first.toState).to.equal('QUESTION_OPEN');

        const second = await SessionCommandService.executeStartQuestion({
            commandId,
            sessionId: session.id,
            actorId: String(host.id),
            questionIndex: 0,
            force: true
        });
        expect(second.replay).to.equal(true);

        await session.reload();
        expect(session.state).to.equal('QUESTION_OPEN');
        expect(Number(session.stateVersion)).to.equal(Number(first.stateVersion));

        const records = await IdempotencyRecord.findAll({ where: { commandId } });
        expect(records).to.have.length(1);
    });

    it('A2: host double-start with different commandIds — second rejected while open', async () => {
        const session = await createLobbySession();

        await SessionCommandService.executeStartQuestion({
            commandId: crypto.randomUUID(),
            sessionId: session.id,
            actorId: String(host.id),
            questionIndex: 0,
            force: true
        });

        const again = await SessionCommandService.executeStartQuestion({
            commandId: crypto.randomUUID(),
            sessionId: session.id,
            actorId: String(host.id),
            questionIndex: 1,
            force: true
        });

        expect(again.ok).to.equal(false);
        expect(again.code).to.equal('ALREADY_IN_PROGRESS');
    });

    it('A3: player double-submit awards points once', async () => {
        const session = await createLobbySession({
            status: 'question',
            state: 'QUESTION_OPEN',
            stateVersion: 3,
            currentQuestionIndex: 0,
            questionStartTime: new Date(Date.now() - 5000)
        });

        await Player.create({
            sessionId: session.id,
            nickname: 'DupPlayer',
            score: 0,
            lastAnswerIndex: -1,
            streak: 0
        });

        const first = await AnswerSubmissionService.submitAnswer(session.pin, 'DupPlayer', 1);
        expect(first.error).to.equal(undefined);
        expect(first.success).to.equal(true);

        const second = await AnswerSubmissionService.submitAnswer(session.pin, 'DupPlayer', 1);
        expect(second.error).to.equal('Answer already submitted');

        const answers = await PlayerAnswer.findAll({
            where: { sessionId: session.id }
        });
        expect(answers).to.have.length(1);

        const player = await Player.findOne({
            where: { sessionId: session.id, nickname: 'DupPlayer' }
        });
        expect(player.lastAnswerIndex).to.equal(1);
    });

    it('A4: stale expectedStateVersion yields SESSION_STATE_CONFLICT', async () => {
        const session = await createLobbySession();
        await SessionCommandService.executeStartQuestion({
            commandId: crypto.randomUUID(),
            sessionId: session.id,
            actorId: String(host.id),
            questionIndex: 0,
            force: true
        });
        await session.reload();

        const conflict = await SessionCommandService.executeEndQuestion({
            commandId: crypto.randomUUID(),
            sessionId: session.id,
            actorId: String(host.id),
            expectedStateVersion: 0, // stale
            force: true
        });

        expect(conflict.ok).to.equal(false);
        expect(conflict.code).to.equal('SESSION_STATE_CONFLICT');
    });

    it('A5: full happy path LOBBY → OPEN → REVEAL → FINISHED dual-writes legacy status', async () => {
        const session = await createLobbySession();

        const open = await SessionCommandService.executeStartQuestion({
            commandId: crypto.randomUUID(),
            sessionId: session.id,
            actorId: String(host.id),
            questionIndex: 0,
            force: true
        });
        expect(open.ok).to.equal(true);
        await session.reload();
        expect(session.status).to.equal('question');
        expect(session.state).to.equal('QUESTION_OPEN');

        const end = await SessionCommandService.executeEndQuestion({
            commandId: crypto.randomUUID(),
            sessionId: session.id,
            actorId: String(host.id),
            expectedStateVersion: Number(session.stateVersion),
            force: true
        });
        expect(end.ok).to.equal(true);
        await session.reload();
        expect(session.status).to.equal('result');
        expect(session.state).to.equal('ANSWER_REVEAL');

        const finish = await SessionCommandService.executeEndGame({
            commandId: crypto.randomUUID(),
            sessionId: session.id,
            actorId: String(host.id),
            expectedStateVersion: Number(session.stateVersion),
            force: true
        });
        expect(finish.ok).to.equal(true);
        await session.reload();
        expect(session.state).to.equal('FINISHED');
        expect(session.status).to.equal('finished');
    });

    it('A6: watchdog clears stuck STARTING (no infinite Starting Session)', async () => {
        const session = await createLobbySession({
            state: 'STARTING',
            status: 'lobby',
            stateVersion: 1,
            stateEnteredAt: new Date(Date.now() - 5 * 60 * 1000)
        });

        const result = await SessionWatchdogService.scan({
            force: true,
            timeoutMs: 1000
        });

        const hit = result.remediated.find((r) => r.sessionId === session.id);
        expect(hit).to.not.equal(undefined);
        expect(hit.toState).to.equal('PAUSED');

        await session.reload();
        expect(session.state).to.equal('PAUSED');
        expect(session.lastErrorCode).to.equal('WATCHDOG_STARTING_TIMEOUT');
    });

    it('A7: host lease blocks second owner until expiry', async () => {
        const session = await createLobbySession();

        const a = await HostLeaseService.acquireOrRenew({
            sessionId: session.id,
            ownerId: 'owner-1',
            ttlMs: 60000,
            force: true
        });
        expect(a.ok).to.equal(true);

        const blocked = await HostLeaseService.acquireOrRenew({
            sessionId: session.id,
            ownerId: 'owner-2',
            ttlMs: 60000,
            force: true
        });
        expect(blocked.ok).to.equal(false);
        expect(blocked.code).to.equal('LEASE_HELD');
    });

    it('A8: recovery payloads — player never sees correctIndex mid-question', async () => {
        const session = await createLobbySession({
            status: 'question',
            state: 'QUESTION_OPEN',
            stateVersion: 4,
            currentQuestionIndex: 0,
            questionStartTime: new Date()
        });

        const player = await Player.create({
            sessionId: session.id,
            nickname: 'SafePlayer',
            score: 10,
            lastAnswerIndex: -1
        });

        const fullQuiz = await Quiz.findByPk(quiz.id, {
            include: [{ model: Question, as: 'questions' }],
            order: [[{ model: Question, as: 'questions' }, 'id', 'ASC']]
        });

        const playerRecovery = SessionRecoveryService.buildCanonicalRecovery({
            role: 'player',
            session,
            quiz: fullQuiz,
            player
        });

        expect(playerRecovery.payload.question).to.not.equal(null);
        expect(playerRecovery.payload.question.correctIndex).to.be.undefined;

        const hostRecovery = SessionRecoveryService.buildCanonicalRecovery({
            role: 'host',
            session,
            quiz: fullQuiz
        });
        expect(hostRecovery.payload.currentQuestion.correctIndex).to.equal(1);
    });

    it('A9: feature flag OFF blocks command execute without force', async () => {
        const session = await createLobbySession();
        const result = await SessionCommandService.execute({
            commandId: crypto.randomUUID(),
            commandType: 'START_SESSION',
            sessionId: session.id,
            expectedStateVersion: 0,
            toState: 'STARTING',
            actorId: String(host.id)
            // force omitted → respects flag (default off)
        });
        expect(result.ok).to.equal(false);
        expect(result.code).to.equal('FEATURE_DISABLED');

        await session.reload();
        expect(session.state).to.equal('LOBBY');
        expect(session.status).to.equal('lobby');
    });
});
