const { expect } = require('chai');
const { patchTrackingRuntime } = require('../services/scorm/ScormTrackingPackageFinalizer');

describe('ScormTrackingPackageFinalizer', () => {
    it('initializes the LMS before rendering the first tracked screen', () => {
        const html = "window.onload=function(){sessionStartMs=Date.now();render();if(typeof doLMSInitialize==='function'){doLMSInitialize();doLMSSetValue('cmi.core.lesson_status','incomplete');writeSessionTime();doLMSCommit();commitTimer=setInterval(function(){if(!completed)commitProgress()},15000)}};window.addEventListener('beforeunload'";
        const patched = patchTrackingRuntime(html);
        expect(patched).to.include("window.onload=function(){sessionStartMs=Date.now();lastSessionWriteMs=sessionStartMs;if(typeof doLMSInitialize==='function'){doLMSInitialize();");
        expect(patched).to.include("commitTimer=setInterval(function(){if(!completed)commitProgress()},15000)}render();};window.addEventListener('beforeunload'");
        expect(patched).to.not.include('sessionStartMs=Date.now();render();if');
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
});
