const https = require('https');
const nodemailer = require('nodemailer');
const logger = require('../../utils/logger');
const MailTemplateService = require('./MailTemplateService');

const BRAND_NAME = MailTemplateService.BRAND_NAME;
const DEFAULT_HOST = 'smtpout.secureserver.net';
const DEFAULT_PORT = 465;
const BREVO_HOST = 'api.brevo.com';

let cachedTransport = null;
let cachedFingerprint = null;

function bool(value, fallback = false) {
    if (value === undefined || value === null || value === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function cleanEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail(value));
}

function normaliseEmailList(value) {
    if (!value) return [];
    const items = Array.isArray(value) ? value : String(value).split(',');
    return [...new Set(items.map(cleanEmail).filter(validEmail))];
}

function appBaseUrl() {
    return String(
        process.env.APP_BASE_URL ||
        process.env.PUBLIC_FRONTEND_URL ||
        process.env.FRONTEND_URL ||
        'https://lmsgen.in'
    ).trim().replace(/\/$/, '');
}

function appUrl(pathname = '/') {
    const path = String(pathname || '/');
    if (/^https?:\/\//i.test(path)) return path;
    return `${appBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

function enabledFromEnv(hasCredentials = false) {
    const explicit = String(process.env.MAIL_ENABLED || '').trim().toLowerCase();
    if (['0', 'false', 'no', 'off'].includes(explicit)) return false;
    if (['1', 'true', 'yes', 'on'].includes(explicit)) return true;
    return hasCredentials;
}

function mailProvider() {
    const requested = String(process.env.MAIL_PROVIDER || '').trim().toLowerCase();
    if (requested === 'brevo' || requested === 'smtp') return requested;
    return String(process.env.BREVO_API_KEY || '').trim() ? 'brevo' : 'smtp';
}

function commonConfig() {
    const provider = mailProvider();
    const smtpUser = cleanEmail(process.env.MAIL_USER || process.env.SMTP_USER);
    const fromAddress = cleanEmail(process.env.MAIL_FROM || (provider === 'smtp' ? smtpUser : ''));
    const replyTo = cleanEmail(process.env.MAIL_REPLY_TO);
    const adminTo = cleanEmail(
        process.env.MAIL_ADMIN_TO ||
        process.env.SCORM_ADMIN_CONTACT_EMAIL ||
        process.env.SCORM_SUPER_ADMIN_EMAIL
    );
    const fromName = String(process.env.MAIL_FROM_NAME || BRAND_NAME).trim() || BRAND_NAME;
    return {
        provider,
        fromAddress,
        fromName,
        replyTo: validEmail(replyTo) ? replyTo : null,
        adminTo: validEmail(adminTo) ? adminTo : null
    };
}

function brevoConfig() {
    const common = commonConfig();
    const apiKey = String(process.env.BREVO_API_KEY || '').trim();
    return {
        ...common,
        enabled: enabledFromEnv(Boolean(apiKey && common.fromAddress)),
        apiKey,
        apiHost: BREVO_HOST,
        apiPath: '/v3/smtp/email'
    };
}

function smtpConfig() {
    const common = commonConfig();
    const user = cleanEmail(process.env.MAIL_USER || process.env.SMTP_USER);
    const pass = String(process.env.MAIL_PASS || process.env.SMTP_PASS || '');
    const host = String(process.env.MAIL_HOST || process.env.SMTP_HOST || DEFAULT_HOST).trim();
    const port = Number(process.env.MAIL_PORT || process.env.SMTP_PORT || DEFAULT_PORT);
    const secure = bool(process.env.MAIL_SECURE, port === 465);
    return {
        ...common,
        enabled: enabledFromEnv(Boolean(user && pass)),
        host,
        port: Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT,
        secure,
        user,
        pass,
        fromAddress: common.fromAddress || user
    };
}

function providerConfig() {
    return mailProvider() === 'brevo' ? brevoConfig() : smtpConfig();
}

function isConfigured() {
    const cfg = providerConfig();
    if (!cfg.enabled || !validEmail(cfg.fromAddress)) return false;
    if (cfg.provider === 'brevo') return Boolean(cfg.apiKey);
    return Boolean(cfg.host && cfg.port && validEmail(cfg.user) && cfg.pass);
}

function configFingerprint(cfg) {
    return [cfg.host, cfg.port, cfg.secure, cfg.user, cfg.pass].join('|');
}

function transport() {
    const cfg = smtpConfig();
    if (cfg.provider !== 'smtp' || !isConfigured()) {
        const error = new Error('SMTP outbound email is not configured.');
        error.code = 'MAIL_SMTP_NOT_CONFIGURED';
        error.status = 503;
        throw error;
    }
    const fingerprint = configFingerprint(cfg);
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

function requestJson({ method, path, apiKey, body = null, timeoutMs = 15000 }) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const req = https.request({
            hostname: BREVO_HOST,
            port: 443,
            path,
            method,
            headers: {
                accept: 'application/json',
                'api-key': apiKey,
                ...(payload ? {
                    'content-type': 'application/json',
                    'content-length': Buffer.byteLength(payload)
                } : {})
            }
        }, (res) => {
            let raw = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { raw += chunk; });
            res.on('end', () => {
                let data = {};
                if (raw) {
                    try { data = JSON.parse(raw); } catch (_) { data = { message: raw }; }
                }
                if (res.statusCode >= 200 && res.statusCode < 300) return resolve(data);
                const error = new Error(data.message || `Brevo API request failed with HTTP ${res.statusCode}.`);
                error.code = data.code || `BREVO_HTTP_${res.statusCode}`;
                error.status = 503;
                error.providerStatus = res.statusCode;
                error.provider = 'brevo';
                return reject(error);
            });
        });
        req.setTimeout(timeoutMs, () => {
            const error = new Error('Brevo email API request timed out.');
            error.code = 'BREVO_API_TIMEOUT';
            error.status = 503;
            error.provider = 'brevo';
            req.destroy(error);
        });
        req.on('error', (error) => {
            if (!error.code) error.code = 'BREVO_API_NETWORK_ERROR';
            if (!error.status) error.status = 503;
            error.provider = 'brevo';
            reject(error);
        });
        if (payload) req.write(payload);
        req.end();
    });
}

function buildMessage(type, data = {}) {
    const definition = MailTemplateService.definitionFor(type);
    return MailTemplateService.renderDefinition(definition, data);
}

async function sendViaBrevo({ cfg, recipients, cc, bcc, template, message }) {
    const body = {
        sender: { name: cfg.fromName, email: cfg.fromAddress },
        to: recipients.map((email) => ({ email })),
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
        headers: { 'X-LMSGEN-Notification': template }
    };
    const ccRecipients = normaliseEmailList(cc);
    const bccRecipients = normaliseEmailList(bcc);
    if (ccRecipients.length) body.cc = ccRecipients.map((email) => ({ email }));
    if (bccRecipients.length) body.bcc = bccRecipients.map((email) => ({ email }));
    if (cfg.replyTo) body.replyTo = { email: cfg.replyTo };

    const response = await requestJson({
        method: 'POST',
        path: cfg.apiPath,
        apiKey: cfg.apiKey,
        body,
        timeoutMs: Number(process.env.MAIL_API_TIMEOUT_MS || 15000)
    });
    return { sent: true, skipped: false, messageId: response.messageId || null, provider: 'brevo' };
}

async function sendViaSmtp({ cfg, recipients, cc, bcc, template, message }) {
    const info = await transport().sendMail({
        from: `${cfg.fromName} <${cfg.fromAddress}>`,
        to: recipients.join(', '),
        cc: cc || undefined,
        bcc: bcc || undefined,
        replyTo: cfg.replyTo || undefined,
        subject: message.subject,
        text: message.text,
        html: message.html,
        headers: { 'X-LMSGEN-Notification': template }
    });
    return { sent: true, skipped: false, messageId: info.messageId || null, provider: 'smtp' };
}

async function send({ to, template, data = {}, required = false, cc = null, bcc = null }) {
    const recipients = normaliseEmailList(to);
    if (!recipients.length) {
        const error = Object.assign(new Error('A valid recipient email is required.'), { code: 'MAIL_RECIPIENT_INVALID', status: 400 });
        if (required) throw error;
        return { sent: false, skipped: true, reason: error.code };
    }

    if (!isConfigured()) {
        const cfg = providerConfig();
        const message = cfg.provider === 'brevo'
            ? 'Outbound email is not configured. Set BREVO_API_KEY and MAIL_FROM.'
            : 'Outbound email is not configured. Set MAIL_USER and MAIL_PASS.';
        const error = Object.assign(new Error(message), { code: 'MAIL_NOT_CONFIGURED', status: 503 });
        if (required) throw error;
        logger.warn('mail_skipped_not_configured', { module: 'mail', provider: cfg.provider, template, recipients: recipients.length });
        return { sent: false, skipped: true, reason: error.code };
    }

    const cfg = providerConfig();
    const message = await MailTemplateService.resolveMessage(template, data);
    const result = cfg.provider === 'brevo'
        ? await sendViaBrevo({ cfg, recipients, cc, bcc, template, message })
        : await sendViaSmtp({ cfg, recipients, cc, bcc, template, message });

    logger.info('mail_sent', {
        module: 'mail',
        provider: cfg.provider,
        template,
        recipients: recipients.length,
        messageId: result.messageId || null
    });
    return result;
}

async function safeSend(args) {
    try {
        return await send({ ...args, required: false });
    } catch (error) {
        logger.error('mail_send_failed', {
            module: 'mail',
            provider: mailProvider(),
            template: args?.template,
            error: error.message,
            code: error.code
        });
        return { sent: false, skipped: false, reason: error.code || 'MAIL_SEND_FAILED', provider: mailProvider() };
    }
}

async function verifyConnection() {
    if (!isConfigured()) return { ok: false, configured: false, provider: mailProvider() };
    const cfg = providerConfig();
    if (cfg.provider === 'brevo') {
        await requestJson({
            method: 'GET',
            path: '/v3/account',
            apiKey: cfg.apiKey,
            timeoutMs: Number(process.env.MAIL_API_TIMEOUT_MS || 10000)
        });
        return { ok: true, configured: true, provider: 'brevo' };
    }
    await transport().verify();
    return { ok: true, configured: true, provider: 'smtp' };
}

function diagnostics() {
    const cfg = providerConfig();
    if (cfg.provider === 'brevo') {
        return {
            provider: 'brevo',
            enabled: Boolean(cfg.enabled),
            apiConfigured: Boolean(cfg.apiKey),
            apiHost: cfg.apiHost,
            fromAddress: cfg.fromAddress || null,
            fromName: cfg.fromName || BRAND_NAME,
            adminRecipientSet: Boolean(cfg.adminTo)
        };
    }
    return {
        provider: 'smtp',
        enabled: Boolean(cfg.enabled),
        host: cfg.host || null,
        port: cfg.port || null,
        secure: Boolean(cfg.secure),
        userSet: Boolean(cfg.user),
        passwordSet: Boolean(cfg.pass),
        fromAddress: cfg.fromAddress || null,
        fromName: cfg.fromName || BRAND_NAME,
        adminRecipientSet: Boolean(cfg.adminTo)
    };
}

function adminRecipient() {
    return providerConfig().adminTo;
}

module.exports = {
    BRAND_NAME,
    appBaseUrl,
    appUrl,
    mailProvider,
    providerConfig,
    brevoConfig,
    smtpConfig,
    diagnostics,
    isConfigured,
    buildMessage,
    send,
    safeSend,
    verifyConnection,
    adminRecipient
};
