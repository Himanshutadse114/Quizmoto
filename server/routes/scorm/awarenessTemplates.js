'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const AwarenessTemplateService = require('../../services/awareness/AwarenessTemplateService');

function requireEditor(req, res, next) {
    const role = String(req.scormRole || '').toLowerCase();
    if (!['super_admin', 'admin', 'co_admin'].includes(role)) {
        return res.status(403).json({
            message: 'Template authoring access is required.',
            code: 'AWARENESS_TEMPLATE_EDITOR_REQUIRED'
        });
    }
    next();
}

function errorResponse(res, error, fallback) {
    return res.status(error.status || 500).json({
        ok: false,
        message: error.message || fallback,
        code: error.code || 'AWARENESS_TEMPLATE_ERROR'
    });
}

router.get('/catalog', auth, requireEditor, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
        ok: true,
        layouts: AwarenessTemplateService.catalogue(),
        mail: AwarenessTemplateService.mailStatus(),
        maxRecipientsPerSend: AwarenessTemplateService.MAX_RECIPIENTS_PER_SEND
    });
});

router.get('/', auth, requireEditor, async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store');
        res.json({
            ok: true,
            templates: await AwarenessTemplateService.listTemplates(req.userId)
        });
    } catch (error) {
        errorResponse(res, error, 'Unable to load awareness email templates.');
    }
});

router.post('/generate', auth, requireEditor, async (req, res) => {
    try {
        const template = await AwarenessTemplateService.createTemplate({
            hostId: req.userId,
            createdByUserId: req.authenticatedUserId || null,
            input: req.body || {}
        });
        res.status(201).json({ ok: true, template });
    } catch (error) {
        errorResponse(res, error, 'Unable to generate the awareness email template.');
    }
});

router.get('/:id', auth, requireEditor, async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store');
        res.json({
            ok: true,
            template: await AwarenessTemplateService.getTemplate(req.params.id, req.userId)
        });
    } catch (error) {
        errorResponse(res, error, 'Unable to load the awareness email template.');
    }
});

router.put('/:id', auth, requireEditor, async (req, res) => {
    try {
        const template = await AwarenessTemplateService.updateTemplate(req.params.id, req.userId, req.body || {});
        res.json({ ok: true, template });
    } catch (error) {
        errorResponse(res, error, 'Unable to save the awareness email template.');
    }
});

router.delete('/:id', auth, requireEditor, async (req, res) => {
    try {
        await AwarenessTemplateService.deleteTemplate(req.params.id, req.userId);
        res.json({ ok: true });
    } catch (error) {
        errorResponse(res, error, 'Unable to delete the awareness email template.');
    }
});

router.get('/:id/preview', auth, requireEditor, async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store');
        res.json({
            ok: true,
            preview: await AwarenessTemplateService.renderPreview(req.params.id, req.userId)
        });
    } catch (error) {
        errorResponse(res, error, 'Unable to build the email preview.');
    }
});

router.post('/:id/send', auth, requireEditor, async (req, res) => {
    try {
        const delivery = await AwarenessTemplateService.sendTemplate(
            req.params.id,
            req.userId,
            req.body?.recipients || req.body?.to || []
        );
        const status = delivery.failed && !delivery.sent ? 502 : 200;
        res.status(status).json({ ok: delivery.failed === 0, delivery });
    } catch (error) {
        errorResponse(res, error, 'Unable to send the awareness email.');
    }
});

router.post('/:id/export-eml', auth, requireEditor, async (req, res) => {
    try {
        const exported = await AwarenessTemplateService.exportEml(
            req.params.id,
            req.userId,
            String(req.body?.to || '').trim()
        );
        const safeName = String(exported.title || 'awareness-email')
            .replace(/[^a-z0-9._-]+/gi, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80) || 'awareness-email';
        res.setHeader('Content-Type', 'message/rfc822');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}.eml"`);
        res.setHeader('Cache-Control', 'private, no-store');
        res.send(exported.message);
    } catch (error) {
        errorResponse(res, error, 'Unable to export the awareness email.');
    }
});

module.exports = router;
