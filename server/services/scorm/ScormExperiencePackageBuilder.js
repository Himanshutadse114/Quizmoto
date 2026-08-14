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
    if (/likelihood|impact|risk matrix|severity/.test(text)) return 'matrix';
    if (/cycle|continuous|repeat|ongoing/.test(text)) return 'cycle';
    if (/step|process|workflow|how .* works|lifecycle|flow/.test(text)) return 'process';
    if (/before|after|versus| vs |do and don|good|bad|safe|unsafe|compare/.test(text)) return 'comparison';
    if (/timeline|history|phase|stage|sequence|journey/.test(text)) return 'timeline';
    if (/types|pillars|principles|elements|areas|components|categories/.test(text)) return 'hub';
    if (/warning|risk|important|remember|critical|key takeaway/.test(text)) return 'spotlight';
    return ['cards', 'process', 'hub', 'timeline', 'spotlight', 'comparison'][index % 6];
}

function inferScreenType(slide, layout, index) {
    const explicit = String(slide?.screenType || '').trim().toLowerCase();
    if (SCREEN_TYPES.includes(explicit)) return explicit;
    if (layout === 'process' || layout === 'cycle') return 'process';
    if (layout === 'timeline') return 'timeline';
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
    if (explicit) return explicit;
    const text = `${slide?.title || ''} ${slide?.content || ''}`.toLowerCase();
    if (/email|phish|inbox|message/.test(text)) return 'email';
    if (/password|credential|login|authentication|mfa|passkey/.test(text)) return 'lock';
    if (/phone|sms|whatsapp|call|mobile/.test(text)) return 'phone';
    if (/ransom|file|attachment|document/.test(text)) return 'file';
    if (/cloud|share|drive/.test(text)) return 'cloud';
    if (/identity|account|employee|user/.test(text)) return 'identity';
    if (/voice|deepfake|audio|synthetic| ai /.test(` ${text} `)) return 'ai-wave';
    if (/qr|code/.test(text)) return 'qr';
    if (/browser|website|url|link/.test(text)) return 'browser';
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
.qmx-bg-grid:before{background-image:linear-gradient(color-mix(in srgb,var(--accent) 5%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--accent) 5%,transparent) 1px,transparent 1px);background-size:32px 32px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.85),transparent)}
.qmx-bg-orbit:before{background:radial-gradient(circle at 72% 45%,transparent 0 90px,color-mix(in srgb,var(--accent) 8%,transparent) 91px 92px,transparent 93px 145px,color-mix(in srgb,var(--accent) 6%,transparent) 146px 147px,transparent 148px)}
.qmx-bg-waves:before{background:radial-gradient(ellipse at 72% 80%,color-mix(in srgb,var(--accent) 12%,transparent),transparent 35rem)}
.qmx-bg-focus:before{background:radial-gradient(circle at 70% 45%,color-mix(in srgb,var(--primary) 20%,transparent),transparent 23rem)}
.qmx-frame{display:grid;grid-template-columns:minmax(300px,.72fr) minmax(520px,1.28fr);grid-template-areas:"copy visual" "interaction visual";gap:18px 24px;align-items:start}
.qmx-copy{grid-area:copy;align-self:end;padding:28px 28px 22px;min-width:0}
.qmx-kicker{font-size:10px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;margin-bottom:10px}
.qmx-copy h2{font-size:clamp(30px,3vw,46px);line-height:1.01;letter-spacing:-.05em;margin:0 0 14px;text-wrap:balance}
.qmx-copy p{font-size:16px;line-height:1.62;margin:0;max-width:62ch}
.qmx-visual{grid-area:visual;position:relative;border-radius:28px;min-height:500px;padding:0;overflow:hidden;display:flex;align-items:center;justify-content:center}
.qmx-visual picture{display:block;width:100%;height:100%}.qmx-visual img{display:block;width:100%;height:auto;max-width:100%;max-height:540px;object-fit:contain;margin:auto}
.qmx-visual-label{position:absolute;left:16px;bottom:14px;display:flex;gap:6px;align-items:center;padding:7px 10px;border-radius:999px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;backdrop-filter:blur(12px)}
.qmx-interaction{grid-area:interaction;align-self:start;padding:0 4px 8px}
.qmx-prompt{font-size:12px;line-height:1.45;font-weight:650;margin:0 0 10px}
.qmx-points{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.qmx-point{appearance:none;min-height:46px;border-radius:13px;padding:10px 12px;font-size:12px;font-weight:750;cursor:pointer;text-align:left;transition:transform .18s ease,border-color .18s ease,background .18s ease,color .18s ease}
.qmx-point-index{display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:7px;margin-right:7px;font-size:9px;font-weight:850;vertical-align:middle}
.qmx-point.explored:after{content:"✓";float:right;margin-left:6px;opacity:.82}
.qmx-count{font-size:10px;font-weight:750;text-transform:uppercase;letter-spacing:.08em;margin-top:10px}
.qmx-reveal{margin-top:11px;padding:14px 15px;border-radius:16px;font-size:13.5px;line-height:1.55;min-height:60px;transition:opacity .2s ease,transform .2s ease}
.qmx-reveal[hidden]{display:block!important;opacity:0;transform:translateY(5px);pointer-events:none;min-height:0;padding-top:0;padding-bottom:0;border-width:0;margin-top:0;overflow:hidden}
.qmx-reveal-label{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.11em;font-weight:850;margin-bottom:5px;opacity:.7}
.qmx-type-takeaway .qmx-frame{grid-template-columns:minmax(280px,.62fr) minmax(560px,1.38fr)}
.qmx-type-takeaway .qmx-visual{min-height:520px}.qmx-type-scenario .qmx-copy{border-left:3px solid var(--accent)}
.qmx-type-hotspot .qmx-visual,.qmx-type-scenario .qmx-visual{min-height:520px}
.qmx-enter{animation:qmxIn .46s cubic-bezier(.16,1,.3,1) both}
@keyframes qmxIn{from{opacity:0;transform:translateY(9px) scale(.995)}to{opacity:1;transform:none}}
@media(max-width:1040px){.qmx-frame{grid-template-columns:minmax(270px,.82fr) minmax(430px,1.18fr);gap:16px}.qmx-copy{padding:22px}.qmx-visual{min-height:430px}.qmx-visual img{max-height:460px}}
@media(max-width:820px){
  .qmx-frame,.qmx-type-takeaway .qmx-frame{grid-template-columns:1fr;grid-template-areas:"copy" "visual" "interaction";gap:13px}
  .qmx-copy{padding:20px}.qmx-copy h2{font-size:clamp(27px,6vw,37px)}.qmx-copy p{font-size:15px}
  .qmx-visual,.qmx-type-takeaway .qmx-visual,.qmx-type-hotspot .qmx-visual,.qmx-type-scenario .qmx-visual{min-height:360px}
  .qmx-visual img{max-height:410px}.qmx-interaction{padding:0}.qmx-points{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:560px){
  .qmx-screen:before{inset:-12px;border-radius:25px}.qmx-frame{gap:11px}.qmx-copy{padding:17px;border-radius:19px!important}.qmx-kicker{font-size:10px}.qmx-copy h2{font-size:clamp(25px,7vw,32px);margin-bottom:10px}.qmx-copy p{font-size:14.5px;line-height:1.58}
  .qmx-visual,.qmx-type-takeaway .qmx-visual,.qmx-type-hotspot .qmx-visual,.qmx-type-scenario .qmx-visual{min-height:0!important;border-radius:20px!important}.qmx-visual picture{height:auto}.qmx-visual img{width:100%!important;height:auto!important;max-height:none!important;object-fit:contain!important}
  .qmx-visual-label{left:10px;bottom:9px;font-size:8.5px;padding:6px 8px}.qmx-points{grid-template-columns:1fr 1fr;gap:7px}.qmx-point{min-height:46px;font-size:12px;padding:9px}.qmx-prompt{font-size:11.5px}.qmx-reveal{font-size:13px;padding:12px 13px}
}
@media(prefers-reduced-motion:reduce){.qmx-enter{animation:none!important}.qmx-point,.qmx-reveal{transition:none!important}}
</style>`;
    return html.includes('</head>') ? html.replace('</head>', `${css}\n</head>`) : `${css}\n${html}`;
}

function experienceScript() {
    return `
<script id="quizmoto-experience-v5-script">
(function(){
  function esc(s){var M={'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'};return String(s||'').replace(/[<>&"']/g,function(c){return M[c]||c})}
  function pointLabel(s,n){var t=String(s.screenType||'');var l=String(s.layout||'');if(t==='scenario')return 'Option '+(n+1);if(l==='process')return 'Step '+(n+1);if(l==='timeline')return 'Stage '+(n+1);if(l==='cycle')return 'Phase '+(n+1);if(l==='comparison')return n===0?'Recommended':n===1?'Watch out':'Signal '+(n+1);return 'Explore '+(n+1)}
  function buildPicture(s){
    var desktop=s.visualAsset||'',mobile=s.mobileVisualAsset||'';
    if(!desktop)return '<div class="qmx-fallback">The visual could not be generated. Use the learning content on this screen to continue.</div>';
    return '<picture>'+(mobile?'<source media="(max-width:680px)" srcset="'+esc(mobile)+'">':'')+'<img src="'+esc(desktop)+'" alt="'+esc(s.visualTitle||s.title)+'" loading="eager" decoding="async"></picture>';
  }
  function enhanceLearningSlides(data){
    var slides=document.querySelectorAll('.slide');
    (data.slides||[]).forEach(function(s,i){
      var node=slides[i+1];if(!node)return;var stage=node.querySelector('.stage');if(!stage)return;
      var list=Array.isArray(s.keyPoints)?s.keyPoints.filter(Boolean).slice(0,6):[];
      var type=String(s.screenType||'concept'),bg=String(s.backgroundStyle||'mesh');
      var buttons=list.map(function(p,n){return '<button type="button" class="qmx-point" data-index="'+n+'" aria-label="'+esc(pointLabel(s,n))+': '+esc(p)+'"><span class="qmx-point-index">'+(n+1)+'</span>'+esc(pointLabel(s,n))+'</button>'}).join('');
      if(!buttons&&(s.revealText||s.content))buttons='<button type="button" class="qmx-point qmx-single-reveal" data-index="0"><span class="qmx-point-index">+</span>Reveal insight</button>';
      var frame=document.createElement('div');frame.className='qmx-stage qmx-screen qmx-type-'+type+' qmx-bg-'+bg+' qmx-enter';
      frame.innerHTML='<div class="qmx-frame"><section class="qmx-copy"><div class="qmx-kicker">Section '+(i+1)+' · '+esc(type)+'</div><h2>'+esc(s.title)+'</h2><p>'+esc(s.introText||s.content||'')+'</p></section><section class="qmx-visual" tabindex="0" role="group" aria-label="'+esc(s.visualTitle||s.title)+'">'+buildPicture(s)+'<div class="qmx-visual-label">Interactive learning visual</div></section><section class="qmx-interaction"><p class="qmx-prompt">'+esc((s.interaction&&s.interaction.prompt)||'Explore the visual to continue learning.')+'</p><div class="qmx-points" role="group" aria-label="Learning interaction">'+buttons+'</div><div class="qmx-count" data-count aria-live="polite">'+(list.length?'0 / '+list.length+' explored':'Reveal the insight')+'</div><div class="qmx-reveal" data-reveal role="status" aria-live="polite" hidden><span class="qmx-reveal-label">Learning detail</span><span data-reveal-text></span></div></section></div>';
      stage.replaceWith(frame);
      var explored={},all=Array.prototype.slice.call(frame.querySelectorAll('.qmx-point')),reveal=frame.querySelector('[data-reveal]'),revealText=frame.querySelector('[data-reveal-text]'),count=frame.querySelector('[data-count]');
      function activate(idx,focus){
        if(idx<0||idx>=all.length)return;explored[idx]=true;
        all.forEach(function(b,n){b.classList.toggle('active',n===idx);b.setAttribute('aria-pressed',n===idx?'true':'false')});all[idx].classList.add('explored');
        var detail=list[idx]||s.revealText||s.content||'';var suffix=s.revealText&&list[idx]?(' '+String(s.revealText)) : '';
        if(revealText)revealText.textContent=String(detail)+suffix;if(reveal)reveal.hidden=false;
        var done=Object.keys(explored).length;if(count)count.textContent=list.length?done+' / '+list.length+' explored':'Insight revealed';if(focus)all[idx].focus();
      }
      all.forEach(function(btn,n){btn.setAttribute('aria-pressed','false');btn.addEventListener('click',function(){activate(n,false)});btn.addEventListener('keydown',function(e){if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;e.preventDefault();var next=e.key==='ArrowRight'?(n+1)%all.length:(n-1+all.length)%all.length;activate(next,true)})});
      var image=frame.querySelector('.qmx-visual img');if(image)image.addEventListener('error',function(){var visual=frame.querySelector('.qmx-visual');if(visual)visual.innerHTML='<div class="qmx-fallback">The visual could not be displayed. The learning text and interactions remain available.</div>'});
    });
  }
  function enhanceQuiz(data){document.querySelectorAll('.quiz-option').forEach(function(btn){btn.setAttribute('aria-pressed','false');btn.addEventListener('click',function(){var qi=Number(btn.getAttribute('data-qi')),oi=Number(btn.getAttribute('data-oi')),q=(data.quiz||[])[qi]||{},correct=Number(q.correctAnswer),container=document.getElementById('opts-'+qi),feedback=document.getElementById('fb-'+qi);if(container)container.querySelectorAll('.quiz-option').forEach(function(option,n){option.setAttribute('aria-pressed',n===oi?'true':'false')});if(feedback){feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');if(q.explanation)setTimeout(function(){feedback.textContent=(oi===correct?'Correct. ':'Review this. ')+String(q.explanation)},0)}})})}
  function enhanceCompletion(data){var card=document.querySelector('.final-card');if(!card)return;var lead=card.querySelector('.lead');if(lead)lead.textContent='You have completed '+(data.slides||[]).length+' learning experiences and '+(data.quiz||[]).length+' knowledge checks. Finish the course to save your final result.'}
  function enhance(){var data=window.__quizmotoData;if(!data||!Array.isArray(data.slides))return;enhanceLearningSlides(data);enhanceQuiz(data);enhanceCompletion(data)}
  if(document.readyState==='complete')setTimeout(enhance,0);else window.addEventListener('load',function(){setTimeout(enhance,0)});
})();
</script>`;
}

function exposeData(html) {
    if (html.includes('window.__quizmotoData')) return html;
    return html.replace('var data=', 'var data=window.__quizmotoData=');
}

function injectExperienceScript(html) {
    return html.includes('</body>') ? html.replace('</body>', `${experienceScript()}\n</body>`) : `${html}\n${experienceScript()}`;
}

async function buildScormPackageZip(rawAnalysis, opts = {}) {
    const analysis = enrichAnalysis(rawAnalysis);
    let assets = [];
    try {
        assets = await generateVisualAssets(analysis);
    } catch (err) {
        console.warn('[scorm-visual-v5] Responsive vector generation failed; continuing with HTML fallback', { message: err && err.message });
    }

    const byIndex = new Map(assets.map((asset) => [asset.index, asset]));
    analysis.slides = analysis.slides.map((slide, index) => {
        const asset = byIndex.get(index);
        return asset ? {
            ...slide,
            layout: asset.layout || slide.layout,
            screenType: asset.screenType || slide.screenType,
            visualAsset: asset.desktopZipPath || asset.zipPath,
            mobileVisualAsset: asset.mobileZipPath || null
        } : slide;
    });

    const baseBuffer = await buildVisualPackage(analysis, opts);
    const zip = await JSZip.loadAsync(baseBuffer);

    assets.forEach((asset) => {
        zip.file(asset.desktopZipPath || asset.zipPath, asset.desktopBody || asset.body);
        if (asset.mobileZipPath && asset.mobileBody) zip.file(asset.mobileZipPath, asset.mobileBody);
    });

    if (assets.length) {
        zip.file('assets/visuals/visual-manifest.json', JSON.stringify({
            generatedBy: 'quizmoto-responsive-vector-engine-v5',
            responsive: true,
            visuals: assets.map((asset) => ({
                index: asset.index,
                layout: asset.layout,
                screenType: asset.screenType,
                desktop: asset.desktopZipPath || asset.zipPath,
                mobile: asset.mobileZipPath || null
            }))
        }, null, 2));
    }

    const indexFile = zip.file('index.html');
    if (indexFile) {
        let html = await indexFile.async('string');
        html = exposeData(html);
        html = injectExperienceCss(html);
        html = injectExperienceScript(html);
        zip.file('index.html', html);
    }

    zip.file('content.json', JSON.stringify({
        ...analysis,
        generatedBy: 'quizmoto',
        generator: 'Quizmoto Course Experience V5',
        version: 5,
        experienceVersion: 5,
        screenTypes: SCREEN_TYPES,
        visualEngine: assets.length ? 'python-svg-v5-responsive+html' : 'html-fallback',
        responsiveVisuals: Boolean(assets.some((asset) => asset.mobileZipPath)),
        progressiveDisclosure: true
    }, null, 2));

    const manifestFile = zip.file('imsmanifest.xml');
    if (manifestFile && assets.length) {
        let manifest = await manifestFile.async('string');
        const uniquePaths = [];
        assets.forEach((asset) => {
            uniquePaths.push(asset.desktopZipPath || asset.zipPath);
            if (asset.mobileZipPath) uniquePaths.push(asset.mobileZipPath);
        });
        const fileEntries = [...new Set(uniquePaths)].map((file) => `\n      <file href="${file}"/>`).join('');
        manifest = manifest.replace(/(\s*<\/resource>)/, `${fileEntries}$1`);
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
    SCREEN_TYPES,
    BACKGROUNDS
};
