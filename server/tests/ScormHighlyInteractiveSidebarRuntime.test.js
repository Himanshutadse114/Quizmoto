const { expect } = require('chai');
const {
    SCRIPT_ID,
    STYLE_ID,
    inject,
    script,
    style
} = require('../services/scorm/ScormHighlyInteractiveSidebarRuntime');
const { injectTemplateRuntime } = require('../services/scorm/ScormTemplateRuntime');

function interactiveAnalysis() {
    return {
        templateEngineVersion: 1,
        templateBinding: {
            templateId: 'highly-interactive',
            templateVersion: '1.0.0',
            rendererVersion: 1,
            interactionLevel: 'high'
        },
        slides: [{
            title: 'Immediate Actions for Malware Infection',
            content: 'Disconnect the infected device and contact IT for assistance.',
            keyPoints: ['Disconnect infected device', 'Run anti-malware scan'],
            layout: 'process',
            layoutId: 'highly-interactive.stepper',
            screenType: 'process',
            interaction: { type: 'step_explore' }
        }],
        quiz: []
    };
}

describe('Highly Interactive learner sidebar runtime', () => {
    it('adds a persistent desktop course contents panel only at large desktop widths', () => {
        const css = style();
        expect(css).to.include(STYLE_ID);
        expect(css).to.include('@media(min-width:1500px)');
        expect(css).to.include('.qmx-course-sidebar');
        expect(css).to.include('flex:0 0 252px');
        expect(css).to.include('.qmx-course-main');
    });

    it('increases large-screen content density without changing the smaller-window layout', () => {
        const css = style();
        expect(css).to.include('font-size:clamp(38px,3.25vw,56px)');
        expect(css).to.include('font-size:16px!important');
        expect(css).to.include('height:min(80%,540px)!important');
    });

    it('uses the existing Previous and Next controls instead of bypassing learner navigation state', () => {
        const js = script();
        expect(js).to.include("target<current?'prev-btn':'next-btn'");
        expect(js).to.include('button.click()');
        expect(js).to.not.include("classList.toggle('active'");
        expect(js).to.include('target>state.maxVisited');
    });

    it('emits syntactically valid browser JavaScript', () => {
        const js = script().replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
        expect(() => new Function(js)).not.to.throw();
    });

    it('does not inject the sidebar into Professional compatibility courses', () => {
        const html = '<!doctype html><html><head></head><body><main></main></body></html>';
        expect(inject(html, 'professional-classic')).to.equal(html);
        expect(inject(html, 'highly-interactive')).to.include(SCRIPT_ID);
        expect(inject(html, 'highly-interactive')).to.include(STYLE_ID);
    });

    it('is automatically included by the template package runtime for Highly Interactive courses', () => {
        const html = '<!doctype html><html><head></head><body><main><section class="slide active" data-kind="learning" data-section="1"><div class="qmx-learning-shell no-image"><div class="qmx-copy"><h2>Malware</h2><p>Copy</p></div></div></section></main><footer><button id="prev-btn">Previous</button><button id="next-btn">Next</button></footer></body></html>';
        const patched = injectTemplateRuntime(html, interactiveAnalysis());
        expect(patched).to.include(SCRIPT_ID);
        expect(patched).to.include(STYLE_ID);
        expect(patched).to.include('qmx-course-sidebar');
    });
});
