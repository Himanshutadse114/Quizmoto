const JSZip = require('jszip');
const logger = require('../utils/logger');

const DEFAULT_MODELS = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest'
];

const QUIZ_SCHEMA = {
    type: 'object',
    properties: {
        title: { type: 'string' },
        questions: {
            type: 'array',
            minItems: 5,
            maxItems: 10,
            items: {
                type: 'object',
                properties: {
                    questionText: { type: 'string' },
                    options: {
                        type: 'array',
                        minItems: 4,
                        maxItems: 4,
                        items: { type: 'string' }
                    },
                    correctIndex: { type: 'integer', minimum: 0, maximum: 3 },
                    timer: { type: 'integer', minimum: 5, maximum: 60 },
                    explanation: { type: 'string' }
                },
                required: ['questionText', 'options', 'correctIndex', 'timer', 'explanation']
            }
        }
    },
    required: ['title', 'questions']
};

function getApiKey() {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

function modelCandidates() {
    const preferred = String(process.env.GEMINI_QUIZ_MODEL || process.env.GEMINI_MODEL || '').trim();
    return preferred ? [preferred, ...DEFAULT_MODELS.filter((model) => model !== preferred)] : [...DEFAULT_MODELS];
}

function decodeXml(value) {
    return String(value || '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

async function extractPptxText(base64Data) {
    const zip = await JSZip.loadAsync(base64Data, { base64: true });
    const names = Object.keys(zip.files)
        .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
        .sort((a, b) => Number(a.match(/slide(\d+)/i)?.[1] || 0) - Number(b.match(/slide(\d+)/i)?.[1] || 0));
    const chunks = [];
    for (const name of names) {
        const xml = await zip.file(name).async('string');
        const text = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((match) => decodeXml(match[1])).filter(Boolean).join(' ');
        if (text) chunks.push(text);
    }
    return chunks.join('\n\n');
}

async function extractDocxText(base64Data) {
    const zip = await JSZip.loadAsync(base64Data, { base64: true });
    const document = zip.file('word/document.xml');
    if (!document) return '';
    const xml = await document.async('string');
    return [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => decodeXml(match[1])).filter(Boolean).join(' ');
}

async function buildSourceParts({ topic, description, fileBase64, mimeType, fileName }) {
    const parts = [];
    const cleanTopic = String(topic || '').trim();
    const cleanDescription = String(description || '').trim();
    if (cleanTopic || cleanDescription) {
        parts.push({
            text: [
                cleanTopic ? `TOPIC: ${cleanTopic}` : '',
                cleanDescription ? `DESCRIPTION / LEARNING CONTEXT:\n${cleanDescription}` : ''
            ].filter(Boolean).join('\n\n')
        });
    }

    const raw = String(fileBase64 || '').replace(/^data:[^;]+;base64,/, '');
    if (!raw) return parts;

    const maxMb = Math.max(1, Number(process.env.QUIZ_AI_MAX_UPLOAD_MB || 12));
    const approxBytes = Math.floor((raw.length * 3) / 4);
    if (approxBytes > maxMb * 1024 * 1024) {
        const err = new Error(`Quiz AI document must be ${maxMb} MB or smaller.`);
        err.code = 'QUIZ_AI_FILE_TOO_LARGE';
        throw err;
    }

    const mime = String(mimeType || '').toLowerCase();
    const name = String(fileName || '').toLowerCase();
    let extracted = '';

    if (mime.includes('presentationml.presentation') || name.endsWith('.pptx')) {
        extracted = await extractPptxText(raw);
    } else if (mime.includes('wordprocessingml.document') || name.endsWith('.docx')) {
        extracted = await extractDocxText(raw);
    } else if (mime.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) {
        extracted = Buffer.from(raw, 'base64').toString('utf8');
    }

    if (extracted.trim()) {
        parts.push({ text: `UPLOADED DOCUMENT (${fileName || 'document'}):\n\n${extracted.slice(0, 120000)}` });
    } else {
        parts.push({ inlineData: { data: raw, mimeType: mimeType || 'application/pdf' } });
    }

    return parts;
}

function parseQuizJson(text) {
    const raw = String(text || '').replace(/^\uFEFF/, '').trim();
    const candidates = [raw];
    const unfenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    if (unfenced !== raw) candidates.push(unfenced);
    const first = unfenced.indexOf('{');
    const last = unfenced.lastIndexOf('}');
    if (first >= 0 && last > first) {
        const objectText = unfenced.slice(first, last + 1);
        candidates.push(objectText, objectText.replace(/,\s*([}\]])/g, '$1'));
    }

    let parsed = null;
    for (const candidate of [...new Set(candidates.filter(Boolean))]) {
        try {
            parsed = JSON.parse(candidate);
            break;
        } catch (_) {}
    }
    if (!parsed) {
        const err = new Error('Gemini returned invalid quiz JSON.');
        err.code = 'QUIZ_AI_BAD_JSON';
        throw err;
    }
    return parsed;
}

function normalizeQuiz(data) {
    const title = String(data?.title || 'AI Generated Quiz').trim().slice(0, 100) || 'AI Generated Quiz';
    const questions = (Array.isArray(data?.questions) ? data.questions : []).slice(0, 10).map((item) => {
        const options = (Array.isArray(item?.options) ? item.options : []).slice(0, 4).map((option) => String(option || '').trim());
        return {
            questionText: String(item?.questionText || '').trim(),
            options,
            correctIndex: Number(item?.correctIndex),
            timer: Math.min(60, Math.max(5, Number(item?.timer) || 20)),
            explanation: String(item?.explanation || '').trim()
        };
    });

    const invalid = questions.length < 5 || questions.some((item) => (
        !item.questionText ||
        item.options.length !== 4 ||
        item.options.some((option) => !option) ||
        !Number.isInteger(item.correctIndex) ||
        item.correctIndex < 0 ||
        item.correctIndex > 3
    ));
    if (invalid) {
        const err = new Error('Gemini returned an incomplete quiz.');
        err.code = 'QUIZ_AI_INCOMPLETE';
        throw err;
    }
    return { title, questions };
}

async function generateQuiz({ topic, description, fileBase64, mimeType, fileName }) {
    const apiKey = getApiKey();
    if (!apiKey) {
        const err = new Error('GEMINI_API_KEY is not configured on the server.');
        err.code = 'GEMINI_KEY_MISSING';
        throw err;
    }

    const sourceParts = await buildSourceParts({ topic, description, fileBase64, mimeType, fileName });
    if (!sourceParts.length) {
        const err = new Error('Add a topic, description, or document before generating a quiz.');
        err.code = 'QUIZ_AI_SOURCE_REQUIRED';
        throw err;
    }

    const instruction = `Create a professional interactive live quiz from the supplied topic, description and/or document.

Requirements:
- Produce 5 to 10 questions.
- Every question must have exactly 4 distinct answer options.
- correctIndex must be the 0-based index of the correct option.
- Prefer practical understanding and realistic decisions over trivia.
- If the source is cybersecurity related, use realistic awareness scenarios where appropriate.
- Keep questions concise enough for a live audience to read quickly.
- Use plausible distractors; do not make the correct answer obviously longer or more detailed.
- timer should normally be 15, 20 or 30 seconds depending on reading difficulty.
- explanation should be 1 to 2 short sentences that teach why the answer is correct.
- Stay faithful to the supplied document. Do not invent policy facts, statistics or requirements.
- Return only the structured JSON response.`;

    const parts = [...sourceParts, { text: instruction }];
    let lastError = null;

    for (const model of modelCandidates()) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: {
                        responseMimeType: 'application/json',
                        responseJsonSchema: QUIZ_SCHEMA,
                        maxOutputTokens: 8192,
                        temperature: 0.45
                    }
                })
            });

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                lastError = new Error(`Gemini API error (${response.status})`);
                lastError.code = response.status === 429 ? 'GEMINI_QUOTA' : 'GEMINI_API_ERROR';
                logger.warn('quiz_ai_model_failed', { module: 'quiz', model, status: response.status, body: body.slice(0, 300) });
                continue;
            }

            const raw = await response.json();
            const candidate = raw?.candidates?.[0];
            const text = (candidate?.content?.parts || [])
                .filter((part) => part && part.thought !== true)
                .map((part) => part.text || '')
                .join('')
                .trim();
            const quiz = normalizeQuiz(parseQuizJson(text));
            logger.info('quiz_ai_generated', { module: 'quiz', model, questions: quiz.questions.length });
            return quiz;
        } catch (err) {
            lastError = err;
            logger.warn('quiz_ai_generation_attempt_failed', { module: 'quiz', model, error: err.message, code: err.code });
        }
    }

    throw lastError || new Error('AI failed to generate quiz. Please try again.');
}

module.exports = {
    generateQuiz,
    parseQuizJson,
    normalizeQuiz,
    buildSourceParts
};
