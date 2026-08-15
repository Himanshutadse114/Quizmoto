const express = require('express');
const router = express.Router();
const auth = require('./middleware');
const { generateQuiz } = require('../services/QuizAiGenerationService');

router.post('/generate-ai', auth, async (req, res) => {
    try {
        const body = req.body || {};
        const topic = String(body.topic || body.prompt || '').trim();
        const description = String(body.description || '').trim();
        const fileBase64 = body.fileBase64 || '';
        const mimeType = body.mimeType || '';
        const fileName = body.fileName || '';

        const quiz = await generateQuiz({ topic, description, fileBase64, mimeType, fileName });
        res.json(quiz);
    } catch (err) {
        const code = err.code || 'QUIZ_AI_ERROR';
        const status = code === 'QUIZ_AI_SOURCE_REQUIRED'
            ? 400
            : code === 'QUIZ_AI_FILE_TOO_LARGE'
                ? 413
                : code === 'GEMINI_KEY_MISSING'
                    ? 503
                    : code === 'GEMINI_QUOTA'
                        ? 429
                        : 500;
        res.status(status).json({ message: err.message || 'AI failed to generate quiz. Please try again.', code });
    }
});

module.exports = router;
