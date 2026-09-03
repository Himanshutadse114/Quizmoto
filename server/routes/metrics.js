/**
 * P3-T09 — export in-process metrics.
 * GET /api/metrics
 * Optional protection: set METRICS_TOKEN and send header x-metrics-token
 *
 * Public website enquiries are also accepted at POST /api/metrics/inquiry.
 * They are deliberately sent through SMTP to the platform Super Admin.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const Metrics = require('../utils/metrics');
const logger = require('../utils/logger');
const MailService = require('../services/mail/MailService');
const { SUPER_ADMIN_EMAIL } = require('../services/scorm/ScormAccessService');

const router = express.Router();

function clean(value, max = 5000) {
    return String(value || '').trim().slice(0, max);
}

function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim().toLowerCase());
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const inquiryLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    message: { ok: false, message: 'Too many enquiries were submitted. Please try again later.' }
});

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

router.post('/inquiry', inquiryLimiter, async (req, res) => {
    const name = clean(req.body?.name, 120);
    const email = clean(req.body?.email, 180).toLowerCase();
    const phone = clean(req.body?.phone, 80);
    const company = clean(req.body?.company, 180);
    const message = clean(req.body?.message, 5000);
    const source = clean(req.body?.source, 120) || 'LMSGEN Contact page';
    const website = clean(req.body?.website, 200);

    // Quietly accept bot submissions caught by the hidden honeypot field.
    if (website) return res.json({ ok: true });

    if (name.length < 2) {
        return res.status(400).json({ ok: false, message: 'Please enter your name.' });
    }
    if (!validEmail(email)) {
        return res.status(400).json({ ok: false, message: 'Please enter a valid email address.' });
    }
    if (!phone) {
        return res.status(400).json({ ok: false, message: 'Please enter your phone number.' });
    }
    if (!validEmail(SUPER_ADMIN_EMAIL)) {
        return res.status(503).json({ ok: false, message: 'The platform Super Admin email is not configured.' });
    }

    try {
        const cfg = MailService.smtpConfig();
        const smtpUser = cfg.user || String(process.env.MAIL_FROM || '').trim().toLowerCase();
        const smtpPass = cfg.pass || String(process.env.MAIL_PASS || process.env.SMTP_PASS || '');
        const fromAddress = cfg.fromAddress || smtpUser;

        if (!cfg.host || !cfg.port || !smtpUser || !smtpPass || !validEmail(fromAddress)) {
            const error = new Error('SMTP is not configured. Set MAIL_USER and MAIL_PASS in the backend deployment.');
            error.code = 'WEBSITE_INQUIRY_SMTP_NOT_CONFIGURED';
            error.status = 503;
            throw error;
        }

        const transport = nodemailer.createTransport({
            host: cfg.host,
            port: cfg.port,
            secure: cfg.secure,
            auth: { user: smtpUser, pass: smtpPass },
            connectionTimeout: Number(process.env.MAIL_CONNECTION_TIMEOUT_MS || 15000),
            greetingTimeout: Number(process.env.MAIL_GREETING_TIMEOUT_MS || 15000),
            socketTimeout: Number(process.env.MAIL_SOCKET_TIMEOUT_MS || 30000)
        });

        const subjectCompany = company || name;
        const subject = `New LMSGEN website enquiry — ${subjectCompany}`;
        const text = [
            'New LMSGEN website enquiry',
            '',
            `Source: ${source}`,
            `Name: ${name}`,
            `Email: ${email}`,
            `Phone: ${phone}`,
            `Company: ${company || 'Not provided'}`,
            `Message: ${message || 'Not provided'}`
        ].join('\n');

        const html = `
            <div style="font-family:Arial,sans-serif;line-height:1.55;color:#153c38;max-width:680px;margin:auto">
                <h2 style="margin:0 0 18px">New LMSGEN website enquiry</h2>
                <table style="width:100%;border-collapse:collapse">
                    <tr><td style="padding:8px 0;font-weight:700;width:120px">Source</td><td>${escapeHtml(source)}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:700">Name</td><td>${escapeHtml(name)}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:700">Email</td><td>${escapeHtml(email)}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:700">Phone</td><td>${escapeHtml(phone)}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:700">Company</td><td>${escapeHtml(company || 'Not provided')}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:700;vertical-align:top">Message</td><td>${escapeHtml(message || 'Not provided').replace(/\n/g, '<br>')}</td></tr>
                </table>
            </div>`;

        const info = await transport.sendMail({
            from: `${cfg.fromName || 'LMSGEN'} <${fromAddress}>`,
            to: SUPER_ADMIN_EMAIL,
            replyTo: email,
            subject,
            text,
            html,
            headers: { 'X-LMSGEN-Notification': 'website_inquiry' }
        });

        logger.info('website_inquiry_sent', {
            module: 'mail',
            provider: 'smtp',
            recipient: SUPER_ADMIN_EMAIL,
            source,
            messageId: info.messageId || null
        });

        return res.json({ ok: true, sent: true });
    } catch (error) {
        logger.error('website_inquiry_send_failed', {
            module: 'mail',
            provider: 'smtp',
            recipient: SUPER_ADMIN_EMAIL,
            error: error.message,
            code: error.code || 'WEBSITE_INQUIRY_SEND_FAILED'
        });
        return res.status(error.status || 503).json({
            ok: false,
            message: error.message || 'We could not send your enquiry right now.',
            code: error.code || 'WEBSITE_INQUIRY_SEND_FAILED'
        });
    }
});

module.exports = router;
