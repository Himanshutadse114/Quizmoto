const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { PlayerProfile } = require('../models/PlayerProfile');
const { Player, GameSession, PlayerAnswer } = require('../models/GameSession');
const { Quiz, Question } = require('../models/Quiz');
const { OAuth2Client } = require('google-auth-library');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '1001652255296-695gf3vjul0fjh1oden4k2n6tvvdvncn.apps.googleusercontent.com';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

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

// Google Sign-In for Player
router.post('/google', async (req, res) => {
    try {
        const { credential } = req.body;
        
        if (!credential) {
            return res.status(400).json({ message: 'Google credential missing' });
        }

        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        let player = await PlayerProfile.findOne({ where: { googleId } });

        if (!player) {
            player = await PlayerProfile.findOne({ where: { email } });

            if (player) {
                player.googleId = googleId;
                player.avatar = picture;
                await player.save();
            } else {
                player = await PlayerProfile.create({
                    username: name || email.split('@')[0],
                    email,
                    googleId,
                    avatar: picture
                });
            }
        } else {
            if (player.avatar !== picture) {
                player.avatar = picture;
                await player.save();
            }
        }

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
        console.error('Google Auth Error:', err);
        res.status(500).json({ message: 'Authentication failed' });
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
