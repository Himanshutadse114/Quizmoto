'use strict';

const crypto = require('crypto');
const logger = require('../../utils/logger');
const ScormAwarenessEmailTemplate = require('../../models/scorm/ScormAwarenessEmailTemplate');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const MailService = require('../mail/MailService');
const AwarenessMailDeliveryService = require('./AwarenessMailDeliveryService');
const {
    getApiKey,
    createStructuredResponse,
    generateImage
} = require('../openai/OpenAiClient');
const {
    LAYOUT_CATALOG,
    LAYOUT_IDS,
    cleanText,
    normaliseContent,
    renderAwarenessEmail,
    layoutVisualSlots
} = require('./AwarenessEmailRenderer');

const MAX_RECIPIENTS_PER_SEND = 50;
const HERO_CID = 'awareness-hero@lmsgen';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLOT_RE = /^[a-z0-9-]{1,40}$/i;

function parseJson(value, fallback = {}) {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch (_) {
        return fallback;
    }
}

function clampInt(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function maxAiImages() {
    return clampInt(process.env.AWARENESS_MAX_AI_IMAGES, 5, 1, 5);
}

function imageConcurrency() {
    return clampInt(process.env.AWARENESS_IMAGE_CONCURRENCY, 2, 1, 3);
}

function awarenessAssetBaseUrl() {
    return String(
        process.env.AWARENESS_ASSET_BASE_URL ||
        process.env.PUBLIC_API_URL ||
        process.env.RENDER_EXTERNAL_URL ||
        MailService.appBaseUrl()
    ).trim().replace(/\/$/, '');
}

function publicAssetUrl(token, slot = 'hero') {
    if (!token) return '';
    const root = `${awarenessAssetBaseUrl()}/api/scorm/awareness-assets/${encodeURIComponent(token)}`;
    return slot === 'hero' ? root : `${root}/${encodeURIComponent(slot)}`;
}

function cidForSlot(slot = 'hero') {
    const safe = String(slot || 'hero').toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 40) || 'visual';
    return safe === 'hero' ? HERO_CID : `awareness-${safe}@lmsgen`;
}

function extensionForContentType(contentType = '') {
    const type = String(contentType || '').toLowerCase();
    if (type.includes('png')) return 'png';
    if (type.includes('webp')) return 'webp';
    if (type.includes('gif')) return 'gif';
    return 'jpg';
}

function normaliseVisualAsset(asset) {
    if (!asset || typeof asset !== 'object') return null;
    const slot = String(asset.slot || '').trim().toLowerCase();
    const storageKey = String(asset.storageKey || '').trim();
    const contentType = String(asset.contentType || 'image/jpeg').trim() || 'image/jpeg';
    if (!SLOT_RE.test(slot) || !storageKey) return null;
    return {
        slot,
        storageKey,
        contentType,
        model: cleanText(asset.model, 120) || null,
        estimatedCostUsd: Math.max(0, Number(asset.estimatedCostUsd) || 0)
    };
}

function visualAssetRecords(row, aiInput = null) {
    if (!row) return [];
    const ai = aiInput || parseJson(row.aiMetadataJson, {});
    const records = [];
    const seenSlots = new Set();

    for (const raw of Array.isArray(ai.visualAssets) ? ai.visualAssets : []) {
        const asset = normaliseVisualAsset(raw);
        if (!asset || seenSlots.has(asset.slot)) continue;
        records.push(asset);
        seenSlots.add(asset.slot);
    }

    if (row.heroStorageKey && !seenSlots.has('hero')) {
        records.unshift({
            slot: 'hero',
            storageKey: row.heroStorageKey,
            contentType: row.heroContentType || 'image/jpeg',
            model: ai.imageModel || null,
            estimatedCostUsd: 0
        });
    }
    return records;
}

function serializeTemplate(row) {
    if (!row) return null;
    const plain = typeof row.toJSON === 'function' ? row.toJSON() : row;
    const content = normaliseContent(parseJson(plain.contentJson, {}));
    const ai = parseJson(plain.aiMetadataJson, {});
    const assets = visualAssetRecords(plain, ai);
    const visualUrls = plain.publicAssetToken
        ? assets.map((asset) => ({
            slot: asset.slot,
            url: publicAssetUrl(plain.publicAssetToken, asset.slot)
        }))
        : [];
    const hero = visualUrls.find((asset) => asset.slot === 'hero') || visualUrls[0] || null;

    return {
        id: plain.id,
        title: plain.title,
        topic: plain.topic,
        audience: plain.audience || '',
        goal: plain.goal || '',
        tone: plain.tone || 'clear',
        layoutId: plain.layoutId,
        subject: plain.subject,
        preheader: plain.preheader || '',
        content,
        heroAltText: plain.heroAltText || '',
        imageAvailable: assets.length > 0,
        imageUrl: hero?.url || '',
        imageStatus: ai.imageStatus || (assets.length ? 'ready' : 'unavailable'),
        visualCount: assets.length,
        visuals: visualUrls,
        ai: {
            textModel: ai.textModel || null,
            imageModel: ai.imageModel || null,
            estimatedCostUsd: Number(ai.estimatedCostUsd || 0)
        },
        status: plain.status || 'ready',
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt
    };
}

