const { expect } = require('chai');
const { interactionTrackingScript } = require('../services/scorm/ScormExperienceFinalizer');

describe('SCORM authored interaction responsiveness', () => {
    it('defers interaction tracking until after answer feedback can paint', () => {
        const source = interactionTrackingScript();
        const timer = source.indexOf('setTimeout(function(){');
        const firstWrite = source.indexOf("doLMSSetValue(base+'.id'");
        expect(timer).to.be.greaterThan(-1);
        expect(firstWrite).to.be.greaterThan(timer);
    });

    it('does not force an LMSCommit directly from the answer click tracker', () => {
        const source = interactionTrackingScript();
        expect(source).to.not.include("typeof doLMSCommit==='function'");
        expect(source).to.not.include('doLMSCommit()');
    });

    it('still records the full SCORM 1.2 interaction payload', () => {
        const source = interactionTrackingScript();
        expect(source).to.include("base+'.id'");
        expect(source).to.include("base+'.type'");
        expect(source).to.include("base+'.student_response'");
        expect(source).to.include("base+'.result'");
        expect(source).to.include("base+'.correct_responses.0.pattern'");
    });
});
