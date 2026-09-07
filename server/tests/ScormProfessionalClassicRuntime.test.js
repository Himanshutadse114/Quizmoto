const { expect } = require('chai');
const {
    courseInteractionScript,
    courseInteractionStyle
} = require('../services/scorm/ScormCourseInteractionService');

// Professional 1.1 deliberately reuses the proven pre-template flip-card runtime
// instead of introducing another interaction implementation.
describe('Professional classic learner runtime', () => {
    it('retains the classic card reveal and completion gate used by Professional 1.1', () => {
        const script = courseInteractionScript();
        const style = courseInteractionStyle();

        expect(script).to.include("grid.classList.add('qmx-flip-grid')");
        expect(script).to.include("card.classList.add('qmx-flip-card')");
        expect(script).to.include("card.setAttribute('data-qmx-revealed','true')");
        expect(script).to.include('Reveal every key point before continuing');
        expect(script).to.include('syncNextGate');
        expect(style).to.include('.qmx-cards.qmx-flip-grid');
        expect(style).to.include('.qmx-flip-card.is-flipped .qmx-flip-inner');
    });
});
