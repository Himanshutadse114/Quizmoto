// Compatibility entry point retained for existing SCORM routes and tests.
// Course generation uses the Gemini Developer API with a server-side API key.
// A Google Cloud project ID is not required for this mode.
if (!process.env.GEMINI_MODEL) {
    process.env.GEMINI_MODEL = String(process.env.GOOGLE_TEXT_MODEL || 'gemini-2.5-flash').trim();
}

module.exports = require('./PolicyAnalysisService');
