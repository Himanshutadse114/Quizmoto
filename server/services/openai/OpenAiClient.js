'use strict';

const API_ROOT = 'https://api.openai.com/v1';
const DEFAULT_TEXT_MODEL = 'gpt-5.6-luna';
const DEFAULT_IMAGE_MODEL = 'gpt-image-2.5-flare';

const TEXT_INPUT_USD_PER_MILLION = 0.20;
const TEXT_OUTPUT_USD_PER_MILLION = 1.20;
// Low-quality landscape output is approximately $0.006 with the configured
// fast image model. Keep the estimate slightly conservative for budget gates.
const LOW_IMAGE_ESTIMATE_USD = 0.0065;

function clean(value) {
    return String(value || '').trim();
}

function clampInt(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.round(parsed)));
}

function getApiKey() {
    return clean(process.env.OPENAI_API_KEY);
}

function textModel() {
    return clean(process.env.OPENAI_TEXT_MODEL) || DEFAULT_TEXT_MODEL;
}

function imageModel() {
    return clean(process.env.OPENAI_IMAGE_MODEL) || DEFAULT_IMAGE_MODEL;
}

function requestHeaders(apiKey = getApiKey()) {
    if (!apiKey) {
        const error = new Error('OPENAI_API_KEY is not configured on the server.');
        error.code = 'OPENAI_KEY_MISSING';
        throw error;
    }
    const headers = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };
    if (clean(process.env.OPENAI_ORGANIZATION)) headers['OpenAI-Organization'] = clean(process.env.OPENAI_ORGANIZATION);
    if (clean(process.env.OPENAI_PROJECT)) headers['OpenAI-Project'] = clean(process.env.OPENAI_PROJECT);
    return headers;
}

function friendlyError(status, payload, fallback = 'OPENAI_API_ERROR') {
    const apiError = payload && typeof payload === 'object' ? payload.error || payload : {};
    const message = clean(apiError?.message) || `OpenAI API request failed (${status || 'network error'}).`;
    const error = new Error(message);
    error.status = Number(status) || 0;
    error.providerCode = clean(apiError?.code || apiError?.type) || null;
    if (status === 401) error.code = 'OPENAI_KEY_INVALID';
    else if (status === 403) error.code = 'OPENAI_FORBIDDEN';
    else if (status === 404) error.code = 'OPENAI_MODEL_NOT_FOUND';
    else if (status === 429) error.code = 'OPENAI_QUOTA';
    else if (status >= 500) error.code = 'OPENAI_UNAVAILABLE';
    else error.code = fallback;
    return error;
}

async function request(path, body, { timeoutMs = 90000, timeoutCode = 'OPENAI_TIMEOUT' } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), clampInt(timeoutMs, 90000, 1000, 300000));
    timeout.unref?.();
    try {
        const response = await fetch(`${API_ROOT}${path}`, {
            method: 'POST',
            headers: requestHeaders(),
            body: JSON.stringify(body),
            signal: controller.signal
        });
        const rawText = await response.text();
        let payload = null;
        try { payload = rawText ? JSON.parse(rawText) : {}; } catch (_) { payload = { raw: rawText }; }
        if (!response.ok) throw friendlyError(response.status, payload);
        return payload;
    } catch (error) {
        if (controller.signal.aborted || error?.name === 'AbortError') {
            const timeoutError = new Error('OpenAI request timed out. Please retry.');
            timeoutError.code = timeoutCode;
            throw timeoutError;
        }
        if (error?.code) throw error;
        const networkError = new Error(`OpenAI network error: ${error.message}`);
        networkError.code = 'OPENAI_NETWORK';
        throw networkError;
    } finally {
        clearTimeout(timeout);
    }
}

function strictJsonSchema(schema) {
    if (Array.isArray(schema)) return schema.map(strictJsonSchema);
    if (!schema || typeof schema !== 'object') return schema;
    const result = {};
    for (const [key, value] of Object.entries(schema)) result[key] = strictJsonSchema(value);
    if (result.type === 'object') result.additionalProperties = false;
    return result;
}

