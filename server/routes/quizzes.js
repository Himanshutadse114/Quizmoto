const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { Quiz, Question } = require('../models/Quiz');
const { GameSession, Player, PlayerAnswer } = require('../models/GameSession');
const auth = require('./middleware');
const defaultQuizzes = require('../utils/seedData');

const Joi = require('joi');

let GoogleGenerativeAI;
try {
    GoogleGenerativeAI = require("@google/generative-ai").GoogleGenerativeAI;
} catch (err) {
    GoogleGenerativeAI = null;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = (GEMINI_API_KEY && GoogleGenerativeAI) ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const quizSchema = Joi.object({
    title: Joi.string().required().min(3).max(100),
    questions: Joi.array().items(Joi.object({
        questionText: Joi.string().required(),
        options: Joi.array().items(Joi.string()).min(2).max(6).required(),
        correctIndex: Joi.number().integer().min(0).max(5).required(),
        timer: Joi.number().integer().min(5).max(300).required(),
        explanation: Joi.string().allow('', null).optional(),
        image: Joi.string().allow('', null).optional()
    })).min(1).required()
}).unknown(true);

// Generate Quiz with AI
router.post('/generate-ai', auth, async (req, res) => {
    try {
        if (!genAI) {
            return res.status(500).json({ message: 'Gemini AI is not configured on this server.' });
        }

        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ message: 'Prompt is required' });

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        const systemPrompt = `You are a professional Quiz Generator. 
Create a quiz based on the user's topic: "${prompt}".
Respond ONLY with a JSON object in this format:
{
  "title": "A catchy title for the quiz",
  "questions": [
    {
      "questionText": "The question string",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctIndex": 0,
      "timer": 20,
      "explanation": "A short, fun fact or explanation about the correct answer (max 2 sentences)"
    }
  ]
}
Each quiz must have 5-10 questions. Ensure options are distinct and one index is correct.`;

        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        let text = response.text();

        // Clean text if Gemini wraps it in markdown code blocks
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const quizData = JSON.parse(text);
        res.json(quizData);
    } catch (err) {
        console.error('AI Generation Error:', err);
        res.status(500).json({ message: 'AI failed to generate quiz. Please try again.' });
    }
});

