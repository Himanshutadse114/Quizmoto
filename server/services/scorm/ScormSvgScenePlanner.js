const logger = require('../../utils/logger');
const {
    getApiKey,
    modelCandidates,
    thinkingLevel
} = require('./PolicyAnalysisService');

const SCENES = [
    'browser-phishing',
    'email-threat',
    'smartphone-scam',
    'malicious-app',
    'password-mfa',
    'ransomware-file',
    'cloud-data',
    'qr-phishing',
    'deepfake',
    'identity-takeover',
    'social-engineering',
    'network-attack',
    'data-leak',
    'process-diagram',
    'statistics',
    'abstract-security'
];

const COMPOSITIONS = [
    'editorial-right',
    'editorial-left',
    'center-stage',
    'wide-scene',
    'full-bleed'
];

const OBJECTS = [
    'browser', 'email', 'phone', 'lock', 'warning', 'qr', 'file', 'cloud',
    'user', 'attacker', 'shield', 'waveform', 'server', 'data-stream',
    'password', 'mfa-prompt', 'malware', 'link', 'app-grid', 'document',
    'camera', 'microphone', 'network', 'database'
];

const MOODS = ['editorial', 'investigative', 'urgent', 'calm-secure', 'technical', 'human'];

const SCENE_SCHEMA = {
    type: 'object',
    properties: {
        visuals: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    index: { type: 'integer' },
                    scene: { type: 'string', enum: SCENES },
                    composition: { type: 'string', enum: COMPOSITIONS },
                    focalObject: { type: 'string', enum: OBJECTS },
                    secondaryObjects: {
                        type: 'array',
                        items: { type: 'string', enum: OBJECTS }
                    },
                    mood: { type: 'string', enum: MOODS },
                    visualTitle: { type: 'string' },
                    artDirection: { type: 'string' }
                },
                required: [
                    'index', 'scene', 'composition', 'focalObject',
                    'secondaryObjects', 'mood', 'visualTitle', 'artDirection'
                ]
            }
        }
    },
    required: ['visuals']
};

function clean(value, max = 360) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function uniqueObjects(values, focalObject) {
    const allowed = new Set(OBJECTS);
    const out = [];
    for (const raw of Array.isArray(values) ? values : []) {
        const value = String(raw || '').trim();
        if (!allowed.has(value) || value === focalObject || out.includes(value)) continue;
        out.push(value);
        if (out.length >= 5) break;
    }
    return out;
}

function inferScene(slide = {}) {
    const explicit = clean(slide.visualMetaphor, 60).toLowerCase();
    const layout = String(slide.layout || '').toLowerCase();
    const text = `${clean(slide.title, 180)} ${clean(slide.content, 500)} ${(slide.keyPoints || []).join(' ')}`.toLowerCase();

    // Explicit metaphor wins only when it is specific (not a vague "identity"/"shield").
    if (explicit === 'qr' || /\bqr\b|quick response/.test(text)) return 'qr-phishing';
    if (explicit === 'ai-wave' || /deepfake|voice clone|synthetic voice|audio clone/.test(text)) return 'deepfake';
    if (explicit === 'cloud' || /cloud|drive|sharepoint|storage|shared folder|saas|volume-based/.test(text)) return 'cloud-data';
    if (explicit === 'lock' || /password|credential|mfa|multi-factor|passkey|authentication/.test(text)) return 'password-mfa';
    if (explicit === 'file' || /ransom|encrypt(s|ed)? file|malware payload/.test(text)) return 'ransomware-file';
    if (explicit === 'phone' || /sms|smish|whatsapp|callback|text message/.test(text)) return 'smartphone-scam';
    if (explicit === 'browser' || /website|browser|https|url bar|sign-in page|fake login/.test(text)) return 'browser-phishing';
    if (explicit === 'email' || (/\b(inbox|email client|sender address|suspicious message)\b/.test(text) && !/platform|provider|vendor|solution|template library|reporting|scalability|selection|comparison|matrix|certified/.test(text))) {
        return 'email-threat';
    }

    // Topic intent before generic layout fallbacks (reporting/analytics must not become abstract).
    if (/\b\d+%|percent|statistic|metric|rate|survey|research|analytics|reporting|risk score|scalability|1,?000\+|campaign analytics/.test(text)) {
        return 'statistics';
    }
    if (layout === 'comparison' || layout === 'matrix' || /compar(e|ison)|versus|vs\.|distinction|awareness vs|gap|selection criteria|choosing the right/.test(text)) {
        return 'process-diagram';
    }
    if (['process', 'timeline', 'cycle'].includes(layout) || /workflow|stage|step|sequence|lifecycle/.test(text)) {
        return 'process-diagram';
    }
    if (layout === 'hub' || layout === 'cards' || /provider|platform|vendor|solution|product|certified list|template library|extensive list|ecosystem/.test(text)) {
        return /cloud|saas|volume/.test(text) ? 'cloud-data' : 'abstract-security';
    }

    if (/app store|malicious app|mobile app|permissions/.test(text)) return 'malicious-app';
    if (/account takeover|credential theft|identity theft|stolen account/.test(text)) return 'identity-takeover';
    if (/social engineer|pretext|tailgat|help desk|executive impersonat/.test(text)) return 'social-engineering';
    if (/network|endpoint|firewall|lateral movement|server compromise/.test(text)) return 'network-attack';
    if (/data leak|exfiltrat|sensitive data|data breach|confidential/.test(text)) return 'data-leak';
    if (/\bphish\b|inbox|email|attachment|message sender/.test(text)) return 'email-threat';
    if (/mobile|phone|sms|call/.test(text)) return 'smartphone-scam';
    if (/browser|website|url|domain/.test(text)) return 'browser-phishing';
    if (explicit === 'identity') return 'identity-takeover';
    return 'abstract-security';
}