function validLayout(layoutId) {
    return LAYOUT_IDS.has(String(layoutId || '').trim());
}

function chooseFallbackLayout(topic = '') {
    const source = String(topic || 'awareness');
    let hash = 0;
    for (let i = 0; i < source.length; i += 1) hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
    return LAYOUT_CATALOG[Math.abs(hash) % LAYOUT_CATALOG.length].id;
}

function requiredText(value, label, max) {
    const text = cleanText(value, max);
    if (!text) {
        const error = new Error(`${label} is required.`);
        error.code = 'AWARENESS_INPUT_REQUIRED';
        error.status = 400;
        throw error;
    }
    return text;
}

function generationSchema() {
    return {
        type: 'object',
        properties: {
            title: { type: 'string', maxLength: 180 },
            subject: { type: 'string', maxLength: 180 },
            preheader: { type: 'string', maxLength: 200 },
            headline: { type: 'string', maxLength: 180 },
            intro: { type: 'string', maxLength: 520 },
            bodyParagraphs: {
                type: 'array',
                minItems: 1,
                maxItems: 3,
                items: { type: 'string', maxLength: 800 }
            },
            keyPoints: {
                type: 'array',
                minItems: 3,
                maxItems: 5,
                items: {
                    type: 'object',
                    properties: {
                        title: { type: 'string', maxLength: 100 },
                        body: { type: 'string', maxLength: 360 }
                    },
                    required: ['title', 'body']
                }
            },
            ctaLabel: { type: 'string', maxLength: 60 },
            footerNote: { type: 'string', maxLength: 280 },
            heroAltText: { type: 'string', maxLength: 220 },
            heroVisualHeadline: { type: 'string', maxLength: 70 },
            bannerVisualHeadline: { type: 'string', maxLength: 80 },
            imagePrompt: { type: 'string', maxLength: 900 },
            layoutId: { type: 'string', enum: LAYOUT_CATALOG.map((item) => item.id) }
        },
        required: [
            'title',
            'subject',
            'preheader',
            'headline',
            'intro',
            'bodyParagraphs',
            'keyPoints',
            'ctaLabel',
            'footerNote',
            'heroAltText',
            'heroVisualHeadline',
            'bannerVisualHeadline',
            'imagePrompt',
            'layoutId'
        ]
    };
}

function generationInstructions() {
    const layouts = LAYOUT_CATALOG.map((layout) => `${layout.id}: ${layout.name} — ${layout.description}`).join('\n');
    return `You create professional employee-awareness email copy for a learning platform.

Return educational content only. Do not imitate a real person or brand, request passwords, codes or credentials, or create a deceptive phishing lure. Avoid fearmongering and unsupported claims. Use clear international English.

The eight layouts below deliberately mirror eight supplied awareness-email references. Choose the layout that best matches the topic unless the input requests one explicitly.
${layouts}

CONTENT SHAPE MUST MATCH THE SELECTED REFERENCE FAMILY:
- editorial-hero / Data Privacy Newsletter: first two key points are practical daily behaviours suitable for two feature cards. Remaining points are supporting privacy practices. Body copy explains why privacy is everyone's responsibility.
- split-feature / Mobile App Threat Brief: use four distinct mobile threats or warning signs. The field-test section should help the reader spot a suspicious app or mobile prompt. Body copy is a short lock-it-down action list.
- checklist-focus / Internet Security Best Practices: use four distinct everyday habits suitable for a 2×2 illustrated grid. Body copy includes a memorable golden rule and make-it-stick actions.
- signal-card / Social Media Threat Brief: first three key points explain how exposure or social-media scams get in. Remaining points are before-you-post checks. Body copy supports a case-file style explanation.
- story-spotlight / Ransomware Attack Story: first three key points are sequential attack stages. Each stage must describe what happens and what the employee should do. Remaining points are closing rules.
- myth-fact / Social Engineering Playbook: first three key points are distinct social-engineering tactics. Remaining points are red flags. Body copy supplies a short quote/callout and a three-second verification rule.
- action-brief / Modern Threats Dossier: first three key points are distinct modern phishing scenarios or disguises. Remaining points are response rules. Keep scenario headings short and punchy.
- minimal-note / AI Scams & Deepfakes: first three key points are distinct AI-enabled scam scenarios such as cloned voice, live deepfake or synthetic message. Remaining points are verification rules.

Write three to five practical key points. Make them visually and conceptually different from one another.

Also return:
- heroVisualHeadline: a punchy 2–6 word phrase for a reference-style hero graphic. Do not copy a supplied reference phrase verbatim.
- bannerVisualHeadline: a punchy 3–7 word phrase for a secondary reference-style banner. Do not copy a supplied reference phrase verbatim.
- imagePrompt: a concrete topic-specific visual idea for the main image.

The CTA label should describe a safe learning action such as Learn more, Review the guidance or Read the policy. Do not invent a URL.`;
}

