const JSZip = require('jszip');
const { buildScormPackageZip: buildVisualPackage } = require('./ScormVisualThemeFinalizer');

const MOBILE_COURSE_CSS = `
<style id="quizmoto-mobile-course-css">
html,body{width:100%;max-width:100%;overscroll-behavior:none;-webkit-text-size-adjust:100%;text-size-adjust:100%}
#app{min-height:100vh;height:100vh;min-height:100dvh;height:100dvh;max-width:100vw;overflow:hidden}
main{min-width:0;min-height:0;overflow:hidden}
.slide{-webkit-overflow-scrolling:touch;overscroll-behavior:contain;scrollbar-gutter:stable}
button{-webkit-tap-highlight-color:transparent;touch-action:manipulation}

@media (max-width: 680px){
  html,body{font-size:16px;background:#05070D}
  #app{min-height:100dvh;height:100dvh}
  header{
    height:calc(58px + env(safe-area-inset-top));
    min-height:calc(58px + env(safe-area-inset-top));
    padding-top:env(safe-area-inset-top);
    padding-right:max(14px,env(safe-area-inset-right));
    padding-left:max(14px,env(safe-area-inset-left));
    padding-bottom:0;
    gap:10px;
  }
  .brand-mark{width:36px!important;height:36px!important;border-radius:12px!important;font-size:13px;flex:0 0 auto}
  header h1{font-size:13px!important;line-height:1.2;max-width:36vw;color:#E8EEF7!important}
  .progress-shell{height:6px!important;max-width:112px;margin-left:auto;flex:1 1 70px}
  .progress-text{font-size:11px!important;white-space:nowrap}
  main{min-height:0}
  .slide{padding:16px 14px 20px!important;scroll-padding-bottom:84px}
  .slide.active{align-items:flex-start!important;justify-content:center!important}
  .stage,.qmx-stage{width:100%!important;padding:0;margin:auto}
  footer{
    height:calc(64px + env(safe-area-inset-bottom));
    min-height:calc(64px + env(safe-area-inset-bottom));
    padding-top:8px!important;
    padding-right:max(14px,env(safe-area-inset-right))!important;
    padding-bottom:max(8px,env(safe-area-inset-bottom))!important;
    padding-left:max(14px,env(safe-area-inset-left))!important;
    gap:10px;
  }
  .nav-btn{min-height:44px!important;padding:10px 15px!important;border-radius:12px!important;font-size:13px!important;line-height:1.15;min-width:78px;display:inline-flex;align-items:center;justify-content:center}
  .part{font-size:11px!important;line-height:1.2;letter-spacing:.04em!important;max-width:34vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center}
  .eyebrow,.qmx-kicker{font-size:11px!important;letter-spacing:.08em!important;line-height:1.3}
  .title{font-size:clamp(26px,7.5vw,34px)!important;line-height:1.04!important;margin:7px 0 11px!important;letter-spacing:-.035em!important;text-wrap:balance}
  .lead{font-size:15px!important;line-height:1.62!important;max-width:none}
  .section-head{margin-bottom:18px}
  .section-head .title{font-size:clamp(24px,7vw,31px)!important;margin-bottom:9px!important}
  .glass{border-radius:20px!important}
  .hero{grid-template-columns:1fr!important;gap:18px!important;padding:20px!important}
  .hero-art{min-height:210px!important;height:210px!important;border-radius:20px!important}
  .hero-core svg{width:128px!important;height:128px!important}
  .kp-row{gap:8px!important;margin-top:16px!important}
  .chip{font-size:12px!important;line-height:1.25;padding:8px 10px!important}
  .cards-grid{grid-template-columns:1fr!important;gap:10px!important}
  .concept-card{padding:16px 16px 16px 19px!important;border-radius:16px!important}
  .concept-number{width:34px!important;height:34px!important;border-radius:10px!important;margin-bottom:10px!important;font-size:13px!important}
  .concept-card p{font-size:14px!important;line-height:1.5!important}
  .process{grid-template-columns:1fr!important;gap:10px!important}
  .step{min-height:0!important;padding:16px!important;border-radius:16px!important}
  .step:not(:last-child):after{display:none!important}
  .step-no{font-size:11px!important}
  .step p{font-size:14px!important;line-height:1.5!important;margin-top:8px!important}
  .timeline{grid-template-columns:1fr!important;gap:10px!important;padding-top:0!important}
  .timeline:before{display:none!important}
  .milestone{display:grid;grid-template-columns:38px 1fr;align-items:start;gap:10px;text-align:left}
  .dot{width:30px!important;height:30px!important;border-width:5px!important;margin:10px 0 0!important}
  .milestone p{font-size:14px!important;line-height:1.5!important;padding:14px!important;border-radius:15px!important}
  .compare{grid-template-columns:1fr!important;gap:11px!important}
  .compare-col{padding:16px!important;border-radius:17px!important}
  .compare-title{font-size:11px!important;margin-bottom:9px!important}
  .compare-item{font-size:14px!important;line-height:1.48!important;padding:9px 0!important}
  .badge-dot{width:24px!important;height:24px!important;font-size:12px!important}
  .hub-wrap{grid-template-columns:1fr!important;gap:14px!important}
  .hub-svg{max-height:250px!important}
  .hub-list{grid-template-columns:1fr!important;gap:8px!important}
  .hub-item{padding:13px!important;border-radius:14px!important;font-size:13px!important;line-height:1.48!important}
  .spotlight{grid-template-columns:1fr!important;gap:15px!important}
  .spot-visual{height:220px!important;border-radius:20px!important}
  .spot-visual svg{width:130px!important;height:130px!important}
  .takeaway{padding:14px 15px!important;border-radius:15px!important;font-size:14px!important;line-height:1.5!important;margin-top:12px!important}
  .quiz-wrap{width:100%;max-width:none!important}
  .quiz-card{padding:20px!important;border-radius:20px!important}
  .quiz-options{grid-template-columns:1fr!important;gap:10px!important;margin-top:17px!important}
  .quiz-option{padding:13px 14px!important;min-height:52px!important;border-radius:14px!important;font-size:14px!important;line-height:1.35!important}
  .feedback{font-size:13px!important;line-height:1.5!important;padding:12px 13px!important;margin-top:10px!important}
  .final-card{padding:24px 18px!important;border-radius:20px!important}
  .score-ring{width:122px!important;height:122px!important;margin:18px auto!important}
  .score-ring:before{inset:11px!important}
  .score-ring span{font-size:31px!important}

  .qmx-frame,.qmx-frame.qmx-wide{grid-template-columns:1fr!important;gap:14px!important}
  .qmx-copy{padding:20px!important;border-radius:20px!important}
  .qmx-copy h2{font-size:clamp(26px,7vw,34px)!important;line-height:1.04!important;margin-bottom:12px!important}
  .qmx-copy p{font-size:15px!important;line-height:1.62!important}
  .qmx-toolbar{margin-top:17px!important;gap:10px!important;align-items:flex-start!important;flex-direction:column!important}
  .qmx-points{width:100%;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px!important}
  .qmx-point{min-height:44px!important;min-width:0!important;padding:10px 12px!important;font-size:13px!important;line-height:1.2!important;text-align:center}
  .qmx-count{font-size:11px!important;line-height:1.3!important;white-space:normal!important}
  .qmx-detail{min-height:72px!important;margin-top:12px!important;padding:14px 15px!important;border-radius:14px!important;font-size:14px!important;line-height:1.5!important}
  .qmx-detail-label{font-size:10px!important;line-height:1.25!important;margin-bottom:5px!important}
  .qmx-prompt{font-size:12px!important;line-height:1.45!important;margin-top:9px!important}
  .qmx-badge{font-size:10px!important;right:10px!important;top:10px!important;padding:7px 9px!important}
  .qmx-visual,.qmx-frame.qmx-wide .qmx-visual{min-height:300px!important;border-radius:18px!important;padding:8px!important;order:2}
  .qmx-copy{order:1}
  .qmx-visual img{width:100%;height:auto;max-width:100%;max-height:340px;object-fit:contain}
  .qmx-visual.qmx-visual-pan{display:block!important;min-height:390px!important;overflow-x:auto!important;overflow-y:hidden!important;scroll-snap-type:x proximity;overscroll-behavior-inline:contain;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y;scrollbar-width:thin}
  .qmx-visual.qmx-visual-pan img{width:680px!important;min-width:680px!important;max-width:none!important;height:auto!important;max-height:none!important;scroll-snap-align:center;margin:0!important}
  .qmx-pan-hint{position:sticky;left:12px;bottom:10px;display:inline-flex;align-items:center;gap:5px;background:rgba(5,10,18,.9);color:#E7EEF8;border:1px solid #334861;border-radius:999px;padding:7px 9px;font-size:11px;font-weight:700;line-height:1;pointer-events:none;box-shadow:0 6px 18px rgba(0,0,0,.22);transition:opacity .2s ease}
  .qmx-visual.has-panned .qmx-pan-hint{opacity:0}
}

@media (max-width: 390px){
  header h1{display:none}
  .progress-shell{max-width:94px}
  .progress-text{display:none!important}
  .slide{padding:14px 10px 18px!important}
  .title{font-size:25px!important}
  .section-head .title{font-size:23px!important}
  .lead,.qmx-copy p{font-size:14px!important}
  footer{gap:7px}
  .nav-btn{font-size:12px!important;min-width:72px;padding-left:12px!important;padding-right:12px!important}
  .part{font-size:10px!important;max-width:30vw}
  .hero{padding:16px!important}
  .hero-art{min-height:185px!important;height:185px!important}
  .qmx-copy{padding:17px!important}
  .qmx-points{grid-template-columns:1fr 1fr}
  .qmx-point{font-size:12px!important}
  .qmx-visual.qmx-visual-pan{min-height:372px!important}
  .qmx-visual.qmx-visual-pan img{width:650px!important;min-width:650px!important}
}

@media (orientation: landscape) and (max-height: 500px) and (min-width: 560px) and (max-width: 1024px){
  header{height:50px!important;min-height:50px!important;padding-top:0!important;padding-left:max(14px,env(safe-area-inset-left))!important;padding-right:max(14px,env(safe-area-inset-right))!important}
  footer{height:56px!important;min-height:56px!important;padding-top:5px!important;padding-bottom:max(5px,env(safe-area-inset-bottom))!important;padding-left:max(14px,env(safe-area-inset-left))!important;padding-right:max(14px,env(safe-area-inset-right))!important}
  .brand-mark{width:32px!important;height:32px!important}
  header h1{font-size:12px!important;max-width:28vw}
  .slide{padding:10px max(14px,env(safe-area-inset-right)) 12px max(14px,env(safe-area-inset-left))!important}
  .qmx-frame,.qmx-frame.qmx-wide{grid-template-columns:minmax(250px,.82fr) minmax(360px,1.18fr)!important;gap:12px!important;align-items:start!important}
  .qmx-copy{padding:16px!important;max-height:calc(100dvh - 126px);overflow:auto}
  .qmx-copy h2{font-size:24px!important;margin-bottom:8px!important}
  .qmx-copy p{font-size:13px!important;line-height:1.48!important}
  .qmx-toolbar{margin-top:10px!important}
  .qmx-points{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important}
  .qmx-point{min-height:44px!important;font-size:12px!important;padding:8px!important}
  .qmx-detail{min-height:56px!important;font-size:12px!important;padding:10px 11px!important}
  .qmx-prompt{display:none!important}
  .qmx-visual,.qmx-frame.qmx-wide .qmx-visual{min-height:270px!important;max-height:calc(100dvh - 126px);padding:6px!important}
  .qmx-visual img{max-height:290px!important}
  .qmx-visual.qmx-visual-pan{min-height:285px!important;overflow-x:auto!important}
  .qmx-visual.qmx-visual-pan img{width:560px!important;min-width:560px!important;max-height:none!important}
  .quiz-card{padding:16px!important}.quiz-card .title{font-size:24px!important}.quiz-options{grid-template-columns:1fr 1fr!important;gap:8px!important}.quiz-option{min-height:44px!important;font-size:13px!important;padding:10px!important}
  .nav-btn{min-height:44px!important;font-size:12px!important}.part{font-size:10px!important}
}

@media (prefers-reduced-motion: reduce){
  .qmx-pan-hint{transition:none!important}
}
</style>`;

