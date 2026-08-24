const JSZip = require('jszip');
const { buildScormPackageZip: buildVisualPackage } = require('./ScormVisualPackageBuilder');
const { generateVisualAssets, generateCourseCoverAsset } = require('./ScormVisualAssetService');

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
    if (explicit) return explicit;
    const text = `${slide?.title || ''} ${slide?.content || ''}`.toLowerCase();
    if (/cloud|saas/.test(text)) return 'cloud';
    if (/password|credential|login|authentication|mfa|passkey/.test(text)) return 'lock';
    if (/qr|quick response/.test(text)) return 'qr';
    if (/voice|deepfake|audio clone|synthetic/.test(text)) return 'ai-wave';
    if (/sms|smish|whatsapp|callback|text message/.test(text)) return 'phone';
    if (/browser|website|url/.test(text)) return 'browser';
    if (/email|inbox/.test(text)) return 'email';
    return 'abstract';
}

function splitLearningCopy(content, explicitReveal) {
    const full = cleanText(content);
    const reveal = cleanText(explicitReveal);
    if (!full) return { introText: '', revealText: reveal };
    if (reveal) {
        const first = full.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
        return {
            introText: first && first.length < 230 ? first : full.split(/\s+/).slice(0, 32).join(' ') + (full.split(/\s+/).length > 32 ? '…' : ''),
            revealText: reveal
        };
    }
    const sentences = full.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [full];
    const intro = cleanText(sentences[0]);
    const remainder = cleanText(sentences.slice(1).join(' '));
    if (remainder) return { introText: intro, revealText: remainder };
    return { introText: full, revealText: '' };
}

function interactionFor(slide, layout, screenType) {
    const explicit = slide?.interaction && typeof slide.interaction === 'object' ? { ...slide.interaction } : null;
    if (explicit?.type) return { ...explicit, prompt: cleanText(explicit.prompt) || 'Explore the learning point.' };
    if (screenType === 'scenario') return { type: 'decision_explore', prompt: 'Consider the situation and choose what you would examine first.' };
    if (screenType === 'reveal') return { type: 'click_reveal', prompt: 'Open each point to reveal the practical detail.' };
    if (layout === 'process' || layout === 'timeline' || layout === 'cycle') return { type: 'step_explore', prompt: 'Explore each stage to understand the sequence.' };
    if (layout === 'comparison' || layout === 'matrix') return { type: 'compare_reveal', prompt: 'Compare the points before you continue.' };
    if (layout === 'hub' || layout === 'cards') return { type: 'hotspot_explore', prompt: 'Select the learning points to explore.' };
    return { type: 'focus_reveal', prompt: 'Reveal the key learning point when you are ready.' };
}

function polishQuiz(quiz) {
    return (Array.isArray(quiz) ? quiz : []).map((question) => ({
        ...(question || {}),
        question: cleanText(question?.question),
        options: (Array.isArray(question?.options) ? question.options : []).map(cleanText).slice(0, 4),
        explanation: cleanText(question?.explanation)
    }));
}

