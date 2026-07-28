const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { PlayerProfile } = require('../models/PlayerProfile');
const { Player, GameSession, PlayerAnswer } = require('../models/GameSession');
const { Quiz, Question } = require('../models/Quiz');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Middleware to protect routes
const auth = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });
    try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), JWT_SECRET);
        req.player = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

// Register Player
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        let player = await PlayerProfile.findOne({ where: { username } });
        if (player) return res.status(400).json({ message: 'Username already taken' });
        
        let playerEmail = await PlayerProfile.findOne({ where: { email } });
        if (playerEmail) return res.status(400).json({ message: 'Email already registered' });

        player = await PlayerProfile.create({ username, email, password });

        const token = jwt.sign({ playerId: player.id }, JWT_SECRET, { expiresIn: '30d' });
        res.status(201).json({ 
            token, 
            player: {
                id: player.id,
                username: player.username,
                xp: player.xp,
                level: player.level,
                avatar: player.avatar
            } 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login Player
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const player = await PlayerProfile.findOne({ where: { username } });
        if (!player) return res.status(400).json({ message: 'Invalid credentials' });

        const isMatch = await player.comparePassword(password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ playerId: player.id }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ 
            token, 
            player: {
                id: player.id,
                username: player.username,
                xp: player.xp,
                level: player.level,
                avatar: player.avatar
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get Profile
router.get('/profile', auth, async (req, res) => {
    try {
        const player = await PlayerProfile.findByPk(req.player.playerId, {
            attributes: { exclude: ['password'] }
        });
        if (!player) return res.status(404).json({ message: 'Player not found' });
        res.json(player);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update Avatar
router.put('/avatar', auth, async (req, res) => {
    try {
        const { avatar } = req.body;
        if (!avatar) return res.status(400).json({ message: 'Avatar is required' });

        const player = await PlayerProfile.findByPk(req.player.playerId);
        if (!player) return res.status(404).json({ message: 'Player not found' });

        player.avatar = avatar;
        await player.save();

        res.json({ message: 'Avatar updated successfully', avatar: player.avatar });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get History
router.get('/history', auth, async (req, res) => {
    try {
        const history = await Player.findAll({
            where: { playerProfileId: req.player.playerId },
            include: [
                {
                    model: GameSession,
                    include: [
                        {
                            model: Quiz,
                            include: [{ model: Question, as: 'questions' }]
                        }
                    ]
                },
                {
                    model: PlayerAnswer,
                    as: 'answers'
                }
            ],
            order: [[GameSession, 'createdAt', 'DESC']]
        });
        
        // Format data to be easily consumed by frontend
        const formattedHistory = history.map(playerRecord => {
            const session = playerRecord.GameSession;
            const quiz = session ? session.Quiz : null;
            const answers = playerRecord.answers || [];
            
            let totalCorrect = answers.filter(a => a.isCorrect).length;
            let totalQuestions = quiz ? quiz.questions.length : 0;

            let detailedAnswers = [];
            if (quiz && quiz.questions) {
                detailedAnswers = quiz.questions.map((q, index) => {
                    const answerForQ = answers.find(a => a.questionIndex === index);
                    return {
                        questionIndex: index,
                        questionText: q.questionText,
                        options: q.options,
                        correctIndex: q.correctIndex,
                        isCorrect: answerForQ ? answerForQ.isCorrect : false,
                        answered: !!answerForQ,
                        chosenAnswerIndex: answerForQ ? answerForQ.answerIndex : null
                    };
                });
            }

            return {
                sessionId: session ? session.id : null,
                pin: session ? session.pin : 'N/A',
                date: session ? session.createdAt : playerRecord.createdAt,
                score: playerRecord.score,
                quizTitle: quiz ? quiz.title : 'Unknown Quiz',
                totalCorrect,
                totalQuestions,
                detailedAnswers
            };
        });

        res.json(formattedHistory);
    } catch (err) {
        console.error('Error fetching history:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
