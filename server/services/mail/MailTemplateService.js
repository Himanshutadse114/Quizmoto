const MailTemplateOverride = require('../../models/MailTemplateOverride');

const BRAND_NAME = String(process.env.MAIL_BRAND_NAME || 'LMSGEN').trim() || 'LMSGEN';
let schemaReadyPromise = null;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function stripTags(value) {
    return String(value || '')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&#039;/gi, "'")
        .replace(/&quot;/gi, '"')
        .replace(/\s+/g, ' ')
        .trim();
}

function frame({ title, preheader, body, actionLabel = null, actionUrl = null }) {
    const button = actionLabel && actionUrl
        ? `<p style="margin:26px 0 8px"><a href="${actionUrl}" style="display:inline-block;background:#47c7c1;color:#061b1a;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px">${actionLabel}</a></p>`
        : '';
    return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f7f6;font-family:Arial,Helvetica,sans-serif;color:#17312f">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f6;padding:28px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #dce9e7;border-radius:14px;overflow:hidden">
<tr><td style="background:#071c1a;padding:20px 28px;color:#8fe4df;font-size:18px;font-weight:800;letter-spacing:.08em">{{brand_name}}</td></tr>
<tr><td style="padding:30px 28px">
<h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:#102927">${title}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6">{{greeting}}</p>
<div style="font-size:15px;line-height:1.65;color:#294844">${body}</div>
${button}
</td></tr>
<tr><td style="padding:18px 28px;background:#f7fbfa;border-top:1px solid #e2edeb;font-size:12px;line-height:1.55;color:#6a7e7b">This is an automated message from {{brand_name}}.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

const DEFINITIONS = {
    otp: {
        name: 'Verification code',
        description: 'One-time codes for sign-in, password reset and email verification.',
        variables: ['brand_name', 'greeting', 'code', 'purpose', 'expires_minutes'],
        subjectTemplate: '{{code}} is your {{brand_name}} verification code',
        htmlTemplate: frame({
            title: 'Your verification code',
            preheader: '{{code}} is your {{brand_name}} verification code',
            body: '<p style="margin:0 0 18px">Use this code to complete your {{purpose}}:</p><div style="font-size:34px;letter-spacing:8px;font-weight:800;color:#071c1a;margin:8px 0 20px">{{code}}</div><p style="margin:0">The code expires in {{expires_minutes}} minutes. If you did not request it, ignore this message.</p>'
        }),
        sampleData: { learnerName: 'Alex Morgan', code: '482913', purpose: 'sign-in', expiresMinutes: 10 }
    },
    course_assignment: {
        name: 'Course assignment',
        description: 'Sent when a course is assigned directly to a learner.',
        variables: ['brand_name', 'greeting', 'learner_name', 'course_title', 'due_date', 'learner_portal_url'],
        subjectTemplate: 'Course assigned: {{course_title}}',
        htmlTemplate: frame({
            title: 'A course has been assigned to you',
            preheader: '{{course_title}} is ready in your learner portal',
            body: '<p style="margin:0 0 10px"><strong>{{course_title}}</strong> is now available in your learner portal.</p><p style="margin:0">Due date: <strong>{{due_date}}</strong></p>',
            actionLabel: 'Open learner portal',
            actionUrl: '{{learner_portal_url}}'
        }),
        sampleData: { learnerName: 'Alex Morgan', courseTitle: 'Security Awareness Essentials', dueAt: '2026-09-30', path: '/learn' }
    },
    campaign_invitation: {
        name: 'Campaign invitation',
        description: 'Sent automatically when a learner campaign starts.',
        variables: ['brand_name', 'greeting', 'learner_name', 'campaign_name', 'access_code', 'due_date', 'campaign_url'],
        subjectTemplate: 'You have been invited to {{campaign_name}}',
        htmlTemplate: frame({
            title: 'Learning campaign invitation',
            preheader: '{{campaign_name}} is ready for you',
            body: '<p style="margin:0 0 12px">You have been invited to <strong>{{campaign_name}}</strong>.</p><p style="margin:0 0 12px">Access code: <strong style="font-size:18px;letter-spacing:2px">{{access_code}}</strong></p><p style="margin:0">Due date: <strong>{{due_date}}</strong></p>',
            actionLabel: 'Open campaign',
            actionUrl: '{{campaign_url}}'
        }),
        sampleData: { learnerName: 'Alex Morgan', campaignName: 'September Awareness Campaign', campaignId: 'sample-campaign', accessCode: 'AB12-CD34', dueAt: '2026-09-30', path: '/campaign/sample-campaign' }
    },
    campaign_reminder: {
        name: 'Campaign reminder',
        description: 'Manual reminder sent to learners who still have incomplete campaign courses.',
        variables: ['brand_name', 'greeting', 'learner_name', 'campaign_name', 'access_code', 'due_date', 'campaign_url'],
        subjectTemplate: 'Reminder: complete {{campaign_name}}',
        htmlTemplate: frame({
            title: 'Your learning campaign is still in progress',
            preheader: 'Reminder to complete {{campaign_name}}',
            body: '<p style="margin:0 0 12px">This is a reminder to complete <strong>{{campaign_name}}</strong>.</p><p style="margin:0 0 12px">Access code: <strong style="font-size:18px;letter-spacing:2px">{{access_code}}</strong></p><p style="margin:0">Due date: <strong>{{due_date}}</strong></p>',
            actionLabel: 'Continue campaign',
            actionUrl: '{{campaign_url}}'
        }),
        sampleData: { learnerName: 'Alex Morgan', campaignName: 'September Awareness Campaign', campaignId: 'sample-campaign', accessCode: 'AB12-CD34', dueAt: '2026-09-30', path: '/campaign/sample-campaign' }
    },
    team_invitation: {
        name: 'Team member invitation',
        description: 'Sent to new Co-admin and Analytics Viewer team members.',
        variables: ['brand_name', 'greeting', 'workspace_name', 'role_label', 'login_url'],
        subjectTemplate: 'Invitation to join {{workspace_name}}',
        htmlTemplate: frame({
            title: 'You have been invited to LMSGEN',
            preheader: 'Join {{workspace_name}} as {{role_label}}',
            body: '<p style="margin:0">You have been invited to join <strong>{{workspace_name}}</strong> as <strong>{{role_label}}</strong>. Sign in using this email address to continue.</p>',
            actionLabel: 'Sign in to LMSGEN',
            actionUrl: '{{login_url}}'
        }),
        sampleData: { displayName: 'Alex Morgan', email: 'alex@example.com', workspaceName: 'Example Company', role: 'co_admin' }
    },
    tenant_admin_invitation: {
        name: 'Tenant Admin invitation',
        description: 'Sent when a user is assigned as Tenant Admin.',
        variables: ['brand_name', 'greeting', 'workspace_name', 'login_url'],
        subjectTemplate: 'You are the LMSGEN Admin for {{workspace_name}}',
        htmlTemplate: frame({
            title: 'Tenant Admin access is ready',
            preheader: 'Admin access for {{workspace_name}}',
            body: '<p style="margin:0">You have been assigned as the <strong>Tenant Admin</strong> for <strong>{{workspace_name}}</strong>. Sign in or register with this email address to manage your tenant.</p>',
            actionLabel: 'Open LMSGEN',
            actionUrl: '{{login_url}}'
        }),
        sampleData: { displayName: 'Alex Morgan', email: 'alex@example.com', workspaceName: 'Example Company' }
    },
    access_request_admin: {
        name: 'Access request · Admin',
        description: 'Notifies the platform administrator about a new access request.',
        variables: ['brand_name', 'email', 'username', 'auth_method', 'access_admin_url'],
        subjectTemplate: 'LMSGEN access request: {{email}}',
        htmlTemplate: frame({
            title: 'New LMSGEN access request',
            preheader: '{{email}} is waiting for approval',
            body: '<p style="margin:0 0 10px"><strong>{{email}}</strong> has requested LMSGEN access.</p><p style="margin:0 0 6px">Name: {{username}}</p><p style="margin:0">Authentication: {{auth_method}}</p>',
            actionLabel: 'Review access requests',
            actionUrl: '{{access_admin_url}}'
        }),
        sampleData: { email: 'alex@example.com', username: 'Alex Morgan', authMethod: 'Google' }
    },
    access_request_received: {
        name: 'Access request received',
        description: 'Confirms that an access request is waiting for administrator approval.',
        variables: ['brand_name', 'greeting'],
        subjectTemplate: 'Your LMSGEN access request was received',
        htmlTemplate: frame({
            title: 'Access request received',
            preheader: 'Your access request is waiting for approval',
            body: '<p style="margin:0">Your LMSGEN access request has been received and is waiting for administrator approval. We will email you when access is approved.</p>'
        }),
        sampleData: { name: 'Alex Morgan' }
    },
    access_approved: {
        name: 'Access approved',
        description: 'Sent when a platform access request is approved.',
        variables: ['brand_name', 'greeting', 'login_url'],
        subjectTemplate: 'Your LMSGEN access has been approved',
        htmlTemplate: frame({
            title: 'Your access has been approved',
            preheader: 'Your LMSGEN access is ready',
            body: '<p style="margin:0">Your LMSGEN account has been approved. You can now sign in using your existing credentials.</p>',
            actionLabel: 'Sign in to LMSGEN',
            actionUrl: '{{login_url}}'
        }),
        sampleData: { name: 'Alex Morgan' }
    },
    access_revoked: {
        name: 'Access changed or revoked',
        description: 'Sent when administrator access is no longer active.',
        variables: ['brand_name', 'greeting'],
        subjectTemplate: 'Your LMSGEN access has changed',
        htmlTemplate: frame({
            title: 'Your LMSGEN access has changed',
            preheader: 'A change was made to your LMSGEN access',
            body: '<p style="margin:0">Your LMSGEN administrator access is no longer active. Contact your administrator if you believe this was unexpected.</p>'
        }),
        sampleData: { name: 'Alex Morgan' }
    },
    admin_notification: {
        name: 'Admin notification',
        description: 'Generic platform notification used for administrative emails and delivery tests.',
        variables: ['brand_name', 'title', 'message', 'action_label', 'action_url'],
        subjectTemplate: '{{title}}',
        htmlTemplate: frame({
            title: '{{title}}',
            preheader: '{{title}}',
            body: '<p style="margin:0">{{message}}</p>',
            actionLabel: '{{action_label}}',
            actionUrl: '{{action_url}}'
        }),
        sampleData: { title: 'LMSGEN notification', message: 'This is a sample administrator notification.', actionLabel: 'Open LMSGEN', actionUrl: '/' }
    }
};

function appBaseUrl() {
    return String(process.env.APP_BASE_URL || process.env.PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || 'https://lmsgen.in').trim().replace(/\/$/, '');
}

function absoluteUrl(pathname = '/') {
    const value = String(pathname || '/');
    if (/^https?:\/\//i.test(value)) return value;
    return `${appBaseUrl()}${value.startsWith('/') ? value : `/${value}`}`;
}

function displayDate(value) {
    if (!value) return 'No due date';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'No due date' : date.toLocaleDateString('en-GB');
}

function templateVariables(data = {}) {
    const name = String(data.name || data.learnerName || data.displayName || '').trim();
    const role = String(data.roleLabel || data.role || 'team member').replace(/_/g, ' ');
    const purposeLabels = { login: 'sign-in', password_reset: 'password reset', email_verification: 'email verification' };
    const campaignPath = data.path || `/campaign/${encodeURIComponent(data.campaignId || '')}`;
    return {
        brand_name: BRAND_NAME,
        greeting: name ? `Hello ${name},` : 'Hello,',
        name,
        learner_name: String(data.learnerName || name || ''),
        display_name: String(data.displayName || name || ''),
        email: String(data.email || ''),
        username: String(data.username || ''),
        code: String(data.code || ''),
        expires_minutes: String(data.expiresMinutes || 10),
        purpose: purposeLabels[data.purpose] || String(data.purpose || 'verification'),
        course_title: String(data.courseTitle || 'Course'),
        campaign_name: String(data.campaignName || 'Learning campaign'),
        campaign_id: String(data.campaignId || ''),
        access_code: String(data.accessCode || ''),
        due_date: displayDate(data.dueAt),
        workspace_name: String(data.workspaceName || data.tenantName || 'your LMSGEN tenant'),
        tenant_name: String(data.tenantName || data.workspaceName || 'your LMSGEN tenant'),
        role_label: role,
        role,
        auth_method: String(data.authMethod || ''),
        title: String(data.title || 'LMSGEN notification'),
        message: String(data.message || ''),
        action_label: String(data.actionLabel || 'Open LMSGEN'),
        action_url: absoluteUrl(data.actionUrl || '/'),
        login_url: absoluteUrl(`/login${data.email ? `?email=${encodeURIComponent(data.email)}` : ''}`),
        learner_portal_url: absoluteUrl(data.path || '/learn'),
        campaign_url: absoluteUrl(campaignPath),
        access_admin_url: absoluteUrl('/scorm/access')
    };
}

function renderString(template, values, html = false) {
    return String(template || '').replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_, key) => {
        const value = Object.prototype.hasOwnProperty.call(values, key) ? values[key] : '';
        return html ? escapeHtml(value) : String(value ?? '');
    });
}

