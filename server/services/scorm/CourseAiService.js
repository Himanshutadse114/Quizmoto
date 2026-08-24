const logger = require('../../utils/logger');
const GeminiPolicyAnalysisService = require('./PolicyAnalysisService');
const {
    hasReplicateToken,
    runReplicateModel,
    outputText
} = require('./ReplicateClient');

const DEFAULT_REPLICATE_TEXT_MODEL = 'ibm-granite/granite-3.3-8b-instruct';

function configuredTextModel() {
    return String(process.env.REPLICATE_SCORM_TEXT_MODEL || DEFAULT_REPLICATE_TEXT_MODEL).trim();
}

function selectedProvider() {
    const explicit = String(process.env.SCORM_AI_PROVIDER || '').trim().toLowerCase();
    if (explicit === 'gemini' || explicit === 'replicate') return explicit;
    return hasReplicateToken() ? 'replicate' : 'gemini';
}

function canUseGeminiFallback() {
    const enabled = String(process.env.SCORM_AI_FALLBACK_GEMINI || 'true').trim().toLowerCase() !== 'false';
    return enabled && Boolean(GeminiPolicyAnalysisService.getApiKey());
}

function sourceTextFromBase64(fileBase64, mimeType) {
    const mime = String(mimeType || '').toLowerCase();
    if (!fileBase64) return '';
    if (
        mime.startsWith('text/') ||
        mime.includes('json') ||
        mime.includes('csv') ||
        mime.includes('xml')
    ) {
        return Buffer.from(String(fileBase64), 'base64').toString('utf8');
    }
    return '';
}

async function extractReplicateSource({ fileBase64, mimeType }) {
    const mime = String(mimeType || '').toLowerCase();
    const plain = sourceTextFromBase64(fileBase64, mime);
    if (plain) return plain;

    const isPptx =
        mime.includes('presentationml.presentation') ||
        mime.includes('powerpoint') ||
        mime.includes('vnd.ms-powerpoint');
    if (isPptx) return GeminiPolicyAnalysisService.extractTextFromPptx(fileBase64);

    if (!fileBase64) return '';
    const err = new Error('Replicate course writing currently needs text/topic input or a PowerPoint source. PDF files can still use the Gemini fallback when GEMINI_API_KEY is configured.');
    err.code = 'REPLICATE_SOURCE_NEEDS_TEXT';
    throw err;
}

function cleanupModelText(text) {
    let value = String(text || '').trim();
    value = value.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const responseMatch = value.match(/<response>([\s\S]*?)<\/response>/i);
    if (responseMatch) value = responseMatch[1].trim();
    return value;
}

function replicateTextInput({ prompt, systemPrompt, temperature }) {
    return {
        prompt,
        system_prompt: systemPrompt,
        response_format: { type: 'json_object' },
        max_completion_tokens: Number(process.env.REPLICATE_SCORM_MAX_COMPLETION_TOKENS || 12288),
        min_tokens: 0,
        temperature,
        top_p: 0.9,
        top_k: 40,
        presence_penalty: 0.1,
        frequency_penalty: 0.05,
        stream: false
    };
}

async function generateReplicateDraft({ sourceText, detailLevel }) {
    const normalizedLevel = GeminiPolicyAnalysisService.normalizeDetailLevel(detailLevel);
    const level = GeminiPolicyAnalysisService.DETAIL_CONFIG[normalizedLevel];
    const instruction = GeminiPolicyAnalysisService.professionalInstruction(normalizedLevel, level);
    const prompt = [
        'SOURCE MATERIAL:',
        String(sourceText || '').trim() || 'No source document was supplied. Build only from the course brief included below.',
        '',
        instruction,
        '',
        'STRICT OUTPUT REMINDER: Return one complete JSON object only. Do not wrap it in markdown fences.'
    ].join('\n');

    const output = await runReplicateModel(configuredTextModel(), replicateTextInput({
        prompt,
        systemPrompt: 'You are a senior instructional designer. Follow the requested JSON structure exactly and never output commentary outside the JSON.',
        temperature: Number(process.env.REPLICATE_SCORM_TEMPERATURE || 0.25)
    }), { timeoutMs: Number(process.env.REPLICATE_SCORM_TEXT_TIMEOUT_MS || 300000) });

    const text = cleanupModelText(outputText(output));
    return GeminiPolicyAnalysisService.parseAnalysis(text);
}

