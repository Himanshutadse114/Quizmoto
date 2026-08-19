const JSZip = require('jszip');
const { buildScormManifest, buildScormIndexHtml } = require('./ScormPackageBuilder');
const { planSvgScenes } = require('./ScormSvgScenePlanner');
const { renderSmartSvg, paletteFromAnalysis } = require('./ScormSmartSvgRenderer');
const { finalizeGammaEditorial } = require('./ScormGammaEditorialFinalizer');
const logger = require('../../utils/logger');

const SCREEN_TYPES = ['concept', 'scenario', 'reveal', 'hotspot', 'takeaway', 'comparison'];
const BACKGROUNDS = ['mesh', 'glow', 'orbit', 'focus', 'grid'];

function cleanText(value, max = 12000) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function dedupePoints(points) {
    const seen = new Set();
    const out = [];
    for (const raw of Array.isArray(points) ? points : []) {
        const point = cleanText(raw, 180);
        if (!point) continue;
        const key = point.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(point);
        if (out.length >= 6) break;
    }
    return out;
}

function inferLayout(slide, index) {
    const explicit = String(slide?.layout || '').trim().toLowerCase();
    if (['hub', 'cards', 'spotlight', 'comparison', 'matrix', 'process', 'timeline', 'cycle'].includes(explicit)) return explicit;
    const text = `${slide?.title || ''} ${slide?.content || ''}`.toLowerCase();
    if (/compar|versus|vs\.|difference|distinction/.test(text)) return 'comparison';
    if (/process|workflow|stage|step|sequence|timeline/.test(text)) return 'process';
    if (/list|provider|platform|vendor|option/.test(text)) return index % 2 === 0 ? 'cards' : 'hub';
    if (index === 0) return 'hub';
    if (index % 4 === 1) return 'spotlight';
    if (index % 4 === 2) return 'cards';
    return 'spotlight';
}

