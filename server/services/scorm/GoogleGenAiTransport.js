const VERTEX_EXPRESS_BASE = 'https://aiplatform.googleapis.com/v1/publishers/google/models';
const GEMINI_DEVELOPER_HOST = 'generativelanguage.googleapis.com';
const INSTALL_MARKER = Symbol.for('quizmoto.vertexExpressFetchAdapter');

function clean(value) {
    return String(value || '').trim();
}

function requestedTransport() {
    return clean(process.env.GOOGLE_GENAI_TRANSPORT).toLowerCase();
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

function cloudProject() {
    return clean(
        process.env.GOOGLE_CLOUD_PROJECT
        || process.env.GOOGLE_CLOUD_PROJECT_ID
        || process.env.GCP_PROJECT
        || process.env.GCLOUD_PROJECT
    );
}

function isImageModel(model) {
    const value = clean(model).toLowerCase();
    return value.includes('image') || value.startsWith('imagen-');
}

function expressModelUrl(model, method = 'generateContent', apiKey = '') {
    const safeModel = encodeURIComponent(clean(model));
    const safeMethod = clean(method || 'generateContent');
    const keyQuery = apiKey ? `?key=${encodeURIComponent(apiKey)}` : '';
    return `${VERTEX_EXPRESS_BASE}/${safeModel}:${safeMethod}${keyQuery}`;
}

function globalVertexModelUrl(model, method = 'generateContent', apiKey = '', project = cloudProject()) {
    const safeProject = clean(project);
    if (!safeProject) return '';
    const safeModel = encodeURIComponent(clean(model));
    const safeMethod = clean(method || 'generateContent');
    const keyQuery = apiKey ? `?key=${encodeURIComponent(apiKey)}` : '';
    return `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(safeProject)}/locations/global/publishers/google/models/${safeModel}:${safeMethod}${keyQuery}`;
}

function developerModelUrl(model, method = 'generateContent', apiKey = '') {
    const keyQuery = apiKey ? `?key=${encodeURIComponent(apiKey)}` : '';
    return `https://${GEMINI_DEVELOPER_HOST}/v1beta/models/${encodeURIComponent(clean(model))}:${clean(method || 'generateContent')}${keyQuery}`;
}

function modelMethodUrl(model, method = 'generateContent', apiKey = '') {
    if (!useVertexExpress()) return developerModelUrl(model, method, apiKey);

    // Gemini image-generation models are not served from the Singapore Express
    // location used by this account. When a Cloud project is configured, send
    // image calls to the standard Vertex global publisher endpoint with the same
    // service-account-bound API key. Text stays on the projectless Express route.
    if (isImageModel(model) && cloudProject()) {
        return globalVertexModelUrl(model, method, apiKey);
    }

    return expressModelUrl(model, method, apiKey);
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
    const target = modelMethodUrl(model, method, '');
    const rewritten = new URL(target);
    rewritten.search = url.search;

    if (typeof input === 'string' || input instanceof URL) return rewritten.toString();
    return new Request(rewritten.toString(), input);
}

function installVertexExpressFetchAdapter() {
    // The application transport is installed only in runtime processes. Unit tests
    // frequently replace global.fetch with Sinon stubs; wrapping fetch during module
    // import would capture the pre-stub implementation and leak across test files.
    if (clean(process.env.NODE_ENV).toLowerCase() === 'test') return false;
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
    cloudProject,
    isImageModel,
    expressModelUrl,
    globalVertexModelUrl,
    developerModelUrl,
    modelMethodUrl,
    rewriteGeminiUrl,
    installVertexExpressFetchAdapter
};