// Get all quizzes for host
router.get('/', auth, async (req, res) => {
    try {
        const quizzes = await Quiz.findAll({
            where: { hostId: req.userId },
            include: [{ model: Question, as: 'questions' }],
            order: [['createdAt', 'DESC']]
        });
        res.json(quizzes);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create new quiz
router.post('/', auth, async (req, res) => {
    try {
        console.log('Quiz Creation Request:', JSON.stringify(req.body, null, 2));
        const { error } = quizSchema.validate(req.body);
        if (error) {
            console.log('Validation Error:', error.details[0].message);
            return res.status(400).json({ message: error.details[0].message });
        }

        const { title, questions } = req.body;
        const quiz = await Quiz.create({
            title,
            hostId: req.userId
        });

        if (questions && questions.length > 0) {
            const questionsWithQuizId = questions.map(q => ({
                ...q,
                quizId: quiz.id
            }));
            await Question.bulkCreate(questionsWithQuizId);
        }

        const createdQuiz = await Quiz.findByPk(quiz.id, {
            include: [{ model: Question, as: 'questions' }]
        });

        res.status(201).json(createdQuiz);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Start a game session
router.post('/:id/start', auth, async (req, res) => {
    try {
        const quiz = await Quiz.findByPk(req.params.id);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

        // DEFECT FIX: Authorization - ensure host owns the quiz
        if (quiz.hostId !== req.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // Generate 6-digit PIN
        let pin;
        let isUnique = false;
        while (!isUnique) {
            pin = Math.floor(100000 + Math.random() * 900000).toString();
            const existing = await GameSession.findOne({ where: { pin } });
            if (!existing) isUnique = true;
        }

        const session = await GameSession.create({
            pin,
            quizId: quiz.id,
            hostId: req.userId,
            status: 'lobby'
        });

        res.json(session);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get single quiz for editing
router.get('/:id', auth, async (req, res) => {
    try {
        const quiz = await Quiz.findByPk(req.params.id, {
            include: [{ model: Question, as: 'questions' }]
        });
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
        if (quiz.hostId !== req.userId) return res.status(403).json({ message: 'Unauthorized' });
        res.json(quiz);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update quiz
router.put('/:id', auth, async (req, res) => {
    try {
        const { error } = quizSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0].message });

        const quiz = await Quiz.findByPk(req.params.id);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
        if (quiz.hostId !== req.userId) return res.status(403).json({ message: 'Unauthorized' });

        const { title, questions } = req.body;
        await quiz.update({ title });

        // Delete old questions and recreate
        await Question.destroy({ where: { quizId: quiz.id } });
        if (questions && questions.length > 0) {
            const questionsWithQuizId = questions.map(q => ({
                ...q,
                timer: parseInt(q.timer) || 20,
                quizId: quiz.id
            }));
            await Question.bulkCreate(questionsWithQuizId);
        }

        res.json({ message: 'Quiz updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get active sessions for host
router.get('/active-sessions', auth, async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const activeSessions = await GameSession.findAll({
            where: {
                hostId: req.userId,
                status: { [Op.ne]: 'finished' }
            },
            include: [{ model: Quiz, attributes: ['title'] }],
            order: [['updatedAt', 'DESC']]
        });
        res.json(activeSessions);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Import default quizzes
router.post('/import-defaults', auth, async (req, res) => {
    try {
        for (const qData of defaultQuizzes) {
            const quiz = await Quiz.create({
                title: qData.title,
                hostId: req.userId
            });
            const questions = qData.questions.map(q => ({
                ...q,
                quizId: quiz.id
            }));
            await Question.bulkCreate(questions);
        }
        res.json({ message: 'Default quizzes imported successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get reports (finished sessions)
router.get('/reports/all', auth, async (req, res) => {
    try {
        const reports = await GameSession.findAll({
            where: {
                hostId: req.userId,
                status: 'finished'
            },
            include: [
                { 
                    model: Player, 
                    as: 'players',
                    include: [{ model: PlayerAnswer, as: 'answers' }]
                },
                { 
                    model: Quiz, 
                    attributes: ['title'],
                    include: [{ model: Question, as: 'questions' }]
                }
            ],
            attributes: ['id', 'pin', 'quizId', 'status', 'gameMode', 'analytics', 'createdAt', 'updatedAt'],
            order: [['updatedAt', 'DESC']]
        });
        res.json(reports);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete a quiz
router.delete('/:id', auth, async (req, res) => {
    try {
        const quiz = await Quiz.findByPk(req.params.id);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

        // Authorization check
        if (quiz.hostId !== req.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        await quiz.destroy();
        res.json({ message: 'Quiz deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Export report as PDF or Excel
router.get('/reports/:id/export', auth, async (req, res) => {
    try {
        const format = req.query.format || 'pdf';
        if (!['pdf', 'excel'].includes(format)) {
            return res.status(400).json({ message: 'Invalid format' });
        }

        const session = await GameSession.findOne({
            where: { id: req.params.id, hostId: req.userId },
            include: [
                { 
                    model: Player, 
                    as: 'players',
                    include: [{ model: PlayerAnswer, as: 'answers' }]
                },
                { 
                    model: Quiz, 
                    attributes: ['title'],
                    include: [{ model: Question, as: 'questions' }]
                }
            ]
        });

        if (!session) return res.status(404).json({ message: 'Session not found' });

        const tmpRoot = process.env.TEST_TEMP_DIR_ROOT || path.join(__dirname, '../data/tmp');
        const tmpDir = process.env.NODE_ENV === 'test' && req.headers['x-test-run-id'] 
            ? path.join(tmpRoot, `test_${req.headers['x-test-run-id']}`)
            : tmpRoot;

        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        const timestamp = Date.now();
        const jsonPath = path.join(tmpDir, `report_${session.id}_${timestamp}.json`);
        const ext = format === 'pdf' ? '.pdf' : '.xlsx';
        const outputPath = path.join(tmpDir, `report_${session.id}_${timestamp}${ext}`);

        fs.writeFileSync(jsonPath, JSON.stringify(session.toJSON()));

        const scriptPath = path.join(__dirname, '../utils/generate_report.py');
        const pyCmd = process.env.TEST_PYTHON_FAIL ? 'invalid_python_cmd_xyz' : (process.platform === 'win32' ? 'python' : 'python3');
        exec(`${pyCmd} ${scriptPath} ${jsonPath} ${outputPath} ${format}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                console.error(`stderr: ${stderr}`);
                if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
                return res.status(500).json({ message: 'Report generation failed' });
            }
            
            res.download(outputPath, `Report${ext}`, (err) => {
                // Cleanup temp files after sending
                if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
