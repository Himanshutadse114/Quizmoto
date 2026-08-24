const logger = require('../../utils/logger');

const REPLICATE_API_ROOT = 'https://api.replicate.com/v1';

let predictionGate = Promise.resolve();
let nextPredictionCreateAt = 0;

function clampInt(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.round(parsed)));
}

function getReplicateToken() {
    return String(process.env.REPLICATE_API_TOKEN || '').trim();
}

function hasReplicateToken() {
    return Boolean(getReplicateToken());
}

function predictionRequestsPerMinute() {
    // Some Replicate accounts are restricted to six prediction-creation
    // requests per minute. Use that conservative limit by default so multiple
    // simultaneous course builds do not collectively trigger 429 responses.
    return clampInt(process.env.REPLICATE_PREDICTIONS_PER_MINUTE, 6, 1, 600);
}

function predictionSpacingMs() {
    // Add a small safety margin for rolling-window rate-limit accounting.
    return Math.ceil(60000 / predictionRequestsPerMinute()) + 250;
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

function parseRetryAfterMs(response, body) {
    const rawHeader = String(response?.headers?.get?.('retry-after') || '').trim();
    if (rawHeader) {
        const seconds = Number(rawHeader);
        if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
        const dateMs = Date.parse(rawHeader);
        if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
    }

    const detail = String(body?.detail || body?.error || body?.title || '');
    const secondsMatch = detail.match(/(?:resets?\s+in|available\s+in|retry\s+in)\s*~?\s*([\d.]+)\s*(?:s|sec|secs|second|seconds)\b/i);
    if (secondsMatch) return Math.ceil(Number(secondsMatch[1]) * 1000);
    const minutesMatch = detail.match(/(?:resets?\s+in|available\s+in|retry\s+in)\s*~?\s*([\d.]+)\s*(?:m|min|mins|minute|minutes)\b/i);
    if (minutesMatch) return Math.ceil(Number(minutesMatch[1]) * 60000);
    return 0;
}

function friendlyReplicateError(status, body, model) {
    const detail = String(body?.detail || body?.error || body?.title || '').trim();
    if (status === 401) return { code: 'REPLICATE_KEY_INVALID', message: 'Replicate rejected REPLICATE_API_TOKEN. Check the Render environment variable and redeploy.' };
    if (status === 402) return { code: 'REPLICATE_BILLING', message: 'Replicate billing or credit is required before this course can be generated.' };
    if (status === 404) return { code: 'REPLICATE_MODEL_NOT_FOUND', message: `Replicate model is unavailable: ${model}.` };
    if (status === 429) return { code: 'REPLICATE_RATE_LIMIT', message: `Replicate is rate limiting prediction creation${detail ? `: ${detail}` : '. Please retry shortly.'}` };
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

function notifyThrottleWait(opts, model, waitMs) {
    if (typeof opts?.onStatus !== 'function' || waitMs <= 0) return;
    try {
        opts.onStatus({
            model,
            status: 'rate_limit_wait',
            predictionId: '',
            waitMs,
            rateLimitPerMinute: predictionRequestsPerMinute()
        });
    } catch (_) {}
}

async function waitForPredictionCreateSlot(model, opts = {}) {
    const scheduled = predictionGate.then(async () => {
        const now = Date.now();
        const waitMs = Math.max(0, nextPredictionCreateAt - now);
        notifyThrottleWait(opts, model, waitMs);
        if (waitMs > 0) await sleep(waitMs);

        const grantedAt = Date.now();
        nextPredictionCreateAt = grantedAt + predictionSpacingMs();
        return {
            grantedAt,
            waitedMs: waitMs,
            rateLimitPerMinute: predictionRequestsPerMinute()
        };
    });

    // Always release the queue, even when a caller later fails.
    predictionGate = scheduled.then(() => undefined, () => undefined);
    return scheduled;
}

async function runReplicateModel(model, input, opts = {}) {
    const token = getReplicateToken();
    if (!token) {
        const err = new Error('REPLICATE_API_TOKEN is not configured on the server.');
        err.code = 'REPLICATE_KEY_MISSING';
        throw err;
    }

    const waitSeconds = Math.max(1, Math.min(10, Number(opts.waitSeconds || 1)));
    const timeoutMs = Math.max(15000, Number(opts.timeoutMs || 240000));
    const totalStarted = Date.now();
    const endpoint = modelEndpoint(model);

    // Prediction creation is the rate-limited operation. Polling an already
    // created prediction uses Replicate's separate non-create endpoint budget.
    const slot = await waitForPredictionCreateSlot(model, opts);
    const predictionStarted = Date.now();

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
        err.retryAfterMs = response.status === 429 ? parseRetryAfterMs(response, prediction) : 0;
        throw err;
    }

    notifyStatus(opts, prediction, model);

    while (prediction && ['starting', 'processing'].includes(String(prediction.status || '').toLowerCase())) {
        if (Date.now() - predictionStarted > timeoutMs) {
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
            err.retryAfterMs = poll.status === 429 ? parseRetryAfterMs(poll, polled) : 0;
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
        queueWaitMs: slot.waitedMs,
        rateLimitPerMinute: slot.rateLimitPerMinute,
        predictionDurationMs: Date.now() - predictionStarted,
        totalDurationMs: Date.now() - totalStarted
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
    predictionRequestsPerMinute,
    predictionSpacingMs,
    waitForPredictionCreateSlot,
    parseRetryAfterMs,
    runReplicateModel,
    outputText,
    outputUrl,
    downloadReplicateAsset,
    modelEndpoint,
    friendlyReplicateError,
    notifyStatus,
    notifyThrottleWait
};
