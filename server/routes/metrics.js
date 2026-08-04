/**
 * P3-T09 — export in-process metrics.
 * GET /api/metrics
 * Optional protection: set METRICS_TOKEN and send header x-metrics-token
 */

const express = require('express');
const Metrics = require('../utils/metrics');

const router = express.Router();

router.get('/', (req, res) => {
    const token = process.env.METRICS_TOKEN;
    if (token) {
        const provided = req.headers['x-metrics-token'] || req.query.token;
        if (provided !== token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
    }
    res.json(Metrics.snapshot());
});

module.exports = router;