function isRasterPath(value) {
    const path = cleanText(value).toLowerCase();
    return /\.(webp|png|jpe?g)(?:$|[?#])/.test(path) || path.startsWith('data:image/webp') || path.startsWith('data:image/png') || path.startsWith('data:image/jpeg');
}

function isRasterCourse(analysis) {
    if (String(analysis?.visualMode || '').toLowerCase() === 'raster') return true;
    if (isRasterPath(analysis?.coverVisualAsset) || isRasterPath(analysis?.coverImageAsset)) return true;
    return (Array.isArray(analysis?.slides) ? analysis.slides : []).some((slide) => isRasterPath(slide?.rasterVisualAsset) || isRasterPath(slide?.visualAsset));
}

function canonicalizeRasterAnalysis(raw) {
    const analysis = raw && typeof raw === 'object' ? { ...raw } : {};
    if (!isRasterCourse(analysis)) return analysis;
    analysis.visualMode = 'raster';
    if (isRasterPath(analysis.coverImageAsset)) {
        analysis.coverVisualAsset = analysis.coverImageAsset;
        analysis.coverMobileVisualAsset = analysis.coverImageAsset;
    }
    analysis.slides = (Array.isArray(analysis.slides) ? analysis.slides : []).map((slide) => {
        const next = { ...(slide || {}) };
        const raster = isRasterPath(next.rasterVisualAsset)
            ? next.rasterVisualAsset
            : (isRasterPath(next.visualAsset) ? next.visualAsset : '');
        if (raster) {
            next.rasterVisualAsset = raster;
            next.visualAsset = raster;
            next.mobileVisualAsset = raster;
            next.visualSource = 'ai_raster';
            next.visualAssetType = 'image/webp';
        } else {
            // Raster-authored courses deliberately do not fall back to generated SVGs.
            delete next.visualAsset;
            delete next.mobileVisualAsset;
            delete next.rasterVisualAsset;
        }
        return next;
    });
    return analysis;
}

function enrichAnalysis(raw) {
    const canonical = canonicalizeRasterAnalysis(raw);
    const slides = Array.isArray(canonical.slides) ? canonical.slides : [];
    return {
        ...canonical,
        title: cleanText(canonical.title) || 'Learning experience',
        summary: cleanText(canonical.summary),
        experienceVersion: 6,
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
        quiz: polishQuiz(canonical.quiz)
    };
}

function experienceCss() {
    return [
        '<style id="quizmoto-course-visual-v6">',
        '.qmx-native-visual-frame,.qmx-raster-native-panel,.qmx-native-cover-raster{position:relative!important;width:100%!important;aspect-ratio:16/9!important;height:auto!important;min-height:0!important;overflow:hidden!important;border-radius:22px!important;background:rgba(255,255,255,.24)!important;border:1px solid rgba(40,40,36,.14)!important;box-shadow:0 16px 38px rgba(40,40,36,.09)!important}',
        '.qmx-native-visual-frame:before,.qmx-native-visual-frame:after,.qmx-raster-native-panel:before,.qmx-raster-native-panel:after{display:none!important}',
        '.qmx-native-visual-frame svg,.qmx-raster-native-panel svg{display:none!important}',
        '.qmx-native-course-picture{display:block!important;width:100%!important;height:100%!important}',
        '.qmx-native-course-picture img{display:block!important;width:100%!important;height:100%!important;object-fit:cover!important;border-radius:inherit!important}',
        '.qmx-native-cover-raster{width:min(760px,100%)!important;margin:24px auto 0!important}',
        '.qmx-raster-stage-v6{display:grid!important;grid-template-columns:minmax(0,1.1fr) minmax(300px,.9fr)!important;grid-template-areas:"head image" "body image"!important;column-gap:28px!important;row-gap:18px!important;align-items:start!important}',
        '.qmx-raster-stage-v6>.section-head{grid-area:head!important;margin-bottom:0!important}',
        '.qmx-raster-stage-v6>.cards-grid,.qmx-raster-stage-v6>.process,.qmx-raster-stage-v6>.timeline,.qmx-raster-stage-v6>.compare,.qmx-raster-stage-v6>.hub-wrap{grid-area:body!important;min-width:0!important}',
        '.qmx-raster-stage-v6>.qmx-raster-native-panel{grid-area:image!important;align-self:center!important}',
        '@media(max-width:980px){.qmx-raster-stage-v6{grid-template-columns:1fr!important;grid-template-areas:"head" "image" "body"!important}.qmx-native-cover-raster{width:min(680px,100%)!important}}',
        '@media(max-width:560px){.qmx-native-visual-frame,.qmx-raster-native-panel,.qmx-native-cover-raster{border-radius:16px!important}}',
        '</style>'
    ].join('');
}

function experienceScript() {
    return [
        '<script id="quizmoto-course-visual-v6-script">',
        '(function(){',
        "function esc(s){var M={'<':'&lt;','>':'&gt;','&':'&amp;','\"':'&quot;',\"'\":'&#39;'};return String(s||'').replace(/[<>&\"']/g,function(c){return M[c]||c})}",
        'function picture(path,alt){if(!path)return "";return "<picture class=\"qmx-native-course-picture\"><img src=\""+esc(path)+"\" alt=\""+esc(alt||"Learning visual")+"\" loading=\"eager\" decoding=\"async\"></picture>"}',
        'function installSlide(node,s){',
        '  if(!node||!s||!s.visualAsset)return;',
        '  var html=picture(String(s.visualAsset),s.visualTitle||s.title);if(!html)return;',
        '  var target=node.querySelector(".qmx-hub-art")||node.querySelector(".spot-visual")||node.querySelector(".hero-art");',
        '  if(target){target.classList.add("qmx-native-visual-frame");target.innerHTML=html;target.setAttribute("data-qmx-canonical-visual",String(s.visualAsset));return;}',
        '  var hub=node.querySelector(".hub-svg");',
        '  if(hub&&hub.parentNode){var replacement=document.createElement("div");replacement.className="qmx-native-visual-frame";replacement.innerHTML=html;replacement.setAttribute("data-qmx-canonical-visual",String(s.visualAsset));hub.parentNode.replaceChild(replacement,hub);return;}',
        '  var stage=node.querySelector(".stage,.qmx-stage")||node;',
        '  var panel=stage.querySelector(".qmx-raster-native-panel");if(!panel){panel=document.createElement("div");panel.className="qmx-raster-native-panel";stage.appendChild(panel)}',
        '  stage.classList.add("qmx-raster-stage-v6");panel.innerHTML=html;panel.setAttribute("data-qmx-canonical-visual",String(s.visualAsset));',
        '}',
        'function installCover(intro,data){',
        '  if(!intro||!data||!data.coverVisualAsset)return;',
        '  var hero=intro.querySelector(".hero");if(!hero)return;',
        '  var frame=hero.querySelector(".qmx-native-cover-raster");if(!frame){frame=document.createElement("div");frame.className="qmx-native-cover-raster";var chips=hero.querySelector(".kp-row,.qmx-cover-meta");if(chips&&chips.parentNode===hero)hero.insertBefore(frame,chips);else hero.appendChild(frame)}',
        '  frame.innerHTML=picture(String(data.coverVisualAsset),data.title||"Course cover");frame.setAttribute("data-qmx-canonical-visual",String(data.coverVisualAsset));',
        '}',
        'function install(){',
        '  var data=window.__quizmotoData||null;if(!data||!Array.isArray(data.slides))return false;',
        '  var nodes=Array.prototype.slice.call(document.querySelectorAll(".slide"));if(!nodes.length)return false;',
        '  installCover(nodes[0],data);data.slides.forEach(function(s,i){installSlide(nodes[i+1],s)});return true;',
        '}',
        'function run(){install();[80,250,600,1200].forEach(function(ms){setTimeout(install,ms)})}',
        "if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();",
        'window.addEventListener("load",function(){setTimeout(install,0)},{once:true});',
        '})();',
        '</'+'script>'
    ].join('');
}

function exposeData(html) {
    if (html.includes('window.__quizmotoData')) return html;
    return html.replace(/\bvar\s+data\s*=\s*/, 'var data=window.__quizmotoData=');
}

function inject(html) {
    let out = exposeData(String(html || ''));
    if (!out.includes('quizmoto-course-visual-v6')) {
        out = out.includes('</head>') ? out.replace('</head>', () => `${experienceCss()}\n</head>`) : `${experienceCss()}\n${out}`;
    }
    if (!out.includes('quizmoto-course-visual-v6-script')) {
        const script = experienceScript();
        out = out.includes('</body>') ? out.replace('</body>', () => `${script}\n</body>`) : `${out}\n${script}`;
    }
    return out;
}

async function buildLegacySvgAssets(analysis, opts) {
    let assets = [];
    let coverAsset = null;
    try {
        assets = await generateVisualAssets(analysis, opts);
    } catch (err) {
        console.warn('[scorm-visual-v6] Legacy SVG generation failed; continuing without SVGs', { message: err && err.message });
    }
    try {
        coverAsset = generateCourseCoverAsset(analysis);
    } catch (err) {
        console.warn('[scorm-visual-v6] Legacy cover SVG generation failed', { message: err && err.message });
    }
    return { assets, coverAsset };
}

async function buildScormPackageZip(rawAnalysis, opts = {}) {
    const analysis = enrichAnalysis(rawAnalysis);
    const rasterMode = isRasterCourse(analysis);
    let assets = [];
    let coverAsset = null;

    // Critical architectural rule: once Gemini/FLUX has produced raster visuals,
    // the SVG generator must never run because it overwrites visualAsset.
    if (!rasterMode) {
        const legacy = await buildLegacySvgAssets(analysis, opts);
        assets = legacy.assets;
        coverAsset = legacy.coverAsset;

        const byIndex = new Map(assets.map((asset) => [asset.index, asset]));
        analysis.slides = analysis.slides.map((slide, index) => {
            const asset = byIndex.get(index);
            if (!asset) return slide;
            return {
                ...slide,
                layout: asset.layout || slide.layout,
                screenType: asset.screenType || slide.screenType,
                visualAsset: asset.desktopZipPath || asset.zipPath,
                mobileVisualAsset: asset.mobileZipPath || null
            };
        });
        if (coverAsset) {
            analysis.coverVisualAsset = coverAsset.desktopZipPath || coverAsset.zipPath;
            analysis.coverMobileVisualAsset = coverAsset.mobileZipPath || null;
        }
    }

    const allAssets = coverAsset ? [coverAsset, ...assets] : assets;
    const baseBuffer = await buildVisualPackage(analysis, opts);
    const zip = await JSZip.loadAsync(baseBuffer);

    allAssets.forEach((asset) => {
        zip.file(asset.desktopZipPath || asset.zipPath, asset.desktopBody || asset.body);
        if (asset.mobileZipPath && asset.mobileBody) zip.file(asset.mobileZipPath, asset.mobileBody);
    });

    if (allAssets.length) {
        zip.file('assets/visuals/visual-manifest.json', JSON.stringify({
            generatedBy: 'quizmoto-smart-svg-v6-legacy',
            responsive: true,
            visuals: allAssets.map((asset) => ({
                index: asset.index,
                role: asset.role || 'learning-slide',
                layout: asset.layout,
                screenType: asset.screenType,
                desktop: asset.desktopZipPath || asset.zipPath,
                mobile: asset.mobileZipPath || null
            }))
        }, null, 2));
    }

    const indexFile = zip.file('index.html');
    if (indexFile) {
        const html = await indexFile.async('string');
        zip.file('index.html', inject(html));
    }

    zip.file('content.json', JSON.stringify({
        ...analysis,
        generatedBy: 'quizmoto',
        generator: 'Quizmoto Course Experience V6',
        version: 6,
        experienceVersion: 6,
        screenTypes: SCREEN_TYPES,
        visualEngine: rasterMode ? 'gemini-prompted-flux-raster' : (allAssets.length ? 'legacy-smart-svg' : 'html-layout-only'),
        canonicalRasterVisuals: rasterMode,
        legacySvgFallback: !rasterMode && allAssets.length > 0
    }, null, 2));

    const manifestFile = zip.file('imsmanifest.xml');
    if (manifestFile && allAssets.length) {
        let manifest = await manifestFile.async('string');
        const paths = [];
        allAssets.forEach((asset) => {
            paths.push(asset.desktopZipPath || asset.zipPath);
            if (asset.mobileZipPath) paths.push(asset.mobileZipPath);
        });
        const entries = [...new Set(paths)].map((file) => `\n      <file href="${file}"/>`).join('');
        manifest = manifest.replace(/(\s*<\/resource>)/, `${entries}$1`);
        zip.file('imsmanifest.xml', manifest);
    }

    return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
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
    experienceCss,
    isRasterCourse,
    canonicalizeRasterAnalysis,
    isRasterPath,
    SCREEN_TYPES,
    BACKGROUNDS
};
