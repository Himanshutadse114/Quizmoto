const express = require('express');
const {
    modelMethodUrl,
    transportName,
    useVertexExpress,
    cloudProject,
    isImageModel
} = require('../../services/scorm/GoogleGenAiTransport');

const router = express.Router();

const DIAGNOSTIC_RELEASE = 'vertex-express-diagnostic-v7';
const CACHE_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15000;
let cached = null;

function clean(value) {
    return String(value || '').trim();
}

function apiKeyInfo() {
    if (clean(process.env.GEMINI_API_KEY)) {
        return { key: clean(process.env.GEMINI_API_KEY), source: 'GEMINI_API_KEY' };
    }
    if (clean(process.env.GOOGLE_API_KEY)) {
        return { key: clean(process.env.GOOGLE_API_KEY), source: 'GOOGLE_API_KEY' };
    }
    return { key: '', source: null };
}

function textModel() {
    return clean(process.env.GOOGLE_TEXT_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash');
}

function imageModel() {
    return clean(process.env.GOOGLE_IMAGE_MODEL || process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image');
}

function redact(value) {
    return clean(value)
        .replace(/AIza[A-Za-z0-9_-]{20,}/g, '[redacted]')
        .replace(/([?&]key=)[^&\s]+/gi, '$1[redacted]')
        .slice(0, 500);
}

async function requestJson(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    timer.unref?.();
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        const text = await response.text();
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch (_) {}
        return { response, text, json };
    } finally {
        clearTimeout(timer);
    }
}

function failure(result, fallbackCode) {
    const status = Number(result?.response?.status || 0);
    const body = result?.json || {};
    const googleError = body?.error || {};
    return {
        ok: false,
        httpStatus: status || null,
        code: clean(googleError.status || fallbackCode || 'GOOGLE_API_ERROR'),
        message: redact(googleError.message || result?.text || 'Google API request failed.')
    };
}

async function probeModelAccess(apiKey, model) {
    try {
        const result = await requestJson(modelMethodUrl(model, 'countTokens', apiKey), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: 'health check' }] }]
            })
        });
        if (!result.response.ok) return failure(result, 'MODEL_ACCESS_FAILED');
        return {
            ok: true,
            httpStatus: result.response.status,
            totalTokens: Number(result.json?.totalTokens || result.json?.total_tokens || 0) || null
        };
    } catch (error) {
        return { ok: false, httpStatus: null, code: 'NETWORK_ERROR', message: redact(error.message) };
    }
}

async function probeTextGeneration(apiKey, model, structured = false) {
    const schema = {
        type: 'object',
        properties: { ok: { type: 'boolean' } },
        required: ['ok']
    };
    const generationConfig = structured
        ? {
            temperature: 0,
            maxOutputTokens: 128,
            responseMimeType: 'application/json',
            responseJsonSchema: schema
        }
        : { temperature: 0, maxOutputTokens: 128 };

    // Gemini 2.5 Flash defaults to dynamic thinking. A tiny health probe can spend
    // its entire output allowance on thoughts and return MAX_TOKENS with no visible
    // text. Disable thinking for this diagnostic only; the course generator keeps
    // its own production thinking configuration.
    if (/^gemini-2\.5-flash(?:$|-)/i.test(clean(model))) {
        generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    const prompt = structured
        ? 'Return one JSON object with ok set to true.'
        : 'Reply with exactly OK.';

    try {
        const result = await requestJson(modelMethodUrl(model, 'generateContent', apiKey), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig
            })
        });
        if (!result.response.ok) {
            return failure(result, structured ? 'STRUCTURED_OUTPUT_FAILED' : 'TEXT_GENERATION_FAILED');
        }
        const parts = result.json?.candidates?.[0]?.content?.parts || [];
        const output = parts.map((part) => part?.text || '').join('').trim();
        return {
            ok: Boolean(output),
            httpStatus: result.response.status,
            output: redact(output).slice(0, 100),
            finishReason: clean(result.json?.candidates?.[0]?.finishReason || '') || null
        };
    } catch (error) {
        return { ok: false, httpStatus: null, code: 'NETWORK_ERROR', message: redact(error.message) };
    }
}

