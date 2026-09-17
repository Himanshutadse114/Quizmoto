'use strict';

const express = require('express');
const { API_ROOT, getApiKey, textModel, imageModel, requestHeaders } = require('../../services/openai/OpenAiClient');

const router = express.Router();
const DIAGNOSTIC_RELEASE = 'openai-budget-course-v1';
const CACHE_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15000;
let cached = null;

function clean(value) { return String(value || '').trim(); }

function redact(value) {
    return clean(value)
        .replace(/sk-[A-Za-z0-9_-]{16,}/g, '[redacted]')
        .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi, '$1[redacted]')
        .slice(0, 500);
}

async function probeModel(model) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    timer.unref?.();
    try {
        const response = await fetch(`${API_ROOT}/models/${encodeURIComponent(model)}`, {
            headers: requestHeaders(),
            signal: controller.signal
        });
        const text = await response.text();
        let payload = null;
        try { payload = text ? JSON.parse(text) : {}; } catch (_) {}
        if (!response.ok) {
            return {
                ok: false,
                httpStatus: response.status,
                code: clean(payload?.error?.code || payload?.error?.type) || 'OPENAI_MODEL_ACCESS_FAILED',
                message: redact(payload?.error?.message || text || 'OpenAI model access failed.')
            };
        }
        return { ok: true, httpStatus: response.status, id: clean(payload?.id) || model };
    } catch (error) {
        return { ok: false, httpStatus: null, code: 'OPENAI_NETWORK', message: redact(error.message) };
    } finally {
        clearTimeout(timer);
    }
}

async function runProbe() {
    const checkedAt = new Date().toISOString();
    const configuredTextModel = textModel();
    const configuredImageModel = imageModel();
    if (!getApiKey()) {
        return {
            ok: false,
            release: DIAGNOSTIC_RELEASE,
            checkedAt,
            apiKeyConfigured: false,
            keySource: null,
            provider: 'openai',
            textModel: configuredTextModel,
            imageModel: configuredImageModel,
            error: 'OPENAI_API_KEY is not configured on the backend.'
        };
    }

    const [textModelAccess, imageModelAccess] = await Promise.all([
        probeModel(configuredTextModel),
        probeModel(configuredImageModel)
    ]);
    return {
        ok: Boolean(textModelAccess.ok && imageModelAccess.ok),
        release: DIAGNOSTIC_RELEASE,
        checkedAt,
        apiKeyConfigured: true,
        keySource: 'OPENAI_API_KEY',
        provider: 'openai',
        endpoint: API_ROOT,
        textModel: configuredTextModel,
        imageModel: configuredImageModel,
        textModelAccess,
        imageModelAccess,
        budget: {
            courseBudgetInr: Number(process.env.OPENAI_COURSE_BUDGET_INR || 10),
            maxImages: Number(process.env.OPENAI_SCORM_MAX_IMAGES || 6),
            imageQuality: 'low',
            targetSeconds: 180
        },
        note: 'This diagnostic checks model access without generating billable course content or images.'
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
            provider: 'openai',
            error: redact(error.message || 'OpenAI diagnostic failed unexpectedly.')
        });
    }
});

module.exports = router;