function renderDefinition(definition, data, override = null) {
    const values = templateVariables(data);
    const subjectTemplate = override?.subjectTemplate || definition.subjectTemplate;
    const htmlTemplate = override?.htmlTemplate || definition.htmlTemplate;
    const subject = renderString(subjectTemplate, values, false).trim();
    const html = renderString(htmlTemplate, values, true);
    return { subject, html, text: stripTags(html) };
}

async function ensureSchema() {
    if (!schemaReadyPromise) {
        schemaReadyPromise = MailTemplateOverride.sync().catch((error) => {
            schemaReadyPromise = null;
            throw error;
        });
    }
    return schemaReadyPromise;
}

function definitionFor(key) {
    const definition = DEFINITIONS[String(key || '').trim()];
    if (!definition) {
        const error = new Error(`Unknown mail template: ${key}`);
        error.code = 'MAIL_TEMPLATE_UNKNOWN';
        error.status = 404;
        throw error;
    }
    return definition;
}

async function resolveMessage(key, data = {}) {
    const definition = definitionFor(key);
    let override = null;
    try {
        await ensureSchema();
        override = await MailTemplateOverride.findByPk(key);
    } catch (_) {
        override = null;
    }
    return renderDefinition(definition, data, override);
}

async function listTemplates() {
    await ensureSchema();
    const rows = await MailTemplateOverride.findAll();
    const overrides = new Map(rows.map((row) => [row.templateKey, row]));
    return Object.entries(DEFINITIONS).map(([key, definition]) => {
        const override = overrides.get(key);
        return {
            key,
            name: definition.name,
            description: definition.description,
            variables: definition.variables,
            subjectTemplate: override?.subjectTemplate || definition.subjectTemplate,
            htmlTemplate: override?.htmlTemplate || definition.htmlTemplate,
            defaultSubjectTemplate: definition.subjectTemplate,
            defaultHtmlTemplate: definition.htmlTemplate,
            customised: Boolean(override),
            updatedAt: override?.updatedAt || null,
            sampleData: definition.sampleData
        };
    });
}