async function generateCopy(input) {
    if (!getApiKey()) {
        const error = new Error('OPENAI_API_KEY is not configured on the server.');
        error.code = 'OPENAI_KEY_MISSING';
        error.status = 503;
        throw error;
    }

    const response = await createStructuredResponse({
        instructions: generationInstructions(),
        input: JSON.stringify(input),
        schema: generationSchema(),
        schemaName: 'awareness_email_content',
        maxOutputTokens: 5000,
        timeoutMs: 90000,
        metadata: { feature: 'awareness_email_studio' }
    });

    let parsed;
    try {
        parsed = JSON.parse(response.text);
    } catch (_) {
        const error = new Error('AI returned an invalid awareness email structure. Please retry.');
        error.code = 'AWARENESS_AI_INVALID_JSON';
        error.status = 502;
        throw error;
    }
    return { parsed, response };
}

const LAYOUT_VISUAL_DIRECTIONS = Object.freeze({
    'editorial-hero': [
        'REFERENCE VISUAL DNA: warm brown/sepia monochrome editorial photography, like a premium corporate magazine photographed in natural indoor light.',
        'Hero: a real workplace group or privacy-related work scene with one large bold condensed uppercase headline integrated into the left or lower-left of the graphic.',
        'Supporting card art: documentary close-ups of a person or hands carrying out a privacy behaviour, with rich brown shadows and almost no bright colour.',
        'Avoid futuristic cyber graphics, neon blue, floating UI and generic lock/shield stock art.'
    ],
    'split-feature': [
        'REFERENCE VISUAL DNA: matte black, white and acid-lime field-briefing graphic design with bold condensed typography and simple device/app visuals.',
        'Use hard contrast, flat or lightly 3D infographic objects, black panels, lime highlights and sparse white space.',
        'The field-test visual should resemble a clean lineup/comparison graphic using generic app icons or mobile cues, never copied brand logos.',
        'Avoid photorealistic office photography and avoid neon cyberpunk lighting.'
    ],
    'checklist-focus': [
        'REFERENCE VISUAL DNA: cream/off-white studio background with clean 3D clay-like icons in dark charcoal and muted forest green.',
        'Hero: a simple protective object floating above a minimal laptop/device surface with soft bokeh and soft natural shadows.',
        'Supporting habit art: one isolated centred object per card, oversized and easy to read at a glance, such as router waves, lock/key, circular update arrows or pointer/button.',
        'No people, no text, no busy environment and no glossy neon effects.'
    ],
    'signal-card': [
        'REFERENCE VISUAL DNA: black, off-white and red editorial field-report style mixing bold typography with ink-like line art, profile cards and annotation graphics.',
        'Hero should feel like a printed investigative poster: strong black type block plus an energetic red/black collage of social/profile elements.',
        'Case-file art should be a dark schematic profile-card investigation with red callout lines and visual warning markers. Keep any tiny labels minimal.',
        'Use a screenprint/halftone editorial feel rather than glossy 3D rendering.'
    ],
    'story-spotlight': [
        'REFERENCE VISUAL DNA: deep navy cybersecurity illustration with luminous red/orange accents, clean vector/3D hybrid icons and subtle dotted tech texture.',
        'Hero and closing banner use dark navy backgrounds with angular red/blue ribbons, bold white condensed uppercase typography and one simple lock/security motif.',
        'Attack-stage art uses a single central illustrated object or system per image, with red neon edges and dark blue negative space.',
        'Do not use photorealistic people; keep it stylised, graphic and campaign-like.'
    ],
    'myth-fact': [
        'REFERENCE VISUAL DNA: deep purple/indigo campaign graphics with mustard orange, red and cream accents, diagonal stripe texture and target/radar motifs.',
        'Hero and closing banner use bold condensed uppercase typography in capsule/ribbon shapes over a dark purple field.',
        'Tactic-card art uses clean editorial vector illustration: silhouetted or simplified people, phishing-hook objects, doors/access scenes and targeted identity motifs.',
        'Keep it human and illustrative, not photorealistic and not futuristic.'
    ],
    'action-brief': [
        'REFERENCE VISUAL DNA: retro editorial threat banners on cream paper with dark navy, bright red and medium blue angular ribbons, halftone dots and hand-drawn accent lines.',
        'Each visual is primarily a typographic poster/banner with one small supporting flat icon on the side.',
        'Use very bold condensed uppercase white lettering and skewed geometric colour blocks. Preserve generous cream negative space.',
        'Do not use photorealistic scenes, glossy 3D security objects or generic network imagery.'
    ],
    'minimal-note': [
        'REFERENCE VISUAL DNA: the same retro campaign-poster language as the AI/deepfake references: cream paper, dark navy base, bright red/blue ribbons, halftone texture, doodle arrows and a small identity/voice/phone icon.',
        'Hero and supporting banners are bold typographic graphics with short readable slogans and intentionally varied ribbon composition from panel to panel.',
        'Use flat editorial illustration and collage details rather than photorealistic faces, robots, holograms or glowing AI brains.',
        'Every panel in the same email should vary the direction, scale and placement of its coloured ribbons and icon.'
    ]
});

