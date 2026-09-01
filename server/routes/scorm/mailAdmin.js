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

router.get('/status', auth, requireAdmin, async (req, res) => {
    const configured = MailService.isConfigured();
    if (!configured) {
        return res.json({
            ok: true,
            configured: false,
            verified: false
        });
    }

    try {
        await MailService.verifyConnection();
        return res.json({
            ok: true,
            configured: true,
            verified: true
        });
    } catch (error) {
        return res.status(503).json({
            ok: false,
            configured: true,
            verified: false,
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

        const result = await MailService.send({
            to: recipient,
            template: 'admin_notification',
            required: true,
            data: {
                title: 'LMSGEN email delivery test',
                message: 'Your LMSGEN SMTP configuration is working correctly.',
                actionLabel: 'Open LMSGEN',
                actionUrl: '/'
            }
        });

        res.json({
            ok: true,
            sent: result.sent,
            recipient
        });
    } catch (error) {
        res.status(error.status || 503).json({
            ok: false,
            message: error.message || 'Could not send the test email.',
            code: error.code || 'MAIL_TEST_FAILED'
        });
    }
});

module.exports = router;