function validateTemplateInput(subjectTemplate, htmlTemplate) {
    const subject = String(subjectTemplate || '').trim();
    const html = String(htmlTemplate || '').trim();
    if (!subject || subject.length > 240) {
        const error = new Error('Email subject is required and must be 240 characters or fewer.');
        error.code = 'MAIL_TEMPLATE_SUBJECT_INVALID';
        error.status = 400;
        throw error;
    }
    if (!html || html.length > 250000) {
        const error = new Error('Email HTML is required and must be smaller than 250 KB.');
        error.code = 'MAIL_TEMPLATE_HTML_INVALID';
        error.status = 400;
        throw error;
    }
    if (/<script\b|<iframe\b|javascript\s*:/i.test(html)) {
        const error = new Error('Script, iframe and javascript: content is not allowed in email templates.');
        error.code = 'MAIL_TEMPLATE_UNSAFE_HTML';
        error.status = 400;
        throw error;
    }
    return { subject, html };
}

async function saveTemplate(key, { subjectTemplate, htmlTemplate, updatedByUserId = null }) {
    definitionFor(key);
    const clean = validateTemplateInput(subjectTemplate, htmlTemplate);
    await ensureSchema();
    const [row] = await MailTemplateOverride.upsert({
        templateKey: key,
        subjectTemplate: clean.subject,
        htmlTemplate: clean.html,
        updatedByUserId
    }, { returning: true });
    return row;
}

async function resetTemplate(key) {
    definitionFor(key);
    await ensureSchema();
    await MailTemplateOverride.destroy({ where: { templateKey: key } });
    return true;
}

function previewTemplate(key, { subjectTemplate, htmlTemplate, sampleData = null } = {}) {
    const definition = definitionFor(key);
    const clean = validateTemplateInput(
        subjectTemplate || definition.subjectTemplate,
        htmlTemplate || definition.htmlTemplate
    );
    return renderDefinition(definition, sampleData || definition.sampleData, {
        subjectTemplate: clean.subject,
        htmlTemplate: clean.html
    });
}

module.exports = {
    BRAND_NAME,
    DEFINITIONS,
    ensureSchema,
    definitionFor,
    resolveMessage,
    listTemplates,
    saveTemplate,
    resetTemplate,
    previewTemplate,
    templateVariables,
    renderDefinition,
    escapeHtml
};
