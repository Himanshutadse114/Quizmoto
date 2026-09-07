const { expect } = require('chai');
const {
    COURSE_UI_POLISH_STYLE_ID,
    COURSE_UI_POLISH_SCRIPT_ID,
    courseUiPolishStyle,
    courseUiPolishScript,
    injectCourseUiPolish
} = require('../services/scorm/ScormCourseUiPolish');

describe('Adaptive generated course UI', () => {
    it('shows the course menu only when the browser is effectively full-size', () => {
        const style = courseUiPolishStyle();
        const script = courseUiPolishScript();

        expect(style).to.include('qmx-course-menu-full-window');
        expect(style).to.include('.qmx-course-sidebar');
        expect(style).to.include('.qmx-scenario-sidebar');
        expect(script).to.include('screen.availWidth');
        expect(script).to.include('screen.availHeight');
        expect(script).to.include("classList.toggle('qmx-course-menu-full-window'");
        expect(script).to.include("window.addEventListener('resize'");
        expect(script).to.include("document.addEventListener('fullscreenchange'");
    });

    it('uses more vertical space for Professional no-image flip-card slides', () => {
        const style = courseUiPolishStyle();
        expect(style).to.include('body[data-qmx-course-template="professional-classic"]');
        expect(style).to.include('.qmx-learning-shell.no-image');
        expect(style).to.include('.qmx-cards.qmx-flip-grid');
        expect(style).to.include('min-height:190px!important');
    });

    it('injects adaptive style and script independently and only once', () => {
        const source = '<!doctype html><html><head></head><body></body></html>';
        const once = injectCourseUiPolish(source);
        const twice = injectCourseUiPolish(once);

        expect(once).to.include(COURSE_UI_POLISH_STYLE_ID);
        expect(once).to.include(COURSE_UI_POLISH_SCRIPT_ID);
        expect(twice.match(new RegExp(COURSE_UI_POLISH_STYLE_ID, 'g'))).to.have.length(1);
        expect(twice.match(new RegExp(COURSE_UI_POLISH_SCRIPT_ID, 'g'))).to.have.length(1);
    });
});