const SLOT_VISUAL_DIRECTIONS = Object.freeze({
    hero: [
        'WIDE ESTABLISHING IMAGE: show the overall situation or theme, not a close-up.',
        'Use an asymmetrical 28–35mm environmental composition with layered foreground, midground and background.',
        'Keep the main subject off-centre and leave clean negative space for the email layout.'
    ],
    'point-1': [
        'DETAIL IMAGE: use a close or macro viewpoint focused on one concrete object, hand action or warning cue.',
        'Use a 50–85mm perspective, shallow depth of field and tight crop.',
        'Do not repeat the hero composition, location or subject scale.'
    ],
    'point-2': [
        'ACTION IMAGE: show a medium-distance real-world action from a side, over-shoulder or three-quarter viewpoint.',
        'Use a 35–50mm perspective with a visibly different background and spatial arrangement from the other images.',
        'Capture a moment of decision or behaviour rather than a posed portrait.'
    ],
    'point-3': [
        'TOP-DOWN / GRAPHIC IMAGE: use an overhead, bird’s-eye or carefully arranged still-life composition.',
        'Build the idea from relevant physical objects, contrasting items or spatial relationships.',
        'Prefer no visible face so this image is clearly different from people-led scenes.'
    ],
    'point-4': [
        'CONCEPTUAL DETAIL IMAGE: use a clean studio, architectural or environmental metaphor grounded in real objects.',
        'Use a low angle, long-lens compression or unusual crop that has not appeared in the previous slots.',
        'Avoid repeating the same device, person, desk or room.'
    ],
    'case-study': [
        'CASE-FILE IMAGE: create a forensic evidence tableau or investigative scene containing several distinct visual clues.',
        'Use a top-down or oblique documentary composition with multiple relevant objects and no written annotations.',
        'It should invite visual inspection and feel different from a normal hero image.'
    ],
    banner: [
        'PANORAMIC BANNER IMAGE: make a minimal, wide visual transition or closing metaphor.',
        'Use strong horizontal rhythm, generous negative space and fewer objects than the other images.',
        'Do not reuse the hero subject; create a new visual metaphor for the final lesson.'
    ]
});

function layoutDirection(layoutId) {
    const layout = LAYOUT_CATALOG.find((item) => item.id === layoutId);
    const rules = LAYOUT_VISUAL_DIRECTIONS[layoutId] || [];
    if (!layout) return rules.join(' ');
    return [`Design language: ${layout.name}. ${layout.description}`, ...rules].join(' ');
}

