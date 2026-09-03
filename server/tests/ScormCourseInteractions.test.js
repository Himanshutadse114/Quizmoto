const { expect } = require('chai');
const {
    COURSE_INTERACTION_STYLE_ID,
    COURSE_INTERACTION_SCRIPT_ID,
    courseInteractionStyle,
    courseInteractionScript,
    injectCourseInteractionsUi
} = require('../services/scorm/ScormCourseInteractionService');

describe('SCORM course interactions', () => {
    it('injects accessible classic flip-card styling and behaviour', () => {
        const source = '<html><head></head><body><main><section class="slide" data-kind="learning"><div class="qmx-cards"><div class="qmx-card"><span>01</span><p>Verify unexpected requests before approving them.</p></div></div></section></main></body></html>';
        const output = injectCourseInteractionsUi(source);

        expect(output).to.include(COURSE_INTERACTION_STYLE_ID);
        expect(output).to.include(COURSE_INTERACTION_SCRIPT_ID);
        expect(output).to.include('rotateY(180deg)');
        expect(output).to.include('Click to reveal');
        expect(output).to.include("setAttribute('aria-expanded'");
        expect(output).to.include("event.key!=='Enter'");
        expect(output).to.include("event.key!==' '");
    });

    it('keeps the interaction injection idempotent', () => {
        const source = '<html><head></head><body><main></main></body></html>';
        const once = injectCourseInteractionsUi(source);
        const twice = injectCourseInteractionsUi(once);

        expect((twice.match(new RegExp(COURSE_INTERACTION_STYLE_ID, 'g')) || []).length).to.equal(1);
        expect((twice.match(new RegExp(COURSE_INTERACTION_SCRIPT_ID, 'g')) || []).length).to.equal(1);
    });

    it('uses active course theme variables instead of hard-coded interaction colours', () => {
        const style = courseInteractionStyle();
        expect(style).to.include('var(--surface)');
        expect(style).to.include('var(--soft)');
        expect(style).to.include('var(--primary-dark)');
        expect(style).to.include('var(--accent)');
        expect(style).to.include('var(--ink)');
        expect(style).to.include('var(--ink-soft)');
    });

    it('keeps classic flip cards compact and responsive', () => {
        const style = courseInteractionStyle();
        expect(style).to.include('grid-template-columns:repeat(2,minmax(220px,280px))');
        expect(style).to.include('max-width:572px');
        expect(style).to.include('grid-area:1/1');
        expect(style).to.include('min-height:112px');
        expect(style).to.include('@media(max-width:760px)');
        expect(style).to.not.include('min-height:172px');
    });

    it('keeps no-image learning screens split between reading and interaction columns', () => {
        const style = courseInteractionStyle();
        expect(style).to.include('.qmx-learning-shell.no-image');
        expect(style).to.include('width:min(1180px,100%)!important');
        expect(style).to.include('grid-template-columns:minmax(0,1.08fr) minmax(420px,.92fr)');
        expect(style).to.include('grid-column:2');
        expect(style).to.include('grid-row:1/span 3');
        expect(style).to.include('.qmx-learning-shell.no-image .qmx-v7-runtime');
    });

    it('requires classic flip cards on the active slide to be revealed before Next', () => {
        const script = courseInteractionScript();
        expect(script).to.include("card.setAttribute('data-qmx-revealed','false')");
        expect(script).to.include("if(flipped)card.setAttribute('data-qmx-revealed','true')");
        expect(script).to.include('function unrevealedCards(slide)');
        expect(script).to.include("next.setAttribute('data-qmx-reveal-locked','true')");
        expect(script).to.include('Complete the interaction before continuing');
    });

    it('does not use a self-observing MutationObserver for slide navigation', () => {
        const script = courseInteractionScript();
        expect(script).to.not.include('new MutationObserver');
        expect(script).to.include("event.target.closest('#next-btn,#prev-btn')");
        expect(script).to.include('setTimeout(syncNextGate,0)');
    });

    it('preserves classic behaviour unless an advanced template is explicitly selected', () => {
        const script = courseInteractionScript();
        expect(script).to.include("function templateFor(s){var explicit=clean(s&&s.interaction&&s.interaction.templateId);return explicit||'flip_cards_classic'}");
        expect(script).to.include("if(!built)upgradeFlipCards(slide)");
    });

    it('supports opt-in tabs, accordion, process/timeline and decision interactions', () => {
        const script = courseInteractionScript();
        expect(script).to.include("template==='interactive_tabs'");
        expect(script).to.include("template==='accordion'");
        expect(script).to.include("template==='process_tabs'");
        expect(script).to.include("template==='interactive_timeline'");
        expect(script).to.include("template==='scenario_decision'");
        expect(script).to.include('function buildTabs');
        expect(script).to.include('function buildAccordion');
        expect(script).to.include('function buildProcess');
        expect(script).to.include('function buildScenario');
    });

    it('adds accessible keyboard patterns and completion states to advanced interactions', () => {
        const script = courseInteractionScript();
        expect(script).to.include("tabs.setAttribute('role','tablist')");
        expect(script).to.include("btn.setAttribute('role','tab')");
        expect(script).to.include("e.key!=='ArrowRight'&&e.key!=='ArrowLeft'");
        expect(script).to.include("host.setAttribute('data-qmx-complete'");
        expect(script).to.include('function runtimeIncomplete(slide)');
    });

    it('provides responsive and reduced-motion styling for new interactions', () => {
        const style = courseInteractionStyle();
        expect(style).to.include('.qmx-runtime-tabs');
        expect(style).to.include('.qmx-runtime-accordion');
        expect(style).to.include('.qmx-runtime-process');
        expect(style).to.include('.qmx-runtime-scenario');
        expect(style).to.include('@media(max-width:760px)');
        expect(style).to.include('@media(prefers-reduced-motion:reduce)');
    });
});
