const { GoogleAuth } = require('google-auth-library');
const logger = require('../../utils/logger');

const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
let authInstance = null;
let authClientPromise = null;

function clean(value) {
    return String(value || '').trim();
}

function vertexConfig() {
    return {
        projectId: clean(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT),
        location: clean(process.env.GOOGLE_CLOUD_LOCATION) || 'global',
        textModel: clean(process.env.VERTEX_TEXT_MODEL) || 'gemini-2.5-flash',
        imageModel: clean(process.env.VERTEX_IMAGE_MODEL) || 'gemini-3.1-flash-lite-image'
    };
}

function isVertexConfigured() {
    const config = vertexConfig();
    return Boolean(config.projectId && (clean(process.env.GOOGLE_APPLICATION_CREDENTIALS) || clean(process.env.GOOGLE_CLOUD_PROJECT)));
}

function apiBase(location) {
    const loc = clean(location) || 'global';
    return loc === 'global'
        ? 'https://aiplatform.googleapis.com'
        : `https://${loc}-aiplatform.googleapis.com`;
}

function modelEndpoint(model, location, projectId) {
    const safeModel = encodeURIComponent(clean(model));
    const safeLocation = encodeURIComponent(clean(location) || 'global');
    const safeProject = encodeURIComponent(clean(projectId));
    return `${apiBase(location)}/v1/projects/${safeProject}/locations/${safeLocation}/publishers/google/models/${safeModel}:generateContent`;
}

function getAuth() {
    if (!authInstance) {
        authInstance = new GoogleAuth({ scopes: [CLOUD_PLATFORM_SCOPE] });
    }
    return authInstance;
}

async function getAuthClient() {
    if (!authClientPromise) {
        authClientPromise = getAuth().getClient().catch((error) => {
            authClientPromise = null;
            throw error;
        });
    }
    return authClientPromise;
}

function responseStatus(error) {
    return Number(error?.response?.status || error?.status || error?.code || 0) || 0;
}

function responseBody(error) {
    const data = error?.response?.data;
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object') {
        try { return JSON.stringify(data); } catch (_) {}
    }
    return String(error?.message || 'Vertex AI request failed.');
}

function vertexError(error, model) {
    const status = responseStatus(error);
    const body = responseBody(error);
    const messageFromApi = error?.response?.data?.error?.message;
    const err = new Error(messageFromApi || `Vertex AI request failed${status ? ` (${status})` : ''}.`);
    err.status = status;
    err.body = body;
    err.model = model;
    if (status === 401) err.code = 'VERTEX_AUTH';
    else if (status === 403) err.code = 'VERTEX_FORBIDDEN';
    else if (status === 404) err.code = 'VERTEX_MODEL_NOT_FOUND';
    else if (status === 429) err.code = 'VERTEX_QUOTA';
    else if (status >= 500) err.code = 'VERTEX_UNAVAILABLE';
    else err.code = error?.code || 'VERTEX_API_ERROR';
    return err;
}

async function generateContent({ model, contents, generationConfig, safetySettings }) {
    const config = vertexConfig();
    if (!config.projectId) {
        const err = new Error('GOOGLE_CLOUD_PROJECT is not configured for Vertex AI.');
        err.code = 'VERTEX_CONFIG_MISSING';
        throw err;
    }
    const selectedModel = clean(model) || config.textModel;
    const client = await getAuthClient();
    const body = {
        contents: Array.isArray(contents) ? contents : [contents]
    };
    if (generationConfig && Object.keys(generationConfig).length) body.generationConfig = generationConfig;
    if (safetySettings && Object.keys(safetySettings).length) body.safetySettings = safetySettings;

    try {
        const response = await client.request({
            url: modelEndpoint(selectedModel, config.location, config.projectId),
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            data: body,
            timeout: Number(process.env.VERTEX_REQUEST_TIMEOUT_MS || 180000)
        });
        return response.data;
    } catch (error) {
        const mapped = vertexError(error, selectedModel);
        logger.warn('vertex_ai_request_failed', {
            module: 'scorm',
            model: selectedModel,
            status: mapped.status || null,
            code: mapped.code,
            error: mapped.message
        });
        throw mapped;
    }
}

function firstImagePart(raw) {
    const candidates = Array.isArray(raw?.candidates) ? raw.candidates : [];
    for (const candidate of candidates) {
        const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
        for (const part of parts) {
            const inlineData = part?.inlineData || part?.inline_data;
            if (inlineData?.data && String(inlineData?.mimeType || inlineData?.mime_type || '').startsWith('image/')) {
                return {
                    data: String(inlineData.data),
                    mimeType: String(inlineData.mimeType || inlineData.mime_type || 'image/png')
                };
            }
        }
    }
    return null;
}

function responseText(raw) {
    return (Array.isArray(raw?.candidates) ? raw.candidates : [])
        .flatMap((candidate) => Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [])
        .map((part) => part?.text || '')
        .join(' ')
        .trim();
}

async function generateImage({ prompt, model, aspectRatio = '16:9' }) {
    const config = vertexConfig();
    const selectedModel = clean(model) || config.imageModel;
    const raw = await generateContent({
        model: selectedModel,
        contents: [{ role: 'user', parts: [{ text: clean(prompt) }] }],
        generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            maxOutputTokens: 4096,
            imageConfig: {
                aspectRatio,
                imageOutputOptions: { mimeType: 'image/webp' },
                personGeneration: 'ALLOW_NONE'
            }
        }
    });
    const image = firstImagePart(raw);
    if (!image) {
        const err = new Error(responseText(raw) || 'Vertex AI returned no generated image.');
        err.code = 'VERTEX_IMAGE_EMPTY';
        err.model = selectedModel;
        throw err;
    }
    let body;
    try {
        body = Buffer.from(image.data, 'base64');
    } catch (_) {
        const err = new Error('Vertex AI returned invalid image data.');
        err.code = 'VERTEX_IMAGE_INVALID';
        throw err;
    }
    if (!body || body.length < 512) {
        const err = new Error('Vertex AI returned an empty or incomplete image.');
        err.code = 'VERTEX_IMAGE_EMPTY';
        throw err;
    }
    return {
        body,
        contentType: image.mimeType,
        model: selectedModel,
        raw
    };
}

module.exports = {
    vertexConfig,
    isVertexConfigured,
    apiBase,
    modelEndpoint,
    generateContent,
    generateImage,
    firstImagePart,
    responseText
};