function visualSubjectForSlot(slot, content, ai) {
    if (slot === 'hero') return cleanText(ai.imagePrompt, 900);
    const pointMatch = String(slot).match(/^point-(\d+)$/);
    if (pointMatch) {
        const point = content.keyPoints[Math.max(0, Number(pointMatch[1]) - 1)];
        if (point) return `Illustrate this exact learning point with a concrete scene: ${point.title}. ${point.body}`;
    }
    if (slot === 'case-study') {
        const focus = content.keyPoints.slice(0, 3).map((point) => `${point.title}: ${point.body}`).join(' ');
        return `Build a visual case study around the warning signs in this topic. Use these ideas as distinct visual clues: ${focus}`;
    }
    if (slot === 'banner') {
        return `Create a closing visual metaphor for this safety lesson: ${content.footerNote || content.headline}.`;
    }
    return `Create a supporting editorial awareness image for: ${content.headline}.`;
}

function slotDirection(slot) {
    return (SLOT_VISUAL_DIRECTIONS[slot] || [
        'Use a clearly different composition, subject scale and viewpoint from every other image in the email.'
    ]).join(' ');
}

function trimVisualPhrase(value, fallback = '') {
    const words = cleanText(value || fallback, 100).replace(/\s+/g, ' ').split(' ').filter(Boolean);
    return words.slice(0, 8).join(' ');
}

function visualTextForSlot({ slot, layoutId, ai, content, input }) {
    if (layoutId === 'action-brief' || layoutId === 'minimal-note') {
        const pointMatch = String(slot).match(/^point-(\d+)$/);
        if (pointMatch) {
            const point = content.keyPoints[Math.max(0, Number(pointMatch[1]) - 1)];
            return trimVisualPhrase(point?.title, input.topic);
        }
        return slot === 'banner'
            ? trimVisualPhrase(ai.bannerVisualHeadline, content.footerNote || input.topic)
            : trimVisualPhrase(ai.heroVisualHeadline, content.headline || input.topic);
    }
    if (['editorial-hero', 'split-feature', 'signal-card', 'story-spotlight', 'myth-fact'].includes(layoutId)) {
        if (slot === 'hero') return trimVisualPhrase(ai.heroVisualHeadline, content.headline || input.topic);
        if (slot === 'banner') return trimVisualPhrase(ai.bannerVisualHeadline, content.footerNote || input.topic);
    }
    return '';
}

function visualSizeForSlot(layoutId, slot) {
    if (
        /^point-\d+$/.test(String(slot)) &&
        ['editorial-hero', 'checklist-focus', 'story-spotlight', 'myth-fact'].includes(layoutId)
    ) return '1024x1024';
    return '1536x864';
}

function imagePromptForSlot({ slot, ai, input, content, layoutId }) {
    const requestedSlots = layoutVisualSlots(layoutId);
    const slotIndex = Math.max(0, requestedSlots.indexOf(slot));
    const visualText = visualTextForSlot({ slot, layoutId, ai, content, input });
    const textInstruction = visualText
        ? `TYPOGRAPHY IS PART OF THE REFERENCE LOOK. Render this exact short phrase clearly and legibly as the dominant campaign headline: "${visualText}". Do not add any other readable wording.`
        : 'Do not render readable wording in this supporting illustration.';

    return [
        `IMAGE ROLE ${slotIndex + 1} OF ${requestedSlots.length}: ${String(slot).toUpperCase()}.`,
        visualSubjectForSlot(slot, content, ai),
        `Employee awareness topic: ${cleanText(input.topic, 220)}.`,
        `Audience: ${cleanText(input.audience || 'employees', 160)}.`,
        layoutDirection(layoutId),
        slotDirection(slot),
        textInstruction,
        'MATCH THE REFERENCE CAMPAIGN FAMILY, not a generic cybersecurity stock image. Follow its palette, illustration/photo treatment, graphic density, typography hierarchy and composition language.',
        'VARIETY REQUIREMENT: this image must be obviously different from the other images in the same email at thumbnail size. Change viewpoint, object scale, arrangement, icon subject and ribbon/layout direction.',
        'Use concrete topic-specific objects and scenarios. Avoid defaulting to a laptop, shield, padlock or anonymous office worker unless the reference family and exact learning point call for it.',
        'Never use a hooded hacker, blue neon network, holographic dashboard, glowing AI brain, random binary code or generic futuristic cyber background.',
        'No logos, watermarks, trademarked brand marks or copyrighted characters.',
        'Keep critical art inside the safe crop area for email.'
    ].filter(Boolean).join(' ');
}

async function runWithConcurrency(items, concurrency, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, async () => {
        while (true) {
            const index = cursor;
            cursor += 1;
            if (index >= items.length) return;
            results[index] = await worker(items[index], index);
        }
    }));
    return results;
}