function sceneDefaults(scene) {
    switch (scene) {
        case 'browser-phishing': return ['browser', 'lock', 'warning', 'link'];
        case 'email-threat': return ['email', 'warning', 'link', 'attacker'];
        case 'smartphone-scam': return ['phone', 'warning', 'link', 'user'];
        case 'malicious-app': return ['phone', 'app-grid', 'warning', 'malware'];
        case 'password-mfa': return ['lock', 'password', 'mfa-prompt', 'attacker'];
        case 'ransomware-file': return ['file', 'malware', 'lock', 'warning'];
        case 'cloud-data': return ['cloud', 'document', 'user', 'shield'];
        case 'qr-phishing': return ['phone', 'qr', 'link', 'warning'];
        case 'deepfake': return ['user', 'camera', 'waveform', 'microphone'];
        case 'identity-takeover': return ['user', 'attacker', 'lock', 'password'];
        case 'social-engineering': return ['user', 'attacker', 'phone', 'warning'];
        case 'network-attack': return ['network', 'server', 'attacker', 'data-stream'];
        case 'data-leak': return ['database', 'document', 'data-stream', 'warning'];
        case 'process-diagram': return ['shield', 'data-stream', 'user', 'server'];
        case 'statistics': return ['shield', 'data-stream', 'document', 'warning'];
        default: return ['shield', 'lock', 'data-stream', 'user'];
    }
}

function fallbackSpec(slide = {}, index = 0) {
    const scene = inferScene(slide);
    const defaults = sceneDefaults(scene);
    const compositionCycle = ['editorial-right', 'editorial-left', 'wide-scene', 'center-stage'];
    const screenType = String(slide.screenType || '').toLowerCase();
    const composition = screenType === 'takeaway'
        ? 'full-bleed'
        : compositionCycle[index % compositionCycle.length];
    const mood = /warning|risk|attack|malware|phish|ransom/i.test(`${slide.title || ''} ${slide.content || ''}`)
        ? 'investigative'
        : 'editorial';

    return {
        index,
        scene,
        composition,
        focalObject: defaults[0],
        secondaryObjects: defaults.slice(1),
        mood,
        visualTitle: clean(slide.visualTitle || slide.title || `Learning visual ${index + 1}`, 80),
        artDirection: 'Premium editorial cybersecurity illustration with layered depth, realistic interface details, a strong focal object and restrained supporting elements.'
    };
}

