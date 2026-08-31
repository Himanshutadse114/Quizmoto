const logger = require('../../utils/logger');

const DEFAULT_FAL_MODEL = 'fal-ai/flux/schnell';
const DEFAULT_TIMEOUT_MS = 120000;

function clean(value) {
    return String(value || '').trim();
}

function clampInt(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.round(parsed)));
}

function falKey() {
    return clean(process.env.FAL_KEY || process.env.FAL_API_KEY);
}

function isFalConfigured() {
    return Boolean(falKey());
}

function safeModel(value) {
    const model = clean(value) || DEFAULT_FAL_MODEL;
    if (!/^[a-z0-9._/-]+$/i.test(model) || model.includes('..') || model.startsWith('/')) {
        const error = new Error('Invalid fal.ai model identifier.');
        error.code = 'FAL_MODEL_INVALID';
        throw error;
    }
    return model;
}

function falConfig() {
    const acceleration = clean(process.env.FAL_SCORM_ACCELERATION || 'regular').toLowerCase();
    const outputFormat = clean(process.env.FAL_SCORM_OUTPUT_FORMAT || 'jpeg').toLowerCase();
    return {
        model: safeModel(process.env.FAL_IMAGE_MODEL || DEFAULT_FAL_MODEL),
        timeoutMs: clampInt(process.env.FAL_SCORM_IMAGE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 10000, 300000),
        downloadTimeoutMs: clampInt(process.env.FAL_MEDIA_DOWNLOAD_TIMEOUT_MS, 30000, 5000, 120000),
        width: clampInt(process.env.FAL_SCORM_IMAGE_WIDTH, 1280, 512, 1920),
        height: clampInt(process.env.FAL_SCORM_IMAGE_HEIGHT, 720, 512, 1920),
        numInferenceSteps: clampInt(process.env.FAL_SCORM_INFERENCE_STEPS, 4, 1, 12),
        acceleration: ['none', 'regular', 'high'].includes(acceleration) ? acceleration : 'regular',
        outputFormat: ['jpeg', 'png'].includes(outputFormat) ? outputFormat : 'jpeg'
    };
}

function falEndpoint(model) {
    return `https://fal.run/${safeModel(model)}`;
}

function parseRetryAfter(value) {
    const raw = clean(value);
    if (!raw) return 0;
    const seconds = Number(raw);
    if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));
    const timestamp = Date.parse(raw);
    if (!Number.isFinite(timestamp)) return 0;
    return Math.max(0, timestamp - Date.now());
}

function errorMessage(payload, fallback) {
    if (typeof payload === 'string' && payload.trim()) return payload.trim().slice(0, 800);
    const detail = payload?.detail || payload?.message || payload?.error?.message || payload?.error;
    if (typeof detail === 'string' && detail.trim()) return detail.trim().slice(0, 800);
    if (Array.isArray(detail) && detail.length) {
        return detail.map((item) => item?.msg || item?.message || String(item || '')).filter(Boolean).join(' | ').slice(0, 800);
    }
    return fallback;
}

function falHttpError(response, payload) {
    const status = Number(response?.status || 0);
    const error = new Error(errorMessage(payload, `fal.ai request failed${status ? ` (${status})` : ''}.`));
    error.status = status;
    error.retryAfterMs = parseRetryAfter(response?.headers?.get?.('retry-after'));
    error.requestId = response?.headers?.get?.('x-fal-request-id') || null;
    if (status === 401 || status === 403) error.code = 'FAL_AUTH';
    else if (status === 402) error.code = 'FAL_BILLING';
    else if (status === 408 || status === 504) error.code = 'FAL_TIMEOUT';
    else if (status === 429) error.code = 'FAL_RATE_LIMIT';
    else if (status >= 500) error.code = 'FAL_UNAVAILABLE';
    else error.code = 'FAL_API_ERROR';
    return error;
}

async function fetchWithTimeout(url, options, timeoutMs, timeoutCode) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
        if (error?.name === 'AbortError') {
            const timeoutError = new Error('fal.ai image request timed out.');
            timeoutError.code = timeoutCode || 'FAL_TIMEOUT';
            throw timeoutError;
        }
        const networkError = new Error(`fal.ai network request failed: ${error?.message || 'network error'}`);
        networkError.code = 'FAL_NETWORK';
        throw networkError;
    } finally {
        clearTimeout(timer);
    }
}

function parseDataUri(value) {
    const match = String(value || '').match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\r\n]+)$/i);
    if (!match) return null;
    try {
        const body = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
        if (!body || body.length < 512) return null;
        return { body, contentType: match[1].toLowerCase() };
    } catch (_) {
        return null;
    }
}

