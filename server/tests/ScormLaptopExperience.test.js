const { expect } = require('chai');
const {
    injectAnswerTracking,
    LAPTOP_EXPERIENCE_CSS,
    LAPTOP_EXPERIENCE_SCRIPT
} = require('../services/scorm/ScormAnswerTrackingPackageFinalizer');
const { polishDesktopSvg } = require('../services/scorm/ScormVisualAssetService');

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

    it('moves dense card copy below the icon row and reduces its type size', () => {
        const source = Buffer.from('<svg><text x="143.0" y="215" text-anchor="start" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="14" font-weight="720" fill="#fff" opacity="1"><tspan x="143.0" y="206">9.4% Credential</tspan><tspan x="143.0" y="224">Submission</tspan></text></svg>');
        const polished = polishDesktopSvg(source, 'cards').toString('utf8');
        expect(polished).to.include('x="73"');
        expect(polished).to.include('font-size="13"');
        expect(polished).to.include('y="249"');
        expect(polished).to.include('y="240"');
    });
});
