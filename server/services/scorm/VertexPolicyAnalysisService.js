const logger = require('../../utils/logger');
const LegacyPolicy = require('./PolicyAnalysisService');
const { generateContent, vertexConfig } = require('./VertexAiClient');

function selectedTextModel() {
    return String(process.env.VERTEX_TEXT_MODEL || vertexConfig().textModel || 'gemini-2.5-flash').trim();
}

function mapVertexError(error) {
    const code = String(error?.code || '');
    if (code === 'VERTEX_QUOTA') error.code = 'GEMINI_QUOTA';
    else if (code === 'VERTEX_MODEL_NOT_FOUND') error.code = 'GEMINI_MODEL_NOT_FOUND';
    else if (code === 'VERTEX_AUTH' || code === 'VERTEX_FORBIDDEN') error.code = 'GEMINI_FORBIDDEN';
    else if (code === 'VERTEX_CONFIG_MISSING') error.code = 'GEMINI_KEY_MISSING';
    else if (code === 'VERTEX_UNAVAILABLE') error.code = 'GEMINI_NETWORK';
    return error;
}

async function callVertex({ model, parts }) {
    try {
        return await generateContent({
            model,
            contents: [{ role: 'user', parts }],
            generationConfig: LegacyPolicy.generationConfigForModel(model)
        });
    } catch (error) {
        throw mapVertexError(error);
    }
}

function parseCandidate(raw) {
    const candidate = LegacyPolicy.geminiCandidate(raw);
    return {
        candidate,
        analysis: LegacyPolicy.parseAnalysis(candidate.text)
    };
}

async function analyzePolicy({ fileBase64, mimeType, detailLevel = 'detailed' }) {
    const config = vertexConfig();
    if (!config.projectId) {
        const error = new Error('GOOGLE_CLOUD_PROJECT is not configured for Vertex AI.');
        error.code = 'GEMINI_KEY_MISSING';
        throw error;
    }

    const normalizedLevel = LegacyPolicy.normalizeDetailLevel(detailLevel);
    const level = LegacyPolicy.DETAIL_CONFIG[normalizedLevel];
    const sourceParts = [];
    const isPptx =
        String(mimeType || '').includes('presentationml.presentation') ||
        String(mimeType || '').includes('powerpoint') ||
        String(mimeType || '').includes('vnd.ms-powerpoint');

    if (isPptx) {
        const text = await LegacyPolicy.extractTextFromPptx(fileBase64);
        sourceParts.push({ text: `SOURCE DOCUMENT (extracted from PowerPoint):\n\n${text}` });
    } else if (fileBase64) {
        sourceParts.push({ inlineData: { data: fileBase64, mimeType: mimeType || 'application/pdf' } });
    }

    const instruction = LegacyPolicy.professionalInstruction(normalizedLevel, level);
    const baseParts = [...sourceParts, { text: instruction }];
    if (!fileBase64 && !sourceParts.length) {
        baseParts.unshift({ text: 'SOURCE: Course brief will be provided by the caller context or prior messages.' });
    }

    const model = selectedTextModel();
    let raw;
    try {
        raw = await callVertex({ model, parts: baseParts });
    } catch (error) {
        logger.error('scorm_vertex_content_failed', {
            module: 'scorm',
            model,
            code: error.code || null,
            status: error.status || null,
            error: error.message
        });
        throw error;
    }

    let parsed;
    try {
        parsed = parseCandidate(raw);
    } catch (error) {
        logger.warn('scorm_vertex_structured_output_invalid', {
            module: 'scorm',
            model,
            code: error.code || null,
            error: error.message
        });
        throw error;
    }

    let analysis = parsed.analysis;
    let issues = LegacyPolicy.qualityIssues(analysis, normalizedLevel);

    for (let pass = 0; pass < level.refinementPasses && issues.length; pass += 1) {
        const beforeIssueCount = issues.length;
        const beforeWords = LegacyPolicy.courseWordCount(analysis);
        const refinementPrompt = LegacyPolicy.refinementInstruction(
            analysis,
            issues,
            normalizedLevel,
            level
        );

        try {
            const refinedRaw = await callVertex({
                model,
                parts: [...baseParts, { text: refinementPrompt }]
            });
            const refined = parseCandidate(refinedRaw).analysis;
            const candidateIssues = LegacyPolicy.qualityIssues(refined, normalizedLevel);
            const candidateWords = LegacyPolicy.courseWordCount(refined);
            const improved =
                candidateIssues.length < beforeIssueCount ||
                (candidateIssues.length === beforeIssueCount && candidateWords > beforeWords);
            if (!improved) break;

            analysis = refined;
            issues = candidateIssues;
            logger.info('scorm_vertex_content_refined', {
                module: 'scorm',
                model,
                pass: pass + 1,
                issuesBefore: beforeIssueCount,
                issuesAfter: issues.length,
                wordsBefore: beforeWords,
                wordsAfter: candidateWords
            });
        } catch (error) {
            logger.warn('scorm_vertex_refinement_failed', {
                module: 'scorm',
                model,
                pass: pass + 1,
                code: error.code || null,
                error: error.message
            });
            break;
        }
    }

    analysis.aiProvider = 'vertex_ai';
    analysis.aiModel = model;
    analysis.aiPlatform = 'google_cloud_vertex_ai';

    logger.info('scorm_vertex_content_ready', {
        module: 'scorm',
        model,
        detailLevel: normalizedLevel,
        slides: Array.isArray(analysis.slides) ? analysis.slides.length : 0,
        courseWords: LegacyPolicy.courseWordCount(analysis),
        remainingQualityIssues: LegacyPolicy.qualityIssues(analysis, normalizedLevel).length
    });

    return analysis;
}

module.exports = {
    analyzePolicy,
    selectedTextModel,
    callVertex,
    mapVertexError
};
