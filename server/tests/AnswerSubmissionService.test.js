const { expect } = require('chai');
const AnswerSubmissionService = require('../services/AnswerSubmissionService');
const { clearDatabase, seedTestFixtures } = require('./fixtures');

describe('AnswerSubmissionService', () => {
    let host, quiz, pin, session;
    const nickname = 'AnswerTester';

    before(async () => {
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
        const { PlayerAnswer, Player } = require('../models/GameSession');
        
        const initialPlayer = await Player.findOne({ where: { sessionId: session.id, nickname } });
        
        // Initial state from first valid answer
        const initialAnswers = await PlayerAnswer.count({ where: { sessionId: session.id, playerId: initialPlayer.id } });
        
        // Attempt duplicate
        const result = await AnswerSubmissionService.submitAnswer(pin, nickname, 1);
        expect(result.error).to.equal('Answer already submitted');
        
        // Verify DB State
        const finalAnswers = await PlayerAnswer.count({ where: { sessionId: session.id, playerId: initialPlayer.id } });
        const finalPlayer = await Player.findOne({ where: { sessionId: session.id, nickname } });
        
        expect(finalAnswers).to.equal(1); // exactly one answer record
        expect(finalAnswers).to.equal(initialAnswers);
        expect(finalPlayer.score).to.equal(initialPlayer.score); // exactly one point award
        expect(finalPlayer.streak).to.equal(initialPlayer.streak); // exactly one streak update
    });

    it('should handle concurrent duplicate answer submissions safely (Promise.all)', async function () {
        const { sequelize } = require('../config/database');
        if (sequelize.getDialect() === 'sqlite') {
            this.skip(); // SQLite cannot handle concurrent transactions within tests properly
        }
        const { PlayerAnswer, Player } = require('../models/GameSession');
        
        // Create a new player for the concurrent test
        await Player.create({
            sessionId: session.id,
            nickname: 'ConcurrentTester',
            socketId: 'dummy_socket_2',
            score: 0,
            streak: 0
        });

        // Fire two submissions at the exact same time
        const results = await Promise.all([
            AnswerSubmissionService.submitAnswer(pin, 'ConcurrentTester', 1),
            AnswerSubmissionService.submitAnswer(pin, 'ConcurrentTester', 1)
        ]);

        // One should succeed, one should fail with "Answer already submitted"
        const successCount = results.filter(r => r.success === true).length;
        const failCount = results.filter(r => r.error === 'Answer already submitted').length;

        // Note: Depending on isolation level, one might fail with a unique constraint error or the application logic. 
        // We just assert that exactly ONE succeeds.
        expect(successCount).to.equal(1);
        
        // Verify DB State
        const finalPlayer = await Player.findOne({ where: { sessionId: session.id, nickname: 'ConcurrentTester' } });
        const finalAnswers = await PlayerAnswer.count({ where: { sessionId: session.id, playerId: finalPlayer.id } });

        expect(finalAnswers).to.equal(1); // Exactly one answer persisted
        expect(finalPlayer.streak).to.equal(1); // Streak only increments once
        expect(finalPlayer.score).to.be.greaterThan(0); // Score only awarded once
    });
});
