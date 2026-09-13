const VERTEX_EXPRESS_BASE = 'https://aiplatform.googleapis.com/v1/publishers/google/models';
const GEMINI_DEVELOPER_HOST = 'generativelanguage.googleapis.com';
const INSTALL_MARKER = Symbol.for('quizmoto.vertexExpressFetchAdapter');

function requestedTransport() {
    return String(process.env.GOOGLE_GENAI_TRANSPORT || '').trim().toLowerCase();
}

function useVertexExpress() {
    const transport = requestedTransport();

    // Vertex AI Express Mode is the canonical LMSGEN transport. The legacy
    // GOOGLE_GENAI_USE_VERTEXAI flag is intentionally ignored here because older
    // Render environments may still contain GOOGLE_GENAI_USE_VERTEXAI=false from
    // the previous Gemini Developer API implementation. Falling back to the
    // Developer API now requires an explicit GOOGLE_GENAI_TRANSPORT=developer.
    if (['developer', 'gemini-developer', 'gemini_developer', 'developer-api'].includes(transport)) {
        return false;
    }

    return true;
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

function installVertexExpressFetchAdapter() {
    // The application transport is installed only in runtime processes. Unit tests
    // frequently replace global.fetch with Sinon stubs; wrapping fetch during module
    // import would capture the pre-stub implementation and leak across test files.
    if (String(process.env.NODE_ENV || '').trim().toLowerCase() === 'test') return false;
    if (!useVertexExpress()) return false;
    if (globalThis[INSTALL_MARKER]) return true;
    if (typeof globalThis.fetch !== 'function') return false;

    const originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = (input, init) => originalFetch(rewriteGeminiUrl(input), init);
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
    installVertexExpressFetchAdapter
};
