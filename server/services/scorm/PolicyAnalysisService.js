/**
 * TEMPORARY bootstrap - full PolicyAnalysisService is being restored.
 * This unblocks the server from crashing on require().
 * Full quality fix (90-130 words, anti-repetition) is in the scorm-quality-fix pack.
 */
const JSZip = require('jszip');
const logger = require('../../utils/logger');

const DETAIL_CONFIG = {
    detailed: { slides: '8-12', screenWords: '90-130', minWords: 72 },
    condensed: { slides: '5-7', screenWords: '70-100', minWords: 55 },
    summary: { slides: '3-4', screenWords: '55-80', minWords: 42 }
};

const VISUAL_POINT_WORD_LIMITS = {
    process: 8, timeline: 8, cycle: 8, matrix: 8,
    hub: 10, cards: 11, comparison: 12, spotlight: 12
};

function getApiKey() {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

function wordCount(value) {
    return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function qualityIssues() { return []; }
function analysisNeedsRefinement() { return false; }

async function analyzePolicy() {
    const e = new Error(
        'PolicyAnalysisService is temporarily incomplete after a failed large-file push. ' +
        'Please apply the full file from the scorm-quality-fix pack ' +
        '(PolicyAnalysisService.js) via GitHub web UI, or ask the agent to retry the push.'
    );
    e.code = 'POLICY_ANALYSIS_INCOMPLETE';
    throw e;
}

async function extractTextFromPptx() { return ''; }
function modelCandidates() { return ['gemini-2.5-flash']; }
function thinkingLevel() { return 'low'; }
function generationConfigForModel() { return {}; }

module.exports = {
    analyzePolicy,
    getApiKey,
    extractTextFromPptx,
    modelCandidates,
    thinkingLevel,
    generationConfigForModel,
    DEFAULT_MODEL_CANDIDATES: ['gemini-2.5-flash'],
    DETAIL_CONFIG,
    VISUAL_POINT_WORD_LIMITS,
    SCORM_ANALYSIS_SCHEMA: { type: 'object' },
    analysisNeedsRefinement,
    qualityIssues,
    wordCount,
    jsonParseCandidates: () => [],
    parseAnalysis: () => ({}),
    geminiCandidate: () => ({ text: '' })
};
