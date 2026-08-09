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
        return { type: 'hotspot_explore', prompt: 'Explore each learning point before continuing.' };
    }
    if (layout === 'comparison') {
        return { type: 'compare_reveal', prompt: 'Compare the recommended and risky behaviours.' };
    }
    return { type: 'focus_reveal', prompt: 'Review the key idea before continuing.' };
}

function enrichAnalysis(raw) {
    const analysis = raw && typeof raw === 'object' ? raw : {};
    const slides = Array.isArray(analysis.slides) ? analysis.slides : [];
    return {
        ...analysis,
        experienceVersion: 4,
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
<style id="quizmoto-experience-v4">
.qmx-stage{width:min(1280px,100%);height:100%;max-height:680px;margin:auto;display:flex;align-items:center;justify-content:center;min-height:0}
.qmx-scene{position:relative;width:100%;height:100%;min-height:0;overflow:hidden;border:1px solid var(--line);border-radius:26px;background:var(--surface,#fff);display:grid;grid-template-columns:minmax(320px,.82fr) minmax(0,1.18fr);grid-template-rows:1fr auto;gap:0}
.qmx-scene.qmx-wide{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr) auto}
.qmx-copy{position:relative;z-index:2;padding:clamp(28px,3.2vw,48px);display:flex;flex-direction:column;justify-content:center;min-width:0;overflow:auto;background:transparent;border:0!important;box-shadow:none!important}
.qmx-wide .qmx-copy{padding:clamp(24px,2.5vw,36px) clamp(28px,3.5vw,54px) 14px;display:grid;grid-template-columns:minmax(250px,.75fr) minmax(380px,1.25fr);column-gap:clamp(28px,4vw,60px);align-items:end;overflow:visible}
.qmx-kicker{font-size:10px;font-weight:900;letter-spacing:.15em;text-transform:uppercase;color:var(--primary);margin-bottom:10px}
.qmx-copy h2{font-size:clamp(31px,3.1vw,50px);line-height:1.02;letter-spacing:-.045em;margin:0 0 16px;color:var(--text,#111)}
.qmx-copy p{font-size:clamp(14px,1.12vw,17px);line-height:1.65;color:var(--muted,#66706a);margin:0;max-width:62ch}
.qmx-wide .qmx-kicker,.qmx-wide .qmx-copy h2{grid-column:1}.qmx-wide .qmx-copy p{grid-column:2;grid-row:1 / span 2;align-self:end;max-width:72ch}
.qmx-visual{position:relative;min-width:0;min-height:0;height:100%;padding:clamp(22px,2.5vw,34px);display:flex;align-items:center;justify-content:center;overflow:hidden;background:linear-gradient(145deg,var(--soft,#eef2ec),color-mix(in srgb,var(--soft,#eef2ec) 55%,white));border:0!important;border-left:1px solid var(--line)!important;border-radius:0!important;box-shadow:none!important}
.qmx-wide .qmx-visual{border-left:0!important;border-top:1px solid var(--line)!important;padding:clamp(14px,2vw,26px) clamp(34px,4vw,66px)}
.qmx-visual img,.qmx-visual svg{display:block;width:auto!important;height:auto!important;max-width:90%!important;max-height:88%!important;object-fit:contain!important;transform:none!important;transform-origin:center!important;filter:none!important;margin:auto!important}
.qmx-wide .qmx-visual img,.qmx-wide .qmx-visual svg{max-width:92%!important;max-height:90%!important}
.qmx-badge{position:absolute;right:16px;top:16px;background:rgba(255,255,255,.9);border:1px solid var(--line);color:var(--primary-dark);padding:7px 10px;border-radius:999px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;z-index:3}
.qmx-fallback{padding:30px;text-align:center;color:var(--muted);font-size:13px}
.qmx-interaction{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px 18px;align-items:center;padding:14px clamp(22px,2.6vw,38px) 16px;border-top:1px solid var(--line);background:color-mix(in srgb,var(--surface,#fff) 94%,var(--soft,#eef2ec));z-index:4}
.qmx-points{display:flex;flex-wrap:wrap;gap:8px;min-width:0}.qmx-point{appearance:none;border:1px solid color-mix(in srgb,var(--text,#111) 18%,transparent);background:var(--surface,#fff);color:var(--muted,#66706a);border-radius:999px;padding:8px 11px;font-size:11px;font-weight:800;cursor:pointer;transition:.18s}.qmx-point:hover,.qmx-point.active{border-color:var(--primary);background:var(--accent);color:var(--primary-dark);transform:translateY(-1px)}
.qmx-count{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);white-space:nowrap}
.qmx-detail{grid-column:1/-1;padding:10px 13px;border-radius:12px;background:color-mix(in srgb,var(--accent) 48%,white);border-left:4px solid var(--primary);font-size:12px;line-height:1.45;font-weight:700;color:var(--primary-dark);min-height:38px}
.qmx-prompt{grid-column:1/-1;font-size:10px;color:var(--muted);font-weight:700;margin-top:-3px}
.qmx-enter{animation:qmxIn .42s ease both}@keyframes qmxIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media(max-width:980px){.qmx-stage{height:auto;max-height:none}.qmx-scene,.qmx-scene.qmx-wide{height:auto;grid-template-columns:1fr;grid-template-rows:auto minmax(300px,44vh) auto}.qmx-copy,.qmx-wide .qmx-copy{display:block;padding:24px;overflow:visible}.qmx-wide .qmx-copy p{max-width:64ch}.qmx-visual,.qmx-wide .qmx-visual{border-left:0!important;border-top:1px solid var(--line)!important;min-height:300px;height:min(44vh,430px);padding:18px}.qmx-copy h2{font-size:clamp(28px,6vw,40px)}}
@media(max-width:680px){.qmx-scene,.qmx-scene.qmx-wide{border-radius:18px;grid-template-rows:auto minmax(250px,34vh) auto}.qmx-copy,.qmx-wide .qmx-copy{padding:18px}.qmx-copy h2{font-size:27px;margin-bottom:10px}.qmx-copy p{font-size:13px;line-height:1.55}.qmx-visual,.qmx-wide .qmx-visual{min-height:250px;height:min(34vh,320px);padding:12px}.qmx-visual img,.qmx-visual svg,.qmx-wide .qmx-visual img,.qmx-wide .qmx-visual svg{max-width:94%!important;max-height:92%!important}.qmx-interaction{padding:11px 13px 12px;grid-template-columns:1fr}.qmx-count{display:none}.qmx-detail{font-size:11px}.qmx-badge{right:10px;top:10px}}
@media(prefers-reduced-motion:reduce){.qmx-enter{animation:none}.qmx-point{transition:none}}
</style>`;
    return html.replace('</head>', `${css}\n</head>`);
}

function experienceScript() {
    return `
<script id="quizmoto-experience-v4-script">
(function(){
  function esc(s){var M={'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'};return String(s||'').replace(/[<>&"']/g,function(c){return M[c]||c})}
  function points(s){var a=Array.isArray(s.keyPoints)?s.keyPoints.filter(Boolean):[];if(!a.length&&s.content)a=[s.content];return a.slice(0,5)}
  function isWide(layout){return ['process','timeline','comparison','matrix','cycle'].indexOf(layout)>=0}
  function buttonLabel(layout,n){if(layout==='process')return 'Step '+(n+1);if(layout==='timeline')return 'Stage '+(n+1);return String(n+1)}
  function enhance(){
    var data=window.__quizmotoData;if(!data||!Array.isArray(data.slides))return;
    var slides=document.querySelectorAll('.slide');
    data.slides.forEach(function(s,i){
      var node=slides[i+1];if(!node)return;
      var stage=node.querySelector('.stage');if(!stage)return;
      var list=points(s),layout=String(s.layout||'cards'),asset=s.visualAsset||'';
      var frame=document.createElement('div');frame.className='qmx-stage qmx-enter';
      var pointButtons=list.map(function(p,n){return '<button type="button" class="qmx-point" data-index="'+n+'">'+esc(buttonLabel(layout,n))+'</button>'}).join('');
      var visual=asset?'<img src="'+esc(asset)+'" alt="'+esc(s.visualTitle||s.title)+'"/>':'<div class="qmx-fallback">Visual asset unavailable. The lesson content remains fully accessible.</div>';
      frame.innerHTML='<section class="qmx-scene '+(isWide(layout)?'qmx-wide':'')+'" data-layout="'+esc(layout)+'"><div class="qmx-copy"><div class="qmx-kicker">Part '+(i+1)+' · '+esc(layout)+'</div><h2>'+esc(s.title)+'</h2><p>'+esc(s.content)+'</p></div><div class="qmx-visual">'+visual+'<div class="qmx-badge">Explore</div></div><div class="qmx-interaction"><div class="qmx-points">'+pointButtons+'</div><div class="qmx-count" data-count>0 / '+list.length+' explored</div><div class="qmx-detail" data-detail>'+(list.length?'Select a learning point to reveal the supporting detail.':'Review the visual and continue when ready.')+'</div><div class="qmx-prompt">'+esc((s.interaction&&s.interaction.prompt)||'Explore the visual before continuing.')+'</div></div></section>';
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
        generator: 'Quizmoto Immersive Learning Author',
        version: 4,
        visualEngine: assets.length ? 'python-svg+html' : 'html-fallback'
    }, null, 2));

    const manifestFile = zip.file('imsmanifest.xml');
    if (manifestFile && assets.length) {
        let manifest = await manifestFile.async('string');
        const fileEntries = assets.map((asset) => `\n      <file href="${asset.zipPath}"/>`).join('');
        manifest = manifest.replace(/(\s*<\/resource>)/, `${fileEntries}$1`);
        zip.file('imsmanifest.xml', manifest);
    }

    return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}

module.exports = {
    buildScormPackageZip,
    enrichAnalysis,
    inferLayout
};
