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

function publicAssetUrl(token, slot = 'hero') {
    if (!token) return '';
    const root = `${MailService.appBaseUrl()}/api/scorm/awareness-assets/${encodeURIComponent(token)}`;
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
            'imagePrompt',
            'layoutId'
        ]
    };
}

function generationInstructions() {
    const layouts = LAYOUT_CATALOG.map((layout) => `${layout.id}: ${layout.name} — ${layout.description}`).join('\n');
    return `You create professional employee-awareness email copy for a learning platform.

Return concise educational content only. The email must teach a useful behaviour or concept, not imitate a real person or brand, not request passwords, codes or credentials, and not create a deceptive phishing lure. Avoid fearmongering and unsupported claims. Use clear international English. The user will edit only text after generation, so each field must be complete and ready to publish.

Choose the layout that best matches the topic unless the input explicitly requests one of the layout IDs below.
${layouts}

Write three to five practical key points. For attack or threat topics, make the points distinct scenarios, stages, tactics or red flags. For best-practice topics, make them distinct habits or actions.

The imagePrompt must describe a premium, topic-specific editorial illustration or realistic conceptual scene. It must contain no written words, letters, numbers, logos, watermarks, UI screenshots or trademarked branding. Do not put important explanatory text inside the image.

Keep the subject useful rather than clickbait. Make key points practical and non-repetitive. The CTA label should describe a safe learning action such as Learn more, Review the guidance or Read the policy. Do not invent a URL.`;
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

function layoutDirection(layoutId) {
    const layout = LAYOUT_CATALOG.find((item) => item.id === layoutId);
    if (!layout) return '';
    return `Design language: ${layout.name}. ${layout.description}`;
}

function visualSubjectForSlot(slot, content, ai) {
    if (slot === 'hero') return cleanText(ai.imagePrompt, 900);
    const pointMatch = String(slot).match(/^point-(\d+)$/);
    if (pointMatch) {
        const point = content.keyPoints[Math.max(0, Number(pointMatch[1]) - 1)];
        if (point) return `Illustrate this exact learning point: ${point.title}. ${point.body}`;
    }
    if (slot === 'case-study') {
        const focus = content.keyPoints.slice(0, 3).map((point) => `${point.title}: ${point.body}`).join(' ');
        return `Create one concrete visual case-study scene showing the warning signs in this awareness topic. Focus on: ${focus}`;
    }
    if (slot === 'banner') {
        return `Create a strong supporting banner scene that reinforces the final safety lesson: ${content.footerNote || content.headline}.`;
    }
    return `Create a supporting editorial awareness illustration for: ${content.headline}.`;
}

function imagePromptForSlot({ slot, ai, input, content, layoutId }) {
    const slotRole = slot === 'hero'
        ? 'This is the main opening hero visual.'
        : slot === 'banner'
            ? 'This is a wide supporting transition or closing visual.'
            : slot === 'case-study'
                ? 'This is a concrete visual case study.'
                : 'This is a supporting learning-section illustration.';
    return [
        visualSubjectForSlot(slot, content, ai),
        `Employee awareness topic: ${cleanText(input.topic, 220)}.`,
        `Audience: ${cleanText(input.audience || 'employees', 160)}.`,
        layoutDirection(layoutId),
        slotRole,
        'Premium editorial email artwork with a strong focal point and a professional workplace-learning aesthetic.',
        'Show the concept through objects, environments, actions and visual relationships rather than written labels.',
        'No written words, letters, numbers, logos, watermarks, readable user interfaces, brand marks or trademarked characters.',
        'Landscape composition, clean edges, email-friendly crop and enough negative space around the focal subject.'
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
                size: '1536x864',
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
    publicAssetUrl,
    cidForSlot,
    visualAssetRecords,
    imagePromptForSlot,
    maxAiImages
};
