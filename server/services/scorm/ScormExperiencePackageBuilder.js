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
    if (explicit && !['identity', 'shield', 'warning'].includes(explicit)) return explicit;
    const text = `${slide?.title || ''} ${slide?.content || ''} ${(Array.isArray(slide?.keyPoints) ? slide.keyPoints.join(' ') : '')}`.toLowerCase();
    const layout = String(slide?.layout || '').toLowerCase();
    if (/autonomous|ai agent|machine learning|\bml\b|deep learning|decision support|\bedss\b|predictive|forecast|business intelligence/.test(text)) {
        if (/cloud|integration|data source/.test(text)) return 'cloud';
        return 'shield';
    }
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

function experienceCss() {
    return [
        '<style id="quizmoto-smart-visual-v5">',
        '.spot-visual,.hero-art{padding:0!important;overflow:hidden!important;display:flex!important;align-items:stretch!important;justify-content:stretch!important}',
        '.spot-visual:before,.spot-visual:after,.hero-art:before,.hero-art:after{display:none!important}',
        '.spot-visual img,.hero-art img,.qmx-smart-visual{width:100%!important;height:100%!important;object-fit:cover!important;display:block!important;border-radius:inherit}',
        '.spot-visual svg:not(.keep-icon),.hero-core svg{display:none!important}',
        '.hero-core{inset:0!important;display:block!important}',
        '.process{gap:36px!important;overflow:visible!important;align-items:stretch!important}',
        '.process .step{position:relative!important;overflow:visible!important}',
        '.process .step:not(:last-child):after{content:"\\2192"!important;position:absolute!important;right:-26px!important;top:50%!important;transform:translateY(-50%)!important;width:24px!important;height:24px!important;border-radius:50%!important;display:grid!important;place-items:center!important;font-size:12px!important;font-weight:900!important;line-height:1!important;z-index:3!important;box-shadow:0 0 0 4px var(--gamma-paper,var(--bg,#E7E7E4))!important}',
        '.hub-svg{overflow:visible!important}',
        '.hub-wrap{overflow:visible!important}',
        '@media(max-width:900px){.process{gap:14px!important}.process .step:not(:last-child):after{display:none!important}}',
        '</style>'
    ].join('');
}

function experienceScript() {
    return [
        '<script id="quizmoto-experience-v5-script">',
        '(function(){',
        "function esc(s){var M={'<':'&'+'lt;','>':'&'+'gt;','&':'&'+'amp;','\"':'&'+'quot;',\"'\":'&'+'#39;'};return String(s||'').replace(/[<>&\"']/g,function(c){return M[c]||c})}",
        'function pictureFor(s){',
        "  var d=s&&s.visualAsset?String(s.visualAsset):'';",
        "  var m=s&&s.mobileVisualAsset?String(s.mobileVisualAsset):'';",
        "  if(!d)return '';",
        "  return '<picture>'+(m?'<source media=\"(max-width:680px)\" srcset=\"'+esc(m)+'\">':'')+'<img class=\"qmx-smart-visual\" src=\"'+esc(d)+'\" alt=\"'+esc((s&&s.visualTitle)||(s&&s.title)||'Learning visual')+'\" loading=\"eager\" decoding=\"async\"></picture>';",
        '}',
        'function fixHubSvg(){',
        '  document.querySelectorAll("svg.hub-svg").forEach(function(svg){',
        '    if(svg.getAttribute("data-hub-fixed"))return;',
        '    var circles=svg.querySelectorAll("circle");',
        '    if(!circles.length)return;',
        '    var center=null,cr=0;',
        '    circles.forEach(function(c){var r=parseFloat(c.getAttribute("r"))||0;if(r>cr){cr=r;center=c;}});',
        '    if(!center||cr<40)return;',
        '    var cx=parseFloat(center.getAttribute("cx"))||160,cy=parseFloat(center.getAttribute("cy"))||160;',
        '    svg.querySelectorAll("line").forEach(function(line){',
        '      var x2=parseFloat(line.getAttribute("x2")),y2=parseFloat(line.getAttribute("y2"));',
        '      var dx=x2-cx,dy=y2-cy,len=Math.sqrt(dx*dx+dy*dy)||1;',
        '      var nx=dx/len,ny=dy/len,nodeR=28;',
        '      line.setAttribute("x1",(cx+nx*(cr+2)).toFixed(1));',
        '      line.setAttribute("y1",(cy+ny*(cr+2)).toFixed(1));',
        '      if(len>cr+nodeR+4){line.setAttribute("x2",(cx+nx*(len-nodeR)).toFixed(1));line.setAttribute("y2",(cy+ny*(len-nodeR)).toFixed(1));}',
        '      line.setAttribute("stroke-width","3.5");line.setAttribute("opacity",".55");',
        '    });',
        '    var centerTexts=[];',
        '    svg.querySelectorAll("text").forEach(function(t){',
        '      var x=parseFloat(t.getAttribute("x"))||0,y=parseFloat(t.getAttribute("y"))||0;',
        '      if(Math.abs(x-cx)<8&&Math.abs(y-cy)<30)centerTexts.push(t);',
        '    });',
        '    svg.appendChild(center);centerTexts.forEach(function(t){svg.appendChild(t);});',
        '    svg.setAttribute("data-hub-fixed","1");',
        '  });',
        '}',
        'function enhance(){',
        '  var data=window.__quizmotoData;if(!data||!Array.isArray(data.slides))return;',
        '  var slides=document.querySelectorAll(".slide");',
        '  data.slides.forEach(function(s,i){',
        '    var node=slides[i+1];if(!node)return;',
        '    var html=pictureFor(s);if(!html)return;',
        '    var targets=node.querySelectorAll(".spot-visual,.hero-art,.hero-core");',
        '    targets.forEach(function(el){el.innerHTML=html;});',
        '  });',
        '  var intro=slides[0];',
        '  if(intro){',
        '    var art=intro.querySelector(".hero-art,.hero-core");',
        '    var cover={visualAsset:data.coverVisualAsset,mobileVisualAsset:data.coverMobileVisualAsset,visualTitle:data.title,title:data.title};',
        '    var html=pictureFor(cover)||(data.slides[0]?pictureFor(data.slides[0]):"");',
        '    if(art&&html)art.innerHTML=html;',
        '    var chips=intro.querySelector(".kp-row");',
        '    if(chips){',
        '      var sectionCount=(data.slides||[]).length,checkCount=(data.quiz||[]).length;',
        '      var labels=[sectionCount+" learning section"+(sectionCount===1?"":"s"),checkCount+" knowledge check"+(checkCount===1?"":"s"),"Tracked completion"];',
        '      chips.innerHTML=labels.map(function(label){return "<span class=\"chip\">"+esc(label)+"</span>";}).join("");',
        '    }',
        '  }',
        '  fixHubSvg();',
        '}',
        "if(document.readyState==='complete')setTimeout(enhance,0);else window.addEventListener('load',function(){setTimeout(enhance,0)});",
        'setTimeout(fixHubSvg,50);setTimeout(fixHubSvg,400);',
        '})();',
        '</'+'script>'
    ].join('');
}

