const JSZip = require('jszip');
const { buildScormPackageZip: buildVisualPackage } = require('./ScormVisualThemeFinalizer');

const MOBILE_COURSE_CSS = `
<style id="quizmoto-mobile-course-css">
@media (max-width: 680px){
  html,body{font-size:14px}
  #app{min-height:100%;height:100%}
  header{height:52px;padding:0 10px;gap:8px}
  .brand-mark{width:30px;height:30px;border-radius:10px;font-size:12px;flex:0 0 auto}
  header h1{font-size:11px;max-width:32vw}
  .progress-shell{height:5px;max-width:100px;margin-left:auto}
  .progress-text{font-size:9px;white-space:nowrap}
  main{min-height:0}
  .slide{padding:10px 10px 12px}
  .slide.active{align-items:flex-start}
  .stage{width:100%;padding:0;margin:auto}
  footer{height:56px;padding:0 10px;gap:8px}
  .nav-btn{padding:9px 12px;border-radius:10px;font-size:11px;min-width:0}
  .part{font-size:8px;letter-spacing:.09em;max-width:38vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .eyebrow{font-size:9px;letter-spacing:.11em}
  .title{font-size:clamp(20px,6vw,26px);line-height:1.08;margin:5px 0 8px;letter-spacing:-.025em}
  .lead{font-size:12px;line-height:1.48;max-width:none}
  .section-head{margin-bottom:12px}
  .section-head .title{font-size:clamp(19px,5.8vw,24px);margin-bottom:6px}
  .glass{border-radius:18px;box-shadow:0 10px 28px rgba(15,23,42,.08)}
  .hero{grid-template-columns:1fr;gap:14px;padding:16px}
  .hero-art{min-height:155px;border-radius:18px}
  .hero-core svg{width:92px;height:92px}
  .kp-row{gap:6px;margin-top:12px}
  .chip{font-size:9px;padding:6px 8px}
  .cards-grid{grid-template-columns:1fr;gap:8px}
  .concept-card{padding:12px 12px 12px 15px;border-radius:14px;box-shadow:none}
  .concept-number{width:28px;height:28px;border-radius:9px;margin-bottom:7px;font-size:11px}
  .concept-card p{font-size:11px;line-height:1.4}
  .process{grid-template-columns:1fr;gap:8px}
  .step{min-height:0;padding:12px;border-radius:14px}
  .step:not(:last-child):after{display:none}
  .step-no{font-size:8px}
  .step p{font-size:11px;line-height:1.4;margin-top:6px}
  .timeline{grid-template-columns:1fr;gap:8px;padding-top:0}
  .timeline:before{display:none}
  .milestone{display:grid;grid-template-columns:30px 1fr;align-items:start;gap:8px;text-align:left}
  .dot{width:26px;height:26px;border-width:5px;margin:8px 0 0;box-shadow:0 0 0 3px var(--soft)}
  .milestone p{font-size:11px;line-height:1.4;padding:11px;border-radius:13px}
  .compare{grid-template-columns:1fr;gap:9px}
  .compare-col{padding:13px;border-radius:15px}
  .compare-title{font-size:9px;margin-bottom:7px}
  .compare-item{font-size:11px;line-height:1.38;padding:7px 0}
  .badge-dot{width:18px;height:18px;font-size:9px}
  .hub-wrap{grid-template-columns:1fr;gap:12px}
  .hub-svg{max-height:190px}
  .hub-list{grid-template-columns:1fr;gap:7px}
  .hub-item{padding:10px;border-radius:12px;font-size:10.5px;line-height:1.38}
  .spotlight{grid-template-columns:1fr;gap:12px}
  .spot-visual{height:165px;border-radius:18px}
  .spot-visual svg{width:92px;height:92px}
  .takeaway{padding:11px 12px;border-radius:13px;font-size:11px;line-height:1.4;margin-top:10px}
  .quiz-wrap{width:100%;max-width:none}
  .quiz-card{padding:15px;border-radius:18px}
  .quiz-options{grid-template-columns:1fr;gap:7px;margin-top:13px}
  .quiz-option{padding:10px 11px;min-height:44px;border-radius:12px;font-size:11px}
  .feedback{font-size:10px;padding:9px 10px;margin-top:8px}
  .final-card{padding:18px 14px;border-radius:18px}
  .score-ring{width:105px;height:105px;margin:14px auto}
  .score-ring:before{inset:10px}
  .score-ring span{font-size:27px}
}
@media (max-width: 390px){
  header h1{display:none}
  .progress-shell{max-width:78px}
  .slide{padding:8px}
  .title{font-size:20px}
  .section-head .title{font-size:19px}
  .lead{font-size:11px}
  footer{height:52px;padding:0 8px}
  .nav-btn{padding:8px 10px;font-size:10px}
  .part{font-size:7px;max-width:32vw}
  .hero{padding:12px}
  .hero-art{min-height:130px}
}
</style>`;

