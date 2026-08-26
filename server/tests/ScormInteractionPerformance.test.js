const { expect } = require('chai');
const { interactionTrackingScript } = require('../services/scorm/ScormExperienceFinalizer');
const contentRouter = require('../routes/scorm/content');

describe('SCORM authored interaction responsiveness', () => {
    it('defers interaction tracking until after answer feedback can paint', () => {
        const source = interactionTrackingScript();
        const timer = source.indexOf('setTimeout(function(){');
        const firstWrite = source.indexOf("doLMSSetValue(base+'.id'");
        expect(timer).to.be.greaterThan(-1);
        expect(firstWrite).to.be.greaterThan(timer);
    });

    it('does not force a blocking LMSCommit directly from the generated answer tracker', () => {
        const source = interactionTrackingScript();
        expect(source).to.not.include("typeof doLMSCommit==='function'");
        expect(source).to.not.include('doLMSCommit()');
    });

    it('records interactions plus a provisional QA score after each answer', () => {
        const source = interactionTrackingScript();
        expect(source).to.include("base+'.id'");
        expect(source).to.include("base+'.type'");
        expect(source).to.include("base+'.student_response'");
        expect(source).to.include("base+'.result'");
        expect(source).to.include("base+'.correct_responses.0.pattern'");
        expect(source).to.include("doLMSSetValue('cmi.core.score.raw',String(provisional))");
        expect(source).to.include('Math.round((hits/totalQuestions)*100)');
    });

    it('injects a DOM-level tracking bridge into an existing authored course', () => {
        // Existing packages may contain LMSCommit calls. The hosted player now
        // implements LMSCommit as a buffered, non-blocking flush request, so the
        // patcher no longer needs to strip package-authored commit calls.
        const oldHtml = '<html><head></head><body><div class="slide active"></div><div class="slide"></div><button id="next-btn">Next</button><script>if(typeof doLMSCommit===\'function\')doLMSCommit();</script></body></html>';
        const patched = contentRouter.patchAuthoredHtml(oldHtml);
        expect(patched).to.include('quizmoto-authored-runtime-bridge-v7');
        expect(patched).to.include("doLMSSetValue('cmi.core.lesson_location',String(s.index))");
        expect(patched).to.include("doLMSSetValue('cmi.suspend_data'");
        expect(patched).to.include("target.id==='next-btn'||target.id==='prev-btn'");
        expect(patched).to.include("target.matches('.quiz-option')");
        expect(patched).to.include("doLMSSetValue('cmi.core.score.raw',String(provisional))");
        expect(patched).to.include('quizmoto-mobile-course-css');
    });

    it('repairs the self-observing flip-card runtime in already stored course packages', () => {
        const legacy = `<script>
function upgradeCards(){
  var grid=document.querySelector('.qmx-cards');
  grid.classList.add('qmx-flip-grid');
}
function syncNextGate(){}
function install(){
    upgradeCards();
    syncNextGate();
    document.addEventListener('click', blockLockedNext, true);
    var main = document.querySelector('main');
    if (main && typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(function(){
        upgradeCards();
        syncNextGate();
      });
      observer.observe(main,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    }
}
</script>`;
        const patched = contentRouter.patchLegacyCourseInteractionRuntime(legacy);
        expect(patched).to.not.include('observer.observe(main');
        expect(patched).to.not.include('new MutationObserver(function(){');
        expect(patched).to.include("if (!grid.classList.contains('qmx-flip-grid')) grid.classList.add('qmx-flip-grid')");
        expect(patched).to.include('function syncAfterNavigation(event)');
        expect(patched).to.include("event.target.closest('#next-btn,#prev-btn')");
    });

    it('merges progress into existing suspend data instead of erasing quiz resume answers', () => {
        const bridge = contentRouter.authoredRuntimeBridge();
        expect(bridge).to.include("var raw=doLMSGetValue('cmi.suspend_data')");
        expect(bridge).to.include('resume.quizmotoSlide=s.index');
        expect(bridge).to.include('resume.quizmotoProgress=s.progress');
        expect(bridge).to.include("JSON.stringify(mergedSuspendState(s))");
        expect(bridge).to.not.include("JSON.stringify({quizmotoSlide:s.index,quizmotoProgress:s.progress})");
    });

    it('does not inject the authored tracking bridge more than once', () => {
        const html = '<html><head></head><body><div class="slide active"></div></body></html>';
        const once = contentRouter.patchAuthoredHtml(html);
        const twice = contentRouter.patchAuthoredHtml(once);
        expect((twice.match(/id="quizmoto-authored-runtime-bridge-v7"/g) || []).length).to.equal(1);
    });
});
