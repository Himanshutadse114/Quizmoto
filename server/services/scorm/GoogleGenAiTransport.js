const VERTEX_EXPRESS_BASE = 'https://aiplatform.googleapis.com/v1/publishers/google/models';
const GEMINI_DEVELOPER_HOST = 'generativelanguage.googleapis.com';
const INSTALL_MARKER = Symbol.for('quizmoto.vertexExpressFetchAdapter');

function clean(value) {
    return String(value || '').trim();
}

function normalizeBool(value, fallback = false) {
    if (value === undefined || value === null || clean(value) === '') return fallback;
    return ['true', '1', 'yes', 'y', 'on'].includes(clean(value).toLowerCase());
}

function requestedTransport() {
    return clean(process.env.GOOGLE_GENAI_TRANSPORT).toLowerCase();
}

function useVertexExpress() {
    const transport = requestedTransport();

    // Standard Gemini API-key mode is the safest default for LMSGEN because it
    // matches google.genai Client(api_key=...) and does not require a Google
    // Cloud project. Vertex is only enabled when it is explicitly requested.
    if (['developer', 'gemini-developer', 'gemini_developer', 'developer-api', 'gemini developer api'].includes(transport)) {
        return false;
    }
    if (['vertex', 'vertex-express', 'vertex_express', 'vertex-ai', 'vertex_ai', 'vertex ai', 'vertex ai express mode'].includes(transport)) {
        return true;
    }

    // Keep backwards compatibility with the original boolean flag, but default
    // it to false. An old GOOGLE_GENAI_USE_VERTEXAI=false must never be ignored.
    return normalizeBool(process.env.GOOGLE_GENAI_USE_VERTEXAI, false);
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

    // When Vertex is explicitly enabled and a Cloud project is available, use
    // the global publisher route for image models. Text can remain on Express.
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
    // Unit tests often replace global.fetch with stubs, so never wrap it there.
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
