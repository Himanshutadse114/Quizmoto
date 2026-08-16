const { expect } = require('chai');
const {
    injectGammaLayoutV2,
    GAMMA_LAYOUT_V2_CSS
} = require('../services/scorm/ScormGammaLayoutFinalizer');

describe('SCORM Gamma layout v2', () => {
    it('injects the non-cropping Smart SVG layout after existing head content', () => {
        const source = '<!doctype html><html><head><style>.qmx-visual img{object-fit:cover}</style></head><body></body></html>';
        const output = injectGammaLayoutV2(source);
        expect(output).to.include('scorm-ai-gamma-layout-v2');
        expect(output).to.include('object-fit:contain!important');
        expect(output.indexOf('object-fit:cover')).to.be.lessThan(output.indexOf('object-fit:contain!important'));
        expect(output).to.include('aspect-ratio:8 / 5!important');
        expect(output).to.include('aspect-ratio:3 / 4!important');
    });

    it('is idempotent and keeps the editorial heading safe measure', () => {
        const once = injectGammaLayoutV2('<html><head></head><body></body></html>');
        const twice = injectGammaLayoutV2(once);
        expect(twice).to.equal(once);
        expect(GAMMA_LAYOUT_V2_CSS).to.include('max-width:20ch!important');
        expect(GAMMA_LAYOUT_V2_CSS).to.include('max-width:22ch!important');
    });
});