async function runProbe() {
    const keyInfo = apiKeyInfo();
    const configuredTextModel = textModel();
    const configuredImageModel = imageModel();
    const checkedAt = new Date().toISOString();
    const transport = transportName();
    const transportOverride = clean(process.env.GOOGLE_GENAI_TRANSPORT) || null;
    const legacyVertexFlag = clean(process.env.GOOGLE_GENAI_USE_VERTEXAI) || null;
    const projectConfigured = Boolean(cloudProject());

    if (!keyInfo.key) {
        return {
            ok: false,
            release: DIAGNOSTIC_RELEASE,
            checkedAt,
            apiKeyConfigured: false,
            keySource: null,
            transport,
            transportOverride,
            legacyVertexFlag,
            cloudProjectConfigured: projectConfigured,
            textModel: configuredTextModel,
            imageModel: configuredImageModel,
            error: 'No GEMINI_API_KEY or GOOGLE_API_KEY is configured on the backend.'
        };
    }

    const [textModelAccess, imageModelAccess] = await Promise.all([
        probeModelAccess(keyInfo.key, configuredTextModel),
        probeModelAccess(keyInfo.key, configuredImageModel)
    ]);

    const textGeneration = textModelAccess.ok
        ? await probeTextGeneration(keyInfo.key, configuredTextModel, false)
        : { ok: false, code: 'TEXT_MODEL_UNAVAILABLE', message: 'Text model access failed before generation.' };

    const structuredOutput = textGeneration.ok
        ? await probeTextGeneration(keyInfo.key, configuredTextModel, true)
        : { ok: false, code: 'TEXT_GENERATION_UNAVAILABLE', message: 'Basic text generation failed before the structured-output probe.' };

    const imageUsesGlobalVertex = Boolean(useVertexExpress() && isImageModel(configuredImageModel) && projectConfigured);

    return {
        ok: Boolean(textModelAccess.ok && imageModelAccess.ok && textGeneration.ok && structuredOutput.ok),
        release: DIAGNOSTIC_RELEASE,
        checkedAt,
        apiKeyConfigured: true,
        keySource: keyInfo.source,
        transport,
        transportOverride,
        legacyVertexFlag,
        endpoint: useVertexExpress() ? 'aiplatform.googleapis.com' : 'generativelanguage.googleapis.com',
        textRoute: useVertexExpress() ? 'Vertex AI Express Mode' : 'Gemini Developer API',
        imageRoute: imageUsesGlobalVertex ? 'Vertex AI global publisher endpoint' : (useVertexExpress() ? 'Vertex AI Express Mode' : 'Gemini Developer API'),
        cloudProjectConfigured: projectConfigured,
        projectRequiredForText: false,
        projectRequiredForGlobalImage: true,
        serviceAccountJsonRequired: false,
        textModel: configuredTextModel,
        imageModel: configuredImageModel,
        textModelAccess,
        textGeneration,
        structuredOutput,
        imageModelAccess,
        note: projectConfigured
            ? 'Image-model access is checked on the Vertex global route with countTokens; no diagnostic image is generated.'
            : 'Set GOOGLE_CLOUD_PROJECT to route image generation to Vertex global. The Express account location may not serve this image model.'
    };
}

router.get('/', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const force = String(req.query?.refresh || '') === '1';
    if (!force && cached && Date.now() - cached.at < CACHE_MS) {
        return res.status(cached.value.ok ? 200 : 503).json({ ...cached.value, cached: true });
    }

    try {
        const value = await runProbe();
        cached = { at: Date.now(), value };
        return res.status(value.ok ? 200 : 503).json({ ...value, cached: false });
    } catch (error) {
        return res.status(503).json({
            ok: false,
            release: DIAGNOSTIC_RELEASE,
            checkedAt: new Date().toISOString(),
            transport: transportName(),
            error: redact(error.message || 'Google GenAI diagnostic failed unexpectedly.')
        });
    }
});

module.exports = router;
