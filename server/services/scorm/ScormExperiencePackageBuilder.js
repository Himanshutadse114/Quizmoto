const JSZip = require('jszip');
const { buildScormPackageZip: buildVisualPackage } = require('./ScormVisualPackageBuilder');
const { generateVisualAssets } = require('./ScormVisualAssetService');

const LAYOUTS = ['process', 'cards', 'timeline', 'comparison', 'hub', 'spotlight', 'matrix', 'cycle'];
const SCREEN_TYPES = ['concept', 'hotspot', 'process', 'scenario', 'comparison', 'reveal', 'timeline', 'takeaway'];
const BACKGROUNDS = ['mesh', 'glow', 'grid', 'orbit', 'waves', 'focus'];

function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalized(value) {
    return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function dedupePoints(points) {
    const seen = new Set();
    return (Array.isArray(points) ? points : [])
        .map(cleanText)
        .filter(Boolean)
        .filter((point) => {
            const key = normalized(point);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, 6);
}

function inferLayout(slide, index) {
    const explicit = String(slide?.layout || slide?.slideType || '').trim().toLowerCase();
    if (LAYOUTS.includes(explicit)) return explicit;
    const text = `${slide?.title || ''} ${slide?.content || ''}`.toLowerCase();
    if (/likelihood|impact|risk matrix|heatmap/.test(text)) return 'matrix';
    if (/cycle|continuous|repeat|ongoing/.test(text)) return 'cycle';
    if (/step|process|workflow|how .* works|lifecycle|flow/.test(text)) return 'process';
    if (/before|after|versus| vs |do and don|good|bad|safe|unsafe|compare/.test(text)) return 'comparison';
    if (/timeline|history|phase|stage|sequence|journey/.test(text)) return 'timeline';
    if (/types|pillars|principles|elements|areas|components|categories/.test(text)) return 'hub';
    if (/example|scenario|story|case/.test(text)) return 'spotlight';
    if (index % 3 === 0) return 'cards';
    if (index % 3 === 1) return 'hub';
    return 'spotlight';
}

function inferScreenType(slide, layout, index) {
    const explicit = String(slide?.screenType || '').trim().toLowerCase();
    if (SCREEN_TYPES.includes(explicit)) return explicit;
    if (layout === 'comparison' || layout === 'matrix') return 'comparison';
    if (layout === 'process' || layout === 'timeline' || layout === 'cycle') return 'process';
    if (layout === 'spotlight') return index % 3 === 0 ? 'scenario' : 'takeaway';
    if (layout === 'hub') return 'hotspot';
    if (layout === 'cards') return index % 3 === 1 ? 'reveal' : 'concept';
    return 'concept';
}

function inferBackground(slide, screenType, index) {
    const explicit = String(slide?.backgroundStyle || '').trim().toLowerCase();
    if (BACKGROUNDS.includes(explicit)) return explicit;
    if (screenType === 'scenario') return 'focus';
    if (screenType === 'takeaway') return 'glow';
    if (screenType === 'hotspot') return 'orbit';
    return BACKGROUNDS[index % BACKGROUNDS.length];
}

function inferMetaphor(slide) {
    const explicit = cleanText(slide?.visualMetaphor).toLowerCase();
    if (explicit && !['identity', 'shield', 'warning'].includes(explicit)) return explicit;
    const text = `${slide?.title || ''} ${slide?.content || ''} ${(Array.isArray(slide?.keyPoints) ? slide.keyPoints.join(' ') : '')}`.toLowerCase();
    const layout = String(slide?.layout || '').toLowerCase();
    if (/cloud|sharepoint|drive|saas|volume-based/.test(text)) return 'cloud';
    if (/password|credential|login|authentication|mfa|passkey/.test(text)) return 'lock';
    if (/qr|quick response/.test(text)) return 'qr';
    if (/voice|deepfake|audio clone|synthetic/.test(text)) return 'ai-wave';
    if (/ransom|encrypt(s|ed)? file|malware payload/.test(text)) return 'file';
    if (/sms|smish|whatsapp|callback|text message/.test(text)) return 'phone';
    if (/browser|website|url bar|sign-in page|fake login/.test(text)) return 'browser';
    if (layout === 'comparison' || layout === 'matrix' || /compar(e|ison)|versus|vs\.|distinction|selection criteria/.test(text)) return 'shield';
    if (layout === 'hub' || layout === 'cards' || /provider|platform|vendor|solution|certified|template library|ecosystem/.test(text)) {
        return /cloud|saas/.test(text) ? 'cloud' : 'shield';
    }
    if (/\b(inbox|email client|sender address|suspicious message)\b/.test(text) && !/platform|provider|vendor|reporting|scalability/.test(text)) return 'email';
    if (/account takeover|credential theft|identity theft/.test(text)) return 'identity';
    if (/phone|mobile|call/.test(text)) return 'phone';
    if (/browser|website|url|domain/.test(text)) return 'browser';
    if (/warning|incident|threat|malware|risk/.test(text)) return 'warning';
    return 'shield';
}

function splitLearningCopy(content, explicitReveal) {
    const full = cleanText(content);
    const reveal = cleanText(explicitReveal);
    if (!full) return { introText: '', revealText: reveal };
    if (reveal) {
        const first = full.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
        return { introText: first && first.length < 230 ? first : full.split(/\s+/).slice(0, 32).join(' ') + (full.split(/\s+/).length > 32 ? '…' : ''), revealText: reveal };
    }
    const sentences = full.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [full];
    const intro = cleanText(sentences[0]);
    const remainder = cleanText(sentences.slice(1).join(' '));
    if (remainder) return { introText: intro, revealText: remainder };
    const list = full.split(/\s+/);
    if (list.length > 42) {
        return { introText: list.slice(0, 28).join(' ') + '…', revealText: list.slice(28).join(' ') };
    }
    return { introText: full, revealText: '' };
}

function interactionFor(slide, layout, screenType) {
    const explicit = slide?.interaction && typeof slide.interaction === 'object' ? { ...slide.interaction } : null;
    if (explicit?.type) {
        return { ...explicit, prompt: cleanText(explicit.prompt) || 'Explore the visual to continue learning.' };
    }
    if (screenType === 'scenario') return { type: 'decision_explore', prompt: 'Consider the situation and choose what you would examine first.' };
    if (screenType === 'reveal') return { type: 'click_reveal', prompt: 'Open each point to reveal the practical detail.' };
    if (layout === 'process' || layout === 'timeline' || layout === 'cycle') return { type: 'step_explore', prompt: 'Explore each stage to understand the sequence.' };
    if (layout === 'comparison' || layout === 'matrix') return { type: 'compare_reveal', prompt: 'Compare the signals before you continue.' };
    if (layout === 'hub' || layout === 'cards') return { type: 'hotspot_explore', prompt: 'Select the learning points to explore the visual.' };
    return { type: 'focus_reveal', prompt: 'Reveal the key learning point when you are ready.' };
}

function polishQuiz(quiz) {
    return (Array.isArray(quiz) ? quiz : []).map((question) => {
        const item = question && typeof question === 'object' ? question : {};
        return {
            ...item,
            question: cleanText(item.question),
            options: (Array.isArray(item.options) ? item.options : []).map(cleanText).slice(0, 4),
            explanation: cleanText(item.explanation)
        };
    });
}

function enrichAnalysis(raw) {
    const analysis = raw && typeof raw === 'object' ? raw : {};
    const slides = Array.isArray(analysis.slides) ? analysis.slides : [];
    return {
        ...analysis,
        title: cleanText(analysis.title) || 'Learning experience',
        summary: cleanText(analysis.summary),
        experienceVersion: 5,
        slides: slides.map((slide, index) => {
            const item = slide && typeof slide === 'object' ? slide : {};
            const layout = inferLayout(item, index);
            const screenType = inferScreenType(item, layout, index);
            const copy = splitLearningCopy(item.content, item.revealText);
            return {
                ...item,
                title: cleanText(item.title) || `Section ${index + 1}`,
                content: cleanText(item.content),
                introText: cleanText(item.introText) || copy.introText,
                revealText: cleanText(item.revealText) || copy.revealText,
                keyPoints: dedupePoints(item.keyPoints),
                layout,
                screenType,
                backgroundStyle: inferBackground(item, screenType, index),
                visualMetaphor: inferMetaphor(item),
                visualTitle: cleanText(item.visualTitle || item.title || `Section ${index + 1}`),
                interaction: interactionFor(item, layout, screenType)
            };
        }),
        quiz: polishQuiz(analysis.quiz)
    };
}

function experienceScript() {
    return `(() => {
  const root = document.querySelector('[data-qmx-root]') || document.body;
  root.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-qmx-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-qmx-action');
    const screen = btn.closest('[data-qmx-screen]');
    if (!screen) return;
    if (action === 'reveal') {
      screen.querySelectorAll('[data-qmx-reveal]').forEach((node) => { node.hidden = false; });
      btn.hidden = true;
    }
    if (action === 'point') {
      const id = btn.getAttribute('data-point-id');
      const detail = screen.querySelector('[data-point-detail="' + id + '"]');
      if (detail) detail.hidden = !detail.hidden;
    }
  });
})();`;
}

async function buildScormPackageZip(analysis, options = {}) {
    const enriched = enrichAnalysis(analysis);
    const assets = await generateVisualAssets(enriched, options);
    const zip = await buildVisualPackage(enriched, assets, options);
    return zip;
}

module.exports = {
    buildScormPackageZip,
    enrichAnalysis,
    inferLayout,
    inferScreenType,
    inferBackground,
    inferMetaphor,
    dedupePoints,
    cleanText,
    experienceScript,
    SCREEN_TYPES,
    BACKGROUNDS
};
