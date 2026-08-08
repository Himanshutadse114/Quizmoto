const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { Quiz, Question } = require('../models/Quiz');
const {
    GameSession,
    Player,
    PlayerAnswer,
    Round,
    SessionEvent,
    IdempotencyRecord
} = require('../models/GameSession');
const auth = require('./middleware');
const defaultQuizzes = require('../utils/seedData');
const { featureFlags } = require('../config/featureFlags');
const ReportGenerationService = require('../services/ReportGenerationService');
const JobQueueService = require('../jobs/JobQueueService');
const { JOB_TYPES } = require('../jobs/jobTypes');
const { registerReportHandlers } = require('../jobs/handlers/reportHandlers');
const { sequelize } = require('../config/database');

registerReportHandlers();

const Joi = require('joi');

let GoogleGenerativeAI;
try {
    GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
} catch (err) {
    GoogleGenerativeAI = null;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = GEMINI_API_KEY && GoogleGenerativeAI ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const quizSchema = Joi.object({
    title: Joi.string().required().min(3).max(100),
    questions: Joi.array()
        .items(
            Joi.object({
                questionText: Joi.string().required(),
                // Live Quiz renders a four-colour answer grid. Keep the API in
                // lockstep with Create/Edit Quiz and the socket answer contract.
                options: Joi.array().items(Joi.string()).min(2).max(4).required(),
                correctIndex: Joi.number().integer().min(0).max(3).required(),
                timer: Joi.number().integer().min(5).max(300).required(),
                explanation: Joi.string().allow('', null).optional(),
                image: Joi.string().allow('', null).optional()
            })
        )
        .min(1)
        .required()
}).unknown(true);

router.post('/generate-ai', auth, async (req, res) => {
    try {
        if (!genAI) {
            return res.status(500).json({ message: 'Gemini AI is not configured on this server.' });
        }

        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ message: 'Prompt is required' });

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

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

        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const quizData = JSON.parse(text);
        res.json(quizData);
    } catch (err) {
        console.error('AI Generation Error:', err);
        res.status(500).json({ message: 'AI failed to generate quiz. Please try again.' });
    }
});

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

router.post('/', auth, async (req, res) => {
    try {
        const { error } = quizSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const { title, questions } = req.body;
        const quiz = await Quiz.create({
            title,
            hostId: req.userId
        });

        if (questions && questions.length > 0) {
            const questionsWithQuizId = questions.map((q) => ({
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

// Static paths BEFORE /:id
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

router.post('/import-defaults', auth, async (req, res) => {
    try {
        for (const qData of defaultQuizzes) {
            const quiz = await Quiz.create({
                title: qData.title,
                hostId: req.userId
            });
            const questions = qData.questions.map((q) => ({
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

router.post('/:id/start', auth, async (req, res) => {
    try {
        const quiz = await Quiz.findByPk(req.params.id);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

        if (quiz.hostId !== req.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

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

router.put('/:id', auth, async (req, res) => {
    try {
        const { error } = quizSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0].message });

        const quiz = await Quiz.findByPk(req.params.id);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
        if (quiz.hostId !== req.userId) return res.status(403).json({ message: 'Unauthorized' });

        const { title, questions } = req.body;
        await quiz.update({ title });

        await Question.destroy({ where: { quizId: quiz.id } });
        if (questions && questions.length > 0) {
            const questionsWithQuizId = questions.map((q) => ({
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

/**
 * Delete quiz + questions + any game sessions (and related rows).
 * FK constraints previously caused silent failures when sessions existed.
 */
router.delete('/:id', auth, async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const quiz = await Quiz.findByPk(req.params.id, { transaction: t });
        if (!quiz) {
            await t.rollback();
            return res.status(404).json({ message: 'Quiz not found' });
        }

        if (quiz.hostId !== req.userId) {
            await t.rollback();
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const sessions = await GameSession.findAll({
            where: { quizId: quiz.id },
            attributes: ['id'],
            transaction: t
        });
        const sessionIds = sessions.map((s) => s.id);

        if (sessionIds.length > 0) {
            await PlayerAnswer.destroy({ where: { sessionId: sessionIds }, transaction: t });
            await Player.destroy({ where: { sessionId: sessionIds }, transaction: t });
            await Round.destroy({ where: { sessionId: sessionIds }, transaction: t });
            await SessionEvent.destroy({ where: { sessionId: sessionIds }, transaction: t });
            await IdempotencyRecord.destroy({ where: { sessionId: sessionIds }, transaction: t });
            await GameSession.destroy({ where: { id: sessionIds }, transaction: t });
        }

        await Question.destroy({ where: { quizId: quiz.id }, transaction: t });
        await quiz.destroy({ transaction: t });

        await t.commit();
        res.json({ message: 'Quiz deleted successfully' });
    } catch (err) {
        try {
            await t.rollback();
        } catch (_) {}
        console.error('Quiz delete failed:', err);
        res.status(500).json({
            message: err.message || 'Failed to delete quiz. It may still be linked to game data.'
        });
    }
});

router.get('/reports/:id/export', auth, async (req, res) => {
    try {
        const format = req.query.format || 'pdf';
        if (!['pdf', 'excel'].includes(format)) {
            return res.status(400).json({ message: 'Invalid format' });
        }

        const sessionId = req.params.id;
        const testRunId = req.headers['x-test-run-id'] || null;

        const owned = await GameSession.findOne({
            where: { id: sessionId, hostId: req.userId },
            attributes: ['id']
        });
        if (!owned) return res.status(404).json({ message: 'Session not found' });

        if (featureFlags.reportsAsync) {
            const jobType = format === 'excel' ? JOB_TYPES.REPORT_EXCEL : JOB_TYPES.REPORT_PDF;
            const idempotencyKey = `report:${sessionId}:${format}:${req.userId}`;

            const job = await JobQueueService.enqueue({
                type: jobType,
                payload: {
                    sessionId: Number(sessionId) || sessionId,
                    hostId: req.userId,
                    format,
                    testRunId
                },
                idempotencyKey,
                actorId: String(req.userId)
            });

            if (process.env.REPORTS_PROCESS_INLINE === '1') {
                await JobQueueService.processJob(job.id);
                const updated = await JobQueueService.getJob(job.id);
                return res.status(202).json({
                    jobId: updated.id,
                    status: updated.status,
                    downloadPath:
                        updated.status === 'completed' ? `/api/jobs/${updated.id}/download` : null,
                    error: updated.error || null
                });
            }

            return res.status(202).json({
                jobId: job.id,
                status: job.status,
                message: 'Report job enqueued',
                statusPath: `/api/jobs/${job.id}`
            });
        }

        const generated = await ReportGenerationService.generateReportFile({
            sessionId,
            hostId: req.userId,
            format,
            testRunId,
            keepFiles: false
        });

        res.download(generated.outputPath, generated.downloadName, (err) => {
            ReportGenerationService.safeUnlink(generated.outputPath);
            ReportGenerationService.safeUnlink(generated.jsonPath);
            if (err && !res.headersSent) {
                res.status(500).json({ message: 'Report download failed' });
            }
        });
    } catch (err) {
        console.error(err);
        if (err.code === 'SESSION_NOT_FOUND') {
            return res.status(404).json({ message: 'Session not found' });
        }
        if (err.code === 'INVALID_FORMAT') {
            return res.status(400).json({ message: 'Invalid format' });
        }
        if (err.code === 'REPORT_GEN_FAILED') {
            return res.status(500).json({ message: 'Report generation failed' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
