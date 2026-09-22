'use strict';

const LAYOUT_CATALOG = Object.freeze([
    { id: 'editorial-hero', name: 'Editorial Hero', description: 'Large visual opener with a polished editorial learning brief.', accent: '#0F766E', accentSoft: '#CCFBF1', background: '#F0FDFA', mode: 'hero' },
    { id: 'split-feature', name: 'Split Feature', description: 'Two-column visual and message treatment for modern awareness updates.', accent: '#2563EB', accentSoft: '#DBEAFE', background: '#EFF6FF', mode: 'split' },
    { id: 'checklist-focus', name: 'Checklist Focus', description: 'Action-led checklist format that makes practical steps easy to scan.', accent: '#047857', accentSoft: '#D1FAE5', background: '#ECFDF5', mode: 'checklist' },
    { id: 'signal-card', name: 'Signal Card', description: 'Bold signal banner with strong hierarchy for high-attention topics.', accent: '#B45309', accentSoft: '#FEF3C7', background: '#FFFBEB', mode: 'signal' },
    { id: 'story-spotlight', name: 'Story Spotlight', description: 'Narrative-led layout that turns a topic into a memorable learning story.', accent: '#7C3AED', accentSoft: '#EDE9FE', background: '#F5F3FF', mode: 'story' },
    { id: 'myth-fact', name: 'Myth & Fact', description: 'Contrast-led cards for correcting misconceptions and reinforcing facts.', accent: '#BE123C', accentSoft: '#FFE4E6', background: '#FFF1F2', mode: 'facts' },
    { id: 'action-brief', name: 'Action Brief', description: 'Compact executive-style brief with clear actions and minimal distraction.', accent: '#334155', accentSoft: '#E2E8F0', background: '#F8FAFC', mode: 'action' },
    { id: 'minimal-note', name: 'Minimal Note', description: 'Calm, clean educational note suited to routine awareness communication.', accent: '#0891B2', accentSoft: '#CFFAFE', background: '#ECFEFF', mode: 'minimal' }
]);

const LAYOUT_IDS = new Set(LAYOUT_CATALOG.map((item) => item.id));