function exposeData(html) {
    if (html.includes('window.__quizmotoData')) return html;
    return html.replace('var data=', 'var data=window.__quizmotoData=');
}

function inject(html) {
    let out = exposeData(String(html || ''));
    if (!out.includes('quizmoto-smart-visual-v5')) {
        out = out.includes('</head>') ? out.replace('</head>', experienceCss() + '\n</head>') : experienceCss() + '\n' + out;
    }
    if (!out.includes('quizmoto-experience-v5-script')) {
        out = out.includes('</body>') ? out.replace('</body>', experienceScript() + '\n</body>') : out + '\n' + experienceScript();
    }
    return out;
}

async function buildScormPackageZip(rawAnalysis, opts = {}) {
    const analysis = enrichAnalysis(rawAnalysis);
    let assets = [];
    let coverAsset = null;
    try {
        assets = await generateVisualAssets(analysis, opts);
    } catch (err) {
        console.warn('[scorm-visual-v5] Smart SVG generation failed; continuing with HTML fallback', { message: err && err.message });
    }
    try {
        coverAsset = generateCourseCoverAsset(analysis);
    } catch (err) {
        console.warn('[scorm-visual-v5] Course cover generation failed; falling back to first learning visual', { message: err && err.message });
    }

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

    const allAssets = coverAsset ? [coverAsset, ...assets] : assets;
    const baseBuffer = await buildVisualPackage(analysis, opts);
    const zip = await JSZip.loadAsync(baseBuffer);

    allAssets.forEach((asset) => {
        zip.file(asset.desktopZipPath || asset.zipPath, asset.desktopBody || asset.body);
        if (asset.mobileZipPath && asset.mobileBody) zip.file(asset.mobileZipPath, asset.mobileBody);
    });

    if (allAssets.length) {
        zip.file('assets/visuals/visual-manifest.json', JSON.stringify({
            generatedBy: 'quizmoto-smart-svg-v5',
            responsive: true,
            visuals: allAssets.map((asset) => ({
                index: asset.index,
                role: asset.role || 'learning-slide',
                layout: asset.layout,
                screenType: asset.screenType,
                desktop: asset.desktopZipPath || asset.zipPath,
                mobile: asset.mobileZipPath || null,
                scene: asset.sceneSpec && asset.sceneSpec.scene
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
        generator: 'Quizmoto Course Experience V5',
        version: 5,
        experienceVersion: 5,
        screenTypes: SCREEN_TYPES,
        visualEngine: allAssets.length ? 'gemini-smart-svg' : 'html-fallback',
        responsiveVisuals: Boolean(allAssets.some((asset) => asset.mobileZipPath))
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
    SCREEN_TYPES,
    BACKGROUNDS
};
