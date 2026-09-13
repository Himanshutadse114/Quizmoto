// Compatibility entry point retained for existing SCORM routes and tests.
// Course generation uses the normal Gemini Developer API by default with the
// same server-side API key that works with google.genai Client(api_key=...).
// Vertex AI Express Mode remains available only when explicitly enabled.
const { installVertexExpressFetchAdapter } = require('./GoogleGenAiTransport');

installVertexExpressFetchAdapter();

if (!process.env.GEMINI_MODEL) {
    process.env.GEMINI_MODEL = String(process.env.GOOGLE_TEXT_MODEL || 'gemini-2.5-flash').trim();
}

module.exports = require('./PolicyAnalysisService');