function patchTrackingRuntime(html) {
    let out = String(html || '');

    // Initialize the LMS before rendering the first tracked screen.
    out = out.replace(
        "window.onload=function(){sessionStartMs=Date.now();render();if(typeof doLMSInitialize==='function'){doLMSInitialize();",
        "window.onload=function(){sessionStartMs=Date.now();lastSessionWriteMs=sessionStartMs;if(typeof doLMSInitialize==='function'){doLMSInitialize();"
    );
    out = out.replace(
        "writeSessionTime();doLMSCommit();commitTimer=setInterval(function(){if(!completed)commitProgress()},15000)}};window.addEventListener('beforeunload'",
        "writeSessionTime();doLMSCommit();commitTimer=setInterval(function(){if(!completed)commitProgress()},15000)}render();};window.addEventListener('beforeunload'"
    );

    // Restore location, completion state and answered knowledge checks from
    // cmi.suspend_data before render(). This keeps final scoring correct after a
    // learner exits and resumes midway through a course.
    out = out.replace(
        "doLMSInitialize();doLMSSetValue('cmi.core.score.min','0');doLMSSetValue('cmi.core.score.max','100');doLMSSetValue('cmi.core.lesson_status','incomplete');",
        "doLMSInitialize();var savedStatus='';try{var savedLocation=typeof doLMSGetValue==='function'?doLMSGetValue('cmi.core.lesson_location'):'';savedStatus=typeof doLMSGetValue==='function'?doLMSGetValue('cmi.core.lesson_status'):'';var savedSuspend=typeof doLMSGetValue==='function'?doLMSGetValue('cmi.suspend_data'):'';if(/^\\d+$/.test(String(savedLocation||'')))currentSlide=Math.max(0,Number(savedLocation));if(savedSuspend){var resumeData=JSON.parse(savedSuspend);if(Array.isArray(resumeData.quizmotoQuizResults))quizResults=resumeData.quizmotoQuizResults.slice()}}catch(e){}doLMSSetValue('cmi.core.score.min','0');doLMSSetValue('cmi.core.score.max','100');if(!/^(completed|passed|failed)$/i.test(String(savedStatus||'')))doLMSSetValue('cmi.core.lesson_status','incomplete');"
    );
    // Upgrade tracking-v4/v5 HTML that already has location/status restore but not
    // quiz-result restore.
    out = out.replace(
        "savedStatus=typeof doLMSGetValue==='function'?doLMSGetValue('cmi.core.lesson_status'):'';if(/^\\d+$/.test(String(savedLocation||'')))currentSlide=Math.max(0,Number(savedLocation))",
        "savedStatus=typeof doLMSGetValue==='function'?doLMSGetValue('cmi.core.lesson_status'):'';var savedSuspend=typeof doLMSGetValue==='function'?doLMSGetValue('cmi.suspend_data'):'';if(/^\\d+$/.test(String(savedLocation||'')))currentSlide=Math.max(0,Number(savedLocation));if(savedSuspend){var resumeData=JSON.parse(savedSuspend);if(Array.isArray(resumeData.quizmotoQuizResults))quizResults=resumeData.quizmotoQuizResults.slice()}"
    );

    // Rehydrate answered-question visual state after render() has created the
    // quiz buttons. Answered questions remain locked, their selected/correct state
    // is visible, and the learner cannot submit the same question twice.
    const resumeRender = "el('finish-btn').addEventListener('click',exitSco);var resumeSlides=area.querySelectorAll('.slide');if(currentSlide>0&&currentSlide<resumeSlides.length){resumeSlides[0].classList.remove('active');resumeSlides[currentSlide].classList.add('active')}else if(currentSlide<0||currentSlide>=resumeSlides.length){currentSlide=0}updateNav()}";
    const resumeRenderWithQuiz = "el('finish-btn').addEventListener('click',exitSco);(data.quiz||[]).forEach(function(q,qi){var chosen=quizResults[qi];if(chosen===undefined||chosen===null)return;chosen=Number(chosen);var container=el('opts-'+qi);if(!container)return;var btns=container.querySelectorAll('button');btns.forEach(function(b,i){b.disabled=true;if(i===q.correctAnswer)b.classList.add('correct');else if(i===chosen)b.classList.add('incorrect')});var fb=el('fb-'+qi);if(fb){fb.style.display='block';if(chosen===q.correctAnswer){fb.textContent='Correct — well done.';fb.style.background='#f0fdf4';fb.style.color='#166534'}else{fb.textContent='Not quite. Review the highlighted correct answer.';fb.style.background='#fef2f2';fb.style.color='#991b1b'}}});var resumeSlides=area.querySelectorAll('.slide');if(currentSlide>0&&currentSlide<resumeSlides.length){resumeSlides[0].classList.remove('active');resumeSlides[currentSlide].classList.add('active')}else if(currentSlide<0||currentSlide>=resumeSlides.length){currentSlide=0}updateNav()}";
    out = out.replace(
        "el('finish-btn').addEventListener('click',exitSco);updateNav()}",
        resumeRenderWithQuiz
    );
    out = out.replace(resumeRender, resumeRenderWithQuiz);

    // Use a post-paint debounce for routine navigation persistence.
    out = out.replace(
        'sessionStartMs=Date.now(),commitTimer=null;',
        'sessionStartMs=Date.now(),lastSessionWriteMs=sessionStartMs,commitTimer=null,progressCommitTimer=null;'
    );
    out = out.replace(
        'sessionStartMs=Date.now(),lastSessionWriteMs=sessionStartMs,commitTimer=null;',
        'sessionStartMs=Date.now(),lastSessionWriteMs=sessionStartMs,commitTimer=null,progressCommitTimer=null;'
    );
    if (!out.includes('function scheduleProgressCommit(extra)')) {
        out = out.replace(
            "function commitProgress(extra){if(typeof doLMSSetValue!=='function')return;try{writeSessionTime();if(extra){for(var k in extra){if(Object.prototype.hasOwnProperty.call(extra,k))doLMSSetValue(k,String(extra[k]))}}doLMSCommit()}catch(e){}}",
            "function commitProgress(extra){if(typeof doLMSSetValue!=='function')return;try{writeSessionTime();if(extra){for(var k in extra){if(Object.prototype.hasOwnProperty.call(extra,k))doLMSSetValue(k,String(extra[k]))}}doLMSCommit()}catch(e){}}function scheduleProgressCommit(extra){try{if(progressCommitTimer)clearTimeout(progressCommitTimer)}catch(e){}progressCommitTimer=setTimeout(function(){progressCommitTimer=null;if(!completed)commitProgress(extra)},45)}"
        );
    }

    const legacyLocation = "{'cmi.core.lesson_location':String(currentSlide)}";
    const oldEnrichedProgress = "{'cmi.core.lesson_location':String(currentSlide),'cmi.suspend_data':JSON.stringify({quizmotoSlide:currentSlide,quizmotoProgress:p})}";
    const enrichedProgress = "{'cmi.core.lesson_location':String(currentSlide),'cmi.suspend_data':JSON.stringify({quizmotoSlide:currentSlide,quizmotoProgress:p,quizmotoQuizResults:quizResults})}";
    out = out.replace(`commitProgress(${legacyLocation})`, `scheduleProgressCommit(${enrichedProgress})`);
    out = out.replace(`scheduleProgressCommit(${oldEnrichedProgress})`, `scheduleProgressCommit(${enrichedProgress})`);
    out = out.replace(`commitProgress(${oldEnrichedProgress})`, `scheduleProgressCommit(${enrichedProgress})`);

    // Server commit() rolls session_time into total_time. Write only the delta.
    out = out.replace(
        "function writeSessionTime(){if(typeof doLMSSetValue!=='function')return;try{doLMSSetValue('cmi.core.session_time',formatSessionTime(Date.now()-sessionStartMs))}catch(e){}}",
        "function writeSessionTime(){if(typeof doLMSSetValue!=='function')return;try{var now=Date.now();doLMSSetValue('cmi.core.session_time',formatSessionTime(now-lastSessionWriteMs));lastSessionWriteMs=now}catch(e){}}"
    );

    const oldFlush = "function flushSuspendState(markExit){if(completed)return true;try{if(typeof progressCommitTimer!=='undefined'&&progressCommitTimer){clearTimeout(progressCommitTimer);progressCommitTimer=null}var slides=document.querySelectorAll('.slide');var p=Math.round(currentSlide/Math.max(1,slides.length-1)*100);writeSessionTime();if(typeof doLMSSetValue==='function'){doLMSSetValue('cmi.core.lesson_location',String(currentSlide));doLMSSetValue('cmi.suspend_data',JSON.stringify({quizmotoSlide:currentSlide,quizmotoProgress:p}));doLMSSetValue('cmi.core.lesson_status','incomplete');if(markExit!==false)doLMSSetValue('cmi.core.exit','suspend');return typeof doLMSCommit==='function'?doLMSCommit()!=='false':true}}catch(e){}return false}";
    const newFlush = "function flushSuspendState(markExit){if(completed)return true;try{if(typeof progressCommitTimer!=='undefined'&&progressCommitTimer){clearTimeout(progressCommitTimer);progressCommitTimer=null}var slides=document.querySelectorAll('.slide');var p=Math.round(currentSlide/Math.max(1,slides.length-1)*100);writeSessionTime();if(typeof doLMSSetValue==='function'){doLMSSetValue('cmi.core.lesson_location',String(currentSlide));doLMSSetValue('cmi.suspend_data',JSON.stringify({quizmotoSlide:currentSlide,quizmotoProgress:p,quizmotoQuizResults:quizResults}));doLMSSetValue('cmi.core.lesson_status','incomplete');if(markExit!==false)doLMSSetValue('cmi.core.exit','suspend');return typeof doLMSCommit==='function'?doLMSCommit()!=='false':true}}catch(e){}return false}";
    out = out.replace(oldFlush, newFlush);

    // Original legacy unload path → explicit flush hook with quiz state.
    out = out.replace(
        "window.addEventListener('beforeunload',function(){if(completed)return;try{writeSessionTime();if(typeof doLMSSetValue==='function'){doLMSSetValue('cmi.core.exit','suspend');doLMSCommit()}}catch(e){}})",
        `${newFlush}window.__quizmotoFlushScormState=flushSuspendState;window.addEventListener('beforeunload',function(){flushSuspendState(true)})`
    );
    out = out.replace(
        "function flushSuspendState(markExit){if(completed)return true;try{var slides=document.querySelectorAll('.slide');",
        "function flushSuspendState(markExit){if(completed)return true;try{if(typeof progressCommitTimer!=='undefined'&&progressCommitTimer){clearTimeout(progressCommitTimer);progressCommitTimer=null}var slides=document.querySelectorAll('.slide');"
    );

    return out;
}