function normalizeSpec(raw, slide, index) {
    const fallback = fallbackSpec(slide, index);
    const scene = SCENES.includes(raw?.scene) ? raw.scene : fallback.scene;
    const defaults = sceneDefaults(scene);
    const focalObject = OBJECTS.includes(raw?.focalObject) ? raw.focalObject : defaults[0];
    return {
        index,
        scene,
        composition: COMPOSITIONS.includes(raw?.composition) ? raw.composition : fallback.composition,
        focalObject,
        secondaryObjects: uniqueObjects(raw?.secondaryObjects, focalObject).length
            ? uniqueObjects(raw?.secondaryObjects, focalObject)
            : defaults.filter((item) => item !== focalObject).slice(0, 4),
        mood: MOODS.includes(raw?.mood) ? raw.mood : fallback.mood,
        visualTitle: clean(raw?.visualTitle || fallback.visualTitle, 80),
        artDirection: clean(raw?.artDirection || fallback.artDirection, 320)
    };
}

function plannerModels() {
    const preferred = clean(process.env.SCORM_SMART_SVG_MODEL, 80);
    const base = modelCandidates();
    return preferred ? [preferred, ...base.filter((model) => model !== preferred)] : base;
}

function generationConfig(model) {
    const config = {
        responseMimeType: 'application/json',
        responseJsonSchema: SCENE_SCHEMA,
        maxOutputTokens: 12288,
        temperature: 0.55
    };
    if (/^gemini-3(?:\.|-|$)/i.test(String(model || ''))) {
        config.thinkingConfig = { thinkingLevel: thinkingLevel() };
    }
    return config;
}

function responseText(data) {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map((part) => typeof part?.text === 'string' ? part.text : '').join('').trim();
}

function parseJson(text) {
    const source = String(text || '').trim();
    if (!source) return null;
    const candidates = [
        source,
        source.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    ];
    const firstBrace = source.indexOf('{');
    const lastBrace = source.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(source.slice(firstBrace, lastBrace + 1));
    for (const candidate of candidates) {
        try { return JSON.parse(candidate); } catch (_) {}
    }
    return null;
}

function plannerPrompt(analysis) {
    const slides = (analysis?.slides || []).map((slide, index) => ({
        index,
        title: clean(slide.title, 160),
        content: clean(slide.content || slide.introText, 520),
        keyPoints: (Array.isArray(slide.keyPoints) ? slide.keyPoints : []).slice(0, 6).map((item) => clean(item, 100)),
        layout: clean(slide.layout, 40),
        screenType: clean(slide.screenType, 40),
        visualMetaphor: clean(slide.visualMetaphor, 60),
        visualTitle: clean(slide.visualTitle, 100)
    }));

    return `You are the visual art director for SCORM AI. Design one premium SVG illustration direction for every learning slide below.

The final artwork will be rendered by our own safe vector engine. Do NOT write SVG markup. Return only the requested structured JSON.

CRITICAL UNIQUENESS RULES (must follow):
- NEVER assign the same scene to consecutive slides.
- In a course of 8–12 slides, use at least 6 different scene values. Prefer a unique scene per slide when possible.
- "email-threat" is ONLY for slides that are specifically about reading or judging a suspicious email/message. Do NOT use it for platform lists, product features, vendor comparisons, reporting dashboards, scalability, or selection criteria.
- Platform / provider / product / certified-list slides → prefer "abstract-security", "process-diagram", or "cloud-data".
- Comparison / matrix / vs / distinction slides → prefer "process-diagram" or "statistics".
- Reporting / analytics / metrics / scalability slides → prefer "statistics".
- Cloud / SaaS / volume pricing slides → prefer "cloud-data".
- Account takeover / stolen identity slides → "identity-takeover". Social engineering / pretext → "social-engineering".
- Each scene must feel related to THAT slide's unique point, not a generic phishing stock image.

ART DIRECTION:
- Sophisticated Gamma-style editorial learning design, not clipart and not icon diagrams.
- One strong focal object per slide, supported by 2-5 meaningful scene objects.
- Use realistic device/browser/email/interface compositions only when the slide is truly about that device or interface.
- Vary compositions across consecutive slides so a course does not look templated.
- Prefer visual storytelling over repeating the slide text.
- Avoid embedded paragraphs or long text in artwork. UI fragments can be represented abstractly.
- For cybersecurity threats, make the risk visually understandable without graphic violence.
- For process/statistics screens, use editorial information design rather than a generic shield.
- The renderer uses a warm Gamma-like paper palette with charcoal ink, teal accent and pale-yellow highlight.

Course: ${clean(analysis?.title, 160)}
Summary: ${clean(analysis?.summary, 360)}
Slides JSON: ${JSON.stringify(slides)}`;
}

