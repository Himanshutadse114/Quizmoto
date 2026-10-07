'use strict';
/**
 * Forked worker for LMSGEN Video Studio jobs. Runs isolated from the web process.
 * Protocol (same as scormAiGenerationChild):
 *   parent -> { type: 'run', progressId, userId, payload }
 *   child  -> { type: 'progress', progressId, patch }
 *   child  -> { type: 'complete', progressId, result }
 *   child  -> { type: 'error', progressId, message, code }
 *   parent -> { type: 'cancel' }
 */

if (process.env.NODE_ENV === 'test') {
    require('dotenv').config({ path: '.env.test' });
} else {
    require('dotenv').config();
}

const { JOB_TYPES } = require('./jobTypes');
const VideoStudioService = require('../services/videoStudio/VideoStudioService');

let cancelled = false;
let running = false;

function cancellationError() {
    const error = new Error('Video generation was stopped.');
    error.code = 'VIDEO_GENERATION_CANCELLED';
    return error;
}

function checkCancelled() {
    if (cancelled) throw cancellationError();
}

/** Scrub anything secret-looking from error text before it reaches the client. */
function safeErrorMessage(value) {
    return String(value || 'Video generation failed.')
        .replace(/sk-[A-Za-z0-9_-]{10,}/g, '[REDACTED]')
        .replace(/([?&](?:key|api_key|apikey|token)=)[^&\s]+/gi, '$1[REDACTED]')
        .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi, '$1[REDACTED]')
        .replace(/((?:OPENAI_API_KEY)\s*=\s*)[^\s,;]+/gi, '$1[REDACTED]')
        .replace(/data:[^;\s]+;base64,[A-Za-z0-9+/=]+/gi, '[REDACTED_DATA_URL]')
        .slice(0, 1200);
}

function send(message) {
    if (typeof process.send === 'function') process.send(message);
}

process.on('message', async (message) => {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'cancel') {
        cancelled = true;
        return;
    }
    if (message.type !== 'run' || running) return;

    running = true;
    const { progressId, userId, payload } = message;
    const kind = payload && payload.kind;
    try {
        let result;
        const onProgress = (patch) => {
            checkCancelled();
            send({ type: 'progress', progressId, patch });
        };
        if (kind === JOB_TYPES.VIDEO_SCRIPT) {
            result = await VideoStudioService.generateScript({
                topic: payload.topic,
                description: payload.description,
                layout: payload.layout,
                seconds: payload.seconds
            });
        } else if (kind === JOB_TYPES.VIDEO_BUILD) {
            result = await VideoStudioService.buildVideo({
                blueprint: payload.blueprint,
                imageKeys: payload.imageKeys || {},
                userId,
                voice: payload.voice,
                onProgress
            });
        } else {
            throw Object.assign(new Error(`Unknown video job kind: ${kind}`), { code: 'VIDEO_KIND_UNKNOWN' });
        }
        checkCancelled();
        send({ type: 'complete', progressId, result });
        process.exitCode = 0;
    } catch (error) {
        send({
            type: 'error',
            progressId,
            message: safeErrorMessage(error && error.message),
            code: (error && error.code) || 'VIDEO_JOB_FAILED'
        });
        process.exitCode = 1;
    }
});
