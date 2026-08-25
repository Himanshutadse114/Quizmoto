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

    it('upgrades only learning key-point cards and leaves quiz controls alone', () => {
        const script = courseInteractionScript();
        expect(script).to.include('.slide[data-kind="learning"] .qmx-cards .qmx-card');
        expect(script).to.not.include('.quiz-option');
    });
});
