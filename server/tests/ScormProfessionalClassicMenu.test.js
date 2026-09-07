const { expect } = require('chai');
const { inject } = require('../services/scorm/ScormCourseChromeRuntime');

describe('Professional course menu add-on', () => {
    it('keeps the current course contents menu available alongside the classic learner runtime', () => {
        const html = '<!doctype html><html><head></head><body data-qmx-course-template="professional-classic"><main><section class="slide active">Lesson</section></main></body></html>';
        const patched = inject(html, 'professional-classic');

        expect(patched).to.include('quizmoto-course-chrome-v1');
        expect(patched).to.include('quizmoto-course-chrome-script-v1');
        expect(patched).to.include('Course contents');
        expect(patched).to.include('qmx-course-sidebar');
        expect(patched).to.include('Your progress');
    });
});