function patchTrackingRuntime(html) {
    let out = String(html || '');

    // The legacy generated player rendered first, which triggered updateNav()
    // before LMSInitialize(). That made the first lesson_location write fail with
    // SCORM error 301. Initialize first, then render/commit the current screen.
    out = out.replace(
        "window.onload=function(){sessionStartMs=Date.now();render();if(typeof doLMSInitialize==='function'){doLMSInitialize();",
        "window.onload=function(){sessionStartMs=Date.now();lastSessionWriteMs=sessionStartMs;if(typeof doLMSInitialize==='function'){doLMSInitialize();"
    );
    out = out.replace(
        "writeSessionTime();doLMSCommit();commitTimer=setInterval(function(){if(!completed)commitProgress()},15000)}};window.addEventListener('beforeunload'",
        "writeSessionTime();doLMSCommit();commitTimer=setInterval(function(){if(!completed)commitProgress()},15000)}render();};window.addEventListener('beforeunload'"
    );

    // Persist both the zero-based screen location and a small suspend payload on
    // every navigation action. The location remains SCORM 1.2 compatible and is
    // what Quizmoto uses to derive completion percentage and the last screen.
    out = out.replace(
        "commitProgress({'cmi.core.lesson_location':String(currentSlide)})",
        "commitProgress({'cmi.core.lesson_location':String(currentSlide),'cmi.suspend_data':JSON.stringify({quizmotoSlide:currentSlide,quizmotoProgress:p})})"
    );

    // Server commit() rolls session_time into total_time and resets the session
    // accumulator. Write only the time since the previous commit to avoid
    // double-counting cumulative elapsed time on every 15-second commit.
    out = out.replace(
        'sessionStartMs=Date.now(),commitTimer=null;',
        'sessionStartMs=Date.now(),lastSessionWriteMs=sessionStartMs,commitTimer=null;'
    );
    out = out.replace(
        "function writeSessionTime(){if(typeof doLMSSetValue!=='function')return;try{doLMSSetValue('cmi.core.session_time',formatSessionTime(Date.now()-sessionStartMs))}catch(e){}}",
        "function writeSessionTime(){if(typeof doLMSSetValue!=='function')return;try{var now=Date.now();doLMSSetValue('cmi.core.session_time',formatSessionTime(now-lastSessionWriteMs));lastSessionWriteMs=now}catch(e){}}"
    );

    // Expose an explicit synchronous flush hook to the same-origin player shell.
    // The shell calls this before LMSFinish so a mid-course Exit cannot close the
    // runtime first and then lose the iframe's final location/time/suspend commit.
    out = out.replace(
        "window.addEventListener('beforeunload',function(){if(completed)return;try{writeSessionTime();if(typeof doLMSSetValue==='function'){doLMSSetValue('cmi.core.exit','suspend');doLMSCommit()}}catch(e){}})",
        "function flushSuspendState(markExit){if(completed)return true;try{var slides=document.querySelectorAll('.slide');var p=Math.round(currentSlide/Math.max(1,slides.length-1)*100);writeSessionTime();if(typeof doLMSSetValue==='function'){doLMSSetValue('cmi.core.lesson_location',String(currentSlide));doLMSSetValue('cmi.suspend_data',JSON.stringify({quizmotoSlide:currentSlide,quizmotoProgress:p}));doLMSSetValue('cmi.core.lesson_status','incomplete');if(markExit!==false)doLMSSetValue('cmi.core.exit','suspend');return typeof doLMSCommit==='function'?doLMSCommit()!=='false':true}}catch(e){}return false}window.__quizmotoFlushScormState=flushSuspendState;window.addEventListener('beforeunload',function(){flushSuspendState(true)})"
    );

    return out;
}

function patchMobileCourse(html) {
    const source = String(html || '');
    if (!source || source.includes('quizmoto-mobile-course-css')) return source;
    if (source.includes('</head>')) {
        return source.replace('</head>', `${MOBILE_COURSE_CSS}\n</head>`);
    }
    return `${MOBILE_COURSE_CSS}\n${source}`;
}

async function buildScormPackageZip(rawAnalysis, opts = {}) {
    const baseBuffer = await buildVisualPackage(rawAnalysis, opts);
    const zip = await JSZip.loadAsync(baseBuffer);
    const indexFile = zip.file('index.html');
    if (!indexFile) return baseBuffer;

    const html = await indexFile.async('string');
    const patched = patchMobileCourse(patchTrackingRuntime(html));
    zip.file('index.html', patched);

    const contentFile = zip.file('content.json');
    if (contentFile) {
        try {
            const content = JSON.parse(await contentFile.async('string'));
            zip.file('content.json', JSON.stringify({
                ...content,
                trackingVersion: 3,
                progressTracking: 'lesson_location',
                exitTracking: 'synchronous_suspend_flush',
                mobileOptimized: true,
                mobileLayoutVersion: 1
            }, null, 2));
        } catch (_) {
            // Keep the original content.json if an older package has malformed metadata.
        }
    }

    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = {
    buildScormPackageZip,
    patchTrackingRuntime,
    patchMobileCourse,
    MOBILE_COURSE_CSS
};
