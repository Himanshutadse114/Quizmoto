const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { Quiz, Question } = require('../models/Quiz');
const { GameSession, Player, PlayerAnswer } = require('../models/GameSession');
const User = require('../models/User');

// These routes are test-only (mounted only when NODE_ENV === 'test').
// TEST_SECRET is mandatory: when unset the endpoints refuse every request
// (fail closed) instead of accepting a well-known default. Set TEST_SECRET
// in the shell before running the Playwright e2e suite; the spec reads the
// same variable and the webServer inherits it.
const EXPECTED_TEST_SECRET = String(process.env.TEST_SECRET || '');
if (!EXPECTED_TEST_SECRET) {
    console.warn('[test-only] TEST_SECRET is not set. /api/test-only endpoints will reject all requests.');
}

function secretsEqual(provided, expected) {
    if (!provided || !expected) return false;
    const a = Buffer.from(String(provided));
    const b = Buffer.from(String(expected));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Strictly verify we are in test mode and the secret matches
router.use((req, res, next) => {
    if (process.env.NODE_ENV !== 'test') {
        return res.status(404).send('Not Found');
    }
    const secret = req.headers['x-test-secret'];
    if (!secretsEqual(secret, EXPECTED_TEST_SECRET)) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
});

/** Re-seed deterministic host + quiz used by golden flow (safe for multi-project Playwright runs). */
router.post('/seed', async (req, res) => {
    try {
        if (req.body && req.body.testRunId) {
            process.env.TEST_RUN_ID = String(req.body.testRunId);
        }
        const { seedTestFixtures } = require('../tests/fixtures');
        const fixtures = await seedTestFixtures();
        res.json({
            success: true,
            hostId: fixtures.host.id,
            quizId: fixtures.quiz.id,
            quizTitle: fixtures.quiz.title
        });
    } catch (error) {
        console.error('Seed error:', error);
        res.status(500).json({ error: 'Seed failed', message: error.message });
    }
});

router.post('/cleanup', async (req, res) => {
    try {
        const { testRunId } = req.body;
        if (!testRunId) return res.status(400).json({ error: 'testRunId required' });

        const suffix = `-${testRunId}`;
        const { Op } = require('sequelize');

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
