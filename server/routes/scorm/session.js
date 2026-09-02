const express = require('express');
const router = express.Router();
const LearningState = require('../../services/scorm/ScormLearningStateService');
const { ScormAttempt } = require('../../models/scorm');

function tokenFor(req) {
    return LearningState.bearer(req) || String(req.query.token || req.body?.token || '').trim();
}

function statusFor(err) {
    if (err?.code === 'FORBIDDEN') return 403;
    if (err?.code === 'NOT_FOUND') return 404;
    if (err?.code === 'BAD_REQUEST') return 400;
    if (err?.code === 'SCORM_STATE_STORE_UNAVAILABLE' || err?.code === 'SCORM_STATE_WRITE_FAILED') return 503;
    return 500;
}

async function finishOpenAttempt(registrationId, event, state) {
    const normalizedEvent = String(event || '').toLowerCase();
    if (!['finish', 'terminate', 'exit'].includes(normalizedEvent)) return;
    try {
        const attempt = await ScormAttempt.findOne({
            where: { registrationId, finishedAt: null },
            order: [['attemptNo', 'DESC']]
        });
        if (!attempt) return;
        attempt.finishedAt = new Date();
        const exitValue = state?.values?.['cmi.core.exit'] || state?.values?.['cmi.exit'] || normalizedEvent;
        attempt.exitType = String(exitValue || normalizedEvent).slice(0, 255);
        await attempt.save();
    } catch (err) {
        console.warn('[scorm-attempt] finish projection skipped', {
            registrationId,
            event: normalizedEvent,
            error: err?.message || String(err),
            dbCode: err?.original?.code || err?.parent?.code || null
        });
    }
}

router.get('/:regId', async (req, res) => {
    try {
        const token = tokenFor(req);
        if (!token) return res.status(401).json({ message: 'Missing token' });
        const state = await LearningState.getState(req.params.regId, token);
        res.setHeader('Cache-Control', 'no-store');
        res.json({ ok: true, ...state });
    } catch (err) {
        console.error('[scorm-state-v4] load failed', {
            registrationId: req.params.regId,
            error: err?.message || String(err),
            code: err?.code || null,
            dbCode: err?.original?.code || err?.parent?.code || null
        });
        res.status(statusFor(err)).json({
            message: err.message || 'Unable to load learning state',
            code: err?.code || 'SCORM_STATE_LOAD_FAILED'
        });
    }
});

router.post('/:regId', express.json({ limit: '2mb' }), async (req, res) => {
    try {
        const token = tokenFor(req);
        if (!token) return res.status(401).json({ message: 'Missing token' });
        const result = await LearningState.saveState(req.params.regId, token, req.body || {});
        await finishOpenAttempt(req.params.regId, req.body?.event, result?.summary);
        res.setHeader('Cache-Control', 'no-store');
        res.json(result);
    } catch (err) {
        console.error('[scorm-state-v4] save failed', {
            registrationId: req.params.regId,
            event: req.body?.event || null,
            error: err?.message || String(err),
            code: err?.code || null,
            dbCode: err?.original?.code || err?.parent?.code || null
        });
        res.status(statusFor(err)).json({
            message: err.message || 'Unable to save learning state',
            code: err?.code || 'SCORM_STATE_SAVE_FAILED'
        });
    }
});

module.exports = router;
