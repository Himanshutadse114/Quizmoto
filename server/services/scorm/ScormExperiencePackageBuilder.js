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
        return { type: 'step_explore', prompt: 'Explore each stage, then continue when the sequence is clear.' };
    }
    if (layout === 'hub' || layout === 'cards' || layout === 'matrix') {
        return { type: 'hotspot_explore', prompt: 'Explore each point to connect the visual with the lesson.' };
    }
    if (layout === 'comparison') {
        return { type: 'compare_reveal', prompt: 'Compare both sides before moving on.' };
    }
    return { type: 'focus_reveal', prompt: 'Review the key idea before continuing.' };
}

function enrichAnalysis(raw) {
    const analysis = raw && typeof raw === 'object' ? raw : {};
    const slides = Array.isArray(analysis.slides) ? analysis.slides : [];
    return {
        ...analysis,
        experienceVersion: 7,
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
<style id="quizmoto-experience-v7">
.qmx-stage{width:min(1360px,100%);height:100%;max-height:720px;margin:auto;display:flex;align-items:center;justify-content:center;min-height:0}
.qmx-scene{position:relative;width:100%;height:100%;min-height:0;overflow:hidden;background:transparent;display:grid;grid-template-columns:minmax(360px,.9fr) minmax(0,1.1fr);grid-template-rows:minmax(0,1fr);gap:clamp(28px,3.2vw,50px);align-items:stretch}
.qmx-scene.qmx-wide{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr);gap:clamp(18px,2.2vw,28px)}
.qmx-copy{position:relative;z-index:2;padding:clamp(16px,1.4vw,22px) clamp(4px,.6vw,10px);display:flex;flex-direction:column;justify-content:center;min-width:0;overflow:auto;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;scrollbar-width:thin}
.qmx-wide .qmx-copy{padding:0 clamp(10px,1.8vw,26px);display:grid;grid-template-columns:minmax(270px,.78fr) minmax(430px,1.22fr);column-gap:clamp(34px,5vw,82px);row-gap:8px;align-items:end;overflow:visible}
.qmx-kicker{font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:var(--primary);margin-bottom:12px}
.qmx-copy h2{font-size:clamp(34px,3.3vw,54px);line-height:1.03;letter-spacing:-.04em;margin:0 0 20px;color:var(--text,#1e293b);max-width:16ch;font-weight:900}
.qmx-copy-body{display:grid;gap:12px;max-width:62ch;background:var(--secondary-bg,#f8fafc);border-left:7px solid var(--primary);border-radius:26px;padding:clamp(18px,1.9vw,26px) clamp(19px,2.1vw,30px);box-shadow:0 6px 24px rgba(15,23,42,.035)}
.qmx-copy-body p{font-size:clamp(15px,1.16vw,18px);line-height:1.7;color:var(--muted,#64748b);margin:0;font-weight:500}
.qmx-wide .qmx-kicker,.qmx-wide .qmx-copy h2{grid-column:1}.qmx-wide .qmx-copy h2{max-width:14ch;margin-bottom:0}.qmx-wide .qmx-copy-body{grid-column:2;grid-row:1 / span 2;align-self:end;max-width:76ch;border-left-width:6px;border-radius:22px;padding:18px 22px}
.qmx-visual{position:relative;min-width:0;min-height:0;height:100%;padding:clamp(24px,2.8vw,42px);display:flex;align-items:center;justify-content:center;overflow:hidden;background:linear-gradient(145deg,#FFF7ED 0%,#FFFFFF 56%,#FFEDD5 100%);border:1px solid #F1F5F9!important;border-radius:30px!important;box-shadow:0 18px 56px rgba(15,23,42,.065)!important}
.qmx-wide .qmx-visual{padding:clamp(18px,2.4vw,34px) clamp(30px,4.5vw,74px);min-height:0}
.qmx-visual img,.qmx-visual svg{display:block;width:auto!important;height:auto!important;max-width:92%!important;max-height:88%!important;object-fit:contain!important;transform:none!important;transform-origin:center!important;filter:none!important;margin:auto!important}
.qmx-wide .qmx-visual img,.qmx-wide .qmx-visual svg{max-width:94%!important;max-height:90%!important}
.qmx-badge{position:absolute;right:18px;top:18px;background:rgba(255,255,255,.94);border:1px solid rgba(249,115,22,.20);color:var(--primary-dark);padding:8px 11px;border-radius:999px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.09em;z-index:3;backdrop-filter:blur(10px)}
.qmx-fallback{padding:30px;text-align:center;color:var(--muted);font-size:13px}
.qmx-explore{grid-column:1/-1;margin-top:18px;padding-top:18px;border-top:1px solid #F1F5F9}.qmx-wide .qmx-explore{margin-top:0;padding:14px clamp(10px,1.8vw,26px) 0;border-top:0}
.qmx-explore-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}.qmx-explore-title{font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:var(--primary)}.qmx-count{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#94A3B8;white-space:nowrap}
.qmx-points{display:flex;flex-wrap:wrap;gap:8px;min-width:0}.qmx-point{appearance:none;border:1px solid #E2E8F0;background:#fff;color:#475569;border-radius:12px;padding:9px 12px;font-size:10.5px;font-weight:800;cursor:pointer;transition:.18s;max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;box-shadow:0 3px 12px rgba(15,23,42,.025)}.qmx-point:hover,.qmx-point.active{border-color:var(--primary);background:var(--primary);color:#fff;transform:translateY(-1px)}
.qmx-detail{margin-top:10px;padding:12px 14px;border-radius:14px;background:#FFF7ED;border:1px solid #FED7AA;font-size:12px;line-height:1.5;font-weight:700;color:#9A3412;min-height:40px}.qmx-prompt{font-size:10px;color:var(--muted);font-weight:700;margin-top:8px}
.qmx-wide .qmx-explore{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:16px}.qmx-wide .qmx-explore-head{grid-column:1/-1}.qmx-wide .qmx-points{grid-column:1}.qmx-wide .qmx-detail{grid-column:1/-1}.qmx-wide .qmx-prompt{grid-column:1/-1}
.qmx-enter{animation:qmxIn .42s ease both}@keyframes qmxIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media(max-width:1080px){.qmx-scene:not(.qmx-wide){grid-template-columns:minmax(310px,.94fr) minmax(0,1.06fr);gap:26px}.qmx-copy h2{font-size:clamp(31px,4vw,46px)}}
@media(max-width:900px){.qmx-stage{height:auto;max-height:none}.qmx-scene,.qmx-scene.qmx-wide{height:auto;grid-template-columns:1fr;grid-template-rows:auto minmax(300px,42vh);gap:18px}.qmx-copy,.qmx-wide .qmx-copy{display:block;padding:8px 4px;overflow:visible}.qmx-copy h2,.qmx-wide .qmx-copy h2{max-width:20ch;margin-bottom:14px}.qmx-wide .qmx-copy-body{max-width:68ch}.qmx-visual,.qmx-wide .qmx-visual{min-height:300px;height:min(42vh,440px);padding:20px;border-radius:24px!important}.qmx-visual img,.qmx-visual svg,.qmx-wide .qmx-visual img,.qmx-wide .qmx-visual svg{max-width:92%!important;max-height:90%!important}.qmx-explore,.qmx-wide .qmx-explore{padding:14px 4px 0;margin-top:0;border-top:0}}
@media(max-width:680px){.qmx-scene,.qmx-scene.qmx-wide{grid-template-rows:auto minmax(245px,34vh);gap:12px}.qmx-copy,.qmx-wide .qmx-copy{padding:4px 2px}.qmx-copy h2,.qmx-wide .qmx-copy h2{font-size:28px;line-height:1.04;margin-bottom:11px}.qmx-copy-body{gap:8px;border-radius:18px;border-left-width:5px;padding:15px 16px}.qmx-copy-body p{font-size:13.5px;line-height:1.6}.qmx-visual,.qmx-wide .qmx-visual{min-height:245px;height:min(34vh,320px);padding:12px;border-radius:18px!important}.qmx-visual img,.qmx-visual svg,.qmx-wide .qmx-visual img,.qmx-wide .qmx-visual svg{max-width:94%!important;max-height:92%!important}.qmx-count{display:none}.qmx-point{max-width:100%;font-size:10px;padding:8px 10px}.qmx-detail{font-size:11px}.qmx-badge{right:10px;top:10px}.qmx-explore,.qmx-wide .qmx-explore{padding-top:10px}}
@media(prefers-reduced-motion:reduce){.qmx-enter{animation:none}.qmx-point{transition:none}}
</style>`;
    return html.replace('</head>', `${css}\n</head>`);
}

function experienceScript() {
    return `
<script id="quizmoto-experience-v7-script">
(function(){
  function esc(s){var M={'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'};return String(s||'').replace(/[<>&"']/g,function(c){return M[c]||c})}
  function points(s){var a=Array.isArray(s.keyPoints)?s.keyPoints.filter(Boolean):[];if(!a.length&&s.content)a=[s.content];return a.slice(0,5)}
  function isWide(layout){return ['process','timeline','comparison','matrix','cycle'].indexOf(layout)>=0}
  function splitParagraphs(value){
    var text=String(value||'').trim();if(!text)return [];
    var natural=text.split(/\n\s*\n/).map(function(x){return x.trim()}).filter(Boolean);if(natural.length>1)return natural.slice(0,3);
    var sentences=text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[text];
    var words=text.split(/\s+/);if(words.length<64||sentences.length<3)return [text];
    var firstCount=Math.ceil(sentences.length/2);
    return [sentences.slice(0,firstCount).join(' ').trim(),sentences.slice(firstCount).join(' ').trim()].filter(Boolean);
  }
  function bodyHtml(value){return splitParagraphs(value).map(function(x){return '<p>'+esc(x)+'</p>'}).join('')}
  function shortLabel(value,max){var s=String(value||'').trim();return s.length>max?s.slice(0,max-1).trim()+'…':s}
  function buttonLabel(layout,n,value){var prefix='';if(layout==='process')prefix='Step '+(n+1)+' · ';else if(layout==='timeline')prefix='Stage '+(n+1)+' · ';return prefix+shortLabel(value,46-prefix.length)}
  function enhance(){
    var data=window.__quizmotoData;if(!data||!Array.isArray(data.slides))return;
    var slides=document.querySelectorAll('.slide');
    data.slides.forEach(function(s,i){
      var node=slides[i+1];if(!node)return;
      var stage=node.querySelector('.stage');if(!stage)return;
      var list=points(s),layout=String(s.layout||'cards'),asset=s.visualAsset||'';
      var frame=document.createElement('div');frame.className='qmx-stage qmx-enter';
      var pointButtons=list.map(function(p,n){return '<button type="button" class="qmx-point" data-index="'+n+'" title="'+esc(p)+'">'+esc(buttonLabel(layout,n,p))+'</button>'}).join('');
      var visual=asset?'<img src="'+esc(asset)+'" alt="'+esc(s.visualTitle||s.title)+'"/>':'<div class="qmx-fallback">Visual asset unavailable. The lesson content remains fully accessible.</div>';
      var explore='<div class="qmx-explore"><div class="qmx-explore-head"><span class="qmx-explore-title">Key insights</span><span class="qmx-count" data-count>0 / '+list.length+' explored</span></div><div class="qmx-points">'+pointButtons+'</div><div class="qmx-detail" data-detail>'+(list.length?'Choose an insight to reveal the supporting detail.':'Review the visual and continue when ready.')+'</div><div class="qmx-prompt">'+esc((s.interaction&&s.interaction.prompt)||'Explore the visual before continuing.')+'</div></div>';
      frame.innerHTML='<section class="qmx-scene '+(isWide(layout)?'qmx-wide':'')+'" data-layout="'+esc(layout)+'"><div class="qmx-copy"><div class="qmx-kicker">Section '+(i+1)+'</div><h2>'+esc(s.title)+'</h2><div class="qmx-copy-body">'+bodyHtml(s.content)+'</div>'+(!isWide(layout)?explore:'')+'</div><div class="qmx-visual">'+visual+'<div class="qmx-badge">Interactive visual</div></div>'+(isWide(layout)?explore:'')+'</section>';
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
        version: 7,
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