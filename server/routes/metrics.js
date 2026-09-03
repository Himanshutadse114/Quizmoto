/**
 * P3-T09 — export in-process metrics.
 * GET /api/metrics
 * Optional protection: set METRICS_TOKEN and send header x-metrics-token
 *
 * Public website enquiries are also accepted at POST /api/metrics/inquiry.
 * They are delivered to the platform Super Admin. HTTPS mail delivery is
 * preferred when a Brevo API key is configured because some hosting plans
 * block outbound SMTP ports.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const https = require('https');
const nodemailer = require('nodemailer');
const Metrics = require('../utils/metrics');
const logger = require('../utils/logger');
const MailService = require('../services/mail/MailService');
const { SUPER_ADMIN_EMAIL } = require('../services/scorm/ScormAccessService');

const router = express.Router();
const WEBSITE_INQUIRY_RECIPIENT = String(
    process.env.WEBSITE_INQUIRY_TO || SUPER_ADMIN_EMAIL || 'tadsehimanshu@gmail.com'
).trim().toLowerCase();

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

function sendBrevoEmail({ apiKey, fromAddress, fromName, to, replyTo, subject, text, html }) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            sender: { name: fromName || 'LMSGEN', email: fromAddress },
            to: [{ email: to }],
            replyTo: validEmail(replyTo) ? { email: replyTo } : undefined,
            subject,
            textContent: text,
            htmlContent: html,
            headers: { 'X-LMSGEN-Notification': 'website_inquiry' }
        });

        const request = https.request({
            hostname: 'api.brevo.com',
            port: 443,
            path: '/v3/smtp/email',
            method: 'POST',
            headers: {
                accept: 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(payload)
            }
        }, (response) => {
            let raw = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => { raw += chunk; });
            response.on('end', () => {
                let data = {};
                if (raw) {
                    try { data = JSON.parse(raw); } catch (_) { data = { message: raw }; }
                }
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    return resolve({ messageId: data.messageId || null, provider: 'brevo' });
                }
                const error = new Error(data.message || `Brevo request failed with HTTP ${response.statusCode}.`);
                error.code = data.code || `BREVO_HTTP_${response.statusCode}`;
                error.status = 503;
                reject(error);
            });
        });

        request.setTimeout(Number(process.env.MAIL_API_TIMEOUT_MS || 10000), () => {
            const error = new Error('Email service request timed out.');
            error.code = 'BREVO_API_TIMEOUT';
            error.status = 503;
            request.destroy(error);
        });
        request.on('error', (error) => {
            if (!error.status) error.status = 503;
            if (!error.code) error.code = 'BREVO_API_NETWORK_ERROR';
            reject(error);
        });
        request.write(payload);
        request.end();
    });
}

async function sendSmtpEmail({ cfg, to, replyTo, subject, text, html }) {
    const smtpUser = cfg.user || String(process.env.MAIL_FROM || '').trim().toLowerCase();
    const smtpPass = cfg.pass || String(process.env.MAIL_PASS || process.env.SMTP_PASS || '');
    const fromAddress = cfg.fromAddress || smtpUser;

    if (!cfg.host || !cfg.port || !smtpUser || !smtpPass || !validEmail(fromAddress)) {
        const error = new Error('SMTP is not configured. Set MAIL_USER and MAIL_PASS in the backend deployment.');
        error.code = 'WEBSITE_INQUIRY_SMTP_NOT_CONFIGURED';
        error.status = 503;
        throw error;
    }

    const candidates = [{ port: cfg.port, secure: cfg.secure }];
    if (/secureserver\.net$/i.test(cfg.host) && Number(cfg.port) !== 587) {
        candidates.push({ port: 587, secure: false, requireTLS: true });
    }

    let lastError = null;
    for (const candidate of candidates) {
        try {
            const transport = nodemailer.createTransport({
                host: cfg.host,
                port: candidate.port,
                secure: candidate.secure,
                requireTLS: Boolean(candidate.requireTLS),
                auth: { user: smtpUser, pass: smtpPass },
                connectionTimeout: Number(process.env.MAIL_CONNECTION_TIMEOUT_MS || 7000),
                greetingTimeout: Number(process.env.MAIL_GREETING_TIMEOUT_MS || 7000),
                socketTimeout: Number(process.env.MAIL_SOCKET_TIMEOUT_MS || 12000)
            });

            const info = await transport.sendMail({
                from: `${cfg.fromName || 'LMSGEN'} <${fromAddress}>`,
                to,
                replyTo,
                subject,
                text,
                html,
                headers: { 'X-LMSGEN-Notification': 'website_inquiry' }
            });
            return { messageId: info.messageId || null, provider: 'smtp', port: candidate.port };
        } catch (error) {
            lastError = error;
            logger.warn('website_inquiry_smtp_attempt_failed', {
                module: 'mail',
                host: cfg.host,
                port: candidate.port,
                code: error.code || 'SMTP_SEND_FAILED',
                error: error.message
            });
        }
    }

    if (lastError) throw lastError;
    const error = new Error('Could not connect to the SMTP service.');
    error.code = 'WEBSITE_INQUIRY_SMTP_FAILED';
    error.status = 503;
    throw error;
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
    if (!validEmail(WEBSITE_INQUIRY_RECIPIENT)) {
        return res.status(503).json({ ok: false, message: 'The platform Super Admin email is not configured.' });
    }

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

    try {
        const brevo = MailService.brevoConfig();
        const smtp = MailService.smtpConfig();
        let result;

        // Prefer HTTPS delivery when available. This works on hosts that block
        // outbound SMTP ports while keeping the same Super Admin recipient.
        if (brevo.apiKey && validEmail(brevo.fromAddress || smtp.fromAddress)) {
            result = await sendBrevoEmail({
                apiKey: brevo.apiKey,
                fromAddress: brevo.fromAddress || smtp.fromAddress,
                fromName: brevo.fromName || smtp.fromName || 'LMSGEN',
                to: WEBSITE_INQUIRY_RECIPIENT,
                replyTo: email,
                subject,
                text,
                html
            });
        } else {
            result = await sendSmtpEmail({
                cfg: smtp,
                to: WEBSITE_INQUIRY_RECIPIENT,
                replyTo: email,
                subject,
                text,
                html
            });
        }

        logger.info('website_inquiry_sent', {
            module: 'mail',
            provider: result.provider,
            recipient: WEBSITE_INQUIRY_RECIPIENT,
            source,
            messageId: result.messageId || null,
            port: result.port || null
        });

        return res.json({ ok: true, sent: true, provider: result.provider });
    } catch (error) {
        const renderHosted = Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_URL);
        const likelyBlockedSmtp = renderHosted && ['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ENETUNREACH'].includes(String(error.code || '').toUpperCase());
        const messageForClient = likelyBlockedSmtp
            ? 'Email delivery is unavailable on the current hosting plan. Configure BREVO_API_KEY for HTTPS mail delivery.'
            : (error.message || 'We could not send your enquiry right now.');

        logger.error('website_inquiry_send_failed', {
            module: 'mail',
            recipient: WEBSITE_INQUIRY_RECIPIENT,
            error: error.message,
            code: error.code || 'WEBSITE_INQUIRY_SEND_FAILED',
            renderHosted,
            likelyBlockedSmtp
        });
        return res.status(error.status || 503).json({
            ok: false,
            message: messageForClient,
            code: likelyBlockedSmtp ? 'WEBSITE_INQUIRY_HOST_SMTP_BLOCKED' : (error.code || 'WEBSITE_INQUIRY_SEND_FAILED')
        });
    }
});

module.exports = router;
