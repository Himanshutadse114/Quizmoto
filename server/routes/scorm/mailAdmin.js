const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const MailService = require('../../services/mail/MailService');
const MailTemplateService = require('../../services/mail/MailTemplateService');

function requireAdmin(req, res, next) {
    if (!['super_admin', 'admin'].includes(String(req.scormRole || '').toLowerCase())) {
        return res.status(403).json({
            message: 'Tenant Admin access is required to test email delivery.',
            code: 'MAIL_ADMIN_REQUIRED'
        });
    }
    next();
}

function requireSuperAdmin(req, res, next) {
    if (String(req.scormRole || '').toLowerCase() !== 'super_admin') {
        return res.status(403).json({
            message: 'Super Admin access is required to manage platform email templates.',
            code: 'MAIL_TEMPLATE_SUPER_ADMIN_REQUIRED'
        });
    }
    next();
}

router.get('/status', auth, requireAdmin, async (req, res) => {
    const configured = MailService.isConfigured();
    const diagnostics = MailService.diagnostics();

    if (!configured) {
        return res.json({
            ok: true,
            configured: false,
            verified: false,
            provider: diagnostics.provider,
            diagnostics
        });
    }

    try {
        const result = await MailService.verifyConnection();
        return res.json({
            ok: true,
            configured: true,
            verified: true,
            provider: result.provider || diagnostics.provider,
            diagnostics
        });
    } catch (error) {
        return res.status(503).json({
            ok: false,
            configured: true,
            verified: false,
            provider: diagnostics.provider,
            diagnostics,
            message: diagnostics.provider === 'brevo'
                ? 'Brevo is configured but the API key could not be verified.'
                : 'SMTP is configured but the server could not authenticate or connect.',
            code: error.code || 'MAIL_PROVIDER_VERIFY_FAILED'
        });
    }
});

router.get('/templates', auth, requireSuperAdmin, async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store');
        res.json({ ok: true, templates: await MailTemplateService.listTemplates() });
    } catch (error) {
        res.status(error.status || 500).json({
            message: error.message || 'Unable to load email templates.',
            code: error.code || 'MAIL_TEMPLATES_LOAD_FAILED'
        });
    }
});

router.put('/templates/:templateKey', auth, requireSuperAdmin, async (req, res) => {
    try {
        await MailTemplateService.saveTemplate(req.params.templateKey, {
            subjectTemplate: req.body?.subjectTemplate,
            htmlTemplate: req.body?.htmlTemplate,
            updatedByUserId: req.authenticatedUserId || null
        });
        const templates = await MailTemplateService.listTemplates();
        const template = templates.find((item) => item.key === req.params.templateKey) || null;
        res.json({ ok: true, template });
    } catch (error) {
        res.status(error.status || 500).json({
            message: error.message || 'Unable to save email template.',
            code: error.code || 'MAIL_TEMPLATE_SAVE_FAILED'
        });
    }
});

router.delete('/templates/:templateKey', auth, requireSuperAdmin, async (req, res) => {
    try {
        await MailTemplateService.resetTemplate(req.params.templateKey);
        const templates = await MailTemplateService.listTemplates();
        const template = templates.find((item) => item.key === req.params.templateKey) || null;
        res.json({ ok: true, template });
    } catch (error) {
        res.status(error.status || 500).json({
            message: error.message || 'Unable to reset email template.',
            code: error.code || 'MAIL_TEMPLATE_RESET_FAILED'
        });
    }
});

router.post('/templates/:templateKey/preview', auth, requireSuperAdmin, async (req, res) => {
    try {
        const preview = MailTemplateService.previewTemplate(req.params.templateKey, {
            subjectTemplate: req.body?.subjectTemplate,
            htmlTemplate: req.body?.htmlTemplate,
            sampleData: req.body?.sampleData || null
        });
        res.json({ ok: true, preview });
    } catch (error) {
        res.status(error.status || 500).json({
            message: error.message || 'Unable to preview email template.',
            code: error.code || 'MAIL_TEMPLATE_PREVIEW_FAILED'
        });
    }
});

router.post('/test', auth, requireAdmin, async (req, res) => {
    try {
        const recipient = String(
            req.body?.to ||
            req.scormEmail ||
            MailService.adminRecipient() ||
            ''
        ).trim().toLowerCase();
        const kind = String(req.body?.kind || 'email').trim().toLowerCase();
        const campaignTest = kind === 'campaign';

        const result = await MailService.send({
            to: recipient,
            template: campaignTest ? 'campaign_invitation' : 'admin_notification',
            required: true,
            data: campaignTest ? {
                learnerName: 'LMSGEN Test Recipient',
                campaignId: 'email-test',
                campaignName: 'LMSGEN Campaign Email Test',
                accessCode: 'TEST-123456',
                path: '/login'
            } : {
                title: 'LMSGEN email delivery test',
                message: 'Your LMSGEN email delivery configuration is working correctly.',
                actionLabel: 'Open LMSGEN',
                actionUrl: '/'
            }
        });

        res.json({
            ok: true,
            sent: result.sent,
            recipient,
            kind: campaignTest ? 'campaign' : 'email',
            provider: result.provider || MailService.mailProvider(),
            messageId: result.messageId || null
        });
    } catch (error) {
        res.status(error.status || 503).json({
            ok: false,
            message: error.message || 'Could not send the test email.',
            code: error.code || 'MAIL_TEST_FAILED',
            provider: MailService.mailProvider(),
            diagnostics: MailService.diagnostics()
        });
    }
});

module.exports = router;
