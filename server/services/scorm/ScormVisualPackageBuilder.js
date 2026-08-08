/**
 * Visual-first SCORM 1.2 package builder for Quizmoto AI Author.
 *
 * Goals:
 * - keep SCORM tracking semantics compatible with the existing author runtime
 * - make generated modules visually varied without external runtime assets
 * - use deterministic SVG/CSS visuals rather than AI-generated HTML
 * - remain backwards compatible with existing analysis JSON
 */
const JSZip = require('jszip');

function escapeXML(str) {
    const map = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' };
    return String(str || '').replace(/[<>&"']/g, (m) => map[m] || m);
}

const TEMPLATES = {
    1: { primary: '#f97316', primaryDark: '#ea580c', accent: '#fdba74', bg: '#fff7ed', surface: '#ffffff', text: '#172033', muted: '#64748b', soft: '#fff1e6' },
    3: { primary: '#b45309', primaryDark: '#92400e', accent: '#fde68a', bg: '#fffbeb', surface: '#ffffff', text: '#3f2b13', muted: '#78634d', soft: '#fef3c7' },
    4: { primary: '#059669', primaryDark: '#047857', accent: '#6ee7b7', bg: '#f0fdf4', surface: '#ffffff', text: '#15352a', muted: '#557167', soft: '#d1fae5' },
    5: { primary: '#db2777', primaryDark: '#be185d', accent: '#f9a8d4', bg: '#fff1f2', surface: '#ffffff', text: '#43162a', muted: '#765365', soft: '#fce7f3' }
};

const LAYOUTS = ['process', 'cards', 'timeline', 'comparison', 'hub', 'spotlight'];

function inferLayout(slide, index) {
    const explicit = String(slide?.layout || slide?.slideType || '').toLowerCase();
    if (LAYOUTS.includes(explicit)) return explicit;
    const text = `${slide?.title || ''} ${slide?.content || ''}`.toLowerCase();
    if (/step|process|workflow|how .* works|lifecycle|flow/.test(text)) return 'process';
    if (/before|after|versus| vs |do and don|good|bad|safe|unsafe|compare/.test(text)) return 'comparison';
    if (/timeline|history|phase|stage|sequence|journey/.test(text)) return 'timeline';
    if (/types|pillars|principles|elements|areas|components|categories/.test(text)) return 'hub';
    if (/warning|risk|important|remember|critical|key takeaway/.test(text)) return 'spotlight';
    return LAYOUTS[index % LAYOUTS.length];
}

function normalizeAnalysis(analysis) {
    const input = analysis || {};
    return {
        ...input,
        title: String(input.title || 'Course'),
        summary: String(input.summary || ''),
        slides: (Array.isArray(input.slides) ? input.slides : []).map((slide, index) => ({
            ...slide,
            title: String(slide?.title || `Section ${index + 1}`),
            content: String(slide?.content || ''),
            keyPoints: Array.isArray(slide?.keyPoints) ? slide.keyPoints.filter(Boolean).map(String) : [],
            layout: inferLayout(slide, index),
            visualTitle: String(slide?.visualTitle || slide?.title || `Section ${index + 1}`)
        })),
        quiz: Array.isArray(input.quiz) ? input.quiz : []
    };
}

const SCORM_WRAPPER = `var findAPITries=0;
function findAPI(win){while((win.API==null)&&(win.parent!=null)&&(win.parent!=win)){findAPITries++;if(findAPITries>500)return null;win=win.parent;}return win.API;}
function getAPI(){var a=findAPI(window);if((a==null)&&(window.opener!=null)){try{a=findAPI(window.opener);}catch(e){}}return a;}
var API=getAPI();
function doLMSInitialize(){if(!API)return "false";return API.LMSInitialize("");}
function doLMSFinish(){if(!API)return "false";return API.LMSFinish("");}
function doLMSGetValue(n){if(!API)return "";return API.LMSGetValue(n);}
function doLMSSetValue(n,v){if(!API)return "false";return API.LMSSetValue(n,v);}
function doLMSCommit(){if(!API)return "false";return API.LMSCommit("");}
`;

function buildPlayerHtml(analysis, theme, logoHtml, escapedTitle) {
    const dataJson = JSON.stringify(analysis).replace(/</g, '\\u003c');
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="generator" content="Quizmoto Visual Author">
<meta name="quizmoto-editable" content="1">
<title>${escapedTitle}</title>
<script src="scorm_api_wrapper.js"></script>
<style>
:root{--primary:${theme.primary};--primary-dark:${theme.primaryDark};--accent:${theme.accent};--bg:${theme.bg};--surface:${theme.surface};--text:${theme.text};--muted:${theme.muted};--soft:${theme.soft};--line:#e2e8f0;--shadow:0 20px 60px rgba(15,23,42,.10)}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
button{font:inherit}#app{height:100%;display:flex;flex-direction:column;background:linear-gradient(135deg,var(--bg),#fff 58%)}
header{height:68px;display:flex;align-items:center;gap:14px;padding:0 22px;background:#fff;border-bottom:1px solid var(--line);box-shadow:0 4px 20px rgba(15,23,42,.04);z-index:10}
.brand-mark{width:38px;height:38px;border-radius:13px;background:var(--primary);display:grid;place-items:center;color:#fff;font-weight:900;box-shadow:0 7px 18px color-mix(in srgb,var(--primary) 28%,transparent)}
header h1{font-size:14px;margin:0;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:38vw}
.progress-shell{height:7px;background:#eef2f7;border-radius:99px;overflow:hidden;flex:1;margin-left:auto;max-width:360px}.progress-fill{height:100%;width:0;background:linear-gradient(90deg,var(--primary),var(--accent));transition:width .45s ease}.progress-text{font-size:11px;font-weight:850;color:var(--muted)}
main{flex:1;position:relative;overflow:hidden}.slide{position:absolute;inset:0;display:none;padding:24px 28px;overflow:auto}.slide.active{display:flex;align-items:center;justify-content:center}.stage{width:min(1180px,100%);margin:auto}
footer{height:70px;padding:0 24px;display:flex;align-items:center;justify-content:space-between;background:#fff;border-top:1px solid var(--line);z-index:10}.nav-btn{border:0;border-radius:12px;padding:11px 18px;font-weight:800;cursor:pointer;transition:.2s}.nav-btn.primary{background:var(--primary);color:#fff;box-shadow:0 5px 0 var(--primary-dark)}.nav-btn.primary:hover{transform:translateY(1px);box-shadow:0 4px 0 var(--primary-dark)}.nav-btn.secondary{background:#f8fafc;color:#64748b;border:1px solid #e2e8f0}.nav-btn:disabled{opacity:.35;cursor:not-allowed}.part{font-size:10px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:#94a3b8}
.eyebrow{font-size:11px;font-weight:900;color:var(--primary);letter-spacing:.16em;text-transform:uppercase}.title{font-size:clamp(28px,3.3vw,48px);line-height:1.02;letter-spacing:-.035em;margin:8px 0 14px;font-weight:900}.lead{font-size:15px;line-height:1.65;color:#475569;max-width:780px;margin:0}.glass{background:rgba(255,255,255,.92);border:1px solid rgba(226,232,240,.9);border-radius:28px;box-shadow:var(--shadow)}
.hero{display:grid;grid-template-columns:1.12fr .88fr;gap:34px;align-items:center;padding:38px}.hero-art{min-height:360px;border-radius:26px;background:radial-gradient(circle at 30% 25%,var(--accent),transparent 34%),linear-gradient(145deg,var(--primary),var(--primary-dark));position:relative;overflow:hidden;color:#fff}.hero-art:after,.hero-art:before{content:"";position:absolute;border:22px solid rgba(255,255,255,.18);border-radius:50%}.hero-art:before{width:170px;height:170px;right:-45px;top:-35px}.hero-art:after{width:95px;height:95px;left:24px;bottom:20px}.hero-core{position:absolute;inset:0;display:grid;place-items:center}.hero-core svg{width:170px;height:170px;filter:drop-shadow(0 18px 24px rgba(0,0,0,.16))}
.kp-row{display:flex;flex-wrap:wrap;gap:9px;margin-top:20px}.chip{padding:8px 11px;border-radius:999px;background:var(--soft);color:var(--primary-dark);font-size:11px;font-weight:800}
.section-head{margin-bottom:20px}.section-head .title{font-size:clamp(25px,2.7vw,38px);margin-bottom:9px}.section-head .lead{max-width:920px}
.cards-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.concept-card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:20px;box-shadow:0 9px 30px rgba(15,23,42,.06);position:relative;overflow:hidden}.concept-card:before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--primary)}.concept-number{width:34px;height:34px;border-radius:12px;background:var(--soft);color:var(--primary-dark);display:grid;place-items:center;font-weight:900;margin-bottom:12px}.concept-card p{font-size:13px;line-height:1.5;margin:0;color:#475569;font-weight:650}
.process{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;align-items:stretch}.step{position:relative;background:#fff;border:1px solid var(--line);border-radius:20px;padding:18px;min-height:155px}.step:not(:last-child):after{content:"→";position:absolute;right:-15px;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--primary);color:#fff;font-weight:900;z-index:2}.step-no{font-size:10px;letter-spacing:.12em;font-weight:900;color:var(--primary);text-transform:uppercase}.step p{font-size:13px;line-height:1.5;font-weight:700;color:#334155;margin:13px 0 0}
.timeline{position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:18px;padding-top:24px}.timeline:before{content:"";position:absolute;left:9%;right:9%;top:42px;height:4px;background:linear-gradient(90deg,var(--primary),var(--accent));border-radius:99px}.milestone{position:relative;text-align:center}.dot{width:42px;height:42px;border-radius:50%;background:#fff;border:7px solid var(--primary);margin:0 auto 16px;box-shadow:0 0 0 5px var(--soft);position:relative;z-index:1}.milestone p{background:#fff;border:1px solid var(--line);padding:14px;border-radius:16px;font-size:12px;line-height:1.45;font-weight:700;color:#475569;margin:0}
.compare{display:grid;grid-template-columns:1fr 1fr;gap:20px}.compare-col{border-radius:24px;padding:24px;border:1px solid var(--line);background:#fff}.compare-col.good{border-top:6px solid #16a34a}.compare-col.warn{border-top:6px solid #ef4444}.compare-title{font-size:12px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;margin-bottom:15px}.compare-col.good .compare-title{color:#15803d}.compare-col.warn .compare-title{color:#dc2626}.compare-item{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;line-height:1.45;font-weight:650}.compare-item:last-child{border:0}.badge-dot{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;flex:0 0 auto;color:#fff;font-size:12px;font-weight:900}.good .badge-dot{background:#16a34a}.warn .badge-dot{background:#ef4444}
.hub-wrap{display:grid;grid-template-columns:.9fr 1.1fr;gap:28px;align-items:center}.hub-svg{width:100%;max-height:390px}.hub-list{display:grid;grid-template-columns:1fr 1fr;gap:12px}.hub-item{padding:15px;border:1px solid var(--line);border-radius:17px;background:#fff;font-size:12px;line-height:1.45;font-weight:700;color:#475569}.hub-item b{display:block;color:var(--primary);margin-bottom:4px}
.spotlight{display:grid;grid-template-columns:.85fr 1.15fr;gap:30px;align-items:center}.spot-visual{height:360px;border-radius:28px;background:linear-gradient(145deg,var(--primary),var(--primary-dark));display:grid;place-items:center;position:relative;overflow:hidden}.spot-visual svg{width:180px;height:180px;color:#fff}.spot-visual:before{content:"";position:absolute;width:260px;height:260px;border:34px solid rgba(255,255,255,.12);border-radius:50%;right:-95px;bottom:-95px}.takeaway{padding:16px 18px;border-radius:18px;background:var(--soft);border-left:5px solid var(--primary);font-size:13px;line-height:1.55;font-weight:750;color:#334155;margin-top:18px}
.quiz-wrap{max-width:880px;margin:auto}.quiz-card{padding:30px}.quiz-options{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:22px}.quiz-option{border:2px solid #e2e8f0;background:#fff;border-radius:16px;padding:15px;text-align:left;font-weight:700;color:#334155;cursor:pointer;min-height:58px;transition:.2s}.quiz-option:hover{border-color:var(--primary);transform:translateY(-1px)}.quiz-option.correct{background:#f0fdf4;border-color:#22c55e}.quiz-option.incorrect{background:#fef2f2;border-color:#ef4444}.feedback{display:none;margin-top:14px;border-radius:14px;padding:12px 14px;text-align:center;font-weight:800}
.final-card{text-align:center;padding:42px;max-width:650px;margin:auto}.score-ring{width:160px;height:160px;border-radius:50%;margin:22px auto;display:grid;place-items:center;background:conic-gradient(var(--primary) 0deg,var(--accent) 270deg,#eef2f7 270deg);position:relative}.score-ring:before{content:"";position:absolute;inset:15px;border-radius:50%;background:#fff}.score-ring span{position:relative;font-size:38px;font-weight:950;color:var(--primary)}
.reveal{opacity:0;transform:translateY(18px)}.slide.active .reveal{animation:rise .55s ease forwards}.slide.active .reveal:nth-child(2){animation-delay:.08s}.slide.active .reveal:nth-child(3){animation-delay:.16s}.slide.active .reveal:nth-child(4){animation-delay:.24s}@keyframes rise{to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none}.slide.active .reveal{animation:none}}
@media(max-width:900px){header h1{max-width:28vw}.hero,.hub-wrap,.spotlight{grid-template-columns:1fr}.hero-art,.spot-visual{min-height:230px;height:230px}.process,.timeline{grid-template-columns:1fr 1fr}.timeline:before{display:none}.step:nth-child(2n):after{display:none}.cards-grid,.quiz-options{grid-template-columns:1fr}.slide{padding:18px}.compare{grid-template-columns:1fr}}
</style>
</head>
<body>
<div id="app">
<header>${logoHtml || '<div class="brand-mark">Q</div>'}<h1>${escapedTitle}</h1><div class="progress-shell"><div id="progress-fill" class="progress-fill"></div></div><span id="progress-text" class="progress-text">0%</span></header>
<main id="content-area"></main>
<footer><button id="prev-btn" class="nav-btn secondary">Previous</button><div id="slide-number" class="part">...</div><button id="next-btn" class="nav-btn primary">Next</button></footer>
</div>
<script>
(function(){
var data=${dataJson},currentSlide=0,score=0,quizResults=[],completed=false,sessionStartMs=Date.now(),commitTimer=null;
function el(id){return document.getElementById(id)}
function esc(s){var M={'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'};return String(s||'').replace(/[<>&"']/g,function(c){return M[c]||c})}
function formatSessionTime(ms){var totalSec=Math.max(0,Math.floor(ms/1000)),h=Math.floor(totalSec/3600),m=Math.floor((totalSec%3600)/60),s=totalSec%60,frac=Math.floor((ms%1000)/10);function p2(n){return(n<10?'0':'')+n}function p4(n){return(n<10?'000':n<100?'00':n<1000?'0':'')+n}return p4(h)+':'+p2(m)+':'+p2(s)+'.'+p2(frac)}
function writeSessionTime(){if(typeof doLMSSetValue!=='function')return;try{doLMSSetValue('cmi.core.session_time',formatSessionTime(Date.now()-sessionStartMs))}catch(e){}}
function commitProgress(extra){if(typeof doLMSSetValue!=='function')return;try{writeSessionTime();if(extra){for(var k in extra){if(Object.prototype.hasOwnProperty.call(extra,k))doLMSSetValue(k,String(extra[k]))}}doLMSCommit()}catch(e){}}
function iconSvg(title){var t=String(title||'').toLowerCase();var body='<path d="M12 3l8 4v5c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V7l8-4z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.5 12l2.2 2.2 4.8-5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>';if(/email|phish|message/.test(t))body='<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4 7l8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.7"/>';else if(/password|credential|login|access/.test(t))body='<rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 10V7a4 4 0 018 0v3" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="15" r="1.5" fill="currentColor"/>';else if(/data|privacy|information/.test(t))body='<ellipse cx="12" cy="6" rx="7" ry="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" fill="none" stroke="currentColor" stroke-width="1.7"/>';else if(/mobile|phone|whatsapp|sms/.test(t))body='<rect x="7" y="2" width="10" height="20" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 5h4M11 19h2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>';else if(/risk|warning|alert/.test(t))body='<path d="M12 3l10 18H2L12 3z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 9v5M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">'+body+'</svg>'}
function head(s,i){return '<div class="section-head reveal"><div class="eyebrow">Section '+(i+1)+' · '+esc(s.layout||'concept')+'</div><h2 class="title">'+esc(s.title)+'</h2><p class="lead">'+esc(s.content)+'</p></div>'}
function points(s){var a=s.keyPoints||[];return a.length?a:[s.content||'Key learning point']}
function processLayout(s,i){var p=points(s).slice(0,4),rows=p.map(function(x,n){return '<div class="step reveal"><div class="step-no">Step '+(n+1)+'</div><p>'+esc(x)+'</p></div>'}).join('');return '<div class="stage">'+head(s,i)+'<div class="process">'+rows+'</div></div>'}
function cardsLayout(s,i){var p=points(s).slice(0,6),rows=p.map(function(x,n){return '<div class="concept-card reveal"><div class="concept-number">'+(n+1)+'</div><p>'+esc(x)+'</p></div>'}).join('');return '<div class="stage">'+head(s,i)+'<div class="cards-grid">'+rows+'</div></div>'}
function timelineLayout(s,i){var p=points(s).slice(0,4),rows=p.map(function(x){return '<div class="milestone reveal"><div class="dot"></div><p>'+esc(x)+'</p></div>'}).join('');return '<div class="stage">'+head(s,i)+'<div class="timeline">'+rows+'</div></div>'}
function comparisonLayout(s,i){var p=points(s),half=Math.max(1,Math.ceil(p.length/2)),a=p.slice(0,half),b=p.slice(half);if(!b.length)b=['Avoid the opposite behavior and verify before acting.'];function col(arr,good){return '<div class="compare-col '+(good?'good':'warn')+' reveal"><div class="compare-title">'+(good?'Recommended':'Watch out')+'</div>'+arr.map(function(x){return '<div class="compare-item"><span class="badge-dot">'+(good?'✓':'!')+'</span><span>'+esc(x)+'</span></div>'}).join('')+'</div>'}return '<div class="stage">'+head(s,i)+'<div class="compare">'+col(a,true)+col(b,false)+'</div></div>'}
function hubLayout(s,i){var p=points(s).slice(0,6),cx=160,cy=160,r=105;var nodes=p.map(function(x,n){var angle=(Math.PI*2*n/Math.max(1,p.length))-Math.PI/2,xx=cx+Math.cos(angle)*r,yy=cy+Math.sin(angle)*r;return '<line x1="'+cx+'" y1="'+cy+'" x2="'+xx+'" y2="'+yy+'" stroke="var(--accent)" stroke-width="4" opacity=".8"/><circle cx="'+xx+'" cy="'+yy+'" r="27" fill="#fff" stroke="var(--primary)" stroke-width="5"/><text x="'+xx+'" y="'+(yy+4)+'" text-anchor="middle" font-size="12" font-weight="900" fill="var(--primary)">'+(n+1)+'</text>'}).join('');var list=p.map(function(x,n){return '<div class="hub-item reveal"><b>0'+(n+1)+'</b>'+esc(x)+'</div>'}).join('');return '<div class="stage">'+head(s,i)+'<div class="hub-wrap"><svg class="hub-svg" viewBox="0 0 320 320"><circle cx="160" cy="160" r="62" fill="var(--primary)"/><text x="160" y="154" text-anchor="middle" font-size="14" font-weight="900" fill="#fff">'+esc((s.visualTitle||s.title).slice(0,24))+'</text><text x="160" y="176" text-anchor="middle" font-size="10" font-weight="700" fill="#fff" opacity=".8">KEY CONCEPT</text>'+nodes+'</svg><div class="hub-list">'+list+'</div></div></div>'}
function spotlightLayout(s,i){var p=points(s),chips=p.slice(0,4).map(function(x){return '<span class="chip">'+esc(x)+'</span>'}).join('');return '<div class="stage"><div class="spotlight glass" style="padding:32px"><div class="spot-visual reveal">'+iconSvg(s.title)+'</div><div class="reveal"><div class="eyebrow">Section '+(i+1)+' · Focus</div><h2 class="title">'+esc(s.title)+'</h2><p class="lead">'+esc(s.content)+'</p><div class="kp-row">'+chips+'</div><div class="takeaway">'+esc(p[0]||'Remember the key action from this section.')+'</div></div></div></div>'}
function renderLearning(s,i){var layout=s.layout||'cards';if(layout==='process')return processLayout(s,i);if(layout==='timeline')return timelineLayout(s,i);if(layout==='comparison')return comparisonLayout(s,i);if(layout==='hub')return hubLayout(s,i);if(layout==='spotlight')return spotlightLayout(s,i);return cardsLayout(s,i)}
function render(){var area=el('content-area');area.innerHTML='';var intro=document.createElement('div');intro.className='slide active';intro.innerHTML='<div class="stage"><div class="hero glass"><div class="reveal"><div class="eyebrow">Quizmoto Learning Experience</div><h2 class="title">'+esc(data.title)+'</h2><p class="lead">'+esc(data.summary)+'</p><div class="kp-row"><span class="chip">Visual learning</span><span class="chip">Knowledge checks</span><span class="chip">Tracked completion</span></div></div><div class="hero-art reveal"><div class="hero-core">'+iconSvg(data.title)+'</div></div></div></div>';area.appendChild(intro);(data.slides||[]).forEach(function(s,i){var n=document.createElement('div');n.className='slide';n.innerHTML=renderLearning(s,i);area.appendChild(n)});(data.quiz||[]).forEach(function(q,i){var n=document.createElement('div');n.className='slide';var opts=(q.options||[]).map(function(o,oi){return '<button class="quiz-option" data-qi="'+i+'" data-oi="'+oi+'">'+esc(o)+'</button>'}).join('');n.innerHTML='<div class="stage quiz-wrap"><div class="quiz-card glass reveal"><div class="eyebrow">Knowledge Check '+(i+1)+'</div><h2 class="title" style="font-size:32px">'+esc(q.question)+'</h2><div id="opts-'+i+'" class="quiz-options">'+opts+'</div><div id="fb-'+i+'" class="feedback"></div></div></div>';area.appendChild(n)});var final=document.createElement('div');final.className='slide';final.innerHTML='<div class="stage"><div class="final-card glass reveal"><div class="eyebrow">Course Complete</div><h2 class="title">Well done</h2><p class="lead" style="margin:auto">Your answers have been evaluated and your progress is ready to be saved.</p><div class="score-ring"><span id="final-res">--%</span></div><button id="finish-btn" class="nav-btn primary" style="min-width:190px">Finish Course</button></div></div>';area.appendChild(final);area.querySelectorAll('.quiz-option').forEach(function(btn){btn.addEventListener('click',function(){answer(Number(btn.getAttribute('data-qi')),Number(btn.getAttribute('data-oi')))})});el('finish-btn').addEventListener('click',exitSco);updateNav()}
function moveSlide(n){var slides=document.querySelectorAll('.slide');if(currentSlide+n>=0&&currentSlide+n<slides.length){slides[currentSlide].classList.remove('active');currentSlide+=n;slides[currentSlide].classList.add('active');updateNav()}}
function updateNav(){var slides=document.querySelectorAll('.slide');el('prev-btn').disabled=currentSlide===0;var next=el('next-btn');if(currentSlide===slides.length-1){next.style.display='none';calcScore()}else{next.style.display='inline-flex';next.textContent=currentSlide===slides.length-2?'Finish':'Next'}el('slide-number').textContent='Part '+(currentSlide+1)+' of '+slides.length;var p=Math.round(currentSlide/Math.max(1,slides.length-1)*100);el('progress-fill').style.width=p+'%';el('progress-text').textContent=p+'%';commitProgress({'cmi.core.lesson_location':String(currentSlide)})}
function answer(qi,oi){if(quizResults[qi]!==undefined)return;quizResults[qi]=oi;var correct=data.quiz[qi].correctAnswer,container=el('opts-'+qi),btns=container.querySelectorAll('button');btns.forEach(function(b,i){b.disabled=true;if(i===correct)b.classList.add('correct');else if(i===oi)b.classList.add('incorrect')});var fb=el('fb-'+qi);fb.style.display='block';if(oi===correct){fb.textContent='Correct — well done.';fb.style.background='#f0fdf4';fb.style.color='#166534'}else{fb.textContent='Not quite. Review the highlighted correct answer.';fb.style.background='#fef2f2';fb.style.color='#991b1b'}}
function calcScore(){var hits=0;(data.quiz||[]).forEach(function(q,i){if(quizResults[i]===q.correctAnswer)hits++});score=data.quiz&&data.quiz.length?Math.round(hits/data.quiz.length*100):0;var r=el('final-res');if(r)r.textContent=score+'%'}
function exitSco(){if(completed)return;calcScore();if(commitTimer){clearInterval(commitTimer);commitTimer=null}if(typeof doLMSSetValue==='function'){writeSessionTime();doLMSSetValue('cmi.core.score.raw',String(score));doLMSSetValue('cmi.core.score.min','0');doLMSSetValue('cmi.core.score.max','100');doLMSSetValue('cmi.core.lesson_status',score>=70?'passed':'completed');doLMSSetValue('cmi.core.exit','normal');doLMSCommit();doLMSFinish()}completed=true;try{if(window.opener)window.opener.postMessage({type:'quizmoto_scorm_exit'},'*')}catch(e){}try{window.close()}catch(e){}}
el('prev-btn').addEventListener('click',function(){moveSlide(-1)});el('next-btn').addEventListener('click',function(){moveSlide(1)});window.onload=function(){sessionStartMs=Date.now();render();if(typeof doLMSInitialize==='function'){doLMSInitialize();doLMSSetValue('cmi.core.score.min','0');doLMSSetValue('cmi.core.score.max','100');doLMSSetValue('cmi.core.lesson_status','incomplete');writeSessionTime();doLMSCommit();commitTimer=setInterval(function(){if(!completed)commitProgress()},15000)}};window.addEventListener('beforeunload',function(){if(completed)return;try{writeSessionTime();if(typeof doLMSSetValue==='function'){doLMSSetValue('cmi.core.exit','suspend');doLMSCommit()}}catch(e){}})
})();
</script>
</body>
</html>`;
}

async function buildScormPackageZip(rawAnalysis, opts = {}) {
    const analysis = normalizeAnalysis(rawAnalysis);
    const zip = new JSZip();
    const escapedTitle = escapeXML(analysis.title || 'Course');
    const theme = TEMPLATES[opts.templateId] || TEMPLATES[1];

    let logoFileName = '';
    let logoHtml = '';
    if (opts.logoDataUrl) {
        const matches = String(opts.logoDataUrl).match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (matches) {
            const ext = matches[1].split('/')[1].split('+')[0];
            logoFileName = `logo.${ext}`;
            zip.file(logoFileName, matches[2], { base64: true });
            logoHtml = `<img src="${logoFileName}" alt="Logo" style="height:38px;width:auto;max-width:150px;object-fit:contain"/>`;
        }
    }

    zip.file('index.html', buildPlayerHtml(analysis, theme, logoHtml, escapedTitle));
    zip.file('scorm_api_wrapper.js', SCORM_WRAPPER);
    zip.file('content.json', JSON.stringify({ ...analysis, generatedBy: 'quizmoto', generator: 'Quizmoto Visual Author', version: 2 }, null, 2));

    const logoFileEntry = logoFileName ? `\n      <file href="${logoFileName}"/>` : '';
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.quizmoto.visual.${Date.now()}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG-1"><organization identifier="ORG-1"><title>${escapedTitle}</title><item identifier="ITEM-1" identifierref="RES-1"><title>${escapedTitle}</title></item></organization></organizations>
  <resources><resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html"><file href="index.html"/><file href="scorm_api_wrapper.js"/><file href="content.json"/>${logoFileEntry}</resource></resources>
</manifest>`;
    zip.file('imsmanifest.xml', manifest);

    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = { buildScormPackageZip, TEMPLATES, escapeXML, normalizeAnalysis, inferLayout };
