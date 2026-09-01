const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const MailService = require('../../services/mail/MailService');
const { requestOtp, verifyOtp } = require('../../services/mail/MailOtpService');

function emailKey(req) {
    return String(req.body?.email || '').trim().toLowerCase() || req.ip || 'anonymous';
}

const requestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    keyGenerator: emailKey,
    message: {
        message: 'Too many verification codes were requested. Please wait and try again.',
        code: 'MAIL_OTP_RATE_LIMITED'
    }
});

const verifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    keyGenerator: emailKey,
    message: {
        message: 'Too many verification attempts. Please wait and try again.',
        code: 'MAIL_OTP_VERIFY_RATE_LIMITED'
    }
});

router.get('/status', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
        ok: true,
        configured: MailService.isConfigured()
    });
});

router.post('/request', requestLimiter, async (req, res) => {
    try {
        const result = await requestOtp({
            email: req.body?.email,
            purpose: req.body?.purpose,
            name: req.body?.name,
            requestedIp: req.ip
        });
        res.status(202).json(result);
    } catch (error) {
        res.status(error.status || 500).json({
            message: error.message || 'Could not send the verification code.',
            code: error.code || 'MAIL_OTP_REQUEST_FAILED'
        });
    }
});

router.post('/verify', verifyLimiter, async (req, res) => {
    try {
        res.json(await verifyOtp({
            email: req.body?.email,
            purpose: req.body?.purpose,
            code: req.body?.code
        }));
    } catch (error) {
        res.status(error.status || 500).json({
            message: error.message || 'Could not verify the code.',
            code: error.code || 'MAIL_OTP_VERIFY_FAILED'
        });
    }
});

module.exports = router;
