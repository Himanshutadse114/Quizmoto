const JSZip = require('jszip');
const { buildScormPackageZip: buildVisualPackage } = require('./ScormVisualPackageBuilder');
const { generateVisualAssets } = require('./ScormVisualAssetService');

const LAYOUTS = ['process', 'cards', 'timeline', 'comparison', 'hub', 'spotlight', 'matrix', 'cycle'];

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
    if (explicit?.type) return explicit;
    if (layout === 'process' || layout === 'timeline' || layout === 'cycle') {
        return { type: 'step_explore', prompt: 'Explore each stage to reinforce the sequence.' };
    }
    if (layout === 'hub' || layout === 'cards' || layout === 'matrix') {
        return { type: 'hotspot_explore', prompt: 'Select the numbered learning points to explore the concept.' };
    }
    if (layout === 'comparison') {
        return { type: 'compare_reveal', prompt: 'Compare recommended behaviour with common risk patterns.' };
    }
    return { type: 'focus_reveal', prompt: 'Review the key takeaway before continuing.' };
}

function enrichAnalysis(raw) {
    const analysis = raw && typeof raw === 'object' ? raw : {};
    const slides = Array.isArray(analysis.slides) ? analysis.slides : [];
    return {
        ...analysis,
        experienceVersion: 3,
        slides: slides.map((slide, index) => {
            const item = slide && typeof slide === 'object' ? slide : {};
            const layout = inferLayout(item, index);
            return {
                ...item,
                layout,
                visualTitle: String(item.visualTitle || item.title || `Section ${index + 1}`),
                interaction: interactionFor(item, layout)
            };
        })
    };
}

function injectExperienceCss(html) {
    const css = `
<style id="quizmoto-experience-v3">
.qmx-stage{width:min(1180px,100%);margin:auto}.qmx-frame{display:grid;grid-template-columns:minmax(280px,.72fr) minmax(420px,1.28fr);gap:24px;align-items:stretch}.qmx-frame.qmx-wide{grid-template-columns:1fr}.qmx-copy{background:#fff;border:1px solid var(--line);border-radius:26px;padding:26px;box-shadow:0 18px 50px rgba(15,23,42,.07);display:flex;flex-direction:column;justify-content:center}.qmx-kicker{font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:var(--primary);margin-bottom:8px}.qmx-copy h2{font-size:clamp(26px,2.8vw,40px);line-height:1.06;letter-spacing:-.03em;margin:0 0 13px}.qmx-copy p{font-size:14px;line-height:1.6;color:#475569;margin:0}.qmx-visual{position:relative;background:linear-gradient(145deg,#fff,var(--soft));border:1px solid var(--line);border-radius:26px;min-height:390px;padding:14px;display:grid;place-items:center;overflow:hidden;box-shadow:0 18px 50px rgba(15,23,42,.07)}.qmx-visual img{width:100%;height:100%;max-height:470px;object-fit:contain;display:block}.qmx-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:16px}.qmx-points{display:flex;flex-wrap:wrap;gap:8px}.qmx-point{appearance:none;border:1px solid #e2e8f0;background:#fff;color:#475569;border-radius:999px;padding:8px 11px;font-size:11px;font-weight:800;cursor:pointer;transition:.18s}.qmx-point:hover,.qmx-point.active{border-color:var(--primary);background:var(--soft);color:var(--primary-dark);transform:translateY(-1px)}.qmx-count{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;white-space:nowrap}.qmx-detail{margin-top:12px;padding:13px 15px;border-radius:16px;background:var(--soft);border-left:4px solid var(--primary);font-size:12px;line-height:1.5;font-weight:700;color:#334155;min-height:44px}.qmx-prompt{font-size:10px;color:#94a3b8;margin-top:9px;font-weight:700}.qmx-badge{position:absolute;right:14px;top:14px;background:rgba(255,255,255,.92);border:1px solid #e2e8f0;color:var(--primary);padding:7px 9px;border-radius:999px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.09em;box-shadow:0 7px 20px rgba(15,23,42,.08)}.qmx-fallback{padding:30px;text-align:center;color:#64748b;font-size:13px}.qmx-enter{animation:qmxIn .5s ease both}@keyframes qmxIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}@media(max-width:900px){.qmx-frame{grid-template-columns:1fr}.qmx-visual{min-height:280px}.qmx-copy{padding:20px}}@media(prefers-reduced-motion:reduce){.qmx-enter{animation:none}.qmx-point{transition:none}}
</style>`;
    return html.replace('</head>', `${css}\n</head>`);
}

function experienceScript() {
    return `
<script id="quizmoto-experience-v3-script">
(function(){
  function esc(s){var M={'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'};return String(s||'').replace(/[<>&"']/g,function(c){return M[c]||c})}
  function points(s){var a=Array.isArray(s.keyPoints)?s.keyPoints.filter(Boolean):[];if(!a.length&&s.content)a=[s.content];return a.slice(0,6)}
  function isWide(layout){return ['process','timeline','comparison','matrix','cycle'].indexOf(layout)>=0}
  function enhance(){
    var data=window.__quizmotoData;if(!data||!Array.isArray(data.slides))return;
    var slides=document.querySelectorAll('.slide');
    data.slides.forEach(function(s,i){
      var node=slides[i+1];if(!node)return;
      var stage=node.querySelector('.stage');if(!stage)return;
      var list=points(s),layout=String(s.layout||'cards'),asset=s.visualAsset||'';
      var frame=document.createElement('div');frame.className='qmx-stage qmx-enter';
      var pointButtons=list.map(function(p,n){return '<button type="button" class="qmx-point" data-index="'+n+'">'+(layout==='process'?'Step ':layout==='timeline'?'Stage ':'')+(n+1)+'</button>'}).join('');
      frame.innerHTML='<div class="qmx-frame '+(isWide(layout)?'qmx-wide':'')+'"><div class="qmx-copy"><div class="qmx-kicker">Section '+(i+1)+' · '+esc(layout)+'</div><h2>'+esc(s.title)+'</h2><p>'+esc(s.content)+'</p><div class="qmx-toolbar"><div class="qmx-points">'+pointButtons+'</div><div class="qmx-count" data-count>0 / '+list.length+' explored</div></div><div class="qmx-detail" data-detail>'+(list.length?'Select a learning point to explore it.':'Review the visual and continue when ready.')+'</div><div class="qmx-prompt">'+esc((s.interaction&&s.interaction.prompt)||'Explore the visual before continuing.')+'</div></div><div class="qmx-visual">'+(asset?'<img src="'+esc(asset)+'" alt="'+esc(s.visualTitle||s.title)+'"/>':'<div class="qmx-fallback">Visual asset unavailable. The learning content remains accessible.</div>')+'<div class="qmx-badge">Interactive visual</div></div></div>';
      stage.replaceWith(frame);
      var explored={};var detail=frame.querySelector('[data-detail]');var count=frame.querySelector('[data-count]');
      frame.querySelectorAll('.qmx-point').forEach(function(btn){btn.addEventListener('click',function(){var idx=Number(btn.getAttribute('data-index'));explored[idx]=true;frame.querySelectorAll('.qmx-point').forEach(function(b){b.classList.remove('active')});btn.classList.add('active');if(detail)detail.textContent=list[idx]||'';if(count)count.textContent=Object.keys(explored).length+' / '+list.length+' explored';})});
    });
  }
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
            generatedBy: 'quizmoto-python-vector-engine',
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
        version: 3,
        visualEngine: assets.length ? 'python-svg+html' : 'html-fallback'
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
    inferLayout
};
