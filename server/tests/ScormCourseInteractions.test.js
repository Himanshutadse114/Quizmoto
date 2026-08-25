const { expect } = require('chai');
const {
    COURSE_INTERACTION_STYLE_ID,
    COURSE_INTERACTION_SCRIPT_ID,
    courseInteractionStyle,
    courseInteractionScript,
    injectCourseInteractionsUi
} = require('../services/scorm/ScormCourseInteractionService');

describe('SCORM course interactions', () => {
    it('injects accessible flip-card styling and behavior', () => {
        const source = '<html><head></head><body><main><section class="slide" data-kind="learning"><div class="qmx-cards"><div class="qmx-card"><span>01</span><p>Verify unexpected requests before approving them.</p></div></div></section></main></body></html>';
        const output = injectCourseInteractionsUi(source);

        expect(output).to.include(COURSE_INTERACTION_STYLE_ID);
        expect(output).to.include(COURSE_INTERACTION_SCRIPT_ID);
        expect(output).to.include('rotateY(180deg)');
        expect(output).to.include('Click to reveal');
        expect(output).to.include("setAttribute('aria-expanded'");
        expect(output).to.include("event.key !== 'Enter'");
        expect(output).to.include("event.key !== ' '");
    });

    it('keeps the interaction injection idempotent', () => {
        const source = '<html><head></head><body><main></main></body></html>';
        const once = injectCourseInteractionsUi(source);
        const twice = injectCourseInteractionsUi(once);

        expect((twice.match(new RegExp(COURSE_INTERACTION_STYLE_ID, 'g')) || []).length).to.equal(1);
        expect((twice.match(new RegExp(COURSE_INTERACTION_SCRIPT_ID, 'g')) || []).length).to.equal(1);
    });

    it('uses the active course theme variables instead of hard-coded card colours', () => {
        const style = courseInteractionStyle();
        expect(style).to.include('var(--surface)');
        expect(style).to.include('var(--soft)');
        expect(style).to.include('var(--primary-dark)');
        expect(style).to.include('var(--accent)');
    });

    it('keeps flip cards compact and lets content determine their height', () => {
        const style = courseInteractionStyle();
        expect(style).to.include('grid-template-columns: repeat(2,minmax(220px,280px))');
        expect(style).to.include('max-width: 572px');
        expect(style).to.include('display: grid');
        expect(style).to.include('grid-area: 1 / 1');
        expect(style).to.include('min-height: 112px');
        expect(style).to.not.include('min-height: 172px');
    });

    it('overrides the original card span rules so the number stays centered in its badge', () => {
        const style = courseInteractionStyle();
        expect(style).to.include('.qmx-card.qmx-flip-card .qmx-flip-number');
        expect(style).to.include('display: inline-flex !important');
        expect(style).to.include('width: 28px !important');
        expect(style).to.include('height: 28px !important');
        expect(style).to.include('margin: 0 !important');
        expect(style).to.include('line-height: 1 !important');
    });

    it('keeps no-image slide text left and puts the interaction grid in the visual column', () => {
        const style = courseInteractionStyle();
        expect(style).to.include('.qmx-learning-shell.no-image');
        expect(style).to.include('width: min(1180px,100%) !important');
        expect(style).to.include('grid-template-columns: minmax(0,1.08fr) minmax(420px,.92fr)');
        expect(style).to.include('text-align: left');
        expect(style).to.include('grid-column: 2');
        expect(style).to.include('grid-row: 1 / span 3');
        expect(style).to.include('.qmx-learning-shell.no-image .qmx-cards.qmx-flip-grid');
        expect(style).to.include('grid-template-columns: repeat(2,minmax(0,1fr)) !important');
        expect(style).to.not.include('deliberately centred reading layout');
    });

    it('requires every flip card on the active slide to be revealed before Next is enabled', () => {
        const script = courseInteractionScript();
        expect(script).to.include("card.setAttribute('data-qmx-revealed','false')");
        expect(script).to.include("if (flipped) card.setAttribute('data-qmx-revealed','true')");
        expect(script).to.include('function unrevealedCards(slide)');
        expect(script).to.include("next.setAttribute('data-qmx-reveal-locked','true')");
        expect(script).to.include('Reveal every key point before continuing');
        expect(script).to.include("document.addEventListener('click', blockLockedNext, true)");
    });

    it('upgrades only learning key-point cards and leaves quiz controls alone', () => {
        const script = courseInteractionScript();
        expect(script).to.include('.slide[data-kind="learning"] .qmx-cards');
        expect(script).to.include("grid.classList.add('qmx-flip-grid')");
        expect(script).to.not.include('.quiz-option');
    });
});
