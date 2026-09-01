const nodemailer = require('nodemailer');
const logger = require('../../utils/logger');

const BRAND_NAME = String(process.env.MAIL_BRAND_NAME || 'LMSGEN').trim() || 'LMSGEN';
const DEFAULT_HOST = 'smtpout.secureserver.net';
const DEFAULT_PORT = 465;

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

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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

function smtpConfig() {
    const user = cleanEmail(process.env.MAIL_USER || process.env.SMTP_USER);
    const pass = String(process.env.MAIL_PASS || process.env.SMTP_PASS || '');
    const host = String(process.env.MAIL_HOST || process.env.SMTP_HOST || DEFAULT_HOST).trim();
    const port = Number(process.env.MAIL_PORT || process.env.SMTP_PORT || DEFAULT_PORT);
    const secure = bool(process.env.MAIL_SECURE, port === 465);
    const explicitEnabled = String(process.env.MAIL_ENABLED || '').trim().toLowerCase();
    const disabled = ['0', 'false', 'no', 'off'].includes(explicitEnabled);
    const enabled = !disabled && (['1', 'true', 'yes', 'on'].includes(explicitEnabled) || Boolean(user && pass));
    const fromAddress = cleanEmail(process.env.MAIL_FROM || user);
    const replyTo = cleanEmail(process.env.MAIL_REPLY_TO);
    const adminTo = cleanEmail(
        process.env.MAIL_ADMIN_TO ||
        process.env.SCORM_ADMIN_CONTACT_EMAIL ||
        process.env.SCORM_SUPER_ADMIN_EMAIL
    );

    return {
        enabled,
        host,
        port: Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT,
        secure,
        user,
        pass,
        fromAddress,
        replyTo: validEmail(replyTo) ? replyTo : null,
        adminTo: validEmail(adminTo) ? adminTo : null
    };
}

function isConfigured() {
    const cfg = smtpConfig();
    return Boolean(cfg.enabled && cfg.host && cfg.port && validEmail(cfg.user) && cfg.pass && validEmail(cfg.fromAddress));
}

function configFingerprint(cfg) {
    return [cfg.host, cfg.port, cfg.secure, cfg.user, cfg.pass].join('|');
}

function transport() {
    const cfg = smtpConfig();
    if (!isConfigured()) {
        const error = new Error('Outbound email is not configured. Set MAIL_USER and MAIL_PASS for the LMSGEN mailbox.');
        error.code = 'MAIL_NOT_CONFIGURED';
        error.status = 503;
        throw error;
    }
    const fingerprint = configFingerprint(cfg);
    if (!cachedTransport || cachedFingerprint !== fingerprint) {
        cachedTransport = nodemailer.createTransport({
            host: cfg.host,
            port: cfg.port,
            secure: cfg.secure,
            auth: {
                user: cfg.user,
                pass: cfg.pass
            },
            connectionTimeout: Number(process.env.MAIL_CONNECTION_TIMEOUT_MS || 15000),
            greetingTimeout: Number(process.env.MAIL_GREETING_TIMEOUT_MS || 15000),
            socketTimeout: Number(process.env.MAIL_SOCKET_TIMEOUT_MS || 30000)
        });
        cachedFingerprint = fingerprint;
    }
    return cachedTransport;
}

