const VERTEX_EXPRESS_BASE = 'https://aiplatform.googleapis.com/v1/publishers/google/models';
const GEMINI_DEVELOPER_HOST = 'generativelanguage.googleapis.com';
const VERTEX_HOST = 'aiplatform.googleapis.com';
const INSTALL_MARKER = Symbol.for('quizmoto.vertexExpressFetchAdapter');

function clean(value) {
    return String(value || '').trim();
}

function requestedTransport() {
    return clean(process.env.GOOGLE_GENAI_TRANSPORT).toLowerCase();
}

function useVertexExpress() {
    const transport = requestedTransport();

    // Vertex AI Express Mode is the canonical LMSGEN transport for the
    // service-account-bound key used by this deployment. The legacy
    // GOOGLE_GENAI_USE_VERTEXAI=false value is ignored so it cannot silently
    // send requests back to generativelanguage.googleapis.com.
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
    return `https://${VERTEX_HOST}/v1/projects/${encodeURIComponent(safeProject)}/locations/global/publishers/google/models/${safeModel}:${safeMethod}${keyQuery}`;
}

function developerModelUrl(model, method = 'generateContent', apiKey = '') {
    const keyQuery = apiKey ? `?key=${encodeURIComponent(apiKey)}` : '';
    return `https://${GEMINI_DEVELOPER_HOST}/v1beta/models/${encodeURIComponent(clean(model))}:${clean(method || 'generateContent')}${keyQuery}`;
}

function modelMethodUrl(model, method = 'generateContent', apiKey = '') {
    if (!useVertexExpress()) return developerModelUrl(model, method, apiKey);

    // The bound Express key resolves text correctly, while image generation must
    // use the global publisher route because the account's Express region does
    // not expose gemini-2.5-flash-image.
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

function isVertexRequest(input) {
    const raw = typeof input === 'string' || input instanceof URL ? String(input) : String(input?.url || '');
    if (!raw) return false;
    try {
        return new URL(raw).hostname === VERTEX_HOST;
    } catch (_) {
        return false;
    }
}

function decodeInlineText(part) {
    const inline = part?.inlineData || part?.inline_data;
    const mimeType = clean(inline?.mimeType || inline?.mime_type).toLowerCase();
    const data = clean(inline?.data);
    if (!data || !(mimeType === 'text/plain' || mimeType.startsWith('text/plain;'))) return part;

    try {
        return { text: Buffer.from(data, 'base64').toString('utf8') };
    } catch (_) {
        return part;
    }
}

function rewriteVertexRequestBody(body) {
    if (typeof body !== 'string' || !body.trim()) return body;

    let payload;
    try {
        payload = JSON.parse(body);
    } catch (_) {
        return body;
    }

    let changed = false;
    const generationConfig = payload?.generationConfig;
    if (generationConfig && generationConfig.responseJsonSchema && !generationConfig.responseSchema) {
        generationConfig.responseSchema = generationConfig.responseJsonSchema;
        delete generationConfig.responseJsonSchema;
        changed = true;
    }

    if (Array.isArray(payload?.contents)) {
        payload.contents = payload.contents.map((content) => {
            if (!Array.isArray(content?.parts)) return content;
            let contentChanged = false;
            const parts = content.parts.map((part) => {
                const next = decodeInlineText(part);
                if (next !== part) contentChanged = true;
                return next;
            });
            if (!contentChanged) return content;
            changed = true;
            return { ...content, parts };
        });
    }

    return changed ? JSON.stringify(payload) : body;
}

function normalizeVertexRequest(input, init) {
    const rewrittenInput = rewriteGeminiUrl(input);
    if (!useVertexExpress() || !isVertexRequest(rewrittenInput) || !init || typeof init !== 'object') {
        return { input: rewrittenInput, init };
    }

    const rewrittenBody = rewriteVertexRequestBody(init.body);
    if (rewrittenBody === init.body) return { input: rewrittenInput, init };
    return { input: rewrittenInput, init: { ...init, body: rewrittenBody } };
}

function installVertexExpressFetchAdapter() {
    // Unit tests frequently replace global.fetch with stubs; wrapping fetch during
    // module import would capture the pre-stub implementation and leak between tests.
    if (clean(process.env.NODE_ENV).toLowerCase() === 'test') return false;
    if (!useVertexExpress()) return false;
    if (globalThis[INSTALL_MARKER]) return true;
    if (typeof globalThis.fetch !== 'function') return false;

    const originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = (input, init) => {
        const normalized = normalizeVertexRequest(input, init);
        return originalFetch(normalized.input, normalized.init);
    };
    globalThis[INSTALL_MARKER] = { originalFetch };
    return true;
}

module.exports = {
    VERTEX_EXPRESS_BASE,
    GEMINI_DEVELOPER_HOST,
    VERTEX_HOST,
    useVertexExpress,
    transportName,
    cloudProject,
    isImageModel,
    expressModelUrl,
    globalVertexModelUrl,
    developerModelUrl,
    modelMethodUrl,
    rewriteGeminiUrl,
    rewriteVertexRequestBody,
    normalizeVertexRequest,
    installVertexExpressFetchAdapter
};
