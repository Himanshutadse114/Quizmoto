const { expect } = require('chai');
const {
    injectExperienceCss,
    experienceScript
} = require('../services/scorm/ScormExperiencePackageBuilder');

describe('SCORM Course Experience V5 laptop UX', () => {
    it('adds a dedicated laptop-height layout that compacts the learner stage', () => {
        const html = injectExperienceCss('<html><head></head><body></body></html>');
        expect(html).to.include('max-height:920px');
        expect(html).to.include('qmx-laptop');
        expect(html).to.include('min-height:360px');
    });

    it('keeps revealed learning detail discoverable without forcing blind manual scrolling', () => {
        const script = experienceScript();
        expect(script).to.include('revealIntoView');
        expect(script).to.include('scrollIntoView');
        expect(script).to.include('qmx-reveal-attention');
    });

    it('resets the active slide scroll position when learner navigation changes slides', () => {
        const script = experienceScript();
        expect(script).to.include('resetActiveSlideScroll');
        expect(script).to.include('MutationObserver');
    });
});
