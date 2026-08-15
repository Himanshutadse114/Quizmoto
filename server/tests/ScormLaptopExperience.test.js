const { expect } = require('chai');
const {
    injectAnswerTracking,
    LAPTOP_EXPERIENCE_CSS,
    LAPTOP_EXPERIENCE_SCRIPT
} = require('../services/scorm/ScormAnswerTrackingPackageFinalizer');

describe('SCORM Course Experience V5 laptop UX', () => {
    it('injects a dedicated laptop-height layout that compacts the learner stage', () => {
        const html = injectAnswerTracking('<html><head></head><body></body></html>');
        expect(html).to.include('scorm-ai-laptop-experience-v1');
        expect(LAPTOP_EXPERIENCE_CSS).to.include('max-height:920px');
        expect(LAPTOP_EXPERIENCE_CSS).to.include('min-height:360px');
        expect(LAPTOP_EXPERIENCE_CSS).to.include('justify-content:flex-start');
    });

    it('keeps revealed learning detail discoverable without blind manual scrolling', () => {
        expect(LAPTOP_EXPERIENCE_SCRIPT).to.include('revealIntoView');
        expect(LAPTOP_EXPERIENCE_SCRIPT).to.include('scrollIntoView');
        expect(LAPTOP_EXPERIENCE_CSS).to.include('qmx-reveal-attention');
    });

    it('resets the active slide scroll position when learner navigation changes slides', () => {
        expect(LAPTOP_EXPERIENCE_SCRIPT).to.include('resetActiveSlideScroll');
        expect(LAPTOP_EXPERIENCE_SCRIPT).to.include('MutationObserver');
    });
});