function outputText(response) {
    if (clean(response?.output_text)) return clean(response.output_text);
    const chunks = [];
    for (const item of Array.isArray(response?.output) ? response.output : []) {
        if (item?.type !== 'message') continue;
        for (const content of Array.isArray(item.content) ? item.content : []) {
            if (content?.type === 'output_text' && content.text) chunks.push(content.text);
        }
    }
    return chunks.join('').trim();
}

function usageCostUsd(usage = {}) {
    const input = Math.max(0, Number(usage.input_tokens) || 0);
    const output = Math.max(0, Number(usage.output_tokens) || 0);
    return (input / 1_000_000) * TEXT_INPUT_USD_PER_MILLION
        + (output / 1_000_000) * TEXT_OUTPUT_USD_PER_MILLION;
}

async function createStructuredResponse({
    input,
    instructions,
    schema,
    schemaName,
    maxOutputTokens = 14000,
    timeoutMs = 100000,
    model = textModel(),
    metadata
}) {
    const response = await request('/responses', {
        model,
        instructions,
        input,
        text: {
            format: {
                type: 'json_schema',
                name: clean(schemaName) || 'structured_response',
                strict: true,
                schema: strictJsonSchema(schema)
            },
            verbosity: 'low'
        },
        reasoning: { effort: 'none' },
        max_output_tokens: clampInt(maxOutputTokens, 14000, 256, 32000),
        store: false,
        ...(metadata ? { metadata } : {})
    }, { timeoutMs, timeoutCode: 'OPENAI_TIMEOUT' });

    if (response?.status === 'incomplete') {
        const error = new Error(`OpenAI response was incomplete (${clean(response?.incomplete_details?.reason) || 'unknown reason'}).`);
        error.code = 'OPENAI_INCOMPLETE';
        throw error;
    }
    const text = outputText(response);
    if (!text) {
        const refusal = (Array.isArray(response?.output) ? response.output : [])
            .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
            .find((item) => item?.type === 'refusal')?.refusal;
        const error = new Error(clean(refusal) || 'OpenAI returned an empty response.');
        error.code = refusal ? 'OPENAI_REFUSAL' : 'OPENAI_EMPTY';
        throw error;
    }
    return {
        text,
        model: clean(response?.model) || model,
        responseId: clean(response?.id) || null,
        usage: response?.usage || {},
        estimatedCostUsd: usageCostUsd(response?.usage)
    };
}

async function generateImage({
    prompt,
    model = imageModel(),
    quality = 'low',
    size = '1536x864',
    timeoutMs = 85000
}) {
    const response = await request('/images/generations', {
        model,
        prompt: clean(prompt),
        n: 1,
        size,
        quality,
        output_format: 'jpeg',
        output_compression: 68,
        background: 'opaque'
    }, { timeoutMs, timeoutCode: 'OPENAI_IMAGE_TIMEOUT' });
    const encoded = response?.data?.[0]?.b64_json;
    if (!encoded) {
        const error = new Error('OpenAI image generation returned no image data.');
        error.code = 'OPENAI_IMAGE_EMPTY';
        throw error;
    }
    const body = Buffer.from(encoded, 'base64');
    if (body.length < 512) {
        const error = new Error('OpenAI image generation returned incomplete image data.');
        error.code = 'OPENAI_IMAGE_EMPTY';
        throw error;
    }
    return {
        body,
        contentType: 'image/jpeg',
        model,
        usage: response?.usage || {},
        estimatedCostUsd: LOW_IMAGE_ESTIMATE_USD
    };
}

module.exports = {
    API_ROOT,
    DEFAULT_TEXT_MODEL,
    DEFAULT_IMAGE_MODEL,
    TEXT_INPUT_USD_PER_MILLION,
    TEXT_OUTPUT_USD_PER_MILLION,
    LOW_IMAGE_ESTIMATE_USD,
    getApiKey,
    textModel,
    imageModel,
    requestHeaders,
    friendlyError,
    request,
    strictJsonSchema,
    outputText,
    usageCostUsd,
    createStructuredResponse,
    generateImage,
    clampInt
};