async function generateVisualAssets({ storage, hostId, templateId, layoutId, ai, input, content }) {
    const requestedSlots = layoutVisualSlots(layoutId).slice(0, maxAiImages());
    const warnings = [];

    const results = await runWithConcurrency(requestedSlots, imageConcurrency(), async (slot) => {
        try {
            const image = await generateImage({
                prompt: imagePromptForSlot({ slot, ai, input, content, layoutId }),
                quality: 'low',
                size: visualSizeForSlot(layoutId, slot),
                timeoutMs: 85000
            });
            const contentType = image.contentType || 'image/jpeg';
            const ext = extensionForContentType(contentType);
            const storageKey = `awareness/${hostId}/${templateId}/${slot}.${ext}`;
            await storage.putObject({
                key: storageKey,
                body: image.body,
                contentType
            });
            return {
                slot,
                storageKey,
                contentType,
                model: image.model || null,
                estimatedCostUsd: Number(image.estimatedCostUsd || 0)
            };
        } catch (error) {
            warnings.push({ slot, code: error.code || null, message: error.message });
            logger.warn('awareness_email_visual_generation_failed', {
                module: 'awareness-email',
                hostId,
                templateId,
                slot,
                code: error.code || null,
                error: error.message
            });
            return null;
        }
    });

    const visualAssets = results.filter(Boolean);
    const imageCostUsd = visualAssets.reduce((sum, asset) => sum + Number(asset.estimatedCostUsd || 0), 0);
    const imageModel = visualAssets.find((asset) => asset.model)?.model || null;
    const imageStatus = visualAssets.length === requestedSlots.length
        ? 'ready'
        : visualAssets.length
            ? 'partial'
            : 'unavailable';

    return { requestedSlots, visualAssets, warnings, imageCostUsd, imageModel, imageStatus };
}

async function createTemplate({ hostId, createdByUserId = null, input = {} }) {
    if (!hostId) {
        const error = new Error('Tenant context is required.');
        error.code = 'AWARENESS_TENANT_REQUIRED';
        error.status = 403;
        throw error;
    }

    const topic = requiredText(input.topic, 'Topic', 220);
    const audience = cleanText(input.audience || 'Employees', 160);
    const goal = cleanText(input.goal || 'Help the audience understand the topic and take the right action.', 360);
    const tone = cleanText(input.tone || 'clear', 60).toLowerCase();
    const requestedLayout = validLayout(input.layoutId) ? String(input.layoutId) : 'auto';
    const ctaUrl = cleanText(input.ctaUrl, 1200);
    const generationInput = {
        topic,
        audience,
        goal,
        tone,
        requestedLayout,
        organisationContext: cleanText(input.organisationContext, 500),
        language: cleanText(input.language || 'English', 50)
    };

    const { parsed: ai, response } = await generateCopy(generationInput);
    const layoutId = requestedLayout !== 'auto'
        ? requestedLayout
        : validLayout(ai.layoutId)
            ? ai.layoutId
            : chooseFallbackLayout(topic);

    const content = normaliseContent({
        headline: ai.headline,
        intro: ai.intro,
        bodyParagraphs: ai.bodyParagraphs,
        keyPoints: ai.keyPoints,
        ctaLabel: ai.ctaLabel,
        ctaUrl,
        footerNote: ai.footerNote
    });

    const templateId = crypto.randomUUID();
    const assetToken = crypto.randomBytes(32).toString('hex');
    const storage = getObjectStorage();
    const visuals = await generateVisualAssets({
        storage,
        hostId,
        templateId,
        layoutId,
        ai,
        input: generationInput,
        content
    });
    const hero = visuals.visualAssets.find((asset) => asset.slot === 'hero') || null;

    let row;
    try {
        row = await ScormAwarenessEmailTemplate.create({
            id: templateId,
            hostId,
            createdByUserId,
            title: requiredText(ai.title || topic, 'Title', 180),
            topic,
            audience,
            goal,
            tone,
            layoutId,
            subject: requiredText(ai.subject || topic, 'Subject', 240),
            preheader: cleanText(ai.preheader, 240),
            contentJson: JSON.stringify(content),
            heroStorageKey: hero?.storageKey || null,
            heroContentType: hero?.contentType || null,
            heroAltText: cleanText(ai.heroAltText || `${topic} awareness visual`, 320),
            publicAssetToken: visuals.visualAssets.length ? assetToken : null,
            aiMetadataJson: JSON.stringify({
                textModel: response.model || null,
                imageModel: visuals.imageModel,
                textResponseId: response.responseId || null,
                heroVisualHeadline: cleanText(ai.heroVisualHeadline, 70),
                bannerVisualHeadline: cleanText(ai.bannerVisualHeadline, 80),
                estimatedCostUsd: Number(response.estimatedCostUsd || 0) + visuals.imageCostUsd,
                imageStatus: visuals.imageStatus,
                imageWarnings: visuals.warnings,
                requestedVisualSlots: visuals.requestedSlots,
                visualAssets: visuals.visualAssets
            }),
            status: 'ready'
        });
    } catch (error) {
        await Promise.all(visuals.visualAssets.map((asset) =>
            storage.deleteObject(asset.storageKey).catch(() => {})
        ));
        throw error;
    }

    return serializeTemplate(row);
}

