const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { connectDB } = require('../config/database');
const { seedTestFixtures, clearDatabase } = require('./fixtures');
const { GameSession, Player } = require('../models/GameSession');
const { Question } = require('../models/Quiz');
const SessionTokenService = require('../services/SessionTokenService');
const SessionRecoveryService = require('../services/SessionRecoveryService');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

describe('GET /api/sessions/:id/recovery (Phase 2)', function () {
    this.timeout(15000);

    let app;
    let host;
    let quiz;
    let session;
    let player;
    let hostToken;
    let playerToken;

    before(async () => {
        await connectDB();
        app = express();
        app.use(express.json());
        app.use('/api/sessions', require('../routes/sessions'));
    });

    beforeEach(async () => {
        const fixtures = await seedTestFixtures();
        host = fixtures.host;
        quiz = fixtures.quiz;

        session = await GameSession.create({
            pin: String(Math.floor(100000 + Math.random() * 900000)),
            quizId: quiz.id,
            hostId: host.id,
            status: 'question',
            state: 'QUESTION_OPEN',
            stateVersion: 5,
            currentQuestionIndex: 0,
            questionStartTime: new Date(Date.now() - 2000),
            recoverySchemaVersion: 1
        });

        player = await Player.create({
            sessionId: session.id,
            nickname: 'RecoverPlayer',
            score: 1200,
            lastAnswerIndex: -1,
            streak: 2
        });

        hostToken = jwt.sign({ userId: host.id }, JWT_SECRET, { expiresIn: '1h' });
        playerToken = SessionTokenService.generatePlayerToken(session.id, player.id, player.nickname);
    });

    after(async () => {
        await clearDatabase();
    });

    it('returns 401 without token', async () => {
        const res = await request(app).get(`/api/sessions/${session.id}/recovery?role=host`);
        expect(res.status).to.equal(401);
        expect(res.body.code).to.equal('NO_TOKEN');
    });

    it('returns host recovery with correctIndex and stateVersion', async () => {
        const res = await request(app)
            .get(`/api/sessions/${session.id}/recovery?role=host`)
            .set('Authorization', `Bearer ${hostToken}`);

        expect(res.status).to.equal(200);
        expect(res.body.role).to.equal('host');
        expect(res.body.sessionId).to.equal(session.id);
        expect(res.body.stateVersion).to.equal(5);
        expect(res.body.state).to.equal('QUESTION_OPEN');
        expect(res.body.status).to.equal('question');
        expect(res.body.payload.currentQuestion).to.not.be.null;
        expect(res.body.payload.currentQuestion.correctIndex).to.equal(1); // from fixture Q1
        expect(res.body.schemaVersion).to.equal(1);
    });

    it('returns player recovery without correctIndex on question', async () => {
        const res = await request(app)
            .get(`/api/sessions/${session.id}/recovery?role=player`)
            .set('Authorization', `Bearer ${playerToken}`);

        expect(res.status).to.equal(200);
        expect(res.body.role).to.equal('player');
        expect(res.body.stateVersion).to.equal(5);
        expect(res.body.payload.score).to.equal(1200);
        expect(res.body.payload.question).to.not.be.null;
        expect(res.body.payload.question.correctIndex).to.be.undefined;
        expect(res.body.payload.result).to.equal(null);
    });

    it('forbids host token on player recovery', async () => {
        const res = await request(app)
            .get(`/api/sessions/${session.id}/recovery?role=player`)
            .set('Authorization', `Bearer ${hostToken}`);

        expect(res.status).to.equal(403);
        expect(res.body.code).to.equal('FORBIDDEN');
    });

    it('forbids player token on host recovery', async () => {
        const res = await request(app)
            .get(`/api/sessions/${session.id}/recovery?role=host`)
            .set('Authorization', `Bearer ${playerToken}`);

        expect(res.status).to.equal(403);
    });

    it('forbids wrong host for session', async () => {
        const otherToken = jwt.sign({ userId: host.id + 9999 }, JWT_SECRET, { expiresIn: '1h' });
        const res = await request(app)
            .get(`/api/sessions/${session.id}/recovery?role=host`)
            .set('Authorization', `Bearer ${otherToken}`);

        expect(res.status).to.equal(403);
        expect(res.body.code).to.equal('FORBIDDEN');
    });

    it('returns 404 for unknown session', async () => {
        const res = await request(app)
            .get('/api/sessions/999999/recovery?role=host')
            .set('Authorization', `Bearer ${hostToken}`);

        expect(res.status).to.equal(404);
        expect(res.body.code).to.equal('SESSION_NOT_FOUND');
    });

    it('includes correctIndex in player result only when status is result', async () => {
        session.status = 'result';
        session.state = 'ANSWER_REVEAL';
        player.lastAnswerIndex = 1;
        player.lastAnswerCorrect = true;
        await session.save();
        await player.save();

        const res = await request(app)
            .get(`/api/sessions/${session.id}/recovery?role=player`)
            .set('Authorization', `Bearer ${playerToken}`);

        expect(res.status).to.equal(200);
        expect(res.body.payload.result).to.not.equal(null);
        expect(res.body.payload.result.correctIndex).to.equal(1);
        // Still no correctIndex on the live question object path used mid-question
        if (res.body.payload.question) {
            expect(res.body.payload.question.correctIndex).to.be.undefined;
        }
    });

    it('buildCanonicalRecovery unit: rejects invalid role', () => {
        try {
            SessionRecoveryService.buildCanonicalRecovery({
                role: 'admin',
                session: { status: 'lobby', stateVersion: 0 },
                quiz: { questions: [] }
            });
            expect.fail('should throw');
        } catch (e) {
            expect(e.code).to.equal('INVALID_ROLE');
        }
    });
});
