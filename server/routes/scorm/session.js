const express = require('express');
const router = express.Router();
const LearningState = require('../../services/scorm/ScormLearningStateService');

function tokenFor(req) {
    return LearningState.bearer(req) || String(req.query.token || req.body?.token || '').trim();
}

function statusFor(err) {
    if (err?.code === 'FORBIDDEN') return 403;
    if (err?.code === 'NOT_FOUND') return 404;
    if (err?.code === 'BAD_REQUEST') return 400;
    return 500;
}

router.get('/:regId', async (req, res) => {
    try {
        const token = tokenFor(req);
        if (!token) return res.status(401).json({ message: 'Missing token' });
        const state = await LearningState.getState(req.params.regId, token);
        res.setHeader('Cache-Control', 'no-store');
        res.json({ ok: true, ...state });
    } catch (err) {
        console.error('[scorm-state-v2] load failed', {
            registrationId: req.params.regId,
            error: err?.message || String(err),
            dbCode: err?.original?.code || err?.parent?.code || null
        });
        res.status(statusFor(err)).json({ message: err.message || 'Unable to load learning state' });
    }
});

router.post('/:regId', express.json({ limit: '2mb' }), async (req, res) => {
    try {
        const token = tokenFor(req);
        if (!token) return res.status(401).json({ message: 'Missing token' });
        const result = await LearningState.saveState(req.params.regId, token, req.body || {});
        res.setHeader('Cache-Control', 'no-store');
        res.json(result);
    } catch (err) {
        console.error('[scorm-state-v2] save failed', {
            registrationId: req.params.regId,
            event: req.body?.event || null,
            error: err?.message || String(err),
            dbCode: err?.original?.code || err?.parent?.code || null
        });
        res.status(statusFor(err)).json({ message: err.message || 'Unable to save learning state' });
    }
});

module.exports = router;
