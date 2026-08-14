const JSZip = require('jszip');
const { buildScormPackageZip: buildVisualPackage } = require('./ScormVisualPackageBuilder');
const { generateVisualAssets } = require('./ScormVisualAssetService');

const LAYOUTS = ['process', 'cards', 'timeline', 'comparison', 'hub', 'spotlight', 'matrix', 'cycle'];

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

function interactionFor(slide, layout) {
    const explicit = slide?.interaction && typeof slide.interaction === 'object' ? { ...slide.interaction } : null;
    if (explicit?.type) {
        return {
            ...explicit,
            prompt: cleanText(explicit.prompt) || 'Explore the visual before continuing.'
        };
    }
    if (layout === 'process' || layout === 'timeline' || layout === 'cycle') {
        return { type: 'step_explore', prompt: 'Explore each stage to reinforce the sequence.' };
    }
    if (layout === 'hub' || layout === 'cards' || layout === 'matrix') {
        return { type: 'hotspot_explore', prompt: 'Select the numbered learning points to explore the concept.' };
    }
    if (layout === 'comparison') {
        return { type: 'compare_reveal', prompt: 'Compare the recommended behaviour with the risk pattern.' };
    }
    return { type: 'focus_reveal', prompt: 'Review the key takeaway before continuing.' };
}

