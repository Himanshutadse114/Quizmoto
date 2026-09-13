const VERTEX_EXPRESS_BASE = 'https://aiplatform.googleapis.com/v1/publishers/google/models';
const GEMINI_DEVELOPER_HOST = 'generativelanguage.googleapis.com';
const INSTALL_MARKER = Symbol.for('quizmoto.vertexExpressFetchAdapter');

function normalizeBool(value, fallback = true) {
    if (value === undefined || value === null || String(value).trim() === '') return fallback;
    return ['true', '1', 'yes', 'y', 'on'].includes(String(value).trim().toLowerCase());
}

function useVertexExpress() {
    return normalizeBool(process.env.GOOGLE_GENAI_USE_VERTEXAI, true);
}

function transportName() {
    return useVertexExpress() ? 'Vertex AI Express Mode' : 'Gemini Developer API';
}

function expressModelUrl(model, method = 'generateContent', apiKey = '') {
    const safeModel = encodeURIComponent(String(model || '').trim());
    const safeMethod = String(method || 'generateContent').trim();
    const keyQuery = apiKey ? `?key=${encodeURIComponent(apiKey)}` : '';
    return `${VERTEX_EXPRESS_BASE}/${safeModel}:${safeMethod}${keyQuery}`;
}

function rewriteGeminiUrl(input) {
    if (!useVertexExpress()) return input;

    const raw = typeof input === 'string' || input instanceof URL ? String(input) : String(input?.url || '');
    if (!raw) return input;

    let url;
    try {
        url = new URL(raw);
    } catch (_) {
        return input;
    }

    if (url.hostname !== GEMINI_DEVELOPER_HOST) return input;

    const match = url.pathname.match(/^\/v1beta\/models\/([^/:]+):(generateContent|streamGenerateContent|countTokens)$/i);
    if (!match) return input;

    const model = decodeURIComponent(match[1]);
    const method = match[2];
    const rewritten = new URL(`${VERTEX_EXPRESS_BASE}/${encodeURIComponent(model)}:${method}`);
    rewritten.search = url.search;

    if (typeof input === 'string' || input instanceof URL) return rewritten.toString();
    return new Request(rewritten.toString(), input);
}

function rewriteGeminiInit(input, init) {
    if (!useVertexExpress() || !init || typeof init.body !== 'string') return init;

    const raw = typeof input === 'string' || input instanceof URL ? String(input) : String(input?.url || '');
    let url;
    try {
        url = new URL(raw);
    } catch (_) {
        return init;
    }
    if (url.hostname !== GEMINI_DEVELOPER_HOST) return init;

    try {
        const payload = JSON.parse(init.body);
        const generationConfig = payload?.generationConfig;
        if (generationConfig?.responseJsonSchema && !generationConfig.responseSchema) {
            generationConfig.responseSchema = generationConfig.responseJsonSchema;
            delete generationConfig.responseJsonSchema;
        }
        return { ...init, body: JSON.stringify(payload) };
    } catch (_) {
        return init;
    }
}

function installVertexExpressFetchAdapter() {
    if (!useVertexExpress()) return false;
    if (globalThis[INSTALL_MARKER]) return true;
    if (typeof globalThis.fetch !== 'function') return false;

    const originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = (input, init) => originalFetch(
        rewriteGeminiUrl(input),
        rewriteGeminiInit(input, init)
    );
    globalThis[INSTALL_MARKER] = { originalFetch };
    return true;
}

module.exports = {
    VERTEX_EXPRESS_BASE,
    GEMINI_DEVELOPER_HOST,
    useVertexExpress,
    transportName,
    expressModelUrl,
    rewriteGeminiUrl,
    rewriteGeminiInit,
    installVertexExpressFetchAdapter
};
