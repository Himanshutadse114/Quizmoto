'use strict';

const LAYOUT_CATALOG = Object.freeze([
    {
        id: 'editorial-hero',
        name: 'Data Privacy Newsletter',
        description: 'Reference-style data privacy newsletter with hero storytelling, two practice cards and a dark responsibility band.',
        accent: '#A85A3D',
        accentSoft: '#F3D3AE',
        background: '#F5EFE8',
        ink: '#3E2420',
        muted: '#765E55',
        mode: 'newsletter',
        imageSlots: ['hero', 'point-1', 'point-2']
    },
    {
        id: 'split-feature',
        name: 'Mobile App Threat Brief',
        description: 'Reference-style mobile threat field briefing with numbered risks, a field-test visual and bright lock-it-down band.',
        accent: '#D4F542',
        accentSoft: '#EFFFC0',
        background: '#ECECE8',
        ink: '#0E0E0E',
        muted: '#555555',
        mode: 'high-risk',
        imageSlots: ['hero', 'case-study']
    },
    {
        id: 'checklist-focus',
        name: 'Internet Security Best Practices',
        description: 'Reference-style internet security guide with a hero, 2×2 habit cards, golden rule and make-it-stick actions.',
        accent: '#2E7D4F',
        accentSoft: '#DDEEDD',
        background: '#FAF6EF',
        ink: '#1C1A17',
        muted: '#6E6960',
        mode: 'habits',
        imageSlots: ['hero', 'point-1', 'point-2', 'point-3', 'point-4']
    },
    {
        id: 'signal-card',
        name: 'Social Media Threat Brief',
        description: 'Reference-style social media field brief with numbered exposure risks, dark case file and before-you-post checklist.',
        accent: '#E63946',
        accentSoft: '#FADADD',
        background: '#E4E1DC',
        ink: '#141414',
        muted: '#555555',
        mode: 'field',
        imageSlots: ['hero', 'case-study']
    },
    {
        id: 'story-spotlight',
        name: 'Ransomware Attack Story',
        description: 'Reference-style ransomware story with three alternating attack stages, response moves, mid banner and closing rules.',
        accent: '#DB2922',
        accentSoft: '#F7D6D2',
        background: '#F0F1F5',
        ink: '#002B3B',
        muted: '#3074A0',
        mode: 'storyboard',
        imageSlots: ['hero', 'point-1', 'point-2', 'point-3', 'banner']
    },
    {
        id: 'myth-fact',
        name: 'Social Engineering Playbook',
        description: 'Reference-style social engineering playbook with three tactic cards, red flags, quote callout and three-second rule.',
        accent: '#F2A93B',
        accentSoft: '#F8E7BE',
        background: '#F1ECE0',
        ink: '#221C3F',
        muted: '#4A4468',
        mode: 'playbook',
        imageSlots: ['hero', 'point-1', 'point-2', 'point-3', 'banner']
    },
    {
        id: 'action-brief',
        name: 'Modern Threats Dossier',
        description: 'Reference-style modern phishing dossier with banner-led sections, numbered scenarios, reality check and response rules.',
        accent: '#DB2922',
        accentSoft: '#F4D2CE',
        background: '#E7E4D5',
        ink: '#002B3B',
        muted: '#3074A0',
        mode: 'dossier',
        imageSlots: ['hero', 'point-1', 'point-2', 'point-3', 'banner']
    },
    {
        id: 'minimal-note',
        name: 'AI Scams & Deepfakes',
        description: 'Reference-style AI scams and deepfakes briefing with cinematic banners, familiar-voice scenarios and verification-first rules.',
        accent: '#DB2922',
        accentSoft: '#DCE8F1',
        background: '#E7E4D5',
        ink: '#002B3B',
        muted: '#3074A0',
        mode: 'ai-signal',
        imageSlots: ['hero', 'point-1', 'point-2', 'point-3', 'banner']
    }
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

function layoutVisualSlots(layoutId) {
    return [...(catalogueItem(layoutId).imageSlots || ['hero'])];
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

function normaliseImageSources(options = {}) {
    const images = {};
    if (options.imageSources && typeof options.imageSources === 'object') {
        for (const [slot, value] of Object.entries(options.imageSources)) {
            if (!/^[a-z0-9-]{1,40}$/i.test(slot)) continue;
            const src = cleanText(value, 2200);
            if (src) images[slot] = src;
        }
    }
    const legacyHero = cleanText(options.heroSrc, 2200);
    if (legacyHero && !images.hero) images.hero = legacyHero;
    return images;
}

function visualAlt(slot, title, content, heroAlt) {
    if (slot === 'hero') return cleanText(heroAlt || `${title} awareness visual`, 320);
    const pointMatch = slot.match(/^point-(\d+)$/);
    if (pointMatch) {
        const point = content.keyPoints[Math.max(0, Number(pointMatch[1]) - 1)];
        if (point?.title) return cleanText(`${point.title} illustration`, 320);
    }
    if (slot === 'case-study') return cleanText(`${title} visual case study`, 320);
    return cleanText(`${title} supporting awareness illustration`, 320);
}

function imageTag(src, alt, width = 560, radius = 0) {
    if (!src) return '';
    return `<img src="${escapeHtml(src)}" width="${width}" alt="${escapeHtml(alt)}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;border-radius:${radius}px;object-fit:cover" />`;
}

function visual(images, slot, title, content, heroAlt, width = 560, radius = 0) {
    return imageTag(images[slot], visualAlt(slot, title, content, heroAlt), width, radius);
}

function button(content, accent, ink = '#ffffff') {
    if (!content.ctaLabel || !content.ctaUrl) return '';
    return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:18px"><tr><td style="background:${accent};border-radius:7px"><a href="${escapeHtml(content.ctaUrl)}" style="display:inline-block;padding:12px 17px;color:${ink};text-decoration:none;font-size:13px;font-weight:800">${escapeHtml(content.ctaLabel)}</a></td></tr></table>`;
}

function bodyParagraphs(items, color = '#4b5563') {
    return items.map((item) => `<p style="margin:0 0 13px;font-size:13px;line-height:21px;color:${color}">${escapeHtml(item)}</p>`).join('');
}

function numberedRows(points, layout, { prefix = 'YOUR MOVE', start = 1 } = {}) {
    return points.map((point, index) => `<tr><td style="padding:0 0 23px"><div style="font-size:11px;letter-spacing:.18em;font-weight:800;color:${layout.accent}">${String(start + index).padStart(2, '0')}</div><div style="padding-top:6px;font-size:20px;line-height:25px;font-weight:800;color:${layout.ink}">${escapeHtml(point.title)}</div><div style="padding-top:8px;font-size:14px;line-height:22px;color:${layout.muted}">${escapeHtml(point.body)}</div>${prefix ? `<div style="padding-top:10px;font-size:11px;line-height:18px;font-weight:800;color:${layout.accent}">${escapeHtml(prefix)} <span style="font-weight:500;color:${layout.ink}">Pause, verify and use a trusted route before acting.</span></div>` : ''}</td></tr>`).join('');
}

function checkRows(points, accent, ink, muted) {
    return points.map((point) => `<tr><td width="30" valign="top" style="padding:9px 0;color:${accent};font-size:17px;font-weight:900">✓</td><td style="padding:9px 0"><div style="font-size:14px;line-height:19px;font-weight:800;color:${ink}">${escapeHtml(point.title)}</div><div style="padding-top:3px;font-size:12px;line-height:18px;color:${muted}">${escapeHtml(point.body)}</div></td></tr>`).join('');
}

function twoColumnCards(points, images, layout, title, content, heroAlt) {
    const cells = points.slice(0, 2).map((point, index) => {
        const slot = `point-${index + 1}`;
        const art = visual(images, slot, title, content, heroAlt, 260, 10);
        return `<td class="stack" width="50%" valign="top" style="padding:${index ? '0 0 0 8px' : '0 8px 0 0'}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border:1px solid #eadfd6;border-radius:12px"><tr><td style="padding:0">${art}</td></tr><tr><td style="padding:14px 15px 16px"><div style="font-size:14px;font-weight:800;line-height:19px;color:${layout.ink}">${escapeHtml(point.title)}</div><div style="padding-top:5px;font-size:12px;line-height:18px;color:${layout.muted}">${escapeHtml(point.body)}</div></td></tr></table></td>`;
    }).join('');
    return cells ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>` : '';
}

function habitGrid(points, images, layout, title, content, heroAlt) {
    const rows = [];
    for (let index = 0; index < Math.min(points.length, 4); index += 2) {
        const cells = [index, index + 1].map((pointIndex) => {
            const point = points[pointIndex];
            if (!point) return '<td class="stack" width="50%">&nbsp;</td>';
            const slot = `point-${pointIndex + 1}`;
            const art = visual(images, slot, title, content, heroAlt, 250, 8);
            return `<td class="stack" width="50%" valign="top" style="padding:${pointIndex % 2 ? '0 0 14px 7px' : '0 7px 14px 0'}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border:1px solid #e5ddd0;border-radius:10px"><tr><td style="padding:0">${art}</td></tr><tr><td style="padding:13px 14px 15px"><div style="font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:${layout.accent};font-weight:800">Habit ${String(pointIndex + 1).padStart(2, '0')}</div><div style="padding-top:5px;font-size:15px;line-height:20px;color:${layout.ink};font-weight:800">${escapeHtml(point.title)}</div><div style="padding-top:5px;font-size:12px;line-height:18px;color:${layout.muted}">${escapeHtml(point.body)}</div></td></tr></table></td>`;
        }).join('');
        rows.push(`<tr>${cells}</tr>`);
    }
    return rows.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join('')}</table>` : '';
}

function storyboardRows(points, images, layout, title, content, heroAlt) {
    return points.slice(0, 3).map((point, index) => {
        const art = visual(images, `point-${index + 1}`, title, content, heroAlt, 255, 0);
        const number = String(index + 1).padStart(2, '0');
        const copy = `<td class="stack" width="52%" valign="middle" style="padding:22px 24px"><div style="font-size:11px;letter-spacing:.18em;color:${layout.accent};font-weight:800">${number}</div><div style="padding-top:7px;font-size:20px;line-height:25px;color:${layout.ink};font-weight:800">${escapeHtml(point.title)}</div><div style="padding-top:8px;font-size:13px;line-height:20px;color:${layout.muted}">${escapeHtml(point.body)}</div><div style="padding-top:10px;font-size:11px;line-height:18px;color:${layout.accent};font-weight:800">YOUR MOVE <span style="color:${layout.ink};font-weight:500">Verify before you act and report concerns quickly.</span></div></td>`;
        const imageCell = `<td class="stack" width="48%" valign="middle" style="padding:0">${art}</td>`;
        return `<tr>${index % 2 ? copy + imageCell : imageCell + copy}</tr>`;
    }).join('');
}

function tacticCards(points, images, layout, title, content, heroAlt) {
    const cards = points.slice(0, 3).map((point, index) => {
        const art = visual(images, `point-${index + 1}`, title, content, heroAlt, 175, 0);
        return `<td class="stack" width="33.33%" valign="top" style="padding:${index === 0 ? '0 6px 0 0' : index === 2 ? '0 0 0 6px' : '0 6px'}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border:1px solid #ded8ca"><tr><td style="padding:0">${art}</td></tr><tr><td style="padding:12px"><div style="font-size:10px;letter-spacing:.09em;color:${layout.accent};font-weight:800">${String(index + 1).padStart(2, '0')}</div><div style="padding-top:5px;font-size:13px;line-height:18px;color:${layout.ink};font-weight:800">${escapeHtml(point.title)}</div><div style="padding-top:5px;font-size:11px;line-height:17px;color:${layout.muted}">${escapeHtml(point.body)}</div></td></tr></table></td>`;
    }).join('');
    return cards ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cards}</tr></table>` : '';
}

function renderBody({ layout, title, content, images, heroAlt }) {
    const hero = visual(images, 'hero', title, content, heroAlt, 600, 0);
    const ctaInk = layout.mode === 'high-risk' ? '#0E0E0E' : '#FFFFFF';
    const cta = button(content, layout.accent, ctaInk);
    const paragraphs = bodyParagraphs(content.bodyParagraphs, layout.muted);

    if (layout.mode === 'newsletter') {
        const cards = twoColumnCards(content.keyPoints, images, layout, title, content, heroAlt);
        const remaining = content.keyPoints.slice(2);
        return `
<tr><td style="padding:16px 30px;background:#fff"><div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:${layout.accent}">DATA PRIVACY · SECURITY NEWSLETTER</div></td></tr>
${hero ? `<tr><td style="padding:0">${hero}</td></tr>` : ''}
<tr><td class="pad" style="padding:28px 32px 14px"><h1 style="margin:0 0 10px;font-size:27px;line-height:33px;color:${layout.ink}">${escapeHtml(content.headline)}</h1><p style="margin:0;font-size:14px;line-height:22px;color:${layout.muted}">${escapeHtml(content.intro)}</p></td></tr>
<tr><td class="pad" style="padding:8px 32px 9px"><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:${layout.accent};font-weight:900">PRIVACY IN PRACTICE</div><div style="padding-top:9px;font-size:12px;line-height:18px;color:${layout.muted}">Small habits that turn policy into everyday practice.</div></td></tr>\n<tr><td class="pad" style="padding:8px 32px 18px">${cards}</td></tr>
${remaining.length ? `<tr><td class="pad" style="padding:4px 32px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${checkRows(remaining, layout.accent, layout.ink, layout.muted)}</table></td></tr>` : ''}
<tr><td style="padding:22px 32px;background:${layout.ink};color:#fff"><div style="font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:${layout.accentSoft};font-weight:800">PRIVACY IS EVERYONE'S JOB</div><div style="padding-top:8px;font-size:13px;line-height:21px;color:#fff">${paragraphs || escapeHtml(content.footerNote)}</div>${cta}</td></tr>`;
    }

    if (layout.mode === 'high-risk') {
        const caseImage = visual(images, 'case-study', title, content, heroAlt, 540, 8);
        return `
<tr><td style="padding:14px 26px;background:${layout.ink};color:#fff"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td><div style="font-size:10px;letter-spacing:.15em;text-transform:uppercase;font-weight:800">MOBILE APP THREATS · FIELD BRIEFING</div></td><td align="right"><span style="display:inline-block;padding:5px 8px;background:${layout.accent};color:#0E0E0E;font-size:9px;font-weight:900">THREAT LEVEL: HIGH</span></td></tr></table></td></tr>
${hero ? `<tr><td style="padding:0;background:${layout.ink}">${hero}</td></tr>` : ''}
<tr><td class="pad" style="padding:27px 30px 15px;background:#fff"><h1 style="margin:0 0 9px;font-size:28px;line-height:34px;color:${layout.ink}">${escapeHtml(content.headline)}</h1><p style="margin:0;font-size:14px;line-height:22px;color:${layout.muted}">${escapeHtml(content.intro)}</p></td></tr>
<tr><td class="pad" style="padding:9px 30px 10px;background:#fff"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${numberedRows(content.keyPoints.slice(0, 4), layout, { prefix: '' })}</table></td></tr>
${caseImage ? `<tr><td class="pad" style="padding:8px 30px 22px;background:#fff"><div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:${layout.accent === '#D4F542' ? '#556B11' : layout.accent}">02 · FIELD TEST</div><div style="padding-top:9px">${caseImage}</div></td></tr>` : ''}
<tr><td class="pad" style="padding:21px 30px;background:${layout.accent};color:#0E0E0E"><div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;font-weight:900">03 · LOCK IT DOWN</div><div style="padding-top:8px;font-size:13px;line-height:20px">${paragraphs || 'Slow down, verify the request and use trusted channels before taking action.'}</div>${cta}</td></tr>`;
    }

    if (layout.mode === 'habits') {
        const grid = habitGrid(content.keyPoints, images, layout, title, content, heroAlt);
        const remaining = content.keyPoints.slice(4);
        return `
${hero ? `<tr><td style="padding:0">${hero}</td></tr>` : ''}
<tr><td class="pad" style="padding:28px 32px 12px"><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:${layout.accent};font-weight:800">DOC. ISP · BEST PRACTICES GUIDE</div><h1 style="margin:9px 0 8px;font-size:28px;line-height:34px;color:${layout.ink}">${escapeHtml(content.headline)}</h1><p style="margin:0;font-size:14px;line-height:22px;color:${layout.muted}">${escapeHtml(content.intro)}</p></td></tr>
<tr><td class="pad" style="padding:8px 32px 8px"><div style="font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:${layout.ink};font-weight:900">FOUR HABITS, ZERO DRAMA</div></td></tr>\n<tr><td class="pad" style="padding:8px 32px 15px">${grid}</td></tr>
<tr><td class="pad" style="padding:8px 32px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px solid ${layout.ink};background:#fff"><tr><td style="padding:16px 18px"><div style="font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:${layout.accent};font-weight:800">The golden rule</div><div style="padding-top:6px;font-size:16px;line-height:23px;color:${layout.ink};font-weight:800">${escapeHtml(content.bodyParagraphs[0] || content.footerNote || 'Small habits, repeated consistently, create strong protection.')}</div></td></tr></table></td></tr>
${remaining.length ? `<tr><td class="pad" style="padding:0 32px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${checkRows(remaining, layout.accent, layout.ink, layout.muted)}</table></td></tr>` : ''}
<tr><td class="pad" style="padding:4px 32px 24px"><div style="padding-bottom:8px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${layout.accent};font-weight:900">MAKE IT STICK</div>${bodyParagraphs(content.bodyParagraphs.slice(1), layout.muted)}${cta}</td></tr>`;
    }

    if (layout.mode === 'field') {
        const caseImage = visual(images, 'case-study', title, content, heroAlt, 540, 8);
        return `
<tr><td style="padding:12px 28px;background:${layout.ink};color:#fff"><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;font-weight:800">FIELD BRIEFING · SOCIAL MEDIA THREATS</div></td></tr>
${hero ? `<tr><td style="padding:0">${hero}</td></tr>` : ''}
<tr><td class="pad" style="padding:27px 30px 12px;background:#fff"><h1 style="margin:0 0 8px;font-size:28px;line-height:34px;color:${layout.ink}">${escapeHtml(content.headline)}</h1><p style="margin:0;font-size:14px;line-height:22px;color:${layout.muted}">${escapeHtml(content.intro)}</p></td></tr>
<tr><td class="pad" style="padding:8px 30px 8px;background:#fff"><div style="font-size:11px;letter-spacing:.14em;color:${layout.accent};font-weight:900">HOW THEY GET IN</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding-top:12px">${numberedRows(content.keyPoints.slice(0, 3), layout, { prefix: '' })}</table></td></tr>
${caseImage ? `<tr><td class="pad" style="padding:18px 30px;background:${layout.ink};color:#fff"><div style="font-size:10px;letter-spacing:.15em;color:${layout.accent};font-weight:900">CASE FILE · ANATOMY OF THE THREAT</div><div style="padding-top:9px">${caseImage}</div></td></tr>` : ''}
<tr><td class="pad" style="padding:22px 30px;background:#fff"><div style="font-size:11px;letter-spacing:.14em;color:${layout.accent};font-weight:900">BEFORE YOU POST</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding-top:8px">${checkRows(content.keyPoints.slice(3).length ? content.keyPoints.slice(3) : content.keyPoints.slice(0, 3), layout.accent, layout.ink, layout.muted)}</table>${paragraphs}${cta}</td></tr>`;
    }

    if (layout.mode === 'storyboard') {
        const banner = visual(images, 'banner', title, content, heroAlt, 600, 0);
        return `
${hero ? `<tr><td style="padding:0">${hero}</td></tr>` : ''}
<tr><td class="pad" style="padding:28px 32px 18px;background:#fff"><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:${layout.accent};font-weight:900">ANATOMY OF AN ATTACK</div><h1 style="margin:9px 0 8px;font-size:28px;line-height:34px;color:${layout.ink}">${escapeHtml(content.headline)}</h1><p style="margin:0;font-size:14px;line-height:22px;color:${layout.muted}">${escapeHtml(content.intro)}</p></td></tr>
<tr><td style="padding:0;background:#fff"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${storyboardRows(content.keyPoints, images, layout, title, content, heroAlt)}</table></td></tr>
${banner ? `<tr><td style="padding:0">${banner}</td></tr>` : ''}
<tr><td class="pad" style="padding:23px 32px 25px;background:#fff"><div style="font-size:11px;letter-spacing:.14em;color:${layout.accent};font-weight:900">THE RULES THAT OUTLAST RANSOMWARE</div><div style="padding-top:10px">${paragraphs}</div>${content.keyPoints.slice(3).length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${checkRows(content.keyPoints.slice(3), layout.accent, layout.ink, layout.muted)}</table>` : ''}${cta}</td></tr>`;
    }

    if (layout.mode === 'playbook') {
        const cards = tacticCards(content.keyPoints, images, layout, title, content, heroAlt);
        const banner = visual(images, 'banner', title, content, heroAlt, 600, 0);
        const redFlags = content.keyPoints.slice(3);
        return `
<tr><td style="padding:13px 28px;background:${layout.ink};color:#fff"><div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;font-weight:800">SECURITY AWARENESS · SOCIAL ENGINEERING</div></td></tr>
${hero ? `<tr><td style="padding:0">${hero}</td></tr>` : ''}
<tr><td class="pad" style="padding:27px 30px 12px;background:#fff"><h1 style="margin:0 0 8px;font-size:28px;line-height:34px;color:${layout.ink}">${escapeHtml(content.headline)}</h1><p style="margin:0;font-size:14px;line-height:22px;color:${layout.muted}">${escapeHtml(content.intro)}</p></td></tr>
<tr><td class="pad" style="padding:12px 30px 22px;background:#fff"><div style="padding-bottom:10px;font-size:10px;letter-spacing:.14em;color:${layout.accent};font-weight:900">THREE TRICKS IN THE PLAYBOOK</div>${cards}</td></tr>
${banner ? `<tr><td style="padding:0">${banner}</td></tr>` : ''}
<tr><td class="pad" style="padding:20px 30px;background:${layout.ink};color:#fff"><div style="font-size:10px;letter-spacing:.14em;color:${layout.accent};font-weight:900">SPOT THE RED FLAGS</div>${redFlags.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding-top:8px">${checkRows(redFlags, layout.accent, '#FFFFFF', '#E7E1F4')}</table>` : `<div style="padding-top:9px;font-size:13px;line-height:20px">${escapeHtml(content.bodyParagraphs[0] || 'Urgency, authority, secrecy and unusual requests deserve a second check.')}</div>`}</td></tr>
<tr><td class="pad" align="center" style="padding:18px 30px;background:${layout.accentSoft}"><div style="font-size:16px;line-height:23px;font-style:italic;font-weight:800;color:${layout.ink}">${escapeHtml(content.bodyParagraphs[0] || 'Helpful does not mean verified.')}</div></td></tr>\n<tr><td class="pad" style="padding:22px 30px 26px;background:#fff"><div style="font-size:10px;letter-spacing:.14em;color:${layout.accent};font-weight:900">THE 3-SECOND RULE</div><div style="padding-top:8px">${bodyParagraphs(content.bodyParagraphs.slice(1), layout.muted)}</div>${cta}</td></tr>`;
    }

    if (layout.mode === 'dossier' || layout.mode === 'ai-signal') {
        const label = layout.mode === 'ai-signal' ? 'THE NEW CON · AI SCAMS & DEEPFAKES' : 'THE NEW CON · MODERN THREATS';
        const banner = visual(images, 'banner', title, content, heroAlt, 600, 0);
        const scenarioRows = content.keyPoints.slice(0, 3).map((point, index) => {
            const art = visual(images, `point-${index + 1}`, title, content, heroAlt, 600, 0);
            return `${art ? `<tr><td style="padding:0">${art}</td></tr>` : ''}<tr><td class="pad" style="padding:23px 34px ${index === 2 ? '18px' : '24px'};background:#fff"><div style="font-size:11px;letter-spacing:.18em;color:${layout.accent};font-weight:900">${String(index + 1).padStart(2, '0')}</div><div style="padding-top:7px;font-size:21px;line-height:26px;color:${layout.ink};font-weight:900">${escapeHtml(point.title)}</div><div style="padding-top:8px;font-size:14px;line-height:22px;color:${layout.muted}">${escapeHtml(point.body)}</div><div style="padding-top:11px;font-size:12px;line-height:19px;color:${layout.accent};font-weight:900">YOUR MOVE <span style="color:${layout.ink};font-weight:500">Use a known channel to verify the request before acting.</span></div></td></tr>`;
        }).join('');
        return `
${hero ? `<tr><td style="padding:0">${hero}</td></tr>` : ''}
<tr><td class="pad" style="padding:26px 34px 21px;background:${layout.background}"><div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${layout.accent};font-weight:900">${label}</div><h1 style="margin:10px 0 8px;font-size:29px;line-height:35px;color:${layout.ink}">${escapeHtml(content.headline)}</h1><p style="margin:0;font-size:14px;line-height:22px;color:${layout.muted}">${escapeHtml(content.intro)}</p></td></tr>
${scenarioRows}
${banner ? `<tr><td style="padding:0">${banner}</td></tr>` : ''}
<tr><td class="pad" style="padding:23px 34px 26px;background:#fff"><div style="font-size:10px;letter-spacing:.17em;color:${layout.accent};font-weight:900">QUICK REALITY CHECK</div><div style="padding-top:9px">${paragraphs}</div>${content.keyPoints.slice(3).length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${checkRows(content.keyPoints.slice(3), layout.accent, layout.ink, layout.muted)}</table>` : ''}${cta}</td></tr>`;
    }

    return `<tr><td class="pad" style="padding:30px"><h1 style="margin:0;color:${layout.ink}">${escapeHtml(content.headline)}</h1><p style="color:${layout.muted}">${escapeHtml(content.intro)}</p>${paragraphs}${cta}</td></tr>`;
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
    const images = normaliseImageSources(options);
    const body = renderBody({ layout, title, content, images, heroAlt });
    const html = `<!doctype html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no" />
<meta name="x-apple-disable-message-reformatting" />
<title>${escapeHtml(title)}</title>
<style>
body{margin:0;padding:0}table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0}img{border:0;display:block}
@media only screen and (max-width:620px){.email-shell{width:100%!important}.pad{padding-left:20px!important;padding-right:20px!important}.stack{display:block!important;width:100%!important;padding-left:0!important;padding-right:0!important;padding-bottom:12px!important}}
</style>
</head>
<body style="margin:0;padding:0;background:#eef2f4;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${layout.background};padding:28px 12px"><tr><td align="center">
<table role="presentation" width="600" class="email-shell" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#fff;border:0;overflow:hidden">
${body}
<tr><td class="pad" style="padding:16px 30px 28px;background:#fff"><div style="height:1px;background:#e7eaee;margin-bottom:14px"></div><div style="font-size:10px;line-height:16px;color:#77838f">${escapeHtml(content.footerNote || 'Awareness communication for learning and safer everyday decisions.')}</div></td></tr>
</table></td></tr></table>
</body></html>`;

    return {
        subject,
        preheader,
        html,
        text: plainText({ title, subject, preheader, content }),
        content,
        layout,
        images
    };
}

module.exports = {
    LAYOUT_CATALOG,
    LAYOUT_IDS,
    escapeHtml,
    cleanText,
    safeHttpUrl,
    catalogueItem,
    layoutVisualSlots,
    normaliseContent,
    normaliseImageSources,
    visualAlt,
    plainText,
    renderAwarenessEmail
};