function frame({ title, preheader, greeting = 'Hello,', bodyHtml, actionLabel = null, actionUrl = null, footer = null }) {
    const safeTitle = escapeHtml(title);
    const safePreheader = escapeHtml(preheader || title);
    const button = actionLabel && actionUrl
        ? `<p style="margin:26px 0 8px"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#47c7c1;color:#061b1a;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px">${escapeHtml(actionLabel)}</a></p>`
        : '';
    const footerText = footer || `This is an automated message from ${BRAND_NAME}.`;
    return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f7f6;font-family:Arial,Helvetica,sans-serif;color:#17312f">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${safePreheader}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f6;padding:28px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #dce9e7;border-radius:14px;overflow:hidden">
<tr><td style="background:#071c1a;padding:20px 28px;color:#8fe4df;font-size:18px;font-weight:800;letter-spacing:.08em">${escapeHtml(BRAND_NAME)}</td></tr>
<tr><td style="padding:30px 28px">
<h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:#102927">${safeTitle}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6">${escapeHtml(greeting)}</p>
<div style="font-size:15px;line-height:1.65;color:#294844">${bodyHtml}</div>
${button}
</td></tr>
<tr><td style="padding:18px 28px;background:#f7fbfa;border-top:1px solid #e2edeb;font-size:12px;line-height:1.55;color:#6a7e7b">${escapeHtml(footerText)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function textLines(lines) {
    return (lines || []).filter((line) => line !== null && line !== undefined && line !== '').join('\n\n');
}

function buildMessage(type, data = {}) {
    const name = String(data.name || data.learnerName || data.displayName || '').trim();
    const greeting = name ? `Hello ${name},` : 'Hello,';

    switch (type) {
        case 'otp': {
            const code = String(data.code || '').trim();
            const minutes = Number(data.expiresMinutes || 10);
            const purposeLabels = {
                login: 'sign-in',
                password_reset: 'password reset',
                email_verification: 'email verification'
            };
            const purpose = purposeLabels[data.purpose] || 'verification';
            return {
                subject: `${code} is your ${BRAND_NAME} verification code`,
                text: textLines([
                    greeting,
                    `Your ${BRAND_NAME} ${purpose} code is ${code}.`,
                    `This code expires in ${minutes} minutes.`,
                    'If you did not request this code, you can ignore this email.'
                ]),
                html: frame({
                    title: 'Your verification code',
                    preheader: `${code} is your ${BRAND_NAME} verification code`,
                    greeting,
                    bodyHtml: `<p style="margin:0 0 18px">Use this code to complete your ${escapeHtml(purpose)}:</p><div style="font-size:34px;letter-spacing:8px;font-weight:800;color:#071c1a;margin:8px 0 20px">${escapeHtml(code)}</div><p style="margin:0">The code expires in ${escapeHtml(minutes)} minutes. If you did not request it, ignore this message.</p>`
                })
            };
        }
        case 'course_assignment': {
            const title = String(data.courseTitle || 'Course').trim();
            const due = data.dueAt ? new Date(data.dueAt).toLocaleDateString('en-GB') : null;
            const url = appUrl(data.path || '/learn');
            return {
                subject: `Course assigned: ${title}`,
                text: textLines([
                    greeting,
                    `A new course has been assigned to you in ${BRAND_NAME}: ${title}.`,
                    due ? `Due date: ${due}.` : null,
                    `Open your learner portal: ${url}`
                ]),
                html: frame({
                    title: 'A course has been assigned to you',
                    preheader: `${title} is ready in your learner portal`,
                    greeting,
                    bodyHtml: `<p style="margin:0 0 10px"><strong>${escapeHtml(title)}</strong> is now available in your learner portal.</p>${due ? `<p style="margin:0">Due date: <strong>${escapeHtml(due)}</strong></p>` : ''}`,
                    actionLabel: 'Open learner portal',
                    actionUrl: url
                })
            };
        }
        case 'campaign_invitation': {
            const campaignName = String(data.campaignName || 'Learning campaign').trim();
            const url = appUrl(data.path || `/campaign/${encodeURIComponent(data.campaignId || '')}`);
            const accessCode = String(data.accessCode || '').trim();
            const due = data.dueAt ? new Date(data.dueAt).toLocaleDateString('en-GB') : null;
            return {
                subject: `You have been invited to ${campaignName}`,
                text: textLines([
                    greeting,
                    `You have been invited to the ${campaignName} campaign in ${BRAND_NAME}.`,
                    accessCode ? `Access code: ${accessCode}` : null,
                    due ? `Due date: ${due}.` : null,
                    `Open campaign: ${url}`
                ]),
                html: frame({
                    title: 'Learning campaign invitation',
                    preheader: `${campaignName} is ready for you`,
                    greeting,
                    bodyHtml: `<p style="margin:0 0 12px">You have been invited to <strong>${escapeHtml(campaignName)}</strong>.</p>${accessCode ? `<p style="margin:0 0 12px">Your access code is <strong style="font-size:18px;letter-spacing:2px">${escapeHtml(accessCode)}</strong>.</p>` : ''}${due ? `<p style="margin:0">Due date: <strong>${escapeHtml(due)}</strong></p>` : ''}`,
                    actionLabel: 'Open campaign',
                    actionUrl: url
                })
            };
        }
        case 'team_invitation': {
            const tenant = String(data.workspaceName || data.tenantName || 'your LMSGEN tenant').trim();
            const role = String(data.roleLabel || data.role || 'team member').replace(/_/g, ' ');
            const url = appUrl(`/login?email=${encodeURIComponent(data.email || '')}`);
            return {
                subject: `Invitation to join ${tenant}`,
                text: textLines([
                    greeting,
                    `You have been invited to join ${tenant} as ${role}.`,
                    `Sign in with this email address to accept access: ${url}`
                ]),
                html: frame({
                    title: 'You have been invited to LMSGEN',
                    preheader: `Join ${tenant} as ${role}`,
                    greeting,
                    bodyHtml: `<p style="margin:0">You have been invited to join <strong>${escapeHtml(tenant)}</strong> as <strong>${escapeHtml(role)}</strong>. Sign in using this email address to continue.</p>`,
                    actionLabel: 'Sign in to LMSGEN',
                    actionUrl: url
                })
            };
        }
        case 'tenant_admin_invitation': {
            const tenant = String(data.workspaceName || data.tenantName || 'your LMSGEN tenant').trim();
            const url = appUrl(`/login?email=${encodeURIComponent(data.email || '')}`);
            return {
                subject: `You are the LMSGEN Admin for ${tenant}`,
                text: textLines([
                    greeting,
                    `You have been assigned as the Tenant Admin for ${tenant}.`,
                    `Sign in or register using this email address: ${url}`
                ]),
                html: frame({
                    title: 'Tenant Admin access is ready',
                    preheader: `Admin access for ${tenant}`,
                    greeting,
                    bodyHtml: `<p style="margin:0">You have been assigned as the <strong>Tenant Admin</strong> for <strong>${escapeHtml(tenant)}</strong>. Sign in or register with this email address to manage your tenant.</p>`,
                    actionLabel: 'Open LMSGEN',
                    actionUrl: url
                })
            };
        }
        case 'access_request_admin': {
            const applicant = cleanEmail(data.email);
            const url = appUrl('/admin/access');
            return {
                subject: `LMSGEN access request: ${applicant}`,
                text: textLines([
                    'Hello Admin,',
                    `${applicant} has requested LMSGEN access.`,
                    data.username ? `Name: ${data.username}` : null,
                    data.authMethod ? `Authentication: ${data.authMethod}` : null,
                    `Review the request: ${url}`
                ]),
                html: frame({
                    title: 'New LMSGEN access request',
                    preheader: `${applicant} is waiting for approval`,
                    greeting: 'Hello Admin,',
                    bodyHtml: `<p style="margin:0 0 10px"><strong>${escapeHtml(applicant)}</strong> has requested LMSGEN access.</p>${data.username ? `<p style="margin:0 0 6px">Name: ${escapeHtml(data.username)}</p>` : ''}${data.authMethod ? `<p style="margin:0">Authentication: ${escapeHtml(data.authMethod)}</p>` : ''}`,
                    actionLabel: 'Review access requests',
                    actionUrl: url
                })
            };
        }
        case 'access_request_received': {
            return {
                subject: 'Your LMSGEN access request was received',
                text: textLines([
                    greeting,
                    'Your LMSGEN access request has been received and is waiting for administrator approval.',
                    'You will receive another email when your access is approved.'
                ]),
                html: frame({
                    title: 'Access request received',
                    greeting,
                    bodyHtml: '<p style="margin:0">Your LMSGEN access request has been received and is waiting for administrator approval. We will email you when access is approved.</p>'
                })
            };
        }
        case 'access_approved': {
            const url = appUrl('/login');
            return {
                subject: 'Your LMSGEN access has been approved',
                text: textLines([
                    greeting,
                    'Your LMSGEN account has been approved.',
                    `Sign in using your existing credentials: ${url}`
                ]),
                html: frame({
                    title: 'Your access has been approved',
                    greeting,
                    bodyHtml: '<p style="margin:0">Your LMSGEN account has been approved. You can now sign in using your existing credentials.</p>',
                    actionLabel: 'Sign in to LMSGEN',
                    actionUrl: url
                })
            };
        }
        case 'access_revoked': {
            return {
                subject: 'Your LMSGEN access has changed',
                text: textLines([
                    greeting,
                    'Your LMSGEN administrator access is no longer active. Contact your administrator if you believe this was unexpected.'
                ]),
                html: frame({
                    title: 'Your LMSGEN access has changed',
                    greeting,
                    bodyHtml: '<p style="margin:0">Your LMSGEN administrator access is no longer active. Contact your administrator if you believe this was unexpected.</p>'
                })
            };
        }
        case 'admin_notification': {
            const title = String(data.title || 'LMSGEN notification').trim();
            const message = String(data.message || '').trim();
            const url = data.actionUrl ? appUrl(data.actionUrl) : null;
            return {
                subject: title,
                text: textLines(['Hello Admin,', message, url]),
                html: frame({
                    title,
                    greeting: 'Hello Admin,',
                    bodyHtml: `<p style="margin:0">${escapeHtml(message)}</p>`,
                    actionLabel: url ? String(data.actionLabel || 'Open LMSGEN') : null,
                    actionUrl: url
                })
            };
        }
        default:
            throw Object.assign(new Error(`Unknown mail template: ${type}`), { code: 'MAIL_TEMPLATE_UNKNOWN' });
    }
}

async function send({ to, template, data = {}, required = false, cc = null, bcc = null }) {
    const recipients = Array.isArray(to) ? to.map(cleanEmail).filter(validEmail) : [cleanEmail(to)].filter(validEmail);
    if (!recipients.length) {
        const error = Object.assign(new Error('A valid recipient email is required.'), { code: 'MAIL_RECIPIENT_INVALID', status: 400 });
        if (required) throw error;
        return { sent: false, skipped: true, reason: error.code };
    }

    if (!isConfigured()) {
        const error = Object.assign(new Error('Outbound email is not configured.'), { code: 'MAIL_NOT_CONFIGURED', status: 503 });
        if (required) throw error;
        logger.warn('mail_skipped_not_configured', { module: 'mail', template, recipients: recipients.length });
        return { sent: false, skipped: true, reason: error.code };
    }

    const cfg = smtpConfig();
    const message = buildMessage(template, data);
    const info = await transport().sendMail({
        from: `${BRAND_NAME} <${cfg.fromAddress}>`,
        to: recipients.join(', '),
        cc: cc || undefined,
        bcc: bcc || undefined,
        replyTo: cfg.replyTo || undefined,
        subject: message.subject,
        text: message.text,
        html: message.html,
        headers: {
            'X-LMSGEN-Notification': template
        }
    });

    logger.info('mail_sent', {
        module: 'mail',
        template,
        recipients: recipients.length,
        messageId: info.messageId || null
    });
    return { sent: true, skipped: false, messageId: info.messageId || null };
}

async function safeSend(args) {
    try {
        return await send({ ...args, required: false });
    } catch (error) {
        logger.error('mail_send_failed', {
            module: 'mail',
            template: args?.template,
            error: error.message,
            code: error.code
        });
        return { sent: false, skipped: false, reason: error.code || 'MAIL_SEND_FAILED' };
    }
}

async function verifyConnection() {
    if (!isConfigured()) return { ok: false, configured: false };
    await transport().verify();
    return { ok: true, configured: true };
}

function adminRecipient() {
    return smtpConfig().adminTo;
}

module.exports = {
    BRAND_NAME,
    appBaseUrl,
    appUrl,
    smtpConfig,
    isConfigured,
    buildMessage,
    send,
    safeSend,
    verifyConnection,
    adminRecipient
};
