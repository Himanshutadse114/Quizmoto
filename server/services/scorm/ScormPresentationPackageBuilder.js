'use strict';

const JSZip = require('jszip');
const { createHash } = require('crypto');
const fs = require('fs');
const path = require('path');

function escapeXml(value) {
    return String(value || '').replace(/[<>&"']/g, (character) => ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;'
    }[character]));
}

const QUIZMOTO_PRESENTATION_THEME = Object.freeze({
    background: '#eef8f6',
    surface: '#ffffff',
    primary: '#147d75',
    secondary: '#4fc9bf',
    text: '#123c38',
    muted: '#5d7773',
    primaryText: '#ffffff',
    mode: 'light'
});

// Presentation artwork remains byte-for-byte visual content. The surrounding
// player and generated quiz always use Quizmoto's teal identity so a deck can
// never recolour the product chrome or make assessment text inaccessible.
function normalizeTheme() {
    return { ...QUIZMOTO_PRESENTATION_THEME };
}

function normalizeQuiz(quiz = {}) {
    return {
        title: String(quiz.title || 'Knowledge Check').trim().slice(0, 120) || 'Knowledge Check',
        questions: (Array.isArray(quiz.questions) ? quiz.questions : []).map((question, index) => ({
            id: `question_${index + 1}`,
            question: String(question.question || question.questionText || '').trim(),
            options: (Array.isArray(question.options) ? question.options : []).slice(0, 4).map((option) => String(option || '').trim()),
            correctAnswer: Number.isInteger(question.correctAnswer)
                ? question.correctAnswer
                : Number(question.correctIndex),
            explanation: String(question.explanation || '').trim()
        })).filter((question) => (
            question.question &&
            question.options.length === 4 &&
            question.options.every(Boolean) &&
            question.correctAnswer >= 0 &&
            question.correctAnswer < 4
        ))
    };
}

function decodeLogoDataUrl(value) {
    const match = String(value || '').trim().match(/^data:image\/(png|jpeg|webp);base64,([a-z0-9+/=\r\n]+)$/i);
    if (!match) return null;
    const body = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
    if (!body.length || body.length > 1024 * 1024) return null;
    const extension = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
    return { path: `assets/course-logo.${extension}`, body };
}

function presentationFontAssets() {
    const directory = path.resolve(__dirname, '../../../client/public/landing/fonts');
    return [
        ['OpenSauceSans-Regular.woff2', 400],
        ['OpenSauceSans-Medium.woff2', 500],
        ['OpenSauce-SemiBold.woff2', 600]
    ].flatMap(([fileName, weight]) => {
        const sourcePath = path.join(directory, fileName);
        if (!fs.existsSync(sourcePath)) return [];
        return [{ path: `assets/fonts/${fileName}`, body: fs.readFileSync(sourcePath), weight }];
    });
}

const SCORM_WRAPPER = `var findAPITries=0;
function findAPI(win){while((win.API==null)&&(win.parent!=null)&&(win.parent!=win)){findAPITries++;if(findAPITries>500)return null;win=win.parent;}return win.API;}
function getAPI(){var api=findAPI(window);if((api==null)&&(window.opener!=null)){try{api=findAPI(window.opener);}catch(e){}}return api;}
var API=getAPI();
function doLMSInitialize(){if(!API)return "false";return API.LMSInitialize("");}
function doLMSFinish(){if(!API)return "false";return API.LMSFinish("");}
function doLMSGetValue(name){if(!API)return "";return API.LMSGetValue(name);}
function doLMSSetValue(name,value){if(!API)return "false";return API.LMSSetValue(name,value);}
function doLMSCommit(){if(!API)return "false";return API.LMSCommit("");}
`;

