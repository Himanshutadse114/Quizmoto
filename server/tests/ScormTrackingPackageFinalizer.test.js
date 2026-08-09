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

    it('restores a saved lesson location before render and activates that slide', () => {
        const html = "doLMSInitialize();doLMSSetValue('cmi.core.score.min','0');doLMSSetValue('cmi.core.score.max','100');doLMSSetValue('cmi.core.lesson_status','incomplete');el('finish-btn').addEventListener('click',exitSco);updateNav()}";
        const patched = patchTrackingRuntime(html);
        expect(patched).to.include("doLMSGetValue('cmi.core.lesson_location')");
        expect(patched).to.include("currentSlide=Math.max(0,Number(savedLocation))");
        expect(patched).to.include("doLMSGetValue('cmi.core.lesson_status')");
        expect(patched).to.include("if(!/^(completed|passed|failed)$/i.test(String(savedStatus||'')))");
        expect(patched).to.include("resumeSlides[currentSlide].classList.add('active')");
    });

    it('persists location and progress context on each screen navigation', () => {
        const html = "commitProgress({'cmi.core.lesson_location':String(currentSlide)})";
        const patched = patchTrackingRuntime(html);
        expect(patched).to.include("'cmi.core.lesson_location':String(currentSlide)");
        expect(patched).to.include("'cmi.suspend_data':JSON.stringify({quizmotoSlide:currentSlide,quizmotoProgress:p})");
    });

    it('writes session time as a delta instead of repeatedly adding total elapsed time', () => {
        const html = "sessionStartMs=Date.now(),commitTimer=null;function writeSessionTime(){if(typeof doLMSSetValue!=='function')return;try{doLMSSetValue('cmi.core.session_time',formatSessionTime(Date.now()-sessionStartMs))}catch(e){}}";
        const patched = patchTrackingRuntime(html);
        expect(patched).to.include('lastSessionWriteMs=sessionStartMs');
        expect(patched).to.include('formatSessionTime(now-lastSessionWriteMs)');
        expect(patched).to.include('lastSessionWriteMs=now');
    });

    it('exposes a synchronous suspend flush that saves the current screen before exit', () => {
        const html = "window.addEventListener('beforeunload',function(){if(completed)return;try{writeSessionTime();if(typeof doLMSSetValue==='function'){doLMSSetValue('cmi.core.exit','suspend');doLMSCommit()}}catch(e){}})";
        const patched = patchTrackingRuntime(html);
        expect(patched).to.include('function flushSuspendState(markExit)');
        expect(patched).to.include('window.__quizmotoFlushScormState=flushSuspendState');
        expect(patched).to.include("doLMSSetValue('cmi.core.lesson_location',String(currentSlide))");
        expect(patched).to.include("doLMSSetValue('cmi.suspend_data',JSON.stringify({quizmotoSlide:currentSlide,quizmotoProgress:p}))");
        expect(patched).to.include("doLMSSetValue('cmi.core.lesson_status','incomplete')");
        expect(patched).to.include("doLMSSetValue('cmi.core.exit','suspend')");
        expect(patched).to.include("window.addEventListener('beforeunload',function(){flushSuspendState(true)})");
    });

    it('injects compact responsive rules into generated learner courses', () => {
        const html = '<html><head><title>Course</title></head><body></body></html>';
        const patched = patchMobileCourse(html);
        expect(patched).to.include('id="quizmoto-mobile-course-css"');
        expect(patched).to.include('@media (max-width: 680px)');
        expect(patched).to.include('.hero{grid-template-columns:1fr');
        expect(patched).to.include('.quiz-options{grid-template-columns:1fr');
        expect(patched).to.include('footer{height:56px');
        expect(MOBILE_COURSE_CSS).to.include('@media (max-width: 390px)');
    });

    it('does not inject the mobile stylesheet twice', () => {
        const html = '<html><head><title>Course</title></head><body></body></html>';
        const once = patchMobileCourse(html);
        const twice = patchMobileCourse(once);
        expect(twice).to.equal(once);
    });
});