function patchMobileCourse(html) {
    let source = String(html || '');
    if (!source) return source;

    const viewport = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">';
    if (/<meta\s+name=["']viewport["'][^>]*>/i.test(source)) {
        source = source.replace(/<meta\s+name=["']viewport["'][^>]*>/i, viewport);
    } else if (source.includes('</head>')) {
        source = source.replace('</head>', `${viewport}\n</head>`);
    } else {
        source = `${viewport}\n${source}`;
    }

    if (source.includes('quizmoto-mobile-course-css')) return source;
    if (source.includes('</head>')) return source.replace('</head>', `${MOBILE_COURSE_CSS}\n</head>`);
    return `${MOBILE_COURSE_CSS}\n${source}`;
}

async function buildScormPackageZip(rawAnalysis, opts = {}) {
    const baseBuffer = await buildVisualPackage(rawAnalysis, opts);
    const zip = await JSZip.loadAsync(baseBuffer);
    const indexFile = zip.file('index.html');
    if (!indexFile) return baseBuffer;

    const html = await indexFile.async('string');
    zip.file('index.html', patchMobileCourse(patchTrackingRuntime(html)));

    const contentFile = zip.file('content.json');
    if (contentFile) {
        try {
            const content = JSON.parse(await contentFile.async('string'));
            zip.file('content.json', JSON.stringify({
                ...content,
                trackingVersion: 6,
                progressTracking: 'lesson_location',
                exitTracking: 'synchronous_suspend_flush',
                resumeTracking: 'lesson_location_and_quiz_results_restore',
                navigationPersistence: 'post_paint_debounced_commit',
                mobileOptimized: true,
                mobileLayoutVersion: 2,
                mobilePresentation: 'dynamic_viewport_safe_area_touch_pan'
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