function buildPlayerHtml({ title, slides, quiz, theme, passScore, logoPath = '', fontAssets = [] }) {
    const safeTitle = escapeXml(title);
    const brandMark = logoPath
        ? `<img class="rail-logo" src="${escapeXml(logoPath)}" alt="Course logo">`
        : '<span class="rail-kicker">Presentation course</span>';
    const fontFaceCss = fontAssets.map((asset) => `@font-face{font-family:"Open Sauce Sans";src:url("${escapeXml(asset.path)}") format("woff2");font-style:normal;font-weight:${asset.weight};font-display:swap}`).join('\n');
    const data = JSON.stringify({
        title,
        slides: slides.map((slide) => ({
            src: `${slide.path}?v=${createHash('sha256').update(slide.body).digest('hex').slice(0, 12)}`,
            width: slide.width,
            height: slide.height
        })),
        quiz,
        passScore
    }).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="generator" content="LMSGen Presentation Import">
<title>${safeTitle}</title>
<script src="scorm_api_wrapper.js"></script>
<style>
${fontFaceCss}
:root{--background:${theme.background};--surface:${theme.surface};--primary:${theme.primary};--secondary:${theme.secondary};--text:${theme.text};--muted:${theme.muted};--primary-text:${theme.primaryText};--rail-width:clamp(168px,13vw,220px);--ok:#15803d;--ok-bg:#dcfce7;--bad:#b42318;--bad-bg:#fee4e2}
*{box-sizing:border-box}
html,body{width:100%;height:100%;margin:0;overflow:hidden;background:var(--background);color:var(--text);font-family:"Open Sauce Sans","Aptos","Segoe UI",Arial,sans-serif;font-synthesis:none;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased}
button{font:inherit}
#app{height:100%;display:grid;grid-template-columns:var(--rail-width) minmax(0,1fr);background:var(--background)}
.course-loader{position:fixed;z-index:100;inset:0;display:grid;place-items:center;padding:24px;background:var(--background);transition:opacity .22s ease,visibility .22s ease}
.course-loader.is-ready{opacity:0;visibility:hidden;pointer-events:none}
.course-loader-card{width:min(320px,88vw);padding:24px;border:1px solid color-mix(in srgb,var(--primary) 20%,transparent);border-radius:20px;background:var(--surface);box-shadow:0 20px 60px rgba(18,60,56,.12);text-align:center}
.course-loader-mark{display:block;width:34px;height:34px;margin:0 auto 14px;border:3px solid color-mix(in srgb,var(--primary) 18%,transparent);border-top-color:var(--primary);border-radius:50%;animation:course-loader-spin .8s linear infinite}
.course-loader-title{display:block;color:var(--text);font-size:.95rem;font-weight:800}
.course-loader-status{display:block;margin-top:6px;color:var(--muted);font-size:.72rem;font-weight:650}
@keyframes course-loader-spin{to{transform:rotate(360deg)}}
.course-rail{position:relative;z-index:2;min-width:0;padding:max(18px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));display:flex;flex-direction:column;gap:20px;background:var(--surface);border-right:1px solid color-mix(in srgb,var(--primary) 18%,transparent);box-shadow:10px 0 32px rgba(18,60,56,.08)}
.rail-heading{min-width:0}
.rail-logo{display:block;width:auto;height:auto;max-width:100%;max-height:48px;margin:0 0 12px;object-fit:contain;object-position:left center}
.rail-kicker{display:block;margin-bottom:8px;color:var(--primary);font-size:.65rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
.title{margin:0;display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:5;font-size:clamp(.84rem,1.2vw,1rem);line-height:1.3;font-weight:850;color:var(--text)}
.rail-progress{display:grid;gap:8px}
.progress-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;color:var(--muted);font-size:.7rem;font-weight:800}
.progress-track{height:8px;overflow:hidden;border-radius:999px;background:color-mix(in srgb,var(--text) 17%,transparent)}
.progress-fill{height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,var(--primary),var(--secondary));transition:width .2s ease}
.progress-label{color:var(--text)}
main{position:relative;min-height:0;overflow:hidden}
.page{position:absolute;inset:0;display:none}
.page.active{display:flex}
.presentation-page{align-items:center;justify-content:center;background:var(--background);padding:0}
.presentation-page img{display:block;width:100%;height:100%;object-fit:contain;background:var(--background)}
.quiz-page,.result-page{align-items:center;justify-content:center;overflow:auto;padding:clamp(16px,4vw,48px);background:radial-gradient(circle at 85% 10%,color-mix(in srgb,var(--secondary) 22%,transparent),transparent 36%),var(--background)}
.quiz-card,.result-card{width:min(1040px,100%);padding:clamp(30px,5vw,58px);border:1px solid color-mix(in srgb,var(--primary) 24%,transparent);border-radius:28px;background:var(--surface);box-shadow:0 24px 70px rgba(18,60,56,.12)}
.eyebrow{margin:0 0 10px;color:var(--primary);font-size:.72rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
.question{margin:0 0 30px;font-size:clamp(1.5rem,3.2vw,2.35rem);line-height:1.2;color:var(--text)}
.options{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.option{min-height:78px;padding:20px 22px;border:2px solid color-mix(in srgb,var(--primary) 18%,transparent);border-radius:17px;background:color-mix(in srgb,var(--background) 48%,var(--surface));color:var(--text);font-size:clamp(.98rem,1.5vw,1.12rem);font-weight:500;line-height:1.4;text-align:left;cursor:pointer;transition:transform .12s ease,border-color .12s ease}
.option:hover:not(:disabled),.option:focus-visible:not(:disabled){border-color:var(--primary);transform:translateY(-1px);outline:none}
.option.correct{border-color:var(--ok);background:var(--ok-bg);color:#14532d}
.option.incorrect{border-color:var(--bad);background:var(--bad-bg);color:#7f1d1d}
.option:disabled{cursor:default}
.feedback{display:none;margin-top:16px;padding:14px 16px;border-radius:14px;line-height:1.45;font-weight:650}
.feedback.show{display:block}
.feedback.correct{background:var(--ok-bg);color:#14532d}
.feedback.incorrect{background:var(--bad-bg);color:#7f1d1d}
.result-card{text-align:center}
.score-ring{width:152px;height:152px;margin:24px auto;display:grid;place-items:center;border-radius:50%;background:conic-gradient(var(--primary) var(--score-angle),color-mix(in srgb,var(--text) 13%,transparent) 0)}
.score-ring::before{content:"";grid-area:1/1;width:120px;height:120px;border-radius:50%;background:var(--surface)}
.score-value{grid-area:1/1;z-index:1;font-size:2.1rem;font-weight:900;color:var(--text)}
.result-title{margin:0;font-size:clamp(1.7rem,4vw,2.6rem);color:var(--text)}
.result-copy{margin:10px auto 0;max-width:520px;color:var(--muted);line-height:1.5}
.rail-controls{min-width:0;margin-top:auto;display:grid;gap:10px}
.counter{padding:0 2px;font-size:.72rem;font-weight:800;color:var(--muted);text-align:left;white-space:nowrap}
.nav-buttons{display:grid;grid-template-columns:1fr;gap:8px}
.btn{min-width:0;min-height:42px;padding:10px 9px;border:1px solid transparent;border-radius:12px;font-size:.75rem;font-weight:850;cursor:pointer}
.btn:focus-visible{outline:3px solid color-mix(in srgb,var(--secondary) 62%,transparent);outline-offset:2px}
.btn:disabled{opacity:.38;cursor:not-allowed}
.btn-secondary{background:color-mix(in srgb,var(--text) 10%,transparent);color:var(--text)}
.btn-primary{background:var(--primary);color:var(--primary-text)}
.btn-presentation{width:100%;display:flex;align-items:center;justify-content:center;gap:5px;padding-inline:6px;background:transparent;border-color:color-mix(in srgb,var(--text) 22%,transparent);color:var(--text);font-size:.66rem}
.btn-presentation:hover{background:color-mix(in srgb,var(--text) 8%,transparent)}
.btn-presentation svg{width:17px;height:17px;flex:0 0 auto}
.shortcut{margin:0;text-align:center;color:var(--muted);font-size:.62rem;line-height:1.35}
@media(max-height:520px) and (orientation:landscape){:root{--rail-width:132px}.course-rail{padding:10px;gap:10px}.rail-kicker{display:none}.title{font-size:.72rem;-webkit-line-clamp:2}.rail-progress{gap:5px}.rail-controls{gap:6px}.btn{min-height:34px;padding:6px 7px;border-radius:8px;font-size:.66rem}.btn-presentation{gap:4px;font-size:.59rem}.btn-presentation svg{width:13px;height:13px}.shortcut{display:none}.quiz-page,.result-page{align-items:flex-start;padding:8px}.quiz-card,.result-card{padding:16px}.options{gap:7px}.option{min-height:42px;padding:9px 11px}.question{font-size:1.15rem;margin-bottom:12px}}
html:fullscreen #app,html:-webkit-full-screen #app{grid-template-columns:1fr}
html:fullscreen main,html:-webkit-full-screen main{grid-column:1;grid-row:1}
html:fullscreen .course-rail,html:-webkit-full-screen .course-rail{position:fixed;z-index:20;inset:0 auto 0 0;width:156px;transform:translateX(-146px);opacity:.45;transition:transform .18s ease,opacity .18s ease}
html:fullscreen .course-rail:hover,html:fullscreen .course-rail:focus-within,html:-webkit-full-screen .course-rail:hover,html:-webkit-full-screen .course-rail:focus-within{transform:translateX(0);opacity:1}
@media(max-width:720px) and (orientation:portrait){#app,html:fullscreen #app,html:-webkit-full-screen #app{display:block;height:100dvh;min-height:100svh}.course-rail,html:fullscreen .course-rail,html:-webkit-full-screen .course-rail{position:fixed;z-index:20;inset:auto 0 0 0;width:auto;min-width:0;padding:8px max(10px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));display:block;background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--background) 96%,#fff) 30%);border:0;box-shadow:none;transform:none;opacity:1}.rail-heading{display:none}.rail-progress{position:fixed;z-index:21;inset:0 0 auto;display:block;pointer-events:none}.progress-meta{display:none}.progress-track{height:3px;border-radius:0;background:color-mix(in srgb,var(--text) 12%,transparent)}.rail-controls{margin:0;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px}.counter{display:block;padding:0;color:var(--text);font-size:.65rem}.shortcut{display:none}.nav-buttons{display:grid;grid-template-columns:1fr 1fr;gap:8px}.btn{min-height:40px;padding:8px 10px;border-radius:10px;font-size:.72rem;box-shadow:0 5px 18px rgba(18,60,56,.16)}.btn-presentation{width:40px;padding:8px}.btn-presentation span{display:none}main,html:fullscreen main,html:-webkit-full-screen main{position:relative;grid-column:auto;grid-row:auto;width:100vw;height:100dvh;min-height:100svh}.presentation-page{padding:0;background:var(--background)}.presentation-page img{width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;object-position:center center}.options{grid-template-columns:1fr;gap:8px}.quiz-page,.result-page{padding:18px 14px calc(76px + env(safe-area-inset-bottom));align-items:center}.quiz-card,.result-card{width:min(480px,100%);border-radius:16px;padding:16px}.eyebrow{margin-bottom:7px;font-size:.58rem;letter-spacing:.12em}.question{font-size:clamp(.98rem,4.4vw,1.12rem);line-height:1.3;margin-bottom:13px}.option{min-height:44px;padding:9px 11px;border-width:1px;border-radius:11px;font-size:clamp(.72rem,3.35vw,.82rem);line-height:1.3}.feedback{margin-top:9px;padding:9px 10px;border-radius:10px;font-size:.72rem;line-height:1.35}.result-title{font-size:1.35rem}.score-ring{width:116px;height:116px;margin:16px auto}.score-ring::before{width:90px;height:90px}.score-value{font-size:1.6rem}.result-copy{font-size:.82rem}}
@media(max-width:380px) and (orientation:portrait){.quiz-page,.result-page{padding-inline:10px}.quiz-card,.result-card{padding:13px}.question{font-size:.94rem}.option{min-height:40px;padding:8px 9px;font-size:.7rem}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
</style>
</head>
<body>
<div id="course-loader" class="course-loader" role="status" aria-live="polite"><div class="course-loader-card"><span class="course-loader-mark" aria-hidden="true"></span><strong class="course-loader-title">Preparing your presentation</strong><span id="course-loader-status" class="course-loader-status">Loading slide images…</span></div></div>
<div id="app" aria-busy="true">
  <aside class="course-rail" aria-label="Course controls">
    <div class="rail-heading">${brandMark}<h1 class="title" title="${safeTitle}">${safeTitle}</h1></div>
    <div class="rail-progress"><div class="progress-meta"><span>Progress</span><span id="progress-label" class="progress-label">0%</span></div><div class="progress-track" aria-hidden="true"><div id="progress-fill" class="progress-fill"></div></div></div>
    <div class="rail-controls"><span id="counter" class="counter"></span><div class="nav-buttons"><button id="previous" class="btn btn-secondary" type="button">Previous</button><button id="next" class="btn btn-primary" type="button">Next</button></div><button id="presentation" class="btn btn-presentation" type="button" aria-label="Enter presentation fullscreen"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg><span id="presentation-label">Presentation</span></button><p class="shortcut">Use left and right arrow keys to navigate</p></div>
  </aside>
  <main id="pages" aria-live="polite"></main>
</div>
<script>
(function(){
  'use strict';
  var data=${data};
  var slideCount=data.slides.length;
  var state={current:0,maxVisited:0,answers:[],completed:false,slideTimesMs:new Array(slideCount).fill(0),slideVisits:new Array(slideCount).fill(0)};
  var sessionStarted=Date.now();
  var pageEnteredAt=Date.now();
  var pageTimingActive=!document.hidden;
  var commitTimer=null;
  var pages=[];
  var quizStart=slideCount;
  var resultIndex=slideCount+data.quiz.questions.length;
  function byId(id){return document.getElementById(id);}
  function fullscreenElement(){return document.fullscreenElement||document.webkitFullscreenElement||null;}
  function fitRailToViewport(){if(window.matchMedia&&window.matchMedia('(max-width:720px) and (orientation:portrait)').matches)return;var first=data.slides[0];if(!first)return;var aspect=Number(first.width)/Number(first.height);if(!isFinite(aspect)||aspect<=0)return;var compact=window.innerHeight<=520;var minimum=compact?132:168;var maximum=compact?184:260;var unused=window.innerWidth-(window.innerHeight*aspect);document.documentElement.style.setProperty('--rail-width',Math.round(clamp(unused,minimum,maximum))+'px');}
  function updatePresentationButton(){var active=Boolean(fullscreenElement());byId('presentation-label').textContent=active?'Exit presentation':'Presentation';byId('presentation').setAttribute('aria-label',active?'Exit presentation fullscreen':'Enter presentation fullscreen');if(!active)fitRailToViewport();}
  function togglePresentation(){var active=fullscreenElement();if(active){var exit=document.exitFullscreen||document.webkitExitFullscreen;if(exit){try{var result=exit.call(document);if(result&&typeof result.catch==='function')result.catch(function(){});}catch(e){}}return;}var root=document.documentElement;var request=root.requestFullscreen||root.webkitRequestFullscreen;if(request){try{var result=request.call(root);if(result&&typeof result.catch==='function')result.catch(function(){});}catch(e){}}}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function escapeHtml(value){var map={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};return String(value||'').replace(/[&<>"']/g,function(c){return map[c];});}
  function scormReady(){return typeof doLMSSetValue==='function';}
  function setValue(name,value){if(!scormReady())return;try{doLMSSetValue(name,String(value));}catch(e){}}
  function getValue(name){if(typeof doLMSGetValue!=='function')return '';try{return doLMSGetValue(name)||'';}catch(e){return '';}}
  function sessionTime(){var ms=Math.max(0,Date.now()-sessionStarted);var total=Math.floor(ms/1000);var h=Math.floor(total/3600);var m=Math.floor((total%3600)/60);var s=total%60;var cs=Math.floor((ms%1000)/10);function pad(n,width){var value=String(n);while(value.length<width)value='0'+value;return value;}return pad(h,4)+':'+pad(m,2)+':'+pad(s,2)+'.'+pad(cs,2);}
  function interactionDuration(ms){var totalCs=Math.max(0,Math.floor(Number(ms||0)/10));var cs=totalCs%100;var total=Math.floor(totalCs/100);var s=total%60;var m=Math.floor(total/60)%60;var h=Math.floor(total/3600);function pad(n,width){var value=String(n);while(value.length<width)value='0'+value;return value;}return pad(h,4)+':'+pad(m,2)+':'+pad(s,2)+'.'+pad(cs,2);}
  function markSlideVisit(){if(state.current>=0&&state.current<slideCount)state.slideVisits[state.current]=Math.max(0,Number(state.slideVisits[state.current])||0)+1;}
  function writeSlideTiming(index){if(index<0||index>=slideCount)return;var milliseconds=Math.max(0,Math.round(Number(state.slideTimesMs[index])||0));var visits=Math.max(0,Math.round(Number(state.slideVisits[index])||0));var base='cmi.interactions.'+index;setValue(base+'.id','slide_'+(index+1));setValue(base+'.type','other');setValue(base+'.description','Slide '+(index+1)+' viewing time');setValue(base+'.student_response',milliseconds>=1500?'viewed':'skipped');setValue(base+'.result','neutral');setValue(base+'.weighting','0');setValue(base+'.latency',interactionDuration(milliseconds));setValue('quizmoto.slide_time.'+index+'.milliseconds',milliseconds);setValue('quizmoto.slide_time.'+index+'.visits',visits);}
  function recordPageTime(){var now=Date.now();if(pageTimingActive&&state.current>=0&&state.current<slideCount){var elapsed=Math.max(0,now-pageEnteredAt);state.slideTimesMs[state.current]=Math.max(0,Number(state.slideTimesMs[state.current])||0)+elapsed;writeSlideTiming(state.current);}pageEnteredAt=now;}
  function score(){var hits=0;for(var i=0;i<data.quiz.questions.length;i+=1){if(Number(state.answers[i])===data.quiz.questions[i].correctAnswer)hits+=1;}return data.quiz.questions.length?Math.round(hits/data.quiz.questions.length*100):100;}
  function progress(){return Math.round((state.maxVisited+1)/Math.max(1,pages.length)*100);}
  function serialise(){return JSON.stringify({v:2,current:state.current,maxVisited:state.maxVisited,answers:state.answers,completed:state.completed,slideTimesMs:state.slideTimesMs,slideVisits:state.slideVisits});}
  function commit(){recordPageTime();if(!scormReady())return;setValue('cmi.core.session_time',sessionTime());setValue('cmi.core.lesson_location',state.current);setValue('cmi.suspend_data',serialise());setValue('quizmoto.progress_percent',progress());try{doLMSCommit();}catch(e){}}
  function restore(){var raw=getValue('cmi.suspend_data');if(!raw)return;try{var saved=JSON.parse(raw);if(saved&&(saved.v===1||saved.v===2)){state.current=clamp(Number(saved.current)||0,0,pages.length-1);state.maxVisited=clamp(Number(saved.maxVisited)||0,0,pages.length-1);state.answers=Array.isArray(saved.answers)?saved.answers:[];state.completed=Boolean(saved.completed);if(Array.isArray(saved.slideTimesMs)){for(var i=0;i<slideCount;i+=1)state.slideTimesMs[i]=Math.max(0,Number(saved.slideTimesMs[i])||0);}if(Array.isArray(saved.slideVisits)){for(var j=0;j<slideCount;j+=1)state.slideVisits[j]=Math.max(0,Number(saved.slideVisits[j])||0);}}}catch(e){}}
  function trackAnswer(index,selected){var question=data.quiz.questions[index];var interactionIndex=slideCount+index;setValue('cmi.interactions.'+interactionIndex+'.id',question.id);setValue('cmi.interactions.'+interactionIndex+'.type','choice');setValue('cmi.interactions.'+interactionIndex+'.student_response',String(selected));setValue('cmi.interactions.'+interactionIndex+'.correct_responses.0.pattern',String(question.correctAnswer));setValue('cmi.interactions.'+interactionIndex+'.result',selected===question.correctAnswer?'correct':'wrong');}
  function finish(){if(state.completed)return;state.completed=true;var result=score();setValue('cmi.core.score.raw',result);setValue('cmi.core.score.min','0');setValue('cmi.core.score.max','100');setValue('cmi.core.lesson_status',result>=data.passScore?'passed':'failed');setValue('cmi.core.exit','');commit();if(commitTimer)clearInterval(commitTimer);if(typeof doLMSFinish==='function'){try{doLMSFinish();}catch(e){}}var button=byId('next');button.disabled=true;button.textContent='Completed';try{window.opener&&window.opener.postMessage({type:'quizmoto_scorm_exit'},'*');}catch(e){}}
  function createPages(){var root=byId('pages');data.slides.forEach(function(slide,index){var page=document.createElement('section');page.className='page presentation-page';page.setAttribute('aria-label','Slide '+(index+1)+' of '+slideCount);var image=document.createElement('img');image.alt='Presentation slide '+(index+1);image.width=slide.width;image.height=slide.height;image.dataset.src=slide.src;image.decoding='async';image.loading='eager';page.appendChild(image);root.appendChild(page);pages.push(page);});data.quiz.questions.forEach(function(question,index){var page=document.createElement('section');page.className='page quiz-page';page.setAttribute('aria-label','Quiz question '+(index+1));var options=question.options.map(function(option,optionIndex){return '<button type="button" class="option" data-question="'+index+'" data-option="'+optionIndex+'">'+escapeHtml(option)+'</button>';}).join('');page.innerHTML='<div class="quiz-card"><p class="eyebrow">'+escapeHtml(data.quiz.title)+' · '+(index+1)+' of '+data.quiz.questions.length+'</p><h2 class="question">'+escapeHtml(question.question)+'</h2><div class="options">'+options+'</div><div class="feedback" id="feedback-'+index+'"></div></div>';root.appendChild(page);pages.push(page);});var result=document.createElement('section');result.className='page result-page';result.setAttribute('aria-label','Course result');result.innerHTML='<div class="result-card"><p class="eyebrow">Course complete</p><h2 class="result-title" id="result-title">Your result</h2><div class="score-ring" id="score-ring"><span class="score-value" id="score-value">0%</span></div><p class="result-copy" id="result-copy"></p></div>';root.appendChild(result);pages.push(result);root.addEventListener('click',function(event){var button=event.target.closest('.option');if(!button)return;answer(Number(button.dataset.question),Number(button.dataset.option));});}
  function preloadSlideImages(){var status=byId('course-loader-status'),completed=0;function progress(){if(status)status.textContent='Loading slide '+Math.min(completed+1,slideCount)+' of '+slideCount+'…';}progress();return Promise.all(data.slides.map(function(slide){return new Promise(function(resolve){var image=new Image(),settled=false;function done(){if(settled)return;settled=true;completed+=1;if(status)status.textContent=completed>=slideCount?'Presentation ready':'Loading slide '+(completed+1)+' of '+slideCount+'…';resolve();}var timer=setTimeout(done,20000);image.onload=function(){clearTimeout(timer);if(typeof image.decode==='function'){image.decode().catch(function(){}).then(done);}else done();};image.onerror=function(){clearTimeout(timer);done();};image.src=slide.src;});})).then(function(){for(var i=0;i<slideCount;i+=1){var rendered=pages[i]&&pages[i].querySelector('img');if(rendered&&!rendered.src)rendered.src=rendered.dataset.src;}});}
  function revealCourse(){var loader=byId('course-loader'),app=byId('app');if(app)app.setAttribute('aria-busy','false');if(loader){loader.classList.add('is-ready');loader.setAttribute('aria-hidden','true');setTimeout(function(){if(loader.parentNode)loader.parentNode.removeChild(loader);},260);}}
  function loadImage(index){if(index<0||index>=slideCount)return;var image=pages[index].querySelector('img');if(image&&!image.src&&image.dataset.src){image.src=image.dataset.src;}}
  function showAnswer(index){var selected=state.answers[index];if(selected===undefined||selected===null)return;var question=data.quiz.questions[index];var buttons=pages[quizStart+index].querySelectorAll('.option');for(var i=0;i<buttons.length;i+=1){buttons[i].disabled=true;if(i===question.correctAnswer)buttons[i].classList.add('correct');else if(i===Number(selected))buttons[i].classList.add('incorrect');}var feedback=byId('feedback-'+index);var correct=Number(selected)===question.correctAnswer;feedback.className='feedback show '+(correct?'correct':'incorrect');feedback.textContent=(correct?'Correct. ':'Not quite. ')+(question.explanation||('The correct answer is '+question.options[question.correctAnswer]+'.'));}
  function answer(index,selected){if(state.answers[index]!==undefined&&state.answers[index]!==null)return;state.answers[index]=selected;showAnswer(index);trackAnswer(index,selected);update();commit();}
  function renderResult(){var value=score();byId('score-value').textContent=value+'%';byId('score-ring').style.setProperty('--score-angle',(value*3.6)+'deg');var passed=value>=data.passScore;byId('result-title').textContent=passed?'Course passed':'Course completed';byId('result-copy').textContent=passed?'You passed the knowledge check. Select Finish to send the final result to your learning platform.':'Your result was saved. Review the course and try the quiz again if your learning platform allows another attempt.';setValue('cmi.core.score.raw',value);setValue('cmi.core.score.min','0');setValue('cmi.core.score.max','100');setValue('cmi.core.lesson_status',passed?'passed':'failed');}
  function update(){for(var i=0;i<pages.length;i+=1)pages[i].classList.toggle('active',i===state.current);loadImage(state.current);loadImage(state.current+1);if(state.current>=quizStart&&state.current<resultIndex)showAnswer(state.current-quizStart);if(state.current===resultIndex)renderResult();var currentQuestion=state.current>=quizStart&&state.current<resultIndex?state.current-quizStart:-1;var answered=currentQuestion<0||state.answers[currentQuestion]!==undefined;var next=byId('next');byId('previous').disabled=state.current===0;next.disabled=!answered||(state.completed&&state.current===resultIndex);next.textContent=state.current===resultIndex?(state.completed?'Completed':'Finish'):'Next';var percent=progress();byId('progress-fill').style.width=percent+'%';byId('progress-label').textContent=percent+'%';var label=state.current<slideCount?'Slide '+(state.current+1)+' of '+slideCount:state.current<resultIndex?'Quiz '+(state.current-quizStart+1)+' of '+data.quiz.questions.length:'Results';byId('counter').textContent=label;}
  function move(delta){if(delta>0&&state.current===resultIndex){finish();return;}var target=clamp(state.current+delta,0,pages.length-1);if(target===state.current)return;recordPageTime();state.current=target;pageEnteredAt=Date.now();markSlideVisit();state.maxVisited=Math.max(state.maxVisited,state.current);update();commit();}
  function startCourse(){for(var i=0;i<state.answers.length;i+=1){if(state.answers[i]!==undefined&&state.answers[i]!==null)trackAnswer(i,Number(state.answers[i]));}state.maxVisited=Math.max(state.maxVisited,state.current);markSlideVisit();pageEnteredAt=Date.now();update();commit();commitTimer=setInterval(function(){if(!state.completed)commit();},15000);revealCourse();}
  function initialise(){fitRailToViewport();createPages();if(typeof doLMSInitialize==='function'){try{doLMSInitialize();}catch(e){}setValue('cmi.core.score.min','0');setValue('cmi.core.score.max','100');var status=getValue('cmi.core.lesson_status');if(!status||status==='not attempted')setValue('cmi.core.lesson_status','incomplete');restore();}preloadSlideImages().then(startCourse,startCourse);}
  byId('previous').addEventListener('click',function(){move(-1);});
  byId('next').addEventListener('click',function(){move(1);});
  byId('presentation').addEventListener('click',togglePresentation);
  document.addEventListener('fullscreenchange',updatePresentationButton);
  document.addEventListener('webkitfullscreenchange',updatePresentationButton);
  document.addEventListener('visibilitychange',function(){if(document.hidden){recordPageTime();pageTimingActive=false;commit();}else{pageTimingActive=true;pageEnteredAt=Date.now();}});
  window.addEventListener('resize',fitRailToViewport);
  window.addEventListener('keydown',function(event){if(event.key==='ArrowLeft')move(-1);if(event.key==='ArrowRight'&&!byId('next').disabled)move(1);});
  window.addEventListener('beforeunload',function(){if(state.completed)return;setValue('cmi.core.exit','suspend');commit();});
  initialise();
})();
</script>
</body>
</html>`;
}

async function buildPresentationScormZip({ title, slides, quiz, passScore = 70, logoDataUrl = '' }) {
    if (!Array.isArray(slides) || !slides.length) {
        const error = new Error('At least one rendered slide is required.');
        error.code = 'SCORM_PRESENTATION_EMPTY';
        throw error;
    }
    const normalizedQuiz = normalizeQuiz(quiz);
    if (!normalizedQuiz.questions.length) {
        const error = new Error('A presentation course requires at least one valid quiz question.');
        error.code = 'SCORM_PRESENTATION_QUIZ_EMPTY';
        throw error;
    }
    const normalizedTheme = normalizeTheme();
    const numericPassScore = Number(passScore);
    const normalizedPassScore = Math.max(0, Math.min(100, Number.isFinite(numericPassScore) ? numericPassScore : 70));
    const zip = new JSZip();
    const logoAsset = decodeLogoDataUrl(logoDataUrl);
    const fontAssets = presentationFontAssets();
    slides.forEach((slide) => zip.file(slide.path, slide.body));
    if (logoAsset) zip.file(logoAsset.path, logoAsset.body);
    fontAssets.forEach((asset) => zip.file(asset.path, asset.body));
    zip.file('index.html', buildPlayerHtml({
        title: String(title || 'Presentation Course').trim().slice(0, 200) || 'Presentation Course',
        slides,
        quiz: normalizedQuiz,
        theme: normalizedTheme,
        passScore: normalizedPassScore,
        logoPath: logoAsset?.path || '',
        fontAssets
    }));
    zip.file('scorm_api_wrapper.js', SCORM_WRAPPER);
    zip.file('content.json', JSON.stringify({
        generatedBy: 'lmsgen-presentation-import',
        version: 1,
        title,
        courseMode: 'presentation',
        slideCount: slides.length,
        quiz: normalizedQuiz,
        theme: normalizedTheme,
        branding: { logoPath: logoAsset?.path || '' },
        playerFont: 'Open Sauce Sans',
        passScore: normalizedPassScore
    }, null, 2));

    const resourceFiles = [
        'index.html',
        'scorm_api_wrapper.js',
        'content.json',
        ...(logoAsset ? [logoAsset.path] : []),
        ...fontAssets.map((asset) => asset.path),
        ...slides.map((slide) => slide.path)
    ].map((file) => `      <file href="${escapeXml(file)}"/>`).join('\n');
    zip.file('imsmanifest.xml', `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.lmsgen.presentation.${Date.now()}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG-1"><organization identifier="ORG-1"><title>${escapeXml(title)}</title><item identifier="ITEM-1" identifierref="RES-1"><title>${escapeXml(title)}</title></item></organization></organizations>
  <resources><resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
${resourceFiles}
  </resource></resources>
</manifest>`);

    return zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });
}

module.exports = {
    SCORM_WRAPPER,
    QUIZMOTO_PRESENTATION_THEME,
    escapeXml,
    normalizeTheme,
    normalizeQuiz,
    decodeLogoDataUrl,
    presentationFontAssets,
    buildPlayerHtml,
    buildPresentationScormZip
};
