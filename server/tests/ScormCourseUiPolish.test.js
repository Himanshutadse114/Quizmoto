const { expect } = require('chai');
const {
    COURSE_UI_POLISH_STYLE_ID,
    courseUiPolishStyle,
    injectCourseUiPolish
} = require('../services/scorm/ScormCourseUiPolish');

describe('SCORM course UI polish', () => {
    it('removes the generated Q badge and presents narration as an icon-only speaker control', () => {
        const style = courseUiPolishStyle();
        expect(style).to.include(COURSE_UI_POLISH_STYLE_ID);
        expect(style).to.include('header .brand-mark{display:none!important}');
        expect(style).to.include('#qmx-narration-toggle');
        expect(style).to.include('font-size:0!important');
        expect(style).to.include('data:image/svg+xml');
        expect(style).to.include('[aria-pressed="true"]::before');
        expect(style).to.not.include('Narration Off');
        expect(style).to.not.include('Narration On');
    });

    it('uses smaller regular left-aligned typography for assessment questions', () => {
        const style = courseUiPolishStyle();
        expect(style).to.include('.qmx-quiz-shell h2');
        expect(style).to.include('.quiz-card h2');
        expect(style).to.include('font-size:17px!important');
        expect(style).to.include('font-weight:400!important');
        expect(style).to.include('text-align:left!important');
    });

    it('injects the polish style once into existing stored course HTML', () => {
        const source = '<html><head></head><body><header><div class="brand-mark">Q</div></header></body></html>';
        const once = injectCourseUiPolish(source);
        const twice = injectCourseUiPolish(once);
        expect(once).to.include(COURSE_UI_POLISH_STYLE_ID);
        expect((twice.match(new RegExp(COURSE_UI_POLISH_STYLE_ID, 'g')) || []).length).to.equal(1);
    });
});