async function callGeminiPlanner(analysis) {
    const apiKey = getApiKey();
    if (!apiKey || process.env.NODE_ENV === 'test') return null;

    const timeoutMs = Number(process.env.SCORM_SMART_SVG_TIMEOUT_MS || 45000);
    let lastError = null;

    for (const model of plannerModels()) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: plannerPrompt(analysis) }] }],
                    generationConfig: generationConfig(model)
                }),
                signal: controller.signal
            });
            if (!response.ok) {
                const body = await response.text().catch(() => '');
                const error = new Error(`Gemini Smart SVG planner failed with ${response.status}: ${body.slice(0, 240)}`);
                error.status = response.status;
                throw error;
            }
            const data = await response.json();
            const parsed = parseJson(responseText(data));
            if (parsed?.visuals && Array.isArray(parsed.visuals)) {
                logger.info('scorm_smart_svg_planned', { module: 'scorm', model, slides: parsed.visuals.length });
                return parsed.visuals;
            }
            throw new Error('Gemini Smart SVG planner returned invalid structured output');
        } catch (err) {
            lastError = err;
            logger.warn('scorm_smart_svg_planner_model_failed', {
                module: 'scorm',
                model,
                error: err?.name === 'AbortError' ? 'timeout' : err?.message
            });
            const status = Number(err?.status || 0);
            if (status === 400 || status === 401 || status === 403) break;
        } finally {
            clearTimeout(timer);
        }
    }

    if (lastError) logger.warn('scorm_smart_svg_planner_fallback', { module: 'scorm', error: lastError.message });
    return null;
}

function specSignature(spec) {
    return [spec.scene, spec.composition, spec.focalObject, ...spec.secondaryObjects].join('|');
}

// Scene families that look nearly identical to learners even with different
// compositions (same primary device / people / diagram language).
const SCENE_FAMILIES = {
    'browser-phishing': 'browser',
    'email-threat': 'email',
    'smartphone-scam': 'phone',
    'malicious-app': 'phone',
    'qr-phishing': 'phone',
    'password-mfa': 'auth',
    'ransomware-file': 'file',
    'cloud-data': 'cloud',
    'deepfake': 'media',
    'identity-takeover': 'people',
    'social-engineering': 'people',
    'network-attack': 'network',
    'data-leak': 'network',
    'process-diagram': 'diagram',
    'statistics': 'diagram',
    'abstract-security': 'abstract'
};

function sceneFamily(scene) {
    return SCENE_FAMILIES[scene] || scene || 'abstract';
}

/**
 * Guarantee every slide looks meaningfully different.
 *
 * Previous behaviour only rotated composition/cast and kept the same scene
 * (e.g. five email-threat slides with mirror/scale variants). Learners still
 * saw "the same picture". Now we:
 *  1. Cap any single scene to 1 use in courses ≤ 6 slides, 2 uses otherwise.
 *  2. Never allow the same scene on consecutive slides.
 *  3. Prefer rotating the scene type early; composition is secondary polish.
 *  4. Still ensure full signature uniqueness as a final safety net.
 */
