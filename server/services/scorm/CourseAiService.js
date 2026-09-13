// Compatibility entry point retained for existing SCORM routes and tests.
// Course generation uses Vertex AI Express Mode by default with the same
// server-side API key that works with google.genai Client(vertexai=True, api_key=...).
// No service-account JSON or Google Cloud project ID is required for Express Mode.
const { installVertexExpressFetchAdapter, transportName } = require('./GoogleGenAiTransport');

installVertexExpressFetchAdapter();

if (!process.env.GEMINI_MODEL) {
    process.env.GEMINI_MODEL = String(process.env.GOOGLE_TEXT_MODEL || 'gemini-2.5-flash').trim();
}

process.env.GOOGLE_GENAI_TRANSPORT = transportName();

module.exports = require('./PolicyAnalysisService');