function inferScreenType(slide, layout, index) {
    const explicit = String(slide?.screenType || '').trim().toLowerCase();
    if (SCREEN_TYPES.includes(explicit)) return explicit;
    if (layout === 'comparison' || layout === 'matrix') return 'comparison';
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
    // Keep explicit only when it is a concrete visual cue, not a vague "identity".
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
    // Platform / product / comparison content should not default to email or identity.
    if (layout === 'comparison' || layout === 'matrix' || /compar(e|ison)|versus|vs\.|distinction|selection criteria/.test(text)) return 'shield';
    if (layout === 'hub' || layout === 'cards' || /provider|platform|vendor|solution|certified|template library|ecosystem/.test(text)) {
        return /cloud|saas/.test(text) ? 'cloud' : 'shield';
    }
    if (/\b(inbox|email client|sender address|suspicious message)\b/.test(text) && !/platform|provider|vendor|reporting|scalability/.test(text)) {
        return 'email';
    }
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
        return {
            introText: list.slice(0, 28).join(' ') + '…',
            revealText: list.slice(28).join(' ')
        };
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

function injectExperienceCss(html) {
    const css = `
<style id="quizmoto-experience-v5">
.qmx-stage{width:min(1260px,100%);margin:auto}
.qmx-screen{position:relative;isolation:isolate}
.qmx-screen:before{content:"";position:absolute;inset:-30px;border-radius:38px;pointer-events:none;z-index:-1;opacity:.7}
.qmx-bg-mesh:before{background:radial-gradient(circle at 88% 10%,color-mix(in srgb,var(--accent) 15%,transparent),transparent 28rem),linear-gradient(135deg,transparent 0 42%,color-mix(in srgb,var(--primary) 5%,transparent) 42% 44%,transparent 44%)}
.qmx-bg-glow:before{background:radial-gradient(circle at 75% 30%,color-mix(in srgb,var(--primary) 18%,transparent),transparent 25rem)}
.qmx-bg-orbit:before{background:radial-gradient(circle at 20% 80%,color-mix(in srgb,var(--accent) 12%,transparent),transparent 22rem)}
.qmx-bg-focus:before{background:radial-gradient(circle at 50% 40%,color-mix(in srgb,var(--primary) 14%,transparent),transparent 20rem)}
.qmx-bg-grid:before{background:linear-gradient(color-mix(in srgb,var(--ink) 4%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--ink) 4%,transparent) 1px,transparent 1px);background-size:42px 42px}
.qmx-layout{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,0.95fr);gap:clamp(1.2rem,3vw,2.4rem);align-items:center}
.qmx-copy{min-width:0}
.qmx-visual{aspect-ratio:6/5;width:100%;border-radius:28px;overflow:hidden;background:color-mix(in srgb,var(--paper) 92%,white);box-shadow:0 24px 60px rgba(20,20,17,.12)}
.qmx-visual img,.qmx-visual svg{width:100%;height:100%;object-fit:cover;display:block}
.qmx-kicker{font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;opacity:.62;margin:0 0 .55rem}
.qmx-title{font-size:clamp(1.45rem,2.4vw,2.05rem);line-height:1.15;margin:0 0 .85rem;color:var(--ink)}
.qmx-body{font-size:clamp(.98rem,1.15vw,1.08rem);line-height:1.62;color:var(--body);margin:0 0 1.1rem}
.qmx-points{display:flex;flex-wrap:wrap;gap:.55rem;margin:0 0 1rem;padding:0;list-style:none}
.qmx-points li{border:1px solid color-mix(in srgb,var(--structure) 70%,transparent);background:color-mix(in srgb,var(--paper2) 88%,white);border-radius:999px;padding:.42rem .85rem;font-size:.86rem;color:var(--ink)}
.qmx-reveal{margin-top:.75rem;padding:1rem 1.1rem;border-radius:18px;background:color-mix(in srgb,var(--yellow) 35%,var(--paper2));border:1px solid color-mix(in srgb,var(--amber) 35%,transparent)}
.qmx-actions{display:flex;flex-wrap:wrap;gap:.65rem;margin-top:1.15rem}
.qmx-btn{appearance:none;border:0;border-radius:999px;padding:.72rem 1.2rem;font-weight:600;cursor:pointer;background:var(--teal);color:#102826}
.qmx-btn.secondary{background:transparent;border:1.5px solid color-mix(in srgb,var(--ink) 25%,transparent);color:var(--ink)}
@media (max-width:680px){
  .qmx-layout{grid-template-columns:1fr;gap:1.1rem}
  .qmx-visual{aspect-ratio:9/11;order:-1}
}
</style>`;
    if (!html || typeof html !== 'string') return html;
    if (html.includes('quizmoto-experience-v5')) return html;
    if (html.includes('</head>')) return html.replace('</head>', `${css}\n</head>`);
    return css + html;
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
      screen.querySelectorAll('[data-qmx-reveal]').forEach((node) => node.hidden = false);
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

async function buildExperiencePackage(analysis, options = {}) {
    const enriched = enrichAnalysis(analysis);
    const palette = paletteFromAnalysis(enriched);
    let scenePlans = [];
    try {
        scenePlans = await planSvgScenes(enriched);
    } catch (err) {
        logger.warn('scorm_scene_plan_failed', { error: err?.message });
        scenePlans = (enriched.slides || []).map((slide, index) => ({
            index,
            scene: 'abstract-security',
            composition: 'editorial-right',
            focalObject: 'shield',
            secondaryObjects: ['lock', 'user'],
            mood: 'editorial',
            visualTitle: slide.visualTitle || slide.title,
            artDirection: 'Fallback abstract security illustration'
        }));
    }

    const visuals = [];
    const desktopSvgs = [];
    const mobileSvgs = [];
    for (let i = 0; i < (enriched.slides || []).length; i += 1) {
        const slide = enriched.slides[i];
        const spec = scenePlans[i] || { scene: 'abstract-security', composition: 'editorial-right', focalObject: 'shield', secondaryObjects: [], mood: 'editorial', visualTitle: slide.title };
        const desktop = renderSmartSvg(spec, slide, { mobile: false, palette });
        const mobile = renderSmartSvg(spec, slide, { mobile: true, palette });
        const desktopPath = `assets/visuals/smart-visual-${String(i + 1).padStart(3, '0')}.svg`;
        const mobilePath = `assets/visuals/smart-visual-${String(i + 1).padStart(3, '0')}-mobile.svg`;
        desktopSvgs.push({ path: desktopPath, body: Buffer.from(desktop, 'utf8') });
        mobileSvgs.push({ path: mobilePath, body: Buffer.from(mobile, 'utf8') });
        visuals.push({
            index: i,
            layout: slide.layout,
            screenType: slide.screenType,
            desktop: desktopPath,
            mobile: mobilePath,
            scene: spec.scene,
            composition: spec.composition
        });
    }

    const visualManifest = {
        generatedBy: 'quizmoto-responsive-vector-engine-v5',
        responsive: true,
        visuals
    };

    let html = buildScormIndexHtml(enriched, {
        ...options,
        visuals,
        experienceVersion: 5
    });
    html = injectExperienceCss(html);
    html = finalizeGammaEditorial(html, enriched);

    const zip = new JSZip();
    zip.file('imsmanifest.xml', buildScormManifest(enriched, options));
    zip.file('index.html', html);
    zip.file('content.json', JSON.stringify(enriched, null, 2));
    zip.file('assets/visuals/visual-manifest.json', JSON.stringify(visualManifest, null, 2));
    for (const item of desktopSvgs) zip.file(item.path, item.body);
    for (const item of mobileSvgs) zip.file(item.path, item.body);

    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    return {
        buffer,
        analysis: enriched,
        visualManifest,
        size: buffer.length
    };
}

module.exports = {
    buildExperiencePackage,
    enrichAnalysis,
    injectExperienceCss,
    inferLayout,
    inferScreenType,
    inferMetaphor,
    splitLearningCopy,
    dedupePoints,
    cleanText,
    experienceScript,
    SCREEN_TYPES,
    BACKGROUNDS
};
