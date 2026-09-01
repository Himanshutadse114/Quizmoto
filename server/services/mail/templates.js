const DEFAULT_APP_URL = 'https://quizmoto-frontend.onrender.com';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function brandName() {
    return String(process.env.MAIL_BRAND_NAME || 'LMSGEN').trim() || 'LMSGEN';
}

function publicAppUrl(pathname = '/') {
    const base = String(
        process.env.PUBLIC_APP_URL ||
        process.env.FRONTEND_URL ||
        process.env.CLIENT_URL ||
        process.env.PUBLIC_FRONTEND_URL ||
        DEFAULT_APP_URL
    ).trim().replace(/\/$/, '');
    const path = String(pathname || '/').startsWith('/') ? String(pathname || '/') : `/${pathname}`;
    return `${base}${path}`;
}

function greeting(name) {
    const cleaned = String(name || '').trim();
    return cleaned ? `Hi ${escapeHtml(cleaned)},` : 'Hello,';
}

function formatDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(date);
}

function button(label, href) {
    return `<a href="${escapeHtml(href)}" style="display:inline-block;background:#16a085;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:8px;">${escapeHtml(label)}</a>`;
}

function shell({ preheader = '', title, body, footer = '' }) {
    const brand = escapeHtml(brandName());
    return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f7f8;font-family:Arial,Helvetica,sans-serif;color:#17202a;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f8;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e5ebed;border-radius:14px;overflow:hidden;">
<tr><td style="padding:20px 28px;background:#071817;color:#ffffff;font-size:18px;font-weight:800;letter-spacing:.03em;">${brand}</td></tr>
<tr><td style="padding:30px 28px;">
<h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:#102321;">${escapeHtml(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:18px 28px;background:#f8fafb;border-top:1px solid #edf1f2;color:#6b7777;font-size:12px;line-height:1.6;">
${footer || `This is an automated message from ${brand}.`}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function learnerOtpTemplate({ learnerName, workspaceName, code, expiresInMinutes }) {
    const brand = brandName();
    const workspace = String(workspaceName || 'your organisation').trim();
    const title = 'Your training verification code';
    const body = `
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;">${greeting(learnerName)}</p>
<p style="margin:0 0 18px;font-size:15px;line-height:1.65;">Use this one-time code to securely access the training assigned to you by <strong>${escapeHtml(workspace)}</strong>.</p>
<div style="margin:24px 0;padding:18px 20px;border-radius:12px;background:#eef8f6;border:1px solid #cfe9e3;text-align:center;">
<div style="font-size:12px;color:#60716f;margin-bottom:8px;text-transform:uppercase;letter-spacing:.08em;">Verification code</div>
<div style="font-size:34px;letter-spacing:.18em;font-weight:800;color:#0c3b35;">${escapeHtml(code)}</div>
</div>
<p style="margin:0 0 10px;font-size:14px;line-height:1.6;">This code expires in <strong>${escapeHtml(expiresInMinutes)} minutes</strong> and can be used only once.</p>
<p style="margin:0;font-size:13px;line-height:1.6;color:#6a7775;">If you did not request this code, you can safely ignore this email. Never share this code with another person.</p>`;
    return {
        subject: `${brand} training verification code: ${code}`,
        text: `${learnerName ? `Hi ${learnerName},\n\n` : ''}Your ${brand} training verification code is ${code}. It expires in ${expiresInMinutes} minutes and can be used only once. If you did not request it, ignore this email.`,
        html: shell({ preheader: `Your verification code is ${code}`, title, body })
    };
}

function trainingAssignmentTemplate({ learnerName, workspaceName, courses = [], dueAt, required = true, portalPath = '/learn' }) {
    const brand = brandName();
    const due = formatDate(dueAt);
    const portalUrl = publicAppUrl(portalPath);
    const names = courses.map((course) => String(course?.title || course || 'Training').trim()).filter(Boolean);
    const list = names.length
        ? `<ul style="margin:14px 0 20px;padding-left:20px;">${names.map((name) => `<li style="margin:7px 0;font-size:14px;line-height:1.55;">${escapeHtml(name)}</li>`).join('')}</ul>`
        : '';
    const body = `
<p style="margin:0 0 14px;font-size:15px;line-height:1.65;">${greeting(learnerName)}</p>
<p style="margin:0;font-size:15px;line-height:1.65;"><strong>${escapeHtml(workspaceName || 'Your organisation')}</strong> has assigned ${names.length === 1 ? 'a training course' : 'training courses'} to you${required ? ' as required learning' : ''}.</p>
${list}
${due ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;"><strong>Due date:</strong> ${escapeHtml(due)}</p>` : ''}
<div style="margin:24px 0 18px;">${button('Open my training', portalUrl)}</div>
<p style="margin:0;font-size:13px;line-height:1.6;color:#6a7775;">Open the learner portal, enter this work email address and use the one-time verification code sent to you.</p>`;
    return {
        subject: names.length === 1 ? `Training assigned: ${names[0]}` : `${names.length || ''} training courses assigned`.trim(),
        text: `${learnerName ? `Hi ${learnerName},\n\n` : ''}${workspaceName || 'Your organisation'} assigned training to you.${names.length ? `\n\n${names.map((name) => `- ${name}`).join('\n')}` : ''}${due ? `\n\nDue date: ${due}` : ''}\n\nOpen training: ${portalUrl}`,
        html: shell({ preheader: 'New training has been assigned to you', title: 'New training assigned', body })
    };
}

function campaignLaunchTemplate({ learnerName, workspaceName, campaignName, courses = [], dueAt, portalPath, accessCode = null }) {
    const due = formatDate(dueAt);
    const portalUrl = publicAppUrl(portalPath);
    const names = courses.map((course) => String(course?.title || course || 'Training').trim()).filter(Boolean);
    const accessBlock = accessCode ? `
<div style="margin:22px 0;padding:16px 18px;border-radius:10px;background:#eef8f6;border:1px solid #cfe9e3;">
<div style="font-size:12px;color:#60716f;margin-bottom:6px;">YOUR ACCESS CODE</div>
<div style="font-size:25px;font-weight:800;letter-spacing:.12em;color:#0c3b35;">${escapeHtml(accessCode)}</div>
</div>` : '';
    const body = `
<p style="margin:0 0 14px;font-size:15px;line-height:1.65;">${greeting(learnerName)}</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;"><strong>${escapeHtml(workspaceName || 'Your organisation')}</strong> has started the training campaign <strong>${escapeHtml(campaignName || 'Training campaign')}</strong>.</p>
${names.length ? `<ul style="margin:0 0 18px;padding-left:20px;">${names.map((name) => `<li style="margin:7px 0;font-size:14px;">${escapeHtml(name)}</li>`).join('')}</ul>` : ''}
${due ? `<p style="margin:0 0 18px;font-size:14px;"><strong>Due date:</strong> ${escapeHtml(due)}</p>` : ''}
${accessBlock}
<div style="margin:24px 0 18px;">${button('Open campaign training', portalUrl)}</div>
<p style="margin:0;font-size:13px;line-height:1.6;color:#6a7775;">Use the same email address that received this message when signing in.</p>`;
    return {
        subject: `Training campaign started: ${campaignName || 'Your training'}`,
        text: `${learnerName ? `Hi ${learnerName},\n\n` : ''}${workspaceName || 'Your organisation'} started ${campaignName || 'a training campaign'}.${names.length ? `\n\n${names.map((name) => `- ${name}`).join('\n')}` : ''}${due ? `\n\nDue date: ${due}` : ''}${accessCode ? `\n\nAccess code: ${accessCode}` : ''}\n\nOpen campaign: ${portalUrl}`,
        html: shell({ preheader: 'Your training campaign is ready', title: 'Your training campaign is ready', body })
    };
}

function teamInviteTemplate({ displayName, workspaceName, roleLabel, invitedByEmail }) {
    const loginUrl = publicAppUrl('/login');
    const body = `
<p style="margin:0 0 14px;font-size:15px;line-height:1.65;">${greeting(displayName)}</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;">You have been given <strong>${escapeHtml(roleLabel || 'team')}</strong> access to <strong>${escapeHtml(workspaceName || 'an LMSGEN tenant')}</strong>.</p>
${invitedByEmail ? `<p style="margin:0 0 18px;font-size:13px;color:#667371;">Invited by ${escapeHtml(invitedByEmail)}</p>` : ''}
<div style="margin:24px 0 18px;">${button('Open LMSGEN', loginUrl)}</div>
<p style="margin:0;font-size:13px;line-height:1.6;color:#6a7775;">Sign in or create your account using this exact work email address. Your tenant role is already approved.</p>`;
    return {
        subject: `You’ve been invited to ${workspaceName || 'LMSGEN'}`,
        text: `${displayName ? `Hi ${displayName},\n\n` : ''}You have been given ${roleLabel || 'team'} access to ${workspaceName || 'an LMSGEN tenant'}. Sign in or create an account using this work email: ${loginUrl}`,
        html: shell({ preheader: 'Your LMSGEN team access is ready', title: 'Your team access is ready', body })
    };
}

function tenantAdminTemplate({ adminName, workspaceName, changed = false }) {
    const loginUrl = publicAppUrl('/login');
    const action = changed ? 'You are now the Tenant Admin' : 'Your LMSGEN tenant is ready';
    const body = `
<p style="margin:0 0 14px;font-size:15px;line-height:1.65;">${greeting(adminName)}</p>
<p style="margin:0 0 18px;font-size:15px;line-height:1.65;">${changed ? 'You have been assigned as the Tenant Admin for' : 'A new LMSGEN tenant has been created for'} <strong>${escapeHtml(workspaceName || 'your organisation')}</strong>.</p>
<div style="margin:24px 0 18px;">${button('Open LMSGEN', loginUrl)}</div>
<p style="margin:0;font-size:13px;line-height:1.6;color:#6a7775;">Use this exact work email to sign in. If you do not yet have an account, create one with this email so your approved tenant access can be linked automatically.</p>`;
    return {
        subject: `${action}: ${workspaceName || 'LMSGEN'}`,
        text: `${adminName ? `Hi ${adminName},\n\n` : ''}${action} for ${workspaceName || 'your organisation'}. Sign in or create an account using this work email: ${loginUrl}`,
        html: shell({ preheader: action, title: action, body })
    };
}

function accessApprovedTemplate({ name }) {
    const loginUrl = publicAppUrl('/login');
    const body = `
<p style="margin:0 0 14px;font-size:15px;line-height:1.65;">${greeting(name)}</p>
<p style="margin:0 0 18px;font-size:15px;line-height:1.65;">Your LMSGEN account registration has been approved. Tenant access still depends on your email being assigned to an active tenant.</p>
<div style="margin:24px 0 18px;">${button('Sign in to LMSGEN', loginUrl)}</div>`;
    return {
        subject: 'Your LMSGEN account has been approved',
        text: `${name ? `Hi ${name},\n\n` : ''}Your LMSGEN account registration has been approved. Sign in: ${loginUrl}`,
        html: shell({ preheader: 'Your account has been approved', title: 'Account approved', body })
    };
}

module.exports = {
    brandName,
    publicAppUrl,
    learnerOtpTemplate,
    trainingAssignmentTemplate,
    campaignLaunchTemplate,
    teamInviteTemplate,
    tenantAdminTemplate,
    accessApprovedTemplate
};