async function downloadImage(url, timeoutMs) {
    const embedded = parseDataUri(url);
    if (embedded) return embedded;

    let parsed;
    try { parsed = new URL(String(url || '')); }
    catch (_) {
        const error = new Error('fal.ai returned an invalid image URL.');
        error.code = 'FAL_OUTPUT_INVALID';
        throw error;
    }
    if (!['https:', 'http:'].includes(parsed.protocol)) {
        const error = new Error('fal.ai returned an unsupported image URL.');
        error.code = 'FAL_OUTPUT_INVALID';
        throw error;
    }

    const response = await fetchWithTimeout(parsed.toString(), { method: 'GET' }, timeoutMs, 'FAL_MEDIA_DOWNLOAD');
    if (!response.ok) {
        const error = new Error(`fal.ai image download failed (${response.status}).`);
        error.code = 'FAL_MEDIA_DOWNLOAD';
        error.status = response.status;
        throw error;
    }
    const body = Buffer.from(await response.arrayBuffer());
    if (!body || body.length < 512) {
        const error = new Error('fal.ai image download was empty or incomplete.');
        error.code = 'FAL_IMAGE_EMPTY';
        throw error;
    }
    return {
        body,
        contentType: clean(response.headers.get('content-type')).split(';')[0] || 'image/jpeg'
    };
}

async function generateImage({ prompt, model, width, height, outputFormat, acceleration, numInferenceSteps } = {}) {
    const key = falKey();
    if (!key) {
        const error = new Error('FAL_KEY is required for FLUX Schnell image generation.');
        error.code = 'FAL_KEY_MISSING';
        throw error;
    }

    const config = falConfig();
    const selectedModel = safeModel(model || config.model);
    const selectedFormat = ['jpeg', 'png'].includes(clean(outputFormat).toLowerCase())
        ? clean(outputFormat).toLowerCase()
        : config.outputFormat;
    const selectedAcceleration = ['none', 'regular', 'high'].includes(clean(acceleration).toLowerCase())
        ? clean(acceleration).toLowerCase()
        : config.acceleration;
    const selectedWidth = clampInt(width, config.width, 512, 1920);
    const selectedHeight = clampInt(height, config.height, 512, 1920);
    const selectedSteps = clampInt(numInferenceSteps, config.numInferenceSteps, 1, 12);

    const response = await fetchWithTimeout(falEndpoint(selectedModel), {
        method: 'POST',
        headers: {
            Authorization: `Key ${key}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            prompt: clean(prompt),
            image_size: { width: selectedWidth, height: selectedHeight },
            num_inference_steps: selectedSteps,
            guidance_scale: 3.5,
            sync_mode: true,
            num_images: 1,
            enable_safety_checker: true,
            output_format: selectedFormat,
            acceleration: selectedAcceleration
        })
    }, config.timeoutMs, 'FAL_TIMEOUT');

    const rawText = await response.text();
    let payload = null;
    try { payload = rawText ? JSON.parse(rawText) : {}; }
    catch (_) { payload = rawText; }

    if (!response.ok) throw falHttpError(response, payload);

    const image = payload?.images?.[0];
    const imageUrl = clean(image?.url);
    if (!imageUrl) {
        const error = new Error('fal.ai FLUX Schnell returned no image.');
        error.code = 'FAL_IMAGE_EMPTY';
        throw error;
    }

    const downloaded = await downloadImage(imageUrl, config.downloadTimeoutMs);
    const requestId = response.headers.get('x-fal-request-id') || null;
    const contentType = clean(image?.content_type || downloaded.contentType) || (selectedFormat === 'png' ? 'image/png' : 'image/jpeg');

    logger.info('scorm_fal_image_ready', {
        module: 'scorm',
        model: selectedModel,
        requestId,
        width: Number(image?.width || selectedWidth),
        height: Number(image?.height || selectedHeight),
        contentType
    });

    return {
        body: downloaded.body,
        contentType,
        model: selectedModel,
        requestId,
        width: Number(image?.width || selectedWidth),
        height: Number(image?.height || selectedHeight),
        seed: payload?.seed ?? null
    };
}

module.exports = {
    DEFAULT_FAL_MODEL,
    DEFAULT_TIMEOUT_MS,
    falKey,
    isFalConfigured,
    falConfig,
    falEndpoint,
    falHttpError,
    parseDataUri,
    downloadImage,
    generateImage
};
