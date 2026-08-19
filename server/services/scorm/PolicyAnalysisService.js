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

const VISUAL_POINT_WORD_LIMITS = {
    process: 8,
    timeline: 8,
    cycle: 8,
    matrix: 8,
    hub: 10,
    cards: 11,
    comparison: 12,
    spotlight: 12
};

const GENERIC_TITLES = new Set([
    'introduction',
    'overview',
    'key points',
    'key takeaways',
    'summary',
    'conclusion',
    'important information',
    'things to remember'
]);

const DEFAULT_MODEL_CANDIDATES = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest'
];

const GEMINI_3_THINKING_LEVELS = new Set(['minimal', 'low', 'medium', 'high']);

const SCORM_ANALYSIS_SCHEMA = {
    type: 'object',
    properties: {
        title: { type: 'string' },
        summary: { type: 'string' },
        slides: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    content: { type: 'string' },
                    keyPoints: { type: 'array', items: { type: 'string' } },
                    layout: {
                        type: 'string',
                        enum: ['process', 'cards', 'timeline', 'comparison', 'hub', 'spotlight', 'matrix', 'cycle']
                    },
                    visualTitle: { type: 'string' },
                    interaction: {
                        type: 'object',
                        properties: {
                            type: {
                                type: 'string',
                                enum: ['step_explore', 'hotspot_explore', 'compare_reveal', 'focus_reveal']
                            },
                            prompt: { type: 'string' }
                        },
                        required: ['type', 'prompt']
                    },
                    imageQuery: { type: 'string' }
                },
                required: ['title', 'content', 'keyPoints', 'layout', 'visualTitle', 'interaction', 'imageQuery']
            }
        },
        quiz: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    question: { type: 'string' },
                    options: { type: 'array', items: { type: 'string' } },
                    correctAnswer: { type: 'integer' },
                    explanation: { type: 'string' }
                },
                required: ['question', 'options', 'correctAnswer', 'explanation']
            }
        }
    },
    required: ['title', 'summary', 'slides', 'quiz']
};

// NOTE: Full implementation continues - this push is incomplete if truncated.
// See artifacts for complete file.
module.exports = {
    DETAIL_CONFIG,
    VISUAL_POINT_WORD_LIMITS,
    analyzePolicy: async function() {
        throw new Error('PolicyAnalysisService partial restore - full file must be applied from scorm-quality-fix pack');
    },
    getApiKey: function() { return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''; },
    qualityIssues: function() { return []; },
    analysisNeedsRefinement: function() { return false; },
    wordCount: function(v) { return String(v||'').trim().split(/\s+/).filter(Boolean).length; }
};
