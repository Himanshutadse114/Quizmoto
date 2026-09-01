const nodemailer = require('nodemailer');
const logger = require('../../utils/logger');

let transport = null;
let transportFingerprint = null;

function parseBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function mailConfig() {
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === undefined
        ? port === 465
        : parseBoolean(process.env.SMTP_SECURE, false);
    return {
        host: String(process.env.SMTP_HOST || '').trim(),
        port: Number.isFinite(port) && port > 0 ? port : 587,
        secure,
        user: String(process.env.SMTP_USER || '').trim(),
        pass: String(process.env.SMTP_PASS || ''),
        fromName: String(process.env.MAIL_FROM_NAME || process.env.MAIL_BRAND_NAME || 'LMSGEN').trim() || 'LMSGEN',
        fromAddress: String(process.env.MAIL_FROM_ADDRESS || process.env.SMTP_USER || '').trim(),
        replyTo: String(process.env.MAIL_REPLY_TO || '').trim() || null,
        rejectUnauthorized: !parseBoolean(process.env.SMTP_ALLOW_SELF_SIGNED, false)
    };
}

function configured(config = mailConfig()) {
    return Boolean(config.host && config.port && config.user && config.pass && config.fromAddress);
}

function configurationError() {
    const err = new Error('Email delivery is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM_ADDRESS.');
    err.status = 503;
    err.code = 'MAIL_NOT_CONFIGURED';
    return err;
}

function assertConfigured() {
    const config = mailConfig();
    if (!configured(config)) throw configurationError();
    return config;
}

function fingerprint(config) {
    return [config.host, config.port, config.secure, config.user, config.fromAddress, config.rejectUnauthorized].join('|');
}

function getTransport() {
    const config = assertConfigured();
    const nextFingerprint = fingerprint(config);
    if (transport && transportFingerprint === nextFingerprint) return { transport, config };

    transport = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        pool: true,
        maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS || 5),
        maxMessages: Number(process.env.SMTP_MAX_MESSAGES || 100),
        auth: {
            user: config.user,
            pass: config.pass
        },
        tls: {
            rejectUnauthorized: config.rejectUnauthorized
        },
        connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 15000),
        greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10000),
        socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 20000)
    });
    transportFingerprint = nextFingerprint;
    return { transport, config };
}

function normalizeRecipient(value) {
    return String(value || '').trim().toLowerCase();
}

function safeRecipientForLog(email) {
    const [local, domain] = normalizeRecipient(email).split('@');
    if (!local || !domain) return 'invalid';
    return `${local.slice(0, 2)}***@${domain}`;
}

async function sendMail({ to, subject, html, text, tag = 'transactional' }) {
    const recipient = normalizeRecipient(to);
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
        const err = new Error('A valid email recipient is required.');
        err.code = 'MAIL_RECIPIENT_INVALID';
        err.status = 400;
        throw err;
    }
    const { transport: smtp, config } = getTransport();
    const info = await smtp.sendMail({
        from: { name: config.fromName, address: config.fromAddress },
        to: recipient,
        replyTo: config.replyTo || undefined,
        subject: String(subject || '').trim(),
        text: String(text || '').trim() || undefined,
        html: String(html || '').trim() || undefined,
        headers: {
            'X-LMSGEN-Message-Type': String(tag || 'transactional').slice(0, 64)
        }
    });
    logger.info('mail_sent', {
        module: 'mail',
        tag,
        recipient: safeRecipientForLog(recipient),
        messageId: info.messageId || null,
        accepted: Array.isArray(info.accepted) ? info.accepted.length : null,
        rejected: Array.isArray(info.rejected) ? info.rejected.length : null
    });
    return {
        sent: true,
        skipped: false,
        messageId: info.messageId || null
    };
}

async function safeSendMail(message) {
    if (!configured()) {
        logger.warn('mail_skipped_not_configured', {
            module: 'mail',
            tag: message?.tag || 'transactional',
            recipient: safeRecipientForLog(message?.to)
        });
        return { sent: false, skipped: true, reason: 'not_configured' };
    }
    try {
        return await sendMail(message);
    } catch (err) {
        logger.error('mail_send_failed', {
            module: 'mail',
            tag: message?.tag || 'transactional',
            recipient: safeRecipientForLog(message?.to),
            code: err.code || null,
            error: err.message
        });
        return { sent: false, skipped: false, reason: 'send_failed', code: err.code || null };
    }
}

async function verifyConnection() {
    const { transport: smtp } = getTransport();
    await smtp.verify();
    return true;
}

function resetTransportForTests() {
    if (transport && typeof transport.close === 'function') {
        try { transport.close(); } catch (_) {}
    }
    transport = null;
    transportFingerprint = null;
}

module.exports = {
    mailConfig,
    configured,
    assertConfigured,
    sendMail,
    safeSendMail,
    verifyConnection,
    resetTransportForTests
};
