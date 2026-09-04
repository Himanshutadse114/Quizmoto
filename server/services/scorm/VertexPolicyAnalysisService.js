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

function templateInstruction(courseTemplateId, interactionLevel) {
    const templateId = String(courseTemplateId || '').trim().toLowerCase();
    const level = String(interactionLevel || '').trim().toLowerCase() || 'balanced';
    if (templateId !== 'scenario-learning') return '';

    const scenarioTarget = level === 'high'
        ? 'About 35-50% of suitable learning screens should be genuine workplace situations or decisions.'
        : level === 'balanced'
            ? 'About 25-35% of suitable learning screens should be genuine workplace situations or decisions.'
            : 'Use a small number of genuine workplace situations and keep the rest as guided explanation.';

    return `SELECTED COURSE EXPERIENCE: SCENARIO LEARNING (${level.toUpperCase()} INTERACTION)

This course will be rendered as a decision-led scenario experience. Write the learning content so the scenario template has meaningful material to work with rather than converting ordinary factual bullets into fake choices.

SCENARIO AUTHORING CONTRACT:
- ${scenarioTarget}
- A genuine scenario screen must establish a concrete workplace moment in the body. Use natural openings such as "Imagine...", "You notice...", "A colleague asks..." or "You are about to..." only where a real decision exists.
- On genuine scenario screens, keyPoints must be 3-7 word response choices, decision factors or observable clues that a learner could reasonably select. Do not use four unrelated facts and call them choices.
- Where response choices are used, include enough consequence and coaching language in the body for the renderer to explain why a response is safer, riskier or incomplete. Keep all guidance grounded in the supplied source.
- Do not force every screen into a decision. Definitions, ordered procedures, comparisons, warning-sign screens and reporting steps should remain process, comparison, hub or spotlight content when those structures teach the material better.
- Use process keyPoints for ordered actions, comparison keyPoints for meaningful contrasts and hub keyPoints for clues or warning signs.
- Do not invent organisation-specific policy, disciplinary outcomes, contacts, access rules or escalation routes that are not present in the source.
- The course should feel like a sequence of situation → learner judgement → consequence/coaching → safer behaviour, while still teaching essential concepts clearly.
- Avoid generic recap screens. Every scenario or interaction must change what the learner notices, decides or does.`;
}

async function analyzePolicy({
    fileBase64,
    mimeType,
    detailLevel = 'detailed',
    courseTemplateId = '',
    interactionLevel = ''
}) {
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
    const selectedTemplateInstruction = templateInstruction(courseTemplateId, interactionLevel);
    const baseParts = [
        ...sourceParts,
        { text: instruction },
        ...(selectedTemplateInstruction ? [{ text: selectedTemplateInstruction }] : [])
    ];
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
        courseTemplateId: String(courseTemplateId || '') || null,
        interactionLevel: String(interactionLevel || '') || null,
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
    mapVertexError,
    templateInstruction
};
