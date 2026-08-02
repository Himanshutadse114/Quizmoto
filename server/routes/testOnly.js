const express = require('express');
const router = express.Router();
const { Quiz, Question } = require('../models/Quiz');
const { GameSession, Player, PlayerAnswer } = require('../models/GameSession');
const User = require('../models/User');

// Strictly verify we are in test mode and the secret matches
router.use((req, res, next) => {
    if (process.env.NODE_ENV !== 'test') {
        return res.status(404).send('Not Found');
    }
    const secret = req.headers['x-test-secret'];
    const expectedSecret = process.env.TEST_SECRET || 'fallback_secret';
    if (!secret || secret !== expectedSecret) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
});

router.post('/cleanup', async (req, res) => {
    try {
        const { testRunId } = req.body;
        if (!testRunId) return res.status(400).json({ error: 'testRunId required' });

        const suffix = `-${testRunId}`;
        const { Op } = require('sequelize');

        // Cleanup test users with the suffix
        const testUsers = await User.findAll({ 
            where: { 
                username: { [Op.endsWith]: suffix } 
            } 
        });

        for (const user of testUsers) {
            const sessions = await GameSession.findAll({ where: { hostId: user.id } });
            for (const session of sessions) {
                const players = await Player.findAll({ where: { sessionId: session.id } });
                for (const player of players) {
                    await PlayerAnswer.destroy({ where: { playerId: player.id } });
                    await player.destroy();
                }
                await session.destroy();
            }

            const quizzes = await Quiz.findAll({ where: { hostId: user.id } });
            for (const quiz of quizzes) {
                await Question.destroy({ where: { quizId: quiz.id } });
                await quiz.destroy();
            }

            await user.destroy();
        }

        res.json({ success: true, message: `Cleaned up run ${testRunId}` });
    } catch (error) {
        console.error('Cleanup error:', error);
        res.status(500).json({ error: 'Cleanup failed' });
    }
});

module.exports = router;
