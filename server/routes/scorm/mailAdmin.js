const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const MailService = require('../../services/mail/MailService');

function requireAdmin(req, res, next) {
    if (!['super_admin', 'admin'].includes(String(req.scormRole || '').toLowerCase())) {
        return res.status(403).json({
            message: 'Tenant Admin access is required to test email delivery.',
            code: 'MAIL_ADMIN_REQUIRED'
        });
    }
    next();
}

function diagnostics() {
    const cfg = MailService.smtpConfig();
    return {
        enabled: Boolean(cfg.enabled),
        host: cfg.host || null,
        port: cfg.port || null,
        secure: Boolean(cfg.secure),
        userSet: Boolean(cfg.user),
        passwordSet: Boolean(cfg.pass),
        fromAddress: cfg.fromAddress || null,
        adminRecipientSet: Boolean(cfg.adminTo)
    };
}

router.get('/status', auth, requireAdmin, async (req, res) => {
    const configured = MailService.isConfigured();
    if (!configured) {
        return res.json({
            ok: true,
            configured: false,
            verified: false,
            diagnostics: diagnostics()
        });
    }

    try {
        await MailService.verifyConnection();
        return res.json({
            ok: true,
            configured: true,
            verified: true,
            diagnostics: diagnostics()
        });
    } catch (error) {
        return res.status(503).json({
            ok: false,
            configured: true,
            verified: false,
            diagnostics: diagnostics(),
            message: 'SMTP is configured but the server could not authenticate or connect.',
            code: error.code || 'MAIL_SMTP_VERIFY_FAILED'
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
        const kind = String(req.body?.kind || 'smtp').trim().toLowerCase();
        const campaignTest = kind === 'campaign';

        const result = await MailService.send({
            to: recipient,
            template: campaignTest ? 'campaign_invitation' : 'admin_notification',
            required: true,
            data: campaignTest ? {
                learnerName: 'LMSGEN Test Recipient',
                campaignId: 'smtp-test',
                campaignName: 'LMSGEN Campaign Email Test',
                accessCode: 'TEST-123456',
                path: '/login'
            } : {
                title: 'LMSGEN email delivery test',
                message: 'Your LMSGEN SMTP configuration is working correctly.',
                actionLabel: 'Open LMSGEN',
                actionUrl: '/'
            }
        });

        res.json({
            ok: true,
            sent: result.sent,
            recipient,
            kind: campaignTest ? 'campaign' : 'smtp',
            messageId: result.messageId || null
        });
    } catch (error) {
        res.status(error.status || 503).json({
            ok: false,
            message: error.message || 'Could not send the test email.',
            code: error.code || 'MAIL_TEST_FAILED',
            diagnostics: diagnostics()
        });
    }
});

module.exports = router;
