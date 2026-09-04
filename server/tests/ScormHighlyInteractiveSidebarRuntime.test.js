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
    it('adds a persistent desktop course contents panel without horizontal scrolling', () => {
        const css = style();
        expect(css).to.include(STYLE_ID);
        expect(css).to.include('@media(min-width:1500px)');
        expect(css).to.include('.qmx-course-sidebar');
        expect(css).to.include('flex:0 0 252px');
        expect(css).to.include('overflow-y:auto;overflow-x:hidden');
        expect(css).to.include('.qmx-course-main');
    });

    it('keeps the large-screen density and balanced two-by-two interaction composition', () => {
        const css = style();
        expect(css).to.include('font-size:clamp(38px,3.25vw,56px)');
        expect(css).to.include('font-size:16px!important');
        expect(css).to.include('height:min(80%,540px)!important');
        expect(css).to.include('.qmx-interaction-grid');
        expect(css).to.include('grid-template-columns:repeat(2,minmax(0,1fr))!important');
        expect(css).to.include('grid-template-rows:repeat(2,minmax(112px,1fr))!important');
    });

    it('uses teaser-first cards so full learning detail is only on the revealed face', () => {
        const css = style();
        const js = script();
        expect(css).to.include('.qmx-interaction-source{display:none!important');
        expect(css).to.include('.qmx-reveal-front');
        expect(css).to.include('.qmx-reveal-back');
        expect(js).to.include("front.appendChild(make('span','qmx-interaction-label',item.label))");
        expect(js).to.include("front.appendChild(make('span','qmx-interaction-hint','Click to reveal'))");
        expect(js).to.include("back.appendChild(make('span','qmx-interaction-detail',item.detail))");
        expect(js).to.include("back.appendChild(make('span','qmx-interaction-hint','Click to flip back'))");
        expect(js).to.include('labelFrom(detailFrom(card),i)');
    });

    it('gives reveal, step and explore interactions explicit learner instructions', () => {
        const css = style();
        const js = script();
        expect(css).to.include('.qmx-interaction-instruction');
        expect(css).to.include('min-height:48px!important');
        expect(css).to.include('padding:12px 22px!important');
        expect(js).to.include('Reveal the key takeaways to continue');
        expect(js).to.include('Reveal all ');
        expect(js).to.include('Select to explore');
        expect(js).to.include('Select to compare');
    });

    it('makes Highly Interactive the single owner of Next progression gating', () => {
        const css = style();
        const js = script();
        expect(css).to.include('#next-btn[data-qmx-interaction-locked="true"]');
        expect(css).to.include('visibility:hidden!important');
        expect(js).to.include("type==='focus_reveal'");
        expect(js).to.include("type==='click_reveal'");
        expect(js).to.include("type==='step_explore'");
        expect(js).to.include("type==='hotspot_explore'");
        expect(js).to.include("type==='compare_reveal'");
        expect(js).to.include("type==='decision_explore'");
        expect(js).to.include('data-qmx-revealed');
        expect(js).to.include('data-qmx-step-visited');
        expect(js).to.include('data-qmx-explore-visited');
        expect(js).to.include('data-qmx-compare-visited');
        expect(js).to.include('data-qmx-decision-complete');
        expect(js).to.include("kind==='quiz'");
        expect(js).to.include("next.removeAttribute('data-qmx-reveal-locked')");
        expect(js).to.include("document.addEventListener('qmx:interaction-update',syncGateSoon,true)");
    });

    it('removes qmx-cards from owned interactive source grids before the legacy flip enhancer runs', () => {
        const js = script();
        expect(js).to.include("node.classList.remove('qmx-cards')");
        expect(js).to.include("node.classList.add('qmx-interaction-source')");
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

    it('does not inject the sidebar or interaction layer into Professional compatibility courses', () => {
        const html = '<!doctype html><html><head></head><body><main></main></body></html>';
        expect(inject(html, 'professional-classic')).to.equal(html);
        expect(inject(html, 'highly-interactive')).to.include(SCRIPT_ID);
        expect(inject(html, 'highly-interactive')).to.include(STYLE_ID);
    });

    it('is automatically included by the template package runtime for Highly Interactive courses', () => {
        const html = '<!doctype html><html><head></head><body><main><section class="slide active" data-kind="learning" data-section="1"><div class="qmx-learning-shell no-image"><div class="qmx-copy"><h2>Malware</h2><p>Copy</p><div class="qmx-process"><div class="qmx-step"><p>Disconnect the device.</p></div></div></div></div></section></main><footer><button id="prev-btn">Previous</button><button id="next-btn">Next</button></footer></body></html>';
        const patched = injectTemplateRuntime(html, interactiveAnalysis());
        expect(patched).to.include(SCRIPT_ID);
        expect(patched).to.include(STYLE_ID);
        expect(patched).to.include('qmx-course-sidebar');
        expect(patched).to.include('qmx-interaction-source');
    });
});
