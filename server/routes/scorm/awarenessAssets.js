'use strict';

const express = require('express');
const router = express.Router();
const AwarenessTemplateService = require('../../services/awareness/AwarenessTemplateService');

router.get('/:token', async (req, res) => {
    try {
        const asset = await AwarenessTemplateService.getPublicAsset(req.params.token);
        res.setHeader('Content-Type', asset.contentType || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.send(asset.body);
    } catch (error) {
        res.status(error.status || 404).end();
    }
});

module.exports = router;
