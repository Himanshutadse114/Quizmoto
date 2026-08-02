const { expect } = require('chai');
const AnswerSubmissionService = require('../services/AnswerSubmissionService');
const { clearDatabase, seedTestFixtures } = require('./fixtures');

describe('AnswerSubmissionService', () => {
    let host, quiz, pin, session;
    const nickname = 'AnswerTester';

    before(async () => {
        process.env.SQLITE_STORAGE = ':memory:';
        const { connectDB } = require('../config/database');
        await connectDB();
        
        const fixtures = await seedTestFixtures();
        host = fixtures.host;
        quiz = fixtures.quiz;

        // Create a GameSession
        const { GameSession, Player } = require('../models/GameSession');
        session = await GameSession.create({
            pin: 'ANS123',
            quizId: quiz.id,
            hostId: host.id,
            status: 'question',
            currentQuestionIndex: 0,
            questionStartTime: new Date(Date.now() - 1000) // 1 second ago
        });
        pin = session.pin;

        // Create a Player
        await Player.create({
            sessionId: session.id,
            nickname: nickname,
            socketId: 'dummy_socket',
            score: 0,
            streak: 0
        });
    });

    after(async () => {
        await clearDatabase();
        const { sequelize } = require('../config/database');
        await sequelize.close();
    });

    it('should reject submission if session not found', async () => {
        const result = await AnswerSubmissionService.submitAnswer('INVALID', nickname, 1);
        expect(result.error).to.equal('Invalid session state');
    });

    it('should reject submission if player not found', async () => {
        const result = await AnswerSubmissionService.submitAnswer(pin, 'Ghost', 1);
        expect(result.error).to.equal('Player not found');
    });

    it('should reject submission if question has not started yet', async () => {
        const { GameSession } = require('../models/GameSession');
        await GameSession.update({ questionStartTime: new Date(Date.now() + 10000) }, { where: { id: session.id }});
        
        const result = await AnswerSubmissionService.submitAnswer(pin, nickname, 1);
        expect(result.error).to.equal('Question has not started yet');
        
        // revert
        await GameSession.update({ questionStartTime: new Date(Date.now() - 1000) }, { where: { id: session.id }});
    });

    it('should reject invalid answer index', async () => {
        const result = await AnswerSubmissionService.submitAnswer(pin, nickname, 99);
        expect(result.error).to.equal('Invalid answer index');
    });

    it('should process a valid answer atomically', async () => {
        // Option 1 is correct for Quiz 1 Question 0 ('4')
        const result = await AnswerSubmissionService.submitAnswer(pin, nickname, 1);
        
        expect(result.success).to.be.true;
        expect(result.points).to.be.greaterThan(0);
        expect(result.streak).to.equal(1);
        expect(result.score).to.be.greaterThan(0);
    });

    it('should reject a duplicate answer submission', async () => {
        const result = await AnswerSubmissionService.submitAnswer(pin, nickname, 1);
        expect(result.error).to.equal('Answer already submitted');
    });
});