async function listTemplates(hostId) {
    const rows = await ScormAwarenessEmailTemplate.findAll({
        where: { hostId },
        order: [['updatedAt', 'DESC']],
        limit: 100
    });
    return rows.map(serializeTemplate);
}

async function findOwnedTemplate(id, hostId) {
    const row = await ScormAwarenessEmailTemplate.findOne({ where: { id, hostId } });
    if (!row) {
        const error = new Error('Awareness email template not found.');
        error.code = 'AWARENESS_TEMPLATE_NOT_FOUND';
        error.status = 404;
        throw error;
    }
    return row;
}

async function getTemplate(id, hostId) {
    return serializeTemplate(await findOwnedTemplate(id, hostId));
}

async function updateTemplate(id, hostId, patch = {}) {
    const row = await findOwnedTemplate(id, hostId);
    const current = normaliseContent(parseJson(row.contentJson, {}));
    const requestedContent = patch.content && typeof patch.content === 'object' ? patch.content : {};
    const content = normaliseContent({ ...current, ...requestedContent });

    if (Object.prototype.hasOwnProperty.call(patch, 'title')) row.title = requiredText(patch.title, 'Title', 180);
    if (Object.prototype.hasOwnProperty.call(patch, 'subject')) row.subject = requiredText(patch.subject, 'Subject', 240);
    if (Object.prototype.hasOwnProperty.call(patch, 'preheader')) row.preheader = cleanText(patch.preheader, 240);
    if (Object.prototype.hasOwnProperty.call(patch, 'heroAltText')) row.heroAltText = cleanText(patch.heroAltText, 320);
    row.contentJson = JSON.stringify(content);
    await row.save();
    return serializeTemplate(row);
}

async function deleteTemplate(id, hostId) {
    const row = await findOwnedTemplate(id, hostId);
    const storage = getObjectStorage();
    const keys = [...new Set(visualAssetRecords(row).map((asset) => asset.storageKey).filter(Boolean))];
    for (const key of keys) {
        try {
            await storage.deleteObject(key);
        } catch (error) {
            logger.warn('awareness_email_asset_delete_failed', {
                module: 'awareness-email',
                key,
                error: error.message
            });
        }
    }
    await row.destroy();
    return true;
}

function imageSourcesForRow(row, mode = 'public') {
    const sources = {};
    for (const asset of visualAssetRecords(row)) {
        sources[asset.slot] = mode === 'cid'
            ? `cid:${cidForSlot(asset.slot)}`
            : publicAssetUrl(row.publicAssetToken, asset.slot);
    }
    return sources;
}

function renderRow(row, mode = 'public') {
    const content = normaliseContent(parseJson(row.contentJson, {}));
    return renderAwarenessEmail({
        title: row.title,
        topic: row.topic,
        layoutId: row.layoutId,
        subject: row.subject,
        preheader: row.preheader,
        heroAltText: row.heroAltText,
        content
    }, { imageSources: imageSourcesForRow(row, mode) });
}

async function renderPreview(id, hostId) {
    return renderRow(await findOwnedTemplate(id, hostId), 'public');
}

async function visualAttachments(row) {
    const storage = getObjectStorage();
    const assets = visualAssetRecords(row);
    const attachments = [];
    for (const asset of assets) {
        try {
            const body = await storage.getObjectBuffer(asset.storageKey);
            attachments.push({
                filename: `awareness-${asset.slot}.${extensionForContentType(asset.contentType)}`,
                content: body,
                contentType: asset.contentType || 'image/jpeg',
                cid: cidForSlot(asset.slot),
                contentDisposition: 'inline'
            });
        } catch (error) {
            logger.warn('awareness_email_attachment_read_failed', {
                module: 'awareness-email',
                templateId: row.id,
                slot: asset.slot,
                error: error.message
            });
        }
    }
    return attachments;
}

