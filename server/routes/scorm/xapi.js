/**
 * xAPI (Experience API / Tin Can) endpoints scoped to a SCORM registration.
 *
 * POST /api/scorm/xapi/statements   — store one or more statements
 * GET  /api/scorm/xapi/statements   — list statements for this registration
 *
 * Auth: Bearer <scorm registration JWT>
 * Header (optional): X-Experience-API-Version: 1.0.3
 */
const express = require('express');
const router = express.Router();
const Xapi = require('../../services/scorm/XapiService');

router.use((req, res, next) => {
    res.setHeader('X-Experience-API-Version', '1.0.3');
    next();
});

router.post('/statements', async (req, res) => {
    try {
        const token = Xapi.bearer(req) || req.query.token || '';
        if (!token) return res.status(401).json({ message: 'Missing token' });
        const result = await Xapi.storeStatements(token, req.body);
        // xAPI often expects 204 or statement id(s) as plain text
        if (result.statementIds.length === 1) {
            res.status(200).type('text/plain').send(result.statementIds[0]);
        } else {
            res.status(200).json(result.statementIds);
        }
    } catch (err) {
        const code =
            err.code === 'FORBIDDEN' ? 403
                : err.code === 'NOT_FOUND' ? 404
                    : err.code === 'BAD_REQUEST' ? 400
                        : 500;
        res.status(code).json({ message: err.message });
    }
});

router.get('/statements', async (req, res) => {
    try {
        const token = Xapi.bearer(req) || req.query.token || '';
        if (!token) return res.status(401).json({ message: 'Missing token' });
        const statements = await Xapi.listStatements(token, { limit: req.query.limit });
        res.json({ statements });
    } catch (err) {
        const code = err.code === 'FORBIDDEN' ? 403 : err.code === 'NOT_FOUND' ? 404 : 500;
        res.status(code).json({ message: err.message });
    }
});

module.exports = router;