function diversifyCourse(specs) {
    const seenSignatures = new Set();
    const sceneCounts = new Map();
    const familyCounts = new Map();
    const maxSceneReuse = specs.length <= 6 ? 1 : 2;
    const assigned = [];

    function pickAlternateScene(current, avoidScene, avoidFamily) {
        const start = Math.max(0, SCENES.indexOf(current));
        for (let offset = 1; offset <= SCENES.length; offset += 1) {
            const candidate = SCENES[(start + offset) % SCENES.length];
            if (candidate === avoidScene) continue;
            if (sceneFamily(candidate) === avoidFamily) continue;
            if ((sceneCounts.get(candidate) || 0) >= maxSceneReuse) continue;
            if ((familyCounts.get(sceneFamily(candidate)) || 0) >= Math.max(2, maxSceneReuse + 1)) continue;
            return candidate;
        }
        // Last resort: any scene under the hard cap
        for (const candidate of SCENES) {
            if (candidate === avoidScene) continue;
            if ((sceneCounts.get(candidate) || 0) < maxSceneReuse) return candidate;
        }
        return current;
    }

    for (let index = 0; index < specs.length; index += 1) {
        let attempt = { ...specs[index] };
        const prev = assigned[index - 1] || null;
        const prevScene = prev?.scene || null;
        const prevFamily = prev ? sceneFamily(prev.scene) : null;
        let used = sceneCounts.get(attempt.scene) || 0;
        let familyUsed = familyCounts.get(sceneFamily(attempt.scene)) || 0;

        const mustChangeScene =
            (prevScene && attempt.scene === prevScene) ||
            used >= maxSceneReuse ||
            (prevFamily && sceneFamily(attempt.scene) === prevFamily && familyUsed >= 1);

        if (mustChangeScene) {
            const nextScene = pickAlternateScene(attempt.scene, prevScene, prevFamily);
            const nextDefaults = sceneDefaults(nextScene);
            attempt = {
                ...attempt,
                scene: nextScene,
                focalObject: nextDefaults[0],
                secondaryObjects: nextDefaults.slice(1, 5),
                composition: COMPOSITIONS[index % COMPOSITIONS.length]
            };
        }

        // Guarantee unique full signature (composition + cast) as a final pass.
        let signature = specSignature(attempt);
        let guard = 0;
        while (seenSignatures.has(signature) && guard < COMPOSITIONS.length * 4 + SCENES.length) {
            if (guard < COMPOSITIONS.length * 2) {
                const compIndex = (COMPOSITIONS.indexOf(attempt.composition) + 1 + guard) % COMPOSITIONS.length;
                const defaults = sceneDefaults(attempt.scene);
                const rotation = (guard + 1) % Math.max(defaults.length, 1);
                const rotated = defaults.length > 1
                    ? [...defaults.slice(rotation), ...defaults.slice(0, rotation)]
                    : defaults;
                const focalObject = rotated[0] || attempt.focalObject;
                attempt = {
                    ...attempt,
                    composition: COMPOSITIONS[compIndex],
                    focalObject,
                    secondaryObjects: rotated.filter((item) => item !== focalObject).slice(0, 4)
                };
            } else {
                const nextScene = pickAlternateScene(attempt.scene, prevScene, prevFamily);
                const nextDefaults = sceneDefaults(nextScene);
                attempt = {
                    ...attempt,
                    scene: nextScene,
                    focalObject: nextDefaults[0],
                    secondaryObjects: nextDefaults.slice(1, 5),
                    composition: COMPOSITIONS[(index + guard) % COMPOSITIONS.length]
                };
            }
            signature = specSignature(attempt);
            guard += 1;
        }

        seenSignatures.add(signature);
        sceneCounts.set(attempt.scene, (sceneCounts.get(attempt.scene) || 0) + 1);
        familyCounts.set(sceneFamily(attempt.scene), (familyCounts.get(sceneFamily(attempt.scene)) || 0) + 1);
        assigned.push(attempt);
    }

    return assigned;
}

async function planSvgScenes(analysis = {}) {
    const slides = Array.isArray(analysis.slides) ? analysis.slides : [];
    if (!slides.length) return [];

    let planned = null;
    if (String(process.env.SCORM_SMART_SVG_USE_GEMINI || 'true').toLowerCase() !== 'false') {
        planned = await callGeminiPlanner(analysis);
    }

    const byIndex = new Map();
    for (const raw of Array.isArray(planned) ? planned : []) {
        const index = Number(raw?.index);
        if (Number.isInteger(index) && index >= 0 && index < slides.length && !byIndex.has(index)) {
            byIndex.set(index, raw);
        }
    }

    const specs = slides.map((slide, index) => normalizeSpec(byIndex.get(index), slide, index));
    return diversifyCourse(specs);
}

module.exports = {
    SCENES,
    COMPOSITIONS,
    OBJECTS,
    MOODS,
    SCENE_SCHEMA,
    SCENE_FAMILIES,
    inferScene,
    sceneFamily,
    fallbackSpec,
    normalizeSpec,
    specSignature,
    diversifyCourse,
    planSvgScenes,
    callGeminiPlanner
};
