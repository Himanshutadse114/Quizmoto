const { expect } = require('chai');
const {
    patchTrackingRuntime,
    patchMobileCourse,
    MOBILE_COURSE_CSS
} = require('../services/scorm/ScormTrackingPackageFinalizer');

describe('ScormTrackingPackageFinalizer', () => {
    it('initializes the LMS before rendering the first tracked screen', () => {
        const html = "window.onload=function(){sessionStartMs=Date.now();render();if(typeof doLMSInitialize==='function'){doLMSInitialize();doLMSSetValue('cmi.core.lesson_status','incomplete');writeSessionTime();doLMSCommit();commitTimer=setInterval(function(){if(!completed)commitProgress()},15000)}};window.addEventListener('beforeunload'";
        const patched = patchTrackingRuntime(html);
        expect(patched).to.include("window.onload=function(){sessionStartMs=Date.now();lastSessionWriteMs=sessionStartMs;if(typeof doLMSInitialize==='function'){doLMSInitialize();");
        expect(patched).to.include("commitTimer=setInterval(function(){if(!completed)commitProgress()},15000)}render();};window.addEventListener('beforeunload'");
        expect(patched).to.not.include('sessionStartMs=Date.now();render();if');
    });

    it('restores saved lesson location and quiz answers before render', () => {
        const html = "doLMSInitialize();doLMSSetValue('cmi.core.score.min','0');doLMSSetValue('cmi.core.score.max','100');doLMSSetValue('cmi.core.lesson_status','incomplete');el('finish-btn').addEventListener('click',exitSco);updateNav()}";
        const patched = patchTrackingRuntime(html);
        expect(patched).to.include("doLMSGetValue('cmi.core.lesson_location')");
        expect(patched).to.include("doLMSGetValue('cmi.suspend_data')");
        expect(patched).to.include('currentSlide=Math.max(0,Number(savedLocation))');
        expect(patched).to.include('Array.isArray(resumeData.quizmotoQuizResults)');
        expect(patched).to.include('quizResults=resumeData.quizmotoQuizResults.slice()');
        expect(patched).to.include("doLMSGetValue('cmi.core.lesson_status')");
        expect(patched).to.include("if(!/^(completed|passed|failed)$/i.test(String(savedStatus||'')))");
        expect(patched).to.include("resumeSlides[currentSlide].classList.add('active')");
    });

    it('rehydrates answered-question UI so resumed questions cannot be submitted twice', () => {
        const html = "el('finish-btn').addEventListener('click',exitSco);updateNav()}";
        const patched = patchTrackingRuntime(html);
        expect(patched).to.include('(data.quiz||[]).forEach(function(q,qi)');
        expect(patched).to.include('var chosen=quizResults[qi]');
        expect(patched).to.include('b.disabled=true');
        expect(patched).to.include("b.classList.add('correct')");
        expect(patched).to.include("b.classList.add('incorrect')");
        expect(patched).to.include("fb.style.display='block'");
    });

    it('persists location, progress and quiz-result context after the new slide can paint', () => {
        const html = "sessionStartMs=Date.now(),commitTimer=null;function commitProgress(extra){if(typeof doLMSSetValue!=='function')return;try{writeSessionTime();if(extra){for(var k in extra){if(Object.prototype.hasOwnProperty.call(extra,k))doLMSSetValue(k,String(extra[k]))}}doLMSCommit()}catch(e){}}commitProgress({'cmi.core.lesson_location':String(currentSlide)})";
        const patched = patchTrackingRuntime(html);
        expect(patched).to.include('progressCommitTimer=null');
        expect(patched).to.include('function scheduleProgressCommit(extra)');
        expect(patched).to.include('setTimeout(function(){progressCommitTimer=null;if(!completed)commitProgress(extra)},45)');
        expect(patched).to.include("scheduleProgressCommit({'cmi.core.lesson_location':String(currentSlide)");
        expect(patched).to.include("quizmotoQuizResults:quizResults");
    });

    it('writes session time as a delta instead of repeatedly adding total elapsed time', () => {
        const html = "sessionStartMs=Date.now(),commitTimer=null;function writeSessionTime(){if(typeof doLMSSetValue!=='function')return;try{doLMSSetValue('cmi.core.session_time',formatSessionTime(Date.now()-sessionStartMs))}catch(e){}}";
        const patched = patchTrackingRuntime(html);
        expect(patched).to.include('lastSessionWriteMs=sessionStartMs');
        expect(patched).to.include('formatSessionTime(now-lastSessionWriteMs)');
        expect(patched).to.include('lastSessionWriteMs=now');
    });

    it('exposes a synchronous suspend flush with current slide and quiz results', () => {
        const html = "window.addEventListener('beforeunload',function(){if(completed)return;try{writeSessionTime();if(typeof doLMSSetValue==='function'){doLMSSetValue('cmi.core.exit','suspend');doLMSCommit()}}catch(e){}})";
        const patched = patchTrackingRuntime(html);
        expect(patched).to.include('function flushSuspendState(markExit)');
        expect(patched).to.include('window.__quizmotoFlushScormState=flushSuspendState');
        expect(patched).to.include("doLMSSetValue('cmi.core.lesson_location',String(currentSlide))");
        expect(patched).to.include("quizmotoQuizResults:quizResults");
        expect(patched).to.include("doLMSSetValue('cmi.core.lesson_status','incomplete')");
        expect(patched).to.include("doLMSSetValue('cmi.core.exit','suspend')");
        expect(patched).to.include("window.addEventListener('beforeunload',function(){flushSuspendState(true)})");
    });

    it('cancels a deferred navigation save before the synchronous exit flush', () => {
        const html = "sessionStartMs=Date.now(),commitTimer=null;window.addEventListener('beforeunload',function(){if(completed)return;try{writeSessionTime();if(typeof doLMSSetValue==='function'){doLMSSetValue('cmi.core.exit','suspend');doLMSCommit()}}catch(e){}})";
        const patched = patchTrackingRuntime(html);
        expect(patched).to.include("if(typeof progressCommitTimer!=='undefined'&&progressCommitTimer){clearTimeout(progressCommitTimer);progressCommitTimer=null}");
    });

    it('is idempotent when the served authored HTML is patched repeatedly', () => {
        const html = "sessionStartMs=Date.now(),commitTimer=null;function commitProgress(extra){if(typeof doLMSSetValue!=='function')return;try{writeSessionTime();if(extra){for(var k in extra){if(Object.prototype.hasOwnProperty.call(extra,k))doLMSSetValue(k,String(extra[k]))}}doLMSCommit()}catch(e){}}commitProgress({'cmi.core.lesson_location':String(currentSlide)});doLMSInitialize();doLMSSetValue('cmi.core.score.min','0');doLMSSetValue('cmi.core.score.max','100');doLMSSetValue('cmi.core.lesson_status','incomplete');el('finish-btn').addEventListener('click',exitSco);updateNav()}window.addEventListener('beforeunload',function(){if(completed)return;try{writeSessionTime();if(typeof doLMSSetValue==='function'){doLMSSetValue('cmi.core.exit','suspend');doLMSCommit()}}catch(e){}})";
        const once = patchTrackingRuntime(html);
        const twice = patchTrackingRuntime(once);
        expect(twice).to.equal(once);
        expect((twice.match(/function scheduleProgressCommit\(extra\)/g) || []).length).to.equal(1);
        expect((twice.match(/function flushSuspendState\(markExit\)/g) || []).length).to.equal(1);
    });

    it('injects polished responsive rules and mobile viewport support into generated learner courses', () => {
        const html = '<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Course</title></head><body></body></html>';
        const patched = patchMobileCourse(html);
        expect(patched).to.include('id="quizmoto-mobile-course-css"');
        expect(patched).to.include('viewport-fit=cover');
        expect(patched).to.include('interactive-widget=resizes-content');
        expect(patched).to.include('@media (max-width: 680px)');
        expect(patched).to.include('height:100dvh');
        expect(patched).to.include('env(safe-area-inset-bottom)');
        expect(patched).to.include('.nav-btn{min-height:44px');
        expect(patched).to.include('.quiz-option{padding:13px 14px!important;min-height:52px');
        expect(patched).to.include('.qmx-point{min-height:44px');
        expect(patched).to.include('.qmx-visual.qmx-visual-pan');
        expect(patched).to.include('width:680px!important;min-width:680px!important');
        expect(patched).to.include('@media (orientation: landscape) and (max-height: 500px)');
        expect(MOBILE_COURSE_CSS).to.include('@media (max-width: 390px)');
    });

    it('does not inject the mobile stylesheet or viewport configuration twice', () => {
        const html = '<html><head><title>Course</title></head><body></body></html>';
        const once = patchMobileCourse(html);
        const twice = patchMobileCourse(once);
        expect(twice).to.equal(once);
        expect((twice.match(/quizmoto-mobile-course-css/g) || []).length).to.equal(1);
        expect((twice.match(/name="viewport"/g) || []).length).to.equal(1);
        expect((twice.match(/viewport-fit=cover/g) || []).length).to.equal(1);
    });
});
