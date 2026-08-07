const express = require('express');
const router = express.Router();
const Runtime = require('../../services/scorm/ScormRuntimeService');

function bearer(req) {
    const h = req.header('Authorization') || '';
    return h.replace(/^Bearer\s+/i, '').trim();
}

router.post('/:regId/initialize', async (req, res) => {
    try {
        const result = await Runtime.initialize(req.params.regId, bearer(req));
        res.json(result);
    } catch (err) {
        const code = err.code === 'FORBIDDEN' ? 403 : err.code === 'NOT_FOUND' ? 404 : 500;
        res.status(code).json({ message: err.message, errorCode: 101 });
    }
});

router.get('/:regId/get', async (req, res) => {
    try {
        const result = await Runtime.getValue(req.params.regId, bearer(req), req.query.el || req.query.element);
        res.json(result);
    } catch (err) {
        const code = err.code === 'FORBIDDEN' ? 403 : err.code === 'NOT_FOUND' ? 404 : 500;
        res.status(code).json({ message: err.message, errorCode: 101, value: '' });
    }
});

router.post('/:regId/set', async (req, res) => {
    try {
        const { element, value, values } = req.body || {};
        if (values && typeof values === 'object') {
            let last = { ok: true, value: 'true', errorCode: 0 };
            for (const [el, val] of Object.entries(values)) {
                last = await Runtime.setValue(req.params.regId, bearer(req), el, val);
                if (!last.ok) break;
            }
            return res.json(last);
        }
        const result = await Runtime.setValue(req.params.regId, bearer(req), element, value);
        res.json(result);
    } catch (err) {
        const code = err.code === 'FORBIDDEN' ? 403 : err.code === 'NOT_FOUND' ? 404 : 500;
        res.status(code).json({ message: err.message, errorCode: 101, value: 'false' });
    }
});

router.post('/:regId/commit', async (req, res) => {
    try {
        const result = await Runtime.commit(req.params.regId, bearer(req));
        res.json(result);
    } catch (err) {
        const code = err.code === 'FORBIDDEN' ? 403 : err.code === 'NOT_FOUND' ? 404 : 500;
        res.status(code).json({ message: err.message, errorCode: 101, value: 'false' });
    }
});

router.post('/:regId/finish', async (req, res) => {
    try {
        const result = await Runtime.finish(req.params.regId, bearer(req));
        res.json(result);
    } catch (err) {
        const code = err.code === 'FORBIDDEN' ? 403 : err.code === 'NOT_FOUND' ? 404 : 500;
        res.status(code).json({ message: err.message, errorCode: 101, value: 'false' });
    }
});

module.exports = router;
