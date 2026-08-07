/**
 * Server-side port of policy-to-scorm-engine/geminiService.ts
 * Gemini API key stays on the server (GEMINI_API_KEY).
 */
const JSZip = require('jszip');
const logger = require('../../utils/logger');

const DETAIL_CONFIG = {
    detailed: { slides: '8-12', minWords: '100-150' },
    condensed: { slides: '5-7', minWords: '60-90' },
    summary: { slides: '3-4', minWords: '40-60' }
};

async function extractTextFromPptx(base64Data) {
    try {
        const zip = await JSZip.loadAsync(base64Data, { base64: true });
        let fullText = '';
        const slideFiles = Object.keys(zip.files)
            .filter((n) => n.startsWith('ppt/slides/slide') && n.endsWith('.xml'))
            .sort((a, b) => {
                const numA = parseInt(a.replace(/\D/g, '') || '0', 10);
                const numB = parseInt(b.replace(/\D/g, '') || '0', 10);
                return numA - numB;
            });
        for (const slide of slideFiles) {
            const xmlText = await zip.file(slide).async('string');
            const textMatches = xmlText.match(/<a:t>([^<]+)<\/a:t>/g);
            if (textMatches) {
                fullText += textMatches.map((t) => t.replace(/<\/?a:t>/g, '')).join(' ') + '\n\n';
            }
        }
        return fullText || 'No text extracted from PowerPoint.';
    } catch (err) {
        logger.warn('scorm_pptx_extract_failed', { module: 'scorm', error: err.message });
        return 'Error extracting text from PowerPoint.';
    }
}

function getApiKey() {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

/**
 * @param {object} opts
 * @param {string} opts.fileBase64 - raw file bytes as base64 (no data: prefix)
 * @param {string} opts.mimeType
 * @param {'detailed'|'condensed'|'summary'} [opts.detailLevel]
 * @returns {Promise<{title,summary,slides,quiz}>}
 */
async function analyzePolicy({ fileBase64, mimeType, detailLevel = 'detailed' }) {
    const apiKey = getApiKey();
    if (!apiKey) {
        const e = new Error('GEMINI_API_KEY is not configured on the server');
        e.code = 'GEMINI_KEY_MISSING';
        throw e;
    }

    const level = DETAIL_CONFIG[detailLevel] || DETAIL_CONFIG.detailed;
    const parts = [];

    const isPptx =
        (mimeType || '').includes('presentationml.presentation') ||
        (mimeType || '').includes('powerpoint') ||
        (mimeType || '').includes('vnd.ms-powerpoint');

    if (isPptx) {
        const text = await extractTextFromPptx(fileBase64);
        parts.push({ text: `SOURCE DOCUMENT (extracted from PowerPoint):\n\n${text}` });
    } else {
        // PDF and other binary types as inline data
        parts.push({
            inlineData: {
                data: fileBase64,
                mimeType: mimeType || 'application/pdf'
            }
        });
    }

    parts.push({
        text: `You are an expert instructional designer. Analyze this policy document and transform it into a ${detailLevel}, engaging, corporate e-learning module.

RULES — follow all of these strictly:

1. SLIDES (generate ${level.slides} slides):
   - "title": A clear, professional slide title (title case, no ALL CAPS).
   - "content": A rich, well-written explanatory paragraph (minimum ${level.minWords} words).
   - "keyPoints": Array of 3–5 short, punchy bullet points.
   - "imageQuery": A short 2-3 word search query for a professional photo.

2. QUIZ (generate 5–8 questions):
   - Each question must test specific knowledge from the document.
   - 4 answer options per question.
   - "correctAnswer" is the 0-based index of the correct option.

3. OUTPUT must be valid JSON with keys: title, summary, slides, quiz.`
    });

    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const body = {
        contents: [{ parts }],
        generationConfig: {
            responseMimeType: 'application/json'
        }
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        logger.error('scorm_gemini_failed', {
            module: 'scorm',
            status: res.status,
            body: errText.slice(0, 500)
        });
        const e = new Error(`Gemini API error (${res.status})`);
        e.code = 'GEMINI_API_ERROR';
        e.status = res.status;
        throw e;
    }

    const data = await res.json();
    const text =
        data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '{}';

    let analysis;
    try {
        analysis = JSON.parse(text);
    } catch (_) {
        const e = new Error('Gemini returned invalid JSON');
        e.code = 'GEMINI_BAD_JSON';
        throw e;
    }

    if (!analysis.title || !Array.isArray(analysis.slides) || !Array.isArray(analysis.quiz)) {
        const e = new Error('Gemini analysis missing required fields');
        e.code = 'GEMINI_INCOMPLETE';
        throw e;
    }

    return analysis;
}

module.exports = {
    analyzePolicy,
    getApiKey,
    extractTextFromPptx
};