function normaliseRecipients(value) {
    const raw = Array.isArray(value) ? value : String(value || '').split(/[\s,;]+/g);
    const unique = [...new Set(raw.map((item) => String(item || '').trim().toLowerCase()).filter((email) => EMAIL_RE.test(email)))];

    if (!unique.length) {
        const error = new Error('Add at least one valid recipient email address.');
        error.code = 'AWARENESS_RECIPIENT_REQUIRED';
        error.status = 400;
        throw error;
    }
    if (unique.length > MAX_RECIPIENTS_PER_SEND) {
        const error = new Error(`A maximum of ${MAX_RECIPIENTS_PER_SEND} recipients can be sent in one request.`);
        error.code = 'AWARENESS_RECIPIENT_LIMIT';
        error.status = 400;
        throw error;
    }
    return unique;
}

async function sendTemplate(id, hostId, recipientsInput) {
    if (!MailService.isConfigured()) {
        const error = new Error('Outbound email is not configured for this platform.');
        error.code = 'MAIL_NOT_CONFIGURED';
        error.status = 503;
        throw error;
    }

    const row = await findOwnedTemplate(id, hostId);
    const recipients = normaliseRecipients(recipientsInput);
    const smtp = MailService.mailProvider() === 'smtp';
    const rendered = renderRow(row, smtp ? 'cid' : 'public');
    const attachments = smtp ? await visualAttachments(row) : [];

    const results = await runWithConcurrency(recipients, 3, async (email) => {
        try {
            const result = await AwarenessMailDeliveryService.sendContent({
                to: email,
                subject: rendered.subject,
                html: rendered.html,
                text: rendered.text,
                attachments,
                headers: { 'X-LMSGEN-Content-Type': 'awareness-template' }
            });
            return { email, sent: Boolean(result.sent), messageId: result.messageId || null };
        } catch (error) {
            logger.error('awareness_email_send_failed', {
                module: 'awareness-email',
                hostId,
                templateId: id,
                code: error.code || null,
                error: error.message
            });
            return { email, sent: false, reason: error.code || 'MAIL_SEND_FAILED' };
        }
    });

    return {
        requested: recipients.length,
        sent: results.filter((item) => item.sent).length,
        failed: results.filter((item) => !item.sent).length,
        results
    };
}

async function exportEml(id, hostId, recipient = '') {
    const row = await findOwnedTemplate(id, hostId);
    const rendered = renderRow(row, 'cid');
    const attachments = await visualAttachments(row);
    const message = await AwarenessMailDeliveryService.createEml({
        to: recipient ? [recipient] : [],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        attachments,
        headers: { 'X-LMSGEN-Content-Type': 'awareness-template' }
    });
    return { message, title: row.title };
}

async function getPublicAsset(token, slot = 'hero') {
    const safeToken = String(token || '').trim();
    const safeSlot = String(slot || 'hero').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/i.test(safeToken) || !SLOT_RE.test(safeSlot)) {
        const error = new Error('Awareness image not found.');
        error.code = 'AWARENESS_ASSET_NOT_FOUND';
        error.status = 404;
        throw error;
    }

    const row = await ScormAwarenessEmailTemplate.findOne({ where: { publicAssetToken: safeToken } });
    if (!row) {
        const error = new Error('Awareness image not found.');
        error.code = 'AWARENESS_ASSET_NOT_FOUND';
        error.status = 404;
        throw error;
    }
    const asset = visualAssetRecords(row).find((item) => item.slot === safeSlot);
    if (!asset) {
        const error = new Error('Awareness image not found.');
        error.code = 'AWARENESS_ASSET_NOT_FOUND';
        error.status = 404;
        throw error;
    }

    return {
        body: await getObjectStorage().getObjectBuffer(asset.storageKey),
        contentType: asset.contentType || 'image/jpeg'
    };
}

function catalogue() {
    return LAYOUT_CATALOG.map(({ mode, imageSlots, ...item }) => ({
        ...item,
        visualCount: imageSlots.length
    }));
}

function mailStatus() {
    return {
        configured: MailService.isConfigured(),
        provider: MailService.mailProvider()
    };
}

module.exports = {
    MAX_RECIPIENTS_PER_SEND,
    HERO_CID,
    catalogue,
    mailStatus,
    serializeTemplate,
    createTemplate,
    listTemplates,
    getTemplate,
    updateTemplate,
    deleteTemplate,
    renderPreview,
    sendTemplate,
    exportEml,
    getPublicAsset,
    normaliseRecipients,
    chooseFallbackLayout,
    awarenessAssetBaseUrl,
    publicAssetUrl,
    cidForSlot,
    visualAssetRecords,
    imagePromptForSlot,
    visualSizeForSlot,
    visualTextForSlot,
    maxAiImages
};