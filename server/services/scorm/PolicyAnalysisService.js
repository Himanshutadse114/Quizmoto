/**
 * Server-side policy/PDF/PPT -> visual learning analysis.
 * Gemini API key stays on the server (GEMINI_API_KEY).
 */
const JSZip = require('jszip');
const logger = require('../../utils/logger');

const DETAIL_CONFIG = {
    // Body copy targets are intentionally rich: learners need real explanation,
    // not one-line stubs. keyPoints stay short visual labels (see VISUAL_POINT_*).
    detailed: { slides: '8-12', screenWords: '90-130', minWords: 72 },
    condensed: { slides: '5-7', screenWords: '70-100', minWords: 55 },
    summary: { slides: '3-4', screenWords: '55-80', minWords: 42 }
};

// TEMPORARY STUB - full content follows in next commit
module.exports = { analyzePolicy: async () => { throw new Error('PolicyAnalysisService is being restored'); } };