function polishQuiz(quiz) {
    return (Array.isArray(quiz) ? quiz : []).map((question) => {
        const item = question && typeof question === 'object' ? question : {};
        return {
            ...item,
            question: cleanText(item.question),
            options: (Array.isArray(item.options) ? item.options : []).map(cleanText),
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
        experienceVersion: 4,
        slides: slides.map((slide, index) => {
            const item = slide && typeof slide === 'object' ? slide : {};
            const layout = inferLayout(item, index);
            return {
                ...item,
                title: cleanText(item.title) || `Section ${index + 1}`,
                content: cleanText(item.content),
                keyPoints: dedupePoints(item.keyPoints),
                layout,
                visualTitle: cleanText(item.visualTitle || item.title || `Section ${index + 1}`),
                interaction: interactionFor(item, layout)
            };
        }),
        quiz: polishQuiz(analysis.quiz)
    };
}

function injectExperienceCss(html) {
    const css = `
<style id="quizmoto-experience-v4">
.qmx-stage{width:min(1280px,100%);margin:auto}
.qmx-frame{display:grid;grid-template-columns:minmax(320px,.72fr) minmax(520px,1.28fr);gap:24px;align-items:stretch}
.qmx-frame.qmx-wide{grid-template-columns:minmax(300px,.62fr) minmax(600px,1.38fr)}
.qmx-copy{border-radius:24px;padding:30px;display:flex;flex-direction:column;justify-content:center;min-width:0}
.qmx-kicker{font-size:11px;font-weight:750;letter-spacing:.11em;text-transform:uppercase;margin-bottom:10px}
.qmx-copy h2{font-size:clamp(28px,2.8vw,42px);line-height:1.04;letter-spacing:-.04em;margin:0 0 14px;text-wrap:balance}
.qmx-copy p{font-size:16px;line-height:1.65;margin:0;max-width:68ch}
.qmx-visual{position:relative;border-radius:24px;min-height:470px;padding:10px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.qmx-frame.qmx-wide .qmx-visual{min-height:490px}
.qmx-visual img{display:block;width:100%;height:100%;max-width:100%;max-height:500px;object-fit:contain;margin:auto;transform-origin:center}
.qmx-toolbar{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-top:20px;flex-wrap:wrap}
.qmx-points{display:flex;flex-wrap:wrap;gap:8px;min-width:0}
.qmx-point{appearance:none;border-radius:11px;padding:9px 12px;font-size:12px;font-weight:750;cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease,color .18s ease;position:relative}
.qmx-point.explored:after{content:"✓";font-size:10px;margin-left:6px;opacity:.82}
.qmx-count{font-size:10px;font-weight:750;text-transform:uppercase;letter-spacing:.09em;white-space:nowrap;padding-bottom:2px}
.qmx-count.is-complete{color:#6ee7b7!important}
.qmx-detail{margin-top:13px;padding:14px 16px;border-radius:15px;font-size:14px;line-height:1.55;font-weight:650;min-height:66px;display:flex;flex-direction:column;justify-content:center}
.qmx-detail-label{display:block;font-size:9px;line-height:1.2;text-transform:uppercase;letter-spacing:.11em;font-weight:800;opacity:.64;margin-bottom:5px}
.qmx-detail.is-updating{animation:qmxDetail .28s cubic-bezier(.16,1,.3,1)}
.qmx-prompt{font-size:11px;line-height:1.45;margin-top:10px;font-weight:600}
.qmx-badge{position:absolute;right:14px;top:14px;padding:7px 10px;border-radius:999px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.09em}
.qmx-fallback{padding:30px;text-align:center;font-size:13px;line-height:1.55;max-width:480px}
.qmx-enter{animation:qmxIn .46s cubic-bezier(.16,1,.3,1) both}
@keyframes qmxIn{from{opacity:0;transform:translateY(10px) scale(.994)}to{opacity:1;transform:none}}
@keyframes qmxDetail{0%{opacity:.55;transform:translateY(3px)}100%{opacity:1;transform:none}}
@media(max-width:1040px){
  .qmx-frame,.qmx-frame.qmx-wide{grid-template-columns:minmax(280px,.82fr) minmax(440px,1.18fr);gap:18px}
  .qmx-copy{padding:24px}.qmx-visual,.qmx-frame.qmx-wide .qmx-visual{min-height:410px}.qmx-visual img{max-height:430px}
}
@media(max-width:820px){
  .qmx-frame,.qmx-frame.qmx-wide{grid-template-columns:1fr}.qmx-copy{padding:21px}.qmx-visual,.qmx-frame.qmx-wide .qmx-visual{min-height:340px;order:2}.qmx-copy{order:1}.qmx-visual img{max-height:380px}.qmx-copy h2{font-size:clamp(26px,6vw,36px)}
}
@media(max-width:560px){
  .qmx-copy{padding:18px}.qmx-copy p{font-size:14px;line-height:1.6}.qmx-toolbar{align-items:flex-start;flex-direction:column}.qmx-points{width:100%}.qmx-point{flex:1 1 auto;min-width:68px}.qmx-count{white-space:normal}.qmx-visual,.qmx-frame.qmx-wide .qmx-visual{min-height:270px;padding:5px}.qmx-visual img{max-height:300px}.qmx-badge{right:9px;top:9px}
}
@media(prefers-reduced-motion:reduce){.qmx-enter,.qmx-detail.is-updating{animation:none!important}.qmx-point{transition:none!important}}
</style>`;
    return html.replace('</head>', `${css}\n</head>`);
}

function experienceScript() {
    return `
<script id="quizmoto-experience-v4-script">
(function(){
  function esc(s){var M={'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'};return String(s||'').replace(/[<>&"']/g,function(c){return M[c]||c})}
  function points(s){var a=Array.isArray(s.keyPoints)?s.keyPoints.filter(Boolean):[];if(!a.length&&s.content)a=[s.content];return a.slice(0,6)}
  function pointName(layout,n){if(layout==='process')return 'Step '+(n+1);if(layout==='timeline')return 'Stage '+(n+1);if(layout==='cycle')return 'Phase '+(n+1);if(layout==='comparison')return n===0?'Recommended':n===1?'Watch out':'Point '+(n+1);return 'Point '+(n+1)}
  function enhanceLearningSlides(data){
    var slides=document.querySelectorAll('.slide');
    data.slides.forEach(function(s,i){
      var node=slides[i+1];if(!node)return;
      var stage=node.querySelector('.stage');if(!stage)return;
      var list=points(s),layout=String(s.layout||'cards'),asset=s.visualAsset||'';
      var frame=document.createElement('div');frame.className='qmx-stage qmx-enter';
      var pointButtons=list.map(function(p,n){var label=pointName(layout,n);return '<button type="button" class="qmx-point" data-index="'+n+'" aria-label="Explore '+esc(label)+': '+esc(p)+'">'+esc(label)+'</button>'}).join('');
      frame.innerHTML='<div class="qmx-frame '+(['process','timeline','comparison','matrix','cycle'].indexOf(layout)>=0?'qmx-wide':'')+'"><div class="qmx-copy"><div class="qmx-kicker">Section '+(i+1)+' · '+esc(layout)+'</div><h2>'+esc(s.title)+'</h2><p>'+esc(s.content)+'</p><div class="qmx-toolbar"><div class="qmx-points" role="group" aria-label="Explore learning points">'+pointButtons+'</div><div class="qmx-count" data-count aria-live="polite">0 / '+list.length+' explored</div></div><div class="qmx-detail" data-detail role="status" aria-live="polite"><span class="qmx-detail-label">Explore the visual</span><span data-detail-text>'+(list.length?'Choose a learning point to reveal its detail.':'Review the visual and continue when ready.')+'</span></div><div class="qmx-prompt">'+esc((s.interaction&&s.interaction.prompt)||'Explore the visual before continuing.')+'</div></div><div class="qmx-visual">'+(asset?'<img src="'+esc(asset)+'" alt="'+esc(s.visualTitle||s.title)+'" loading="eager" decoding="async"/>':'<div class="qmx-fallback">The visual could not be generated. The full learning explanation is still available on this screen.</div>')+'<div class="qmx-badge">Interactive visual</div></div></div>';
      stage.replaceWith(frame);
      var explored={},detail=frame.querySelector('[data-detail]'),detailText=frame.querySelector('[data-detail-text]'),detailLabel=frame.querySelector('.qmx-detail-label'),count=frame.querySelector('[data-count]'),buttons=Array.prototype.slice.call(frame.querySelectorAll('.qmx-point'));
      function selectPoint(idx,focus){
        if(idx<0||idx>=buttons.length)return;
        explored[idx]=true;
        buttons.forEach(function(b,n){b.classList.toggle('active',n===idx);b.setAttribute('aria-pressed',n===idx?'true':'false')});
        buttons[idx].classList.add('explored');
        if(detailLabel)detailLabel.textContent=pointName(layout,idx);
        if(detailText)detailText.textContent=list[idx]||'';
        if(detail){detail.classList.remove('is-updating');void detail.offsetWidth;detail.classList.add('is-updating')}
        var exploredCount=Object.keys(explored).length;
        if(count){count.textContent=exploredCount+' / '+list.length+' explored';count.classList.toggle('is-complete',exploredCount===list.length&&list.length>0)}
        if(focus)buttons[idx].focus();
      }
      buttons.forEach(function(btn,n){
        btn.setAttribute('aria-pressed','false');
        btn.addEventListener('click',function(){selectPoint(n,false)});
        btn.addEventListener('keydown',function(event){
          if(event.key!=='ArrowRight'&&event.key!=='ArrowLeft')return;
          event.preventDefault();
          var next=event.key==='ArrowRight'?(n+1)%buttons.length:(n-1+buttons.length)%buttons.length;
          selectPoint(next,true);
        });
      });
      var image=frame.querySelector('.qmx-visual img');
      if(image)image.addEventListener('error',function(){var visual=frame.querySelector('.qmx-visual');if(visual)visual.innerHTML='<div class="qmx-fallback">The visual could not be displayed. Use the explanation and learning points on this screen to continue.</div>'});
    });
  }
  function enhanceQuiz(data){
    document.querySelectorAll('.quiz-option').forEach(function(btn){
      btn.setAttribute('aria-pressed','false');
      btn.addEventListener('click',function(){
        var qi=Number(btn.getAttribute('data-qi')),oi=Number(btn.getAttribute('data-oi')),q=(data.quiz||[])[qi]||{},correct=Number(q.correctAnswer);
        var container=document.getElementById('opts-'+qi),feedback=document.getElementById('fb-'+qi);
        if(container)container.querySelectorAll('.quiz-option').forEach(function(option,n){option.setAttribute('aria-pressed',n===oi?'true':'false')});
        if(feedback){feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');if(q.explanation){setTimeout(function(){feedback.textContent=(oi===correct?'Correct. ':'Review this. ')+String(q.explanation)},0)}}
      });
    });
  }
  function enhanceCompletion(data){
    var card=document.querySelector('.final-card');if(!card)return;
    var lead=card.querySelector('.lead');
    if(lead)lead.textContent='You have completed '+(data.slides||[]).length+' learning sections and '+(data.quiz||[]).length+' knowledge checks. Finish the course to save your final result.';
  }
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
    return html.replace('</body>', `${experienceScript()}\n</body>`);
}

async function buildScormPackageZip(rawAnalysis, opts = {}) {
    const analysis = enrichAnalysis(rawAnalysis);
    let assets = [];
    try {
        assets = await generateVisualAssets(analysis);
    } catch (err) {
        console.warn('[scorm-visual] Python vector generation failed; continuing with HTML visuals', {
            message: err && err.message
        });
    }

    const byIndex = new Map(assets.map((asset) => [asset.index, asset]));
    analysis.slides = analysis.slides.map((slide, index) => {
        const asset = byIndex.get(index);
        return asset
            ? { ...slide, layout: asset.layout || slide.layout, visualAsset: asset.zipPath }
            : slide;
    });

    const baseBuffer = await buildVisualPackage(analysis, opts);
    const zip = await JSZip.loadAsync(baseBuffer);

    assets.forEach((asset) => zip.file(asset.zipPath, asset.body));
    if (assets.length) {
        zip.file('assets/visuals/visual-manifest.json', JSON.stringify({
            generatedBy: 'quizmoto-python-vector-engine-v4',
            visuals: assets.map(({ index, layout, file, zipPath }) => ({ index, layout, file, zipPath }))
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
        generator: 'Quizmoto Visual Experience Author',
        version: 4,
        visualEngine: assets.length ? 'python-svg-v4+html' : 'html-fallback'
    }, null, 2));

    const manifestFile = zip.file('imsmanifest.xml');
    if (manifestFile && assets.length) {
        let manifest = await manifestFile.async('string');
        const fileEntries = assets.map((asset) => `\n      <file href="${asset.zipPath}"/>`).join('');
        manifest = manifest.replace(/(\s*<\/resource>)/, `${fileEntries}$1`);
        zip.file('imsmanifest.xml', manifest);
    }

    // Intermediate ZIP: defer CPU-heavy DEFLATE to the final tracking layer.
    return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}

module.exports = {
    buildScormPackageZip,
    enrichAnalysis,
    inferLayout,
    dedupePoints,
    cleanText
};
