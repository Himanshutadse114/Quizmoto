'use strict';

const nodemailer = require('nodemailer');
const MailService = require('../mail/MailService');

let cachedTransport = null;
let cachedFingerprint = '';

function clean(value) {
    return String(value || '').trim();
}

function normaliseEmailList(value) {
    const raw = Array.isArray(value) ? value : String(value || '').split(/[\s,;]+/g);
    return [...new Set(raw.map((item) => clean(item).toLowerCase()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))];
}

function preparedMessage({ subject, html, text }) {
    const cleanSubject = clean(subject).slice(0, 240);
    const cleanHtml = String(html || '').trim();
    const cleanText = String(text || '').trim();
    if (!cleanSubject || !cleanHtml) {
        const error = new Error('Email subject and HTML content are required.');
        error.code = 'MAIL_CONTENT_INVALID';
        error.status = 400;
        throw error;
    }
    return { subject: cleanSubject, html: cleanHtml, text: cleanText };
}

function smtpTransport(cfg) {
    const fingerprint = [cfg.host, cfg.port, cfg.secure, cfg.user, cfg.pass].join('|');
    if (!cachedTransport || cachedFingerprint !== fingerprint) {
        cachedTransport = nodemailer.createTransport({
            host: cfg.host,
            port: cfg.port,
            secure: cfg.secure,
            auth: { user: cfg.user, pass: cfg.pass },
            connectionTimeout: Number(process.env.MAIL_CONNECTION_TIMEOUT_MS || 15000),
            greetingTimeout: Number(process.env.MAIL_GREETING_TIMEOUT_MS || 15000),
            socketTimeout: Number(process.env.MAIL_SOCKET_TIMEOUT_MS || 30000)
        });
        cachedFingerprint = fingerprint;
    }
    return cachedTransport;
}

async function sendBrevo(cfg, recipients, message, headers = {}) {
    const response = await fetch(`https://${cfg.apiHost || 'api.brevo.com'}${cfg.apiPath || '/v3/smtp/email'}`, {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'api-key': cfg.apiKey,
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            sender: { name: cfg.fromName, email: cfg.fromAddress },
            to: recipients.map((email) => ({ email })),
            subject: message.subject,
            htmlContent: message.html,
            textContent: message.text || undefined,
            replyTo: cfg.replyTo ? { email: cfg.replyTo } : undefined,
            headers: {
                'X-LMSGEN-Notification': 'awareness-template',
                ...headers
            }
        }),
        signal: AbortSignal.timeout(Number(process.env.MAIL_API_TIMEOUT_MS || 15000))
    });
    const raw = await response.text();
    let payload = {};
    try { payload = raw ? JSON.parse(raw) : {}; } catch (_) { payload = { message: raw }; }
    if (!response.ok) {
        const error = new Error(payload.message || `Brevo API request failed with HTTP ${response.status}.`);
        error.code = payload.code || `BREVO_HTTP_${response.status}`;
        error.status = 503;
        throw error;
    }
    return {
        sent: true,
        state: 'queued',
        provider: 'brevo',
        messageId: payload.messageId || null,
        accepted: [...recipients],
        rejected: [],
        providerResponse: payload.messageId ? 'Queued by Brevo' : 'Brevo accepted the request'
    };
}

async function sendSmtp(cfg, recipients, message, attachments = [], headers = {}) {
    const info = await smtpTransport(cfg).sendMail({
        from: `${cfg.fromName} <${cfg.fromAddress}>`,
        to: recipients.join(', '),
        replyTo: cfg.replyTo || undefined,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments,
        headers: {
            'X-LMSGEN-Notification': 'awareness-template',
            ...headers
        }
    });

    const accepted = (Array.isArray(info.accepted) ? info.accepted : [])
        .map((value) => clean(value).toLowerCase()).filter(Boolean);
    const rejected = (Array.isArray(info.rejected) ? info.rejected : [])
        .map((value) => clean(value).toLowerCase()).filter(Boolean);
    const pending = (Array.isArray(info.pending) ? info.pending : [])
        .map((value) => clean(value).toLowerCase()).filter(Boolean);
    const response = clean(info.response).slice(0, 500);

    if (!accepted.length || rejected.length) {
        const error = new Error(
            rejected.length
                ? `SMTP rejected recipient: ${rejected.join(', ')}`
                : 'SMTP server did not accept the recipient for delivery.'
        );
        error.code = 'SMTP_RECIPIENT_NOT_ACCEPTED';
        error.status = 502;
        error.provider = 'smtp';
        error.providerResponse = response || null;
        error.accepted = accepted;
        error.rejected = rejected;
        throw error;
    }

    return {
        sent: true,
        state: pending.length ? 'pending' : 'accepted',
        provider: 'smtp',
        messageId: info.messageId || null,
        accepted,
        rejected,
        pending,
        providerResponse: response || null,
        envelope: info.envelope || null
    };
}

async function sendContent({ to, subject, html, text = '', attachments = [], headers = {} }) {
    const recipients = normaliseEmailList(to);
    if (!recipients.length) {
        const error = new Error('A valid recipient email is required.');
        error.code = 'MAIL_RECIPIENT_INVALID';
        error.status = 400;
        throw error;
    }
    if (!MailService.isConfigured()) {
        const error = new Error('Outbound email is not configured for this platform.');
        error.code = 'MAIL_NOT_CONFIGURED';
        error.status = 503;
        throw error;
    }
    const message = preparedMessage({ subject, html, text });
    const cfg = MailService.providerConfig();
    return cfg.provider === 'brevo'
        ? sendBrevo(cfg, recipients, message, headers)
        : sendSmtp(cfg, recipients, message, attachments, headers);
}

async function verifyConnection() {
    return MailService.verifyConnection();
}

async function sendTestEmail(to) {
    const recipients = normaliseEmailList(to);
    if (!recipients.length) {
        const error = new Error('A valid test recipient email is required.');
        error.code = 'MAIL_RECIPIENT_INVALID';
        error.status = 400;
        throw error;
    }
    const now = new Date().toISOString();
    return sendContent({
        to: recipients[0],
        subject: 'LMSGEN mail delivery test',
        text: `This is an LMSGEN mail delivery test sent at ${now}.`,
        html: `<!doctype html><html><body style="font-family:Arial,sans-serif"><h2>LMSGEN mail delivery test</h2><p>This confirms the platform submitted a test message to the configured mail provider.</p><p>Sent at: ${now}</p></body></html>`,
        headers: { 'X-LMSGEN-Mail-Test': '1' }
    });
}

async function createEml({ to = [], subject, html, text = '', attachments = [], headers = {} }) {
    const message = preparedMessage({ subject, html, text });
    const recipients = normaliseEmailList(to);
    const cfg = MailService.providerConfig();
    const fromAddress = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(cfg.fromAddress || ''))
        ? cfg.fromAddress
        : 'no-reply@lmsgen.in';
    const fromName = clean(cfg.fromName) || 'LMSGEN';
    const streamTransport = nodemailer.createTransport({
        streamTransport: true,
        buffer: true,
        newline: 'unix'
    });
    const info = await streamTransport.sendMail({
        from: `${fromName} <${fromAddress}>`,
        to: recipients.length ? recipients.join(', ') : undefined,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments,
        headers: {
            'X-LMSGEN-Notification': 'awareness-template',
            ...headers
        }
    });
    return Buffer.isBuffer(info.message) ? info.message : Buffer.from(info.message || '', 'utf8');
}

module.exports = {
    normaliseEmailList,
    sendContent,
    verifyConnection,
    sendTestEmail,
    createEml
};
