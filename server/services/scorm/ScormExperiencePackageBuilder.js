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
        experienceVersion: 8,
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
<style id="quizmoto-course-experience-v8">
:root{--qmx-rail:248px;--qmx-orange:#F97316;--qmx-orange-dark:#EA580C;--qmx-orange-soft:#FFF7ED;--qmx-ink:#172033;--qmx-navy:#0F172A;--qmx-muted:#64748B;--qmx-line:#E8ECF2;--qmx-page:#F5F7FA}
.qmx-course-v8 *{box-sizing:border-box}
.qmx-course-v8 html,.qmx-course-v8 body{background:var(--qmx-page)!important}
.qmx-course-v8 #app{background:var(--qmx-page)!important;overflow:hidden!important}
.qmx-course-v8 header{height:68px!important;padding:0 28px!important;background:#fff!important;color:var(--qmx-ink)!important;border-bottom:1px solid var(--qmx-line)!important;box-shadow:0 1px 0 rgba(15,23,42,.02)!important;gap:14px!important}
.qmx-course-v8 .brand-mark{width:38px!important;height:38px!important;border-radius:11px!important;background:var(--qmx-orange)!important;color:#fff!important;box-shadow:none!important}
.qmx-course-v8 header h1{color:var(--qmx-ink)!important;font-size:15px!important;font-weight:900!important;letter-spacing:-.02em!important;max-width:min(44vw,680px)!important}
.qmx-course-v8 .progress-shell{height:7px!important;max-width:330px!important;background:#EEF1F5!important;border-radius:999px!important;overflow:hidden!important}
.qmx-course-v8 .progress-fill{background:linear-gradient(90deg,var(--qmx-orange),#FDBA74)!important}
.qmx-course-v8 .progress-text{color:#596273!important;font-size:11px!important;font-weight:900!important;min-width:34px!important}
.qmx-course-v8 main{position:relative!important;height:calc(100vh - 136px)!important;min-height:0!important;background:var(--qmx-page)!important;overflow:hidden!important}
.qmx-course-v8 .slide{top:0!important;right:0!important;bottom:0!important;left:var(--qmx-rail)!important;height:100%!important;min-height:0!important;padding:clamp(18px,2.2vw,32px)!important;background:var(--qmx-page)!important;overflow:hidden!important}
.qmx-course-v8 .slide.active{display:flex!important;align-items:stretch!important;justify-content:center!important}
.qmx-course-v8 footer{height:68px!important;padding:0 28px 0 calc(var(--qmx-rail) + 28px)!important;background:#fff!important;border-top:1px solid var(--qmx-line)!important;box-shadow:none!important}
.qmx-course-v8 .nav-btn{min-width:112px!important;padding:10px 18px!important;border-radius:10px!important;font-size:13px!important;font-weight:900!important;text-transform:none!important;letter-spacing:0!important;box-shadow:none!important}
.qmx-course-v8 .nav-btn.primary{background:var(--qmx-orange)!important;border:1px solid var(--qmx-orange)!important;color:#fff!important}
.qmx-course-v8 .nav-btn.primary:hover{background:var(--qmx-orange-dark)!important;border-color:var(--qmx-orange-dark)!important;transform:translateY(-1px)!important}
.qmx-course-v8 .nav-btn.secondary{background:#fff!important;border:1px solid #D8DEE8!important;color:#4B5565!important}
.qmx-course-v8 .nav-btn.secondary:hover{background:var(--qmx-orange-soft)!important;border-color:#FED7AA!important;color:#9A3412!important}
.qmx-course-v8 .part{color:#7B8494!important;font-size:10px!important;font-weight:900!important;letter-spacing:.12em!important}

.qmx-course-rail{position:absolute;z-index:6;left:0;top:0;bottom:0;width:var(--qmx-rail);background:var(--qmx-navy);color:#fff;padding:24px 18px 20px;display:flex;flex-direction:column;overflow:hidden;border-right:1px solid rgba(255,255,255,.06)}
.qmx-rail-label{font-size:9px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:#94A3B8;margin-bottom:9px}
.qmx-rail-title{font-size:18px;line-height:1.18;font-weight:900;letter-spacing:-.025em;color:#fff;margin:0 0 22px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden}
.qmx-rail-progress{height:5px;background:rgba(255,255,255,.12);border-radius:999px;overflow:hidden;margin-bottom:22px}.qmx-rail-progress span{display:block;height:100%;width:0;background:var(--qmx-orange);border-radius:999px;transition:.25s ease}
.qmx-rail-nav{display:grid;gap:4px;overflow:auto;min-height:0;padding-right:2px;scrollbar-width:thin;scrollbar-color:#334155 transparent}
.qmx-rail-item{appearance:none;width:100%;border:0;background:transparent;color:#AAB4C4;padding:9px 10px;border-radius:9px;display:grid;grid-template-columns:24px minmax(0,1fr);gap:9px;align-items:center;text-align:left;cursor:pointer;transition:.18s ease}
.qmx-rail-item:hover{background:rgba(255,255,255,.06);color:#fff}.qmx-rail-item.active{background:rgba(249,115,22,.16);color:#fff}.qmx-rail-item.active .qmx-rail-index{background:var(--qmx-orange);color:#fff;border-color:var(--qmx-orange)}
.qmx-rail-index{width:24px;height:24px;border-radius:7px;border:1px solid #475569;display:grid;place-items:center;font-size:9px;font-weight:900;color:#94A3B8}
.qmx-rail-copy{min-width:0}.qmx-rail-copy b{display:block;font-size:10.5px;line-height:1.3;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.qmx-rail-copy span{display:block;font-size:8px;color:#718096;margin-top:2px;text-transform:uppercase;letter-spacing:.09em;font-weight:800}
.qmx-rail-foot{margin-top:auto;padding-top:14px;border-top:1px solid rgba(255,255,255,.08);font-size:9px;color:#64748B;line-height:1.5;font-weight:700}

.qmx-course-page{width:min(1240px,100%);height:100%;min-height:0;margin:auto;display:grid;grid-template-rows:auto minmax(0,1fr);gap:16px;animation:qmxPageIn .35s ease both}
.qmx-page-heading{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,.78fr);gap:34px;align-items:end;background:#fff;border:1px solid var(--qmx-line);border-radius:18px;padding:20px 24px;box-shadow:0 8px 28px rgba(15,23,42,.035)}
.qmx-heading-main{min-width:0}.qmx-section-label{font-size:9px;font-weight:900;letter-spacing:.17em;text-transform:uppercase;color:var(--qmx-orange);margin-bottom:7px}.qmx-page-heading h2{font-size:clamp(27px,2.4vw,40px);line-height:1.04;letter-spacing:-.035em;margin:0;color:var(--qmx-ink);font-weight:900;max-width:22ch}
.qmx-page-summary{font-size:13.5px;line-height:1.62;color:#596273;margin:0;font-weight:600;max-height:5.1em;overflow:auto;padding-right:4px}
.qmx-learning-canvas{min-height:0;background:#fff;border:1px solid var(--qmx-line);border-radius:20px;padding:16px;box-shadow:0 12px 34px rgba(15,23,42,.045);display:grid;grid-template-rows:minmax(0,1fr) auto;gap:12px;overflow:hidden}
.qmx-visual-stage{position:relative;min-height:0;border-radius:15px;background:linear-gradient(180deg,#FFFBF7 0%,#FFF7ED 100%);border:1px solid #F8E7D6;display:grid;place-items:center;overflow:hidden;padding:clamp(12px,1.5vw,22px)}
.qmx-visual-stage:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(249,115,22,.018) 1px,transparent 1px),linear-gradient(rgba(249,115,22,.018) 1px,transparent 1px);background-size:32px 32px;pointer-events:none}
.qmx-visual-stage img,.qmx-visual-stage svg{position:relative;z-index:1;display:block;width:auto!important;height:auto!important;max-width:96%!important;max-height:96%!important;object-fit:contain!important;margin:auto!important;filter:none!important;transform:none!important}
.qmx-visual-missing{position:relative;z-index:1;text-align:center;max-width:480px;color:#7B8494;font-size:12px;font-weight:700;padding:30px}
.qmx-canvas-badge{position:absolute;z-index:2;right:14px;top:14px;padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.94);border:1px solid #FED7AA;color:#9A3412;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.12em;backdrop-filter:blur(8px)}
.qmx-insight-zone{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,.34fr);gap:12px;min-height:86px}
.qmx-insight-row{display:grid;grid-template-columns:repeat(var(--qmx-count,4),minmax(0,1fr));gap:8px;min-width:0}
.qmx-insight{appearance:none;border:1px solid #E5EAF0;background:#fff;color:#475569;border-radius:11px;padding:10px 11px;text-align:left;cursor:pointer;display:grid;grid-template-columns:25px minmax(0,1fr);gap:8px;align-items:center;min-width:0;transition:.17s ease}
.qmx-insight:hover{border-color:#FDBA74;background:#FFFBF7}.qmx-insight.active{border-color:var(--qmx-orange);background:var(--qmx-orange-soft);color:#9A3412;box-shadow:0 0 0 1px rgba(249,115,22,.05)}
.qmx-insight-no{width:25px;height:25px;border-radius:7px;background:#F1F4F7;color:#7B8494;display:grid;place-items:center;font-size:8px;font-weight:900}.qmx-insight.active .qmx-insight-no{background:var(--qmx-orange);color:#fff}
.qmx-insight-text{font-size:9.5px;line-height:1.32;font-weight:850;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3}
.qmx-detail-panel{border-radius:11px;background:var(--qmx-navy);color:#fff;padding:11px 13px;display:flex;flex-direction:column;justify-content:center;min-width:0;overflow:hidden}.qmx-detail-label{font-size:7.5px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#FDBA74;margin-bottom:5px}.qmx-detail-text{font-size:10px;line-height:1.42;font-weight:750;color:#E2E8F0;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;overflow:hidden}
.qmx-course-page[data-layout="spotlight"] .qmx-visual-stage{background:linear-gradient(135deg,#111827,#0F172A 62%,#1E293B);border-color:#1E293B}.qmx-course-page[data-layout="spotlight"] .qmx-visual-stage:before{background:radial-gradient(circle at 80% 20%,rgba(249,115,22,.16),transparent 32%),radial-gradient(circle at 20% 90%,rgba(253,186,116,.09),transparent 28%)}
.qmx-course-page[data-layout="comparison"] .qmx-visual-stage,.qmx-course-page[data-layout="matrix"] .qmx-visual-stage{background:#FAFBFC}

.qmx-cover{width:min(1240px,100%);height:100%;margin:auto;display:grid;grid-template-columns:minmax(0,1.08fr) minmax(330px,.72fr);border-radius:24px;overflow:hidden;background:#fff;border:1px solid var(--qmx-line);box-shadow:0 18px 50px rgba(15,23,42,.07);animation:qmxPageIn .35s ease both}
.qmx-cover-copy{padding:clamp(34px,4vw,68px);display:flex;flex-direction:column;justify-content:center}.qmx-cover-kicker{font-size:10px;font-weight:900;letter-spacing:.19em;text-transform:uppercase;color:var(--qmx-orange);margin-bottom:16px}.qmx-cover h2{font-size:clamp(38px,4vw,64px);line-height:.98;letter-spacing:-.05em;margin:0;color:var(--qmx-ink);font-weight:900;max-width:13ch}.qmx-cover p{font-size:15px;line-height:1.7;color:#5F6878;font-weight:600;max-width:60ch;margin:20px 0 0}.qmx-cover-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:25px}.qmx-cover-meta span{padding:8px 11px;border-radius:999px;background:#F7F8FA;border:1px solid #E6EAF0;color:#596273;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
.qmx-cover-art{position:relative;background:linear-gradient(155deg,#FB923C 0%,#F97316 48%,#C2410C 100%);display:grid;place-items:center;overflow:hidden}.qmx-cover-art:before,.qmx-cover-art:after{content:"";position:absolute;border-radius:50%;border:34px solid rgba(255,255,255,.12)}.qmx-cover-art:before{width:280px;height:280px;right:-90px;top:-80px}.qmx-cover-art:after{width:180px;height:180px;left:-62px;bottom:-54px}.qmx-cover-mark{position:relative;z-index:1;width:142px;height:142px;border-radius:34px;background:#fff;box-shadow:0 24px 60px rgba(124,45,18,.22);display:grid;place-items:center;color:var(--qmx-orange);font-size:64px;font-weight:950;letter-spacing:-.08em}.qmx-cover-art-label{position:absolute;z-index:1;bottom:28px;left:28px;right:28px;color:#fff}.qmx-cover-art-label b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.15em}.qmx-cover-art-label span{display:block;margin-top:5px;font-size:10px;color:#FFEDD5;font-weight:700}

.qmx-course-v8 .qmx-quiz-slide .stage,.qmx-course-v8 .qmx-final-slide .stage{width:min(980px,100%)!important;margin:auto!important;align-self:center!important}.qmx-course-v8 .quiz-card{padding:clamp(28px,3vw,46px)!important;border:1px solid var(--qmx-line)!important;border-radius:20px!important;background:#fff!important;box-shadow:0 14px 40px rgba(15,23,42,.06)!important}.qmx-course-v8 .quiz-card .eyebrow{color:var(--qmx-orange)!important;font-size:9px!important;letter-spacing:.16em!important}.qmx-course-v8 .quiz-card .title{color:var(--qmx-ink)!important;font-size:clamp(26px,2.5vw,38px)!important;line-height:1.12!important;letter-spacing:-.03em!important;max-width:26ch!important}.qmx-course-v8 .quiz-options{gap:10px!important;margin-top:24px!important}.qmx-course-v8 .quiz-option{border:1px solid #DEE4EC!important;border-radius:11px!important;padding:14px 15px!important;min-height:58px!important;color:#394254!important;font-weight:800!important;background:#fff!important;box-shadow:none!important}.qmx-course-v8 .quiz-option:hover:not(:disabled){border-color:#FDBA74!important;background:#FFFBF7!important;transform:translateY(-1px)!important}.qmx-course-v8 .quiz-option.correct{background:#F0FDF4!important;border:2px solid #22C55E!important;color:#166534!important}.qmx-course-v8 .quiz-option.incorrect{background:#FEF2F2!important;border:2px solid #EF4444!important;color:#991B1B!important}.qmx-course-v8 .feedback{border-radius:10px!important;padding:12px 14px!important;font-size:12px!important}
.qmx-course-v8 .final-card{max-width:760px!important;padding:clamp(38px,4vw,58px)!important;border-radius:24px!important;background:var(--qmx-navy)!important;border:0!important;box-shadow:0 18px 50px rgba(15,23,42,.14)!important;color:#fff!important}.qmx-course-v8 .final-card .eyebrow{color:#FDBA74!important}.qmx-course-v8 .final-card .title,.qmx-course-v8 .final-card .lead{color:#fff!important}.qmx-course-v8 .score-ring:before{background:var(--qmx-navy)!important}.qmx-course-v8 .score-ring span{color:#fff!important}
@keyframes qmxPageIn{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}

@media(max-width:1120px){:root{--qmx-rail:218px}.qmx-page-heading{grid-template-columns:1fr;gap:9px;align-items:start}.qmx-page-heading h2{max-width:26ch}.qmx-page-summary{max-height:3.3em}.qmx-insight-zone{grid-template-columns:1fr}.qmx-detail-panel{display:none}.qmx-insight-text{-webkit-line-clamp:2}}
@media(max-width:900px){:root{--qmx-rail:0px}.qmx-course-v8 main{height:auto!important;min-height:calc(100vh - 126px)!important;overflow:auto!important}.qmx-course-v8 .slide{left:0!important;height:auto!important;min-height:calc(100vh - 126px)!important;overflow:visible!important}.qmx-course-v8 footer{height:58px!important;padding:0 14px!important}.qmx-course-v8 header{height:68px!important;padding:0 14px!important}.qmx-course-rail{display:none}.qmx-course-page{height:auto;min-height:calc(100vh - 174px);grid-template-rows:auto auto}.qmx-learning-canvas{min-height:520px}.qmx-cover{height:auto;min-height:calc(100vh - 174px);grid-template-columns:1fr}.qmx-cover-art{min-height:250px}.qmx-cover-copy{padding:32px}.qmx-cover h2{max-width:18ch}.qmx-insight-row{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
@media(max-width:620px){.qmx-course-v8 header h1{max-width:34vw!important;font-size:12px!important}.qmx-course-v8 .progress-shell{max-width:120px!important}.qmx-course-v8 .slide{padding:10px!important}.qmx-page-heading{padding:16px;border-radius:14px}.qmx-page-heading h2{font-size:27px}.qmx-page-summary{font-size:12.5px;max-height:none}.qmx-learning-canvas{padding:10px;border-radius:15px;min-height:460px}.qmx-visual-stage{min-height:285px;padding:8px}.qmx-insight-row{grid-template-columns:1fr!important}.qmx-insight:nth-child(n+4){display:none}.qmx-cover-copy{padding:24px}.qmx-cover h2{font-size:38px}.qmx-cover-art{min-height:210px}.qmx-cover-mark{width:104px;height:104px;border-radius:26px;font-size:48px}.qmx-course-v8 .quiz-options{grid-template-columns:1fr!important}.qmx-course-v8 .nav-btn{min-width:0!important;padding:9px 12px!important;font-size:11px!important}}
@media(prefers-reduced-motion:reduce){.qmx-course-page,.qmx-cover{animation:none}.qmx-insight,.qmx-rail-item{transition:none}}
</style>`;
    return html.replace('</head>', `${css}\n</head>`);
}

function experienceScript() {
    return `
<script id="quizmoto-course-experience-v8-script">
(function(){
  function esc(s){var M={'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'};return String(s||'').replace(/[<>&"']/g,function(c){return M[c]||c})}
  function points(s){var a=Array.isArray(s.keyPoints)?s.keyPoints.filter(Boolean):[];if(!a.length&&s.content)a=[s.content];return a.slice(0,5)}
  function short(value,max){var s=String(value||'').trim();return s.length>max?s.slice(0,max-1).trim()+'…':s}
  function layoutName(layout){var names={process:'Process',cards:'Key concepts',timeline:'Timeline',comparison:'Compare',hub:'Overview',spotlight:'Focus',matrix:'Risk view',cycle:'Cycle'};return names[layout]||'Lesson'}
  function cover(data){var lessons=(data.slides||[]).length,checks=(data.quiz||[]).length;return '<div class="qmx-cover"><div class="qmx-cover-copy"><div class="qmx-cover-kicker">Interactive learning course</div><h2>'+esc(data.title||'Course')+'</h2><p>'+esc(data.summary||'Work through each lesson, explore the visual examples and complete the knowledge check at the end.')+'</p><div class="qmx-cover-meta"><span>'+lessons+' lessons</span><span>'+checks+' knowledge checks</span><span>Progress tracked</span></div></div><div class="qmx-cover-art"><div class="qmx-cover-mark">Q</div><div class="qmx-cover-art-label"><b>Quizmoto Learning</b><span>Explore · understand · apply</span></div></div></div>'}
  function learningPage(s,i){var list=points(s),layout=String(s.layout||'cards'),asset=s.visualAsset||'',count=Math.max(1,Math.min(list.length,5));var buttons=list.map(function(p,n){return '<button type="button" class="qmx-insight" data-index="'+n+'" title="'+esc(p)+'"><span class="qmx-insight-no">'+String(n+1).padStart(2,'0')+'</span><span class="qmx-insight-text">'+esc(short(p,100))+'</span></button>'}).join('');var visual=asset?'<img src="'+esc(asset)+'" alt="'+esc(s.visualTitle||s.title||'Course visual')+'">':'<div class="qmx-visual-missing">This lesson is fully available as text. Continue with the key insights below.</div>';var first=list[0]||'Review this lesson and continue when the main idea is clear.';return '<div class="qmx-course-page" data-layout="'+esc(layout)+'"><div class="qmx-page-heading"><div class="qmx-heading-main"><div class="qmx-section-label">Lesson '+String(i+1).padStart(2,'0')+' · '+esc(layoutName(layout))+'</div><h2>'+esc(s.title||('Lesson '+(i+1)))+'</h2></div><p class="qmx-page-summary">'+esc(s.content||'')+'</p></div><div class="qmx-learning-canvas"><div class="qmx-visual-stage">'+visual+'<div class="qmx-canvas-badge">'+esc(s.visualTitle||layoutName(layout))+'</div></div><div class="qmx-insight-zone"><div class="qmx-insight-row" style="--qmx-count:'+count+'">'+buttons+'</div><div class="qmx-detail-panel"><div class="qmx-detail-label">Key takeaway</div><div class="qmx-detail-text" data-detail>'+esc(first)+'</div></div></div></div></div>'}
  function railLabel(index,data){var lessons=(data.slides||[]).length,checks=(data.quiz||[]).length;if(index===0)return ['Course overview','Start here'];if(index<=lessons){var s=data.slides[index-1]||{};return [s.title||('Lesson '+index),'Lesson '+String(index).padStart(2,'0')]}if(index<=lessons+checks){var qn=index-lessons;return ['Knowledge check '+qn,'Assessment']}return ['Course complete','Finish']}
  function buildRail(data,slides){var rail=document.createElement('aside');rail.className='qmx-course-rail';var items=[];for(var i=0;i<slides.length;i++){var label=railLabel(i,data);items.push('<button type="button" class="qmx-rail-item" data-target="'+i+'"><span class="qmx-rail-index">'+String(i+1).padStart(2,'0')+'</span><span class="qmx-rail-copy"><b>'+esc(short(label[0],34))+'</b><span>'+esc(label[1])+'</span></span></button>')}rail.innerHTML='<div class="qmx-rail-label">Course contents</div><h2 class="qmx-rail-title">'+esc(data.title||'Course')+'</h2><div class="qmx-rail-progress"><span data-rail-progress></span></div><nav class="qmx-rail-nav">'+items.join('')+'</nav><div class="qmx-rail-foot">Your progress is saved as you move through the course.</div>';var main=document.querySelector('main');if(main)main.appendChild(rail);rail.querySelectorAll('[data-target]').forEach(function(btn){btn.addEventListener('click',function(){goTo(Number(btn.getAttribute('data-target')))})});return rail}
  function activeIndex(){var slides=Array.prototype.slice.call(document.querySelectorAll('.slide'));for(var i=0;i<slides.length;i++){if(slides[i].classList.contains('active'))return i}return 0}
  function syncRail(){var rail=document.querySelector('.qmx-course-rail');if(!rail)return;var idx=activeIndex(),items=rail.querySelectorAll('.qmx-rail-item');items.forEach(function(item,n){item.classList.toggle('active',n===idx)});var p=rail.querySelector('[data-rail-progress]');if(p)p.style.width=Math.round((idx/Math.max(1,items.length-1))*100)+'%';var current=items[idx];if(current&&current.scrollIntoView)current.scrollIntoView({block:'nearest'})}
  function goTo(target){var slides=Array.prototype.slice.call(document.querySelectorAll('.slide'));var current=activeIndex(),guard=0;while(current<target&&guard<slides.length+2){var next=document.getElementById('next-btn');if(!next||next.style.display==='none')break;next.click();current++;guard++}while(current>target&&guard<slides.length*2+4){var prev=document.getElementById('prev-btn');if(!prev||prev.disabled)break;prev.click();current--;guard++}setTimeout(syncRail,0)}
  function enhance(){var data=window.__quizmotoData;if(!data)return;document.body.classList.add('qmx-course-v8');var slides=document.querySelectorAll('.slide');if(!slides.length)return;slides[0].innerHTML=cover(data);(data.slides||[]).forEach(function(s,i){var node=slides[i+1];if(node)node.innerHTML=learningPage(s,i)});var lessonCount=(data.slides||[]).length,quizCount=(data.quiz||[]).length;for(var q=0;q<quizCount;q++){var quizNode=slides[lessonCount+1+q];if(quizNode)quizNode.classList.add('qmx-quiz-slide')}var finalNode=slides[slides.length-1];if(finalNode)finalNode.classList.add('qmx-final-slide');buildRail(data,slides);document.querySelectorAll('.qmx-insight-row').forEach(function(row){var detail=row.parentElement&&row.parentElement.querySelector('[data-detail]');row.querySelectorAll('.qmx-insight').forEach(function(btn,n){if(n===0)btn.classList.add('active');btn.addEventListener('click',function(){row.querySelectorAll('.qmx-insight').forEach(function(b){b.classList.remove('active')});btn.classList.add('active');var slideIndex=Array.prototype.slice.call(slides).indexOf(btn.closest('.slide'))-1;var slide=(data.slides||[])[slideIndex]||{},list=points(slide),idx=Number(btn.getAttribute('data-index'));if(detail)detail.textContent=list[idx]||''})})});var observer=new MutationObserver(function(){setTimeout(syncRail,0)});slides.forEach(function(slide){observer.observe(slide,{attributes:true,attributeFilter:['class']})});var prev=document.getElementById('prev-btn'),next=document.getElementById('next-btn');if(prev)prev.addEventListener('click',function(){setTimeout(syncRail,0)});if(next)next.addEventListener('click',function(){setTimeout(syncRail,0)});syncRail()}
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
        generator: 'Quizmoto Professional Course Experience',
        version: 8,
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