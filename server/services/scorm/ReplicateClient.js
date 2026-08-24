const logger = require('../../utils/logger');

const REPLICATE_API_ROOT = 'https://api.replicate.com/v1';

function getReplicateToken() {
    return String(process.env.REPLICATE_API_TOKEN || '').trim();
}

function hasReplicateToken() {
    return Boolean(getReplicateToken());
}

function modelEndpoint(model) {
    const value = String(model || '').trim();
    const parts = value.split('/').filter(Boolean);
    if (parts.length !== 2) {
        const err = new Error(`Invalid Replicate model identifier: ${value || 'empty'}`);
        err.code = 'REPLICATE_MODEL_INVALID';
        throw err;
    }
    return `${REPLICATE_API_ROOT}/models/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}/predictions`;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonResponse(res) {
    const text = await res.text().catch(() => '');
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch (_) {
        return { detail: text };
    }
}

function friendlyReplicateError(status, body, model) {
    const detail = String(body?.detail || body?.error || body?.title || '').trim();
    if (status === 401) return { code: 'REPLICATE_KEY_INVALID', message: 'Replicate rejected REPLICATE_API_TOKEN. Check the Render environment variable and redeploy.' };
    if (status === 402) return { code: 'REPLICATE_BILLING', message: 'Replicate billing or credit is required before this course can be generated.' };
    if (status === 404) return { code: 'REPLICATE_MODEL_NOT_FOUND', message: `Replicate model is unavailable: ${model}.` };
    if (status === 429) return { code: 'REPLICATE_RATE_LIMIT', message: 'Replicate is rate limiting requests. Please retry shortly.' };
    return { code: 'REPLICATE_API_ERROR', message: `Replicate API error (${status})${detail ? `: ${detail}` : ''}` };
}

function notifyStatus(opts, prediction, model) {
    if (typeof opts?.onStatus !== 'function') return;
    try {
        opts.onStatus({
            model,
            status: String(prediction?.status || 'unknown').toLowerCase(),
            predictionId: String(prediction?.id || ''),
            createdAt: prediction?.created_at || null,
            startedAt: prediction?.started_at || null,
            completedAt: prediction?.completed_at || null,
            metrics: prediction?.metrics || null
        });
    } catch (_) {}
}

async function runReplicateModel(model, input, opts = {}) {
    const token = getReplicateToken();
    if (!token) {
        const err = new Error('REPLICATE_API_TOKEN is not configured on the server.');
        err.code = 'REPLICATE_KEY_MISSING';
        throw err;
    }

    // Keep the synchronous wait short so callers can observe the real
    // prediction state (starting/processing) instead of being blind for 60s.
    const waitSeconds = Math.max(1, Math.min(10, Number(opts.waitSeconds || 1)));
    const timeoutMs = Math.max(15000, Number(opts.timeoutMs || 240000));
    const started = Date.now();
    const endpoint = modelEndpoint(model);

    let response;
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Prefer: `wait=${waitSeconds}`
            },
            body: JSON.stringify({ input: input || {} })
        });
    } catch (networkError) {
        const err = new Error(`Replicate network error: ${networkError.message}`);
        err.code = 'REPLICATE_NETWORK';
        throw err;
    }

    let prediction = await readJsonResponse(response);
    if (!response.ok) {
        const friendly = friendlyReplicateError(response.status, prediction, model);
        const err = new Error(friendly.message);
        err.code = friendly.code;
        err.status = response.status;
        throw err;
    }

    notifyStatus(opts, prediction, model);

    while (prediction && ['starting', 'processing'].includes(String(prediction.status || '').toLowerCase())) {
        if (Date.now() - started > timeoutMs) {
            const err = new Error(`Replicate prediction timed out for ${model}.`);
            err.code = 'REPLICATE_TIMEOUT';
            throw err;
        }
        await sleep(Number(opts.pollMs || 1200));
        const getUrl = prediction?.urls?.get;
        if (!getUrl) break;
        let poll;
        try {
            poll = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}` } });
        } catch (networkError) {
            logger.warn('replicate_prediction_poll_network', { module: 'scorm', model, error: networkError.message });
            continue;
        }
        const polled = await readJsonResponse(poll);
        if (!poll.ok) {
            const friendly = friendlyReplicateError(poll.status, polled, model);
            const err = new Error(friendly.message);
            err.code = friendly.code;
            err.status = poll.status;
            throw err;
        }
        prediction = polled;
        notifyStatus(opts, prediction, model);
    }

    const status = String(prediction?.status || '').toLowerCase();
    if (status && status !== 'succeeded') {
        const detail = String(prediction?.error || prediction?.logs || '').trim();
        const err = new Error(`Replicate prediction ${status || 'failed'}${detail ? `: ${detail.slice(0, 500)}` : ''}`);
        err.code = status === 'canceled' ? 'REPLICATE_CANCELED' : 'REPLICATE_PREDICTION_FAILED';
        throw err;
    }

    logger.info('replicate_prediction_ok', {
        module: 'scorm',
        model,
        predictionId: prediction?.id || null,
        durationMs: Date.now() - started
    });
    return prediction?.output;
}

function outputText(output) {
    if (Array.isArray(output)) return output.map((part) => String(part || '')).join('').trim();
    if (output && typeof output === 'object') {
        if (typeof output.text === 'string') return output.text.trim();
        if (typeof output.output === 'string') return output.output.trim();
    }
    return String(output || '').trim();
}

function outputUrl(output) {
    const value = Array.isArray(output) ? output[0] : output;
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value.url === 'string') return value.url;
    return String(value || '');
}

async function downloadReplicateAsset(url) {
    const source = String(url || '').trim();
    if (!/^https:\/\//i.test(source)) {
        const err = new Error('Replicate returned an invalid media URL.');
        err.code = 'REPLICATE_OUTPUT_INVALID';
        throw err;
    }
    const res = await fetch(source);
    if (!res.ok) {
        const err = new Error(`Failed to download Replicate media (${res.status}).`);
        err.code = 'REPLICATE_MEDIA_DOWNLOAD';
        throw err;
    }
    return Buffer.from(await res.arrayBuffer());
}

module.exports = {
    REPLICATE_API_ROOT,
    getReplicateToken,
    hasReplicateToken,
    runReplicateModel,
    outputText,
    outputUrl,
    downloadReplicateAsset,
    modelEndpoint,
    friendlyReplicateError,
    notifyStatus
};
