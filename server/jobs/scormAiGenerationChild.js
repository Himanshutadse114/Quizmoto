if (process.env.NODE_ENV === 'test') {
    require('dotenv').config({ path: '.env.test' });
} else {
    require('dotenv').config();
}

const { generateScormCourse } = require('../services/scorm/ScormAiGenerationService');

let cancelled = false;
let running = false;

function cancellationError() {
    const error = new Error('Course generation was stopped.');
    error.code = 'SCORM_GENERATION_CANCELLED';
    return error;
}

function checkCancelled() {
    if (cancelled) throw cancellationError();
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
    try {
        const result = await generateScormCourse({
            payload: payload || {},
            userId,
            onProgress: (patch) => send({ type: 'progress', progressId, patch }),
            checkCancelled
        });
        checkCancelled();
        send({ type: 'complete', progressId, result });
        process.exitCode = 0;
    } catch (error) {
        send({
            type: 'error',
            progressId,
            error: {
                message: error?.message || 'Course generation failed.',
                code: error?.code || 'SCORM_AI_ERROR'
            }
        });
        process.exitCode = error?.code === 'SCORM_GENERATION_CANCELLED' ? 0 : 1;
    } finally {
        setTimeout(() => process.exit(process.exitCode || 0), 20).unref();
    }
});

process.on('disconnect', () => {
    if (!running) process.exit(0);
});
