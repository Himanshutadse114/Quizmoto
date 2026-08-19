const logger = require('../../utils/logger');
const { getApiKey, modelCandidates, thinkingLevel } = require('./PolicyAnalysisService');

const SCENES = [
    'browser-phishing', 'email-threat', 'smartphone-scam', 'malicious-app', 'password-mfa',
    'ransomware-file', 'cloud-data', 'qr-phishing', 'deepfake', 'identity-takeover',
    'social-engineering', 'network-attack', 'data-leak', 'process-diagram', 'statistics', 'abstract-security'
];
const COMPOSITIONS = ['editorial-right', 'editorial-left', 'center-stage', 'wide-scene', 'full-bleed'];
const OBJECTS = [
    'browser', 'email', 'phone', 'lock', 'warning', 'qr', 'file', 'cloud', 'user', 'attacker',
    'shield', 'waveform', 'server', 'data-stream', 'password', 'mfa-prompt', 'malware', 'link',
    'app-grid', 'document', 'camera', 'microphone', 'network', 'database'
];
const MOODS = ['editorial', 'investigative', 'urgent', 'calm-secure', 'technical', 'human'];

const SCENE_FAMILIES = {
    'browser-phishing': 'browser', 'email-threat': 'email', 'smartphone-scam': 'phone',
    'malicious-app': 'phone', 'qr-phishing': 'phone', 'password-mfa': 'auth',
    'ransomware-file': 'file', 'cloud-data': 'cloud', 'deepfake': 'media',
    'identity-takeover': 'people', 'social-engineering': 'people', 'network-attack': 'network',
    'data-leak': 'network', 'process-diagram': 'diagram', 'statistics': 'diagram',
    'abstract-security': 'abstract'
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
    if (/autonomous|ai agent|machine learning|\bml\b|deep learning|reinforcement learning|decision support|\bedss\b|predictive insight|forecasting|business intelligence|enterprise intelligence|data preprocessing|preprocessing stage/.test(text)) {
        if (/statistic|metric|forecast|trend|analytics|reporting|percent|rate/.test(text)) return 'statistics';
        if (/workflow|stage|step|component|module|pipeline|framework|architecture|process|lifecycle/.test(text) || ['process', 'timeline', 'cycle'].includes(layout)) return 'process-diagram';
        if (/cloud|integration|data source|enterprise data/.test(text)) return 'cloud-data';
        return 'process-diagram';
    }
    if (/\b\d+%|percent|statistic|metric|rate|survey|research|analytics|reporting|risk score|scalability|1,?000\+|campaign analytics/.test(text)) return 'statistics';
    if (layout === 'comparison' || layout === 'matrix' || /compar(e|ison)|versus|vs\.|distinction|awareness vs|gap|selection criteria|choosing the right/.test(text)) return 'process-diagram';
    if (['process', 'timeline', 'cycle'].includes(layout) || /workflow|stage|step|sequence|lifecycle/.test(text)) return 'process-diagram';
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

function sceneFamily(scene) {
    return SCENE_FAMILIES[scene] || scene || 'abstract';
}

function fallbackSpec(slide = {}, index = 0) {
    const scene = inferScene(slide);
    const defaults = sceneDefaults(scene);
    const compositionCycle = ['editorial-right', 'editorial-left', 'wide-scene', 'center-stage'];
    const screenType = String(slide.screenType || '').toLowerCase();
    const composition = screenType === 'takeaway' ? 'full-bleed' : compositionCycle[index % compositionCycle.length];
    const mood = /warning|risk|attack|malware|phish|ransom/i.test(`${slide.title || ''} ${slide.content || ''}`) ? 'investigative' : 'editorial';
    return {
        index,
        scene,
        composition,
        focalObject: defaults[0],
        secondaryObjects: defaults.slice(1),
        mood,
        visualTitle: clean(slide.visualTitle || slide.title || `Learning visual ${index + 1}`, 80),
        artDirection: 'Premium editorial illustration with layered depth and a strong focal object.'
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

function specSignature(spec) {
    return [spec.scene, spec.composition, spec.focalObject, ...spec.secondaryObjects].join('|');
}

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

        let signature = specSignature(attempt);
        let guard = 0;
        while (seenSignatures.has(signature) && guard < COMPOSITIONS.length * 4 + SCENES.length) {
            if (guard < COMPOSITIONS.length * 2) {
                const compIndex = (COMPOSITIONS.indexOf(attempt.composition) + 1 + guard) % COMPOSITIONS.length;
                const defaults = sceneDefaults(attempt.scene);
                const rotation = (guard + 1) % Math.max(defaults.length, 1);
                const rotated = defaults.length > 1 ? [...defaults.slice(rotation), ...defaults.slice(0, rotation)] : defaults;
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
    const specs = slides.map((slide, index) => normalizeSpec(null, slide, index));
    return diversifyCourse(specs);
}

module.exports = {
    SCENES,
    COMPOSITIONS,
    OBJECTS,
    MOODS,
    SCENE_FAMILIES,
    inferScene,
    sceneFamily,
    fallbackSpec,
    normalizeSpec,
    specSignature,
    diversifyCourse,
    planSvgScenes,
    callGeminiPlanner: async () => null
};