async function refineReplicateDraft({ sourceText, analysis, detailLevel, issues }) {
    const normalizedLevel = GeminiPolicyAnalysisService.normalizeDetailLevel(detailLevel);
    const level = GeminiPolicyAnalysisService.DETAIL_CONFIG[normalizedLevel];
    const refinement = GeminiPolicyAnalysisService.refinementInstruction(analysis, issues, normalizedLevel, level);
    const prompt = [
        'SOURCE MATERIAL (authoritative):',
        String(sourceText || '').trim(),
        '',
        refinement,
        '',
        'Return only the corrected complete JSON object.'
    ].join('\n');

    const output = await runReplicateModel(configuredTextModel(), replicateTextInput({
        prompt,
        systemPrompt: 'Act as a strict senior learning editor. Preserve supported facts and return valid JSON only.',
        temperature: 0.2
    }), { timeoutMs: Number(process.env.REPLICATE_SCORM_TEXT_TIMEOUT_MS || 300000) });
    return GeminiPolicyAnalysisService.parseAnalysis(cleanupModelText(outputText(output)));
}

async function analyzeWithReplicate({ fileBase64, mimeType, detailLevel = 'detailed' }) {
    if (!hasReplicateToken()) {
        const err = new Error('REPLICATE_API_TOKEN is not configured on the server.');
        err.code = 'REPLICATE_KEY_MISSING';
        throw err;
    }

    const normalizedLevel = GeminiPolicyAnalysisService.normalizeDetailLevel(detailLevel);
    const sourceText = await extractReplicateSource({ fileBase64, mimeType });
    let analysis = await generateReplicateDraft({ sourceText, detailLevel: normalizedLevel });
    let issues = GeminiPolicyAnalysisService.qualityIssues(analysis, normalizedLevel);
    const maxPasses = Math.max(0, Math.min(2, Number(process.env.REPLICATE_SCORM_REFINEMENT_PASSES || 1)));

    for (let pass = 0; pass < maxPasses && issues.length; pass += 1) {
        const beforeIssues = issues.length;
        const beforeWords = GeminiPolicyAnalysisService.courseWordCount(analysis);
        try {
            const candidate = await refineReplicateDraft({ sourceText, analysis, detailLevel: normalizedLevel, issues });
            const candidateIssues = GeminiPolicyAnalysisService.qualityIssues(candidate, normalizedLevel);
            const candidateWords = GeminiPolicyAnalysisService.courseWordCount(candidate);
            const improved = candidateIssues.length < beforeIssues || (candidateIssues.length === beforeIssues && candidateWords > beforeWords);
            if (!improved) break;
            analysis = candidate;
            issues = candidateIssues;
        } catch (err) {
            logger.warn('scorm_replicate_refinement_failed', { module: 'scorm', pass: pass + 1, error: err.message });
            break;
        }
    }

    analysis.aiProvider = 'replicate';
    analysis.aiModel = configuredTextModel();
    logger.info('scorm_replicate_course_ok', {
        module: 'scorm',
        model: configuredTextModel(),
        detailLevel: normalizedLevel,
        slides: analysis.slides.length,
        courseWords: GeminiPolicyAnalysisService.courseWordCount(analysis),
        remainingQualityIssues: GeminiPolicyAnalysisService.qualityIssues(analysis, normalizedLevel).length
    });
    return analysis;
}

async function analyzePolicy(args) {
    const provider = selectedProvider();
    if (provider === 'replicate') {
        try {
            return await analyzeWithReplicate(args || {});
        } catch (err) {
            if (!canUseGeminiFallback()) throw err;
            logger.warn('scorm_replicate_fallback_gemini', { module: 'scorm', code: err.code, error: err.message });
            const analysis = await GeminiPolicyAnalysisService.analyzePolicy(args || {});
            analysis.aiProvider = 'gemini_fallback';
            return analysis;
        }
    }
    return GeminiPolicyAnalysisService.analyzePolicy(args || {});
}

module.exports = {
    analyzePolicy,
    analyzeWithReplicate,
    extractReplicateSource,
    cleanupModelText,
    replicateTextInput,
    configuredTextModel,
    selectedProvider,
    DEFAULT_REPLICATE_TEXT_MODEL
};