function cleanText(value, max = 4000) {
    return String(value ?? '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .replace(/\r\n?/g, '\n')
        .trim()
        .slice(0, max);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function safeHttpUrl(value) {
    const raw = cleanText(value, 1200);
    if (!raw) return '';
    try {
        const parsed = new URL(raw);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
    } catch (_) {
        return '';
    }
}

function catalogueItem(layoutId) {
    return LAYOUT_CATALOG.find((item) => item.id === layoutId) || LAYOUT_CATALOG[0];
}

function normaliseContent(input = {}) {
    return {
        headline: cleanText(input.headline, 220),
        intro: cleanText(input.intro, 900),
        bodyParagraphs: (Array.isArray(input.bodyParagraphs) ? input.bodyParagraphs : [])
            .map((item) => cleanText(item, 1200)).filter(Boolean).slice(0, 3),
        keyPoints: (Array.isArray(input.keyPoints) ? input.keyPoints : [])
            .map((item) => ({ title: cleanText(item?.title, 120), body: cleanText(item?.body, 520) }))
            .filter((item) => item.title || item.body).slice(0, 5),
        ctaLabel: cleanText(input.ctaLabel, 80),
        ctaUrl: safeHttpUrl(input.ctaUrl),
        footerNote: cleanText(input.footerNote, 500)
    };
}

function paragraphs(items) {
    return items.map((item) => `<p style="margin:0 0 13px;font-size:13px;line-height:21px;color:#4b5563">${escapeHtml(item)}</p>`).join('');
}

function hero(src, alt, radius = 14) {
    if (!src) return '';
    return `<img src="${escapeHtml(src)}" width="560" alt="${escapeHtml(alt)}" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:${radius}px;object-fit:cover" />`;
}

function button(content, accent) {
    if (!content.ctaLabel || !content.ctaUrl) return '';
    return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:18px"><tr><td style="background:${accent};border-radius:9px"><a href="${escapeHtml(content.ctaUrl)}" style="display:inline-block;padding:12px 17px;color:#fff;text-decoration:none;font-size:13px;font-weight:800">${escapeHtml(content.ctaLabel)}</a></td></tr></table>`;
}

function pointRows(points, layout, mode = 'bar') {
    if (!points.length) return '';
    return points.map((point, index) => {
        if (mode === 'number') {
            return `<tr><td style="padding:0 0 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="42" valign="top"><div style="width:32px;height:32px;line-height:32px;text-align:center;border-radius:16px;background:${layout.accent};color:#fff;font-size:13px;font-weight:800">${index + 1}</div></td><td><div style="font-size:14px;line-height:19px;font-weight:800;color:#17202a">${escapeHtml(point.title)}</div><div style="padding-top:3px;font-size:12px;line-height:18px;color:#5f6b76">${escapeHtml(point.body)}</div></td></tr></table></td></tr>`;
        }
        if (mode === 'check') {
            return `<tr><td style="padding:0 0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:11px;background:#fff"><tr><td width="38" style="padding:13px 4px 13px 13px;color:${layout.accent};font-size:18px;font-weight:900">✓</td><td style="padding:12px 13px 12px 4px"><div style="font-size:14px;line-height:19px;font-weight:800;color:#17202a">${escapeHtml(point.title)}</div><div style="padding-top:3px;font-size:12px;line-height:18px;color:#5f6b76">${escapeHtml(point.body)}</div></td></tr></table></td></tr>`;
        }
        if (mode === 'fact') {
            const bg = index % 2 ? '#ffffff' : layout.accentSoft;
            const label = index % 2 ? 'Remember' : 'Fact';
            return `<tr><td style="padding:0 0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};border:1px solid #eceff2;border-radius:11px"><tr><td style="padding:13px 15px"><div style="font-size:9px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:${layout.accent}">${label}</div><div style="padding-top:4px;font-size:14px;line-height:19px;font-weight:800;color:#17202a">${escapeHtml(point.title)}</div><div style="padding-top:3px;font-size:12px;line-height:18px;color:#5f6b76">${escapeHtml(point.body)}</div></td></tr></table></td></tr>`;
        }
        return `<tr><td style="padding:0 0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border:1px solid #e7eaee;border-radius:11px"><tr><td width="6" style="background:${layout.accent};font-size:0">&nbsp;</td><td style="padding:12px 14px"><div style="font-size:14px;line-height:19px;font-weight:800;color:#17202a">${escapeHtml(point.title)}</div><div style="padding-top:3px;font-size:12px;line-height:18px;color:#5f6b76">${escapeHtml(point.body)}</div></td></tr></table></td></tr>`;
    }).join('');
}

function renderBody({ layout, title, content, heroSrc, heroAlt }) {
    const pointsMode = layout.mode === 'checklist' || layout.mode === 'action'
        ? 'check'
        : layout.mode === 'story' || layout.mode === 'minimal' || layout.mode === 'split'
            ? 'number'
            : layout.mode === 'facts'
                ? 'fact'
                : 'bar';
    const points = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${pointRows(content.keyPoints, layout, pointsMode)}</table>`;
    const cta = button(content, layout.accent);
    const body = paragraphs(content.bodyParagraphs);

    if (layout.mode === 'split') {
        return `<tr><td class="pad" style="padding:28px 30px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="stack" width="50%" valign="middle" style="padding-right:14px"><div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:${layout.accent}">${escapeHtml(title)}</div><h1 style="margin:8px 0 10px;font-size:25px;line-height:31px;color:#17202a">${escapeHtml(content.headline)}</h1><div style="font-size:13px;line-height:21px;color:#56616d">${escapeHtml(content.intro)}</div>${cta}</td><td class="stack mobile-top" width="50%" valign="middle" style="padding-left:14px">${hero(heroSrc, heroAlt)}</td></tr></table></td></tr><tr><td class="pad" style="padding:5px 30px 20px">${body}${points}</td></tr>`;
    }

    if (layout.mode === 'signal') {
        return `<tr><td class="pad" style="padding:17px 30px;background:${layout.accent};color:#fff"><div style="font-size:9px;letter-spacing:.13em;text-transform:uppercase;font-weight:800;opacity:.8">Awareness signal</div><div style="padding-top:4px;font-size:15px;font-weight:800">${escapeHtml(title)}</div></td></tr><tr><td class="pad" style="padding:25px 30px 9px"><h1 style="margin:0 0 9px;font-size:28px;line-height:34px;color:#17202a">${escapeHtml(content.headline)}</h1><p style="margin:0;font-size:14px;line-height:22px;color:#56616d">${escapeHtml(content.intro)}</p></td></tr><tr><td class="pad" style="padding:13px 30px">${hero(heroSrc, heroAlt)}</td></tr><tr><td class="pad" style="padding:7px 30px 20px">${body}${points}${cta}</td></tr>`;
    }

    if (layout.mode === 'story') {
        return `<tr><td class="pad" style="padding:28px 30px 14px"><div style="font-size:10px;letter-spacing:.13em;text-transform:uppercase;font-weight:800;color:${layout.accent}">${escapeHtml(title)}</div><h1 style="margin:8px 0 10px;font-size:27px;line-height:33px;color:#17202a">${escapeHtml(content.headline)}</h1><div style="border-left:4px solid ${layout.accent};padding:9px 0 9px 14px;font-size:14px;line-height:22px;color:#4b5563;font-style:italic">${escapeHtml(content.intro)}</div></td></tr><tr><td class="pad" style="padding:4px 30px 16px">${hero(heroSrc, heroAlt)}</td></tr><tr><td class="pad" style="padding:6px 30px 20px">${body}${points}${cta}</td></tr>`;
    }

    if (layout.mode === 'checklist') {
        return `<tr><td class="pad" style="padding:28px 30px 14px"><div style="display:inline-block;padding:6px 10px;border-radius:20px;background:${layout.accentSoft};font-size:9px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:${layout.accent}">${escapeHtml(title)}</div><h1 style="margin:12px 0 8px;font-size:27px;line-height:33px;color:#17202a">${escapeHtml(content.headline)}</h1><p style="margin:0;font-size:14px;line-height:22px;color:#56616d">${escapeHtml(content.intro)}</p></td></tr><tr><td class="pad" style="padding:5px 30px 18px">${points}${body}${hero(heroSrc, heroAlt)}${cta}</td></tr>`;
    }

    if (layout.mode === 'facts') {
        return `<tr><td class="pad" style="padding:28px 30px 14px"><div style="font-size:10px;letter-spacing:.13em;text-transform:uppercase;font-weight:800;color:${layout.accent}">${escapeHtml(title)}</div><h1 style="margin:8px 0 8px;font-size:27px;line-height:33px;color:#17202a">${escapeHtml(content.headline)}</h1><p style="margin:0;font-size:14px;line-height:22px;color:#56616d">${escapeHtml(content.intro)}</p></td></tr><tr><td class="pad" style="padding:4px 30px 14px">${hero(heroSrc, heroAlt)}</td></tr><tr><td class="pad" style="padding:7px 30px 20px">${points}${body}${cta}</td></tr>`;
    }

    if (layout.mode === 'action') {
        return `<tr><td class="pad" style="padding:26px 30px 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td><div style="font-size:9px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:${layout.accent}">Action brief</div><div style="padding-top:3px;font-size:10px;color:#768390">${escapeHtml(title)}</div></td><td align="right"><div style="width:42px;height:4px;background:${layout.accent}"></div></td></tr></table><h1 style="margin:12px 0 8px;font-size:26px;line-height:32px;color:#17202a">${escapeHtml(content.headline)}</h1><p style="margin:0;font-size:13px;line-height:21px;color:#56616d">${escapeHtml(content.intro)}</p></td></tr><tr><td class="pad" style="padding:11px 30px">${hero(heroSrc, heroAlt, 8)}</td></tr><tr><td class="pad" style="padding:8px 30px 20px">${body}${points}${cta}</td></tr>`;
    }

    if (layout.mode === 'minimal') {
        return `<tr><td class="pad" style="padding:28px 32px 11px"><div style="font-size:11px;font-weight:800;color:${layout.accent}">${escapeHtml(title)}</div><h1 style="margin:10px 0 8px;font-size:25px;line-height:31px;color:#17202a">${escapeHtml(content.headline)}</h1><p style="margin:0;font-size:14px;line-height:22px;color:#5b6772">${escapeHtml(content.intro)}</p></td></tr><tr><td class="pad" style="padding:9px 32px">${hero(heroSrc, heroAlt, 10)}</td></tr><tr><td class="pad" style="padding:11px 32px 20px">${body}${points}${cta}</td></tr>`;
    }

    return `<tr><td style="padding:0">${hero(heroSrc, heroAlt, 0)}</td></tr><tr><td class="pad" style="padding:27px 30px 10px"><div style="font-size:10px;letter-spacing:.13em;text-transform:uppercase;font-weight:800;color:${layout.accent}">${escapeHtml(title)}</div><h1 style="margin:8px 0 9px;font-size:28px;line-height:34px;color:#17202a">${escapeHtml(content.headline)}</h1><p style="margin:0;font-size:14px;line-height:22px;color:#55616d">${escapeHtml(content.intro)}</p><div style="padding-top:15px">${body}</div></td></tr><tr><td class="pad" style="padding:5px 30px 20px">${points}${cta}</td></tr>`;
}

function plainText({ title, subject, preheader, content }) {
    const lines = [
        cleanText(title, 220),
        content.headline,
        content.intro,
        ...content.bodyParagraphs,
        ...content.keyPoints.flatMap((point) => [point.title, point.body]),
        content.ctaLabel && content.ctaUrl ? `${content.ctaLabel}: ${content.ctaUrl}` : '',
        content.footerNote,
        cleanText(preheader, 300),
        cleanText(subject, 300)
    ].filter(Boolean);
    return [...new Set(lines)].join('\n\n');
}

function renderAwarenessEmail(input = {}, options = {}) {
    const layout = catalogueItem(input.layoutId);
    const content = normaliseContent(input.content || {});
    const title = cleanText(input.title || input.topic || 'Awareness update', 220);
    const subject = cleanText(input.subject || title, 240);
    const preheader = cleanText(input.preheader || content.intro, 240);
    const heroAlt = cleanText(input.heroAltText || `${title} awareness visual`, 320);
    const heroSrc = cleanText(options.heroSrc, 2000);
    const body = renderBody({ layout, title, content, heroSrc, heroAlt });
    const html = `<!doctype html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${escapeHtml(title)}</title>
<style>@media only screen and (max-width:620px){.email-shell{width:100%!important}.pad{padding-left:20px!important;padding-right:20px!important}.stack{display:block!important;width:100%!important}.mobile-top{padding-top:16px!important}}</style>
</head>
<body style="margin:0;padding:0;background:#eef2f4;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${layout.background};padding:28px 12px"><tr><td align="center">
<table role="presentation" width="620" class="email-shell" cellpadding="0" cellspacing="0" border="0" style="width:620px;max-width:620px;background:#fff;border:1px solid #dfe5e8;border-radius:18px;overflow:hidden">
${body}
<tr><td class="pad" style="padding:8px 30px 27px"><div style="height:1px;background:#e7eaee;margin-bottom:15px"></div><div style="font-size:10px;line-height:16px;color:#77838f">${escapeHtml(content.footerNote || 'Awareness communication for learning and safer everyday decisions.')}</div></td></tr>
</table></td></tr></table>
</body></html>`;

    return {
        subject,
        preheader,
        html,
        text: plainText({ title, subject, preheader, content }),
        content,
        layout
    };
}

module.exports = {
    LAYOUT_CATALOG,
    LAYOUT_IDS,
    escapeHtml,
    cleanText,
    safeHttpUrl,
    catalogueItem,
    normaliseContent,
    plainText,
    renderAwarenessEmail
};
