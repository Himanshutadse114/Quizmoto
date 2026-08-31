// Compatibility entry point retained for existing SCORM routes and tests.
// All course text and visual-prompt generation now goes through Gemini on
// Google Vertex AI using the configured service-account credentials only.
module.exports = require('./GeminiServiceAccountCourseAiService');
