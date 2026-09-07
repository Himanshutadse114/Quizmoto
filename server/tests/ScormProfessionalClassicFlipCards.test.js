const { expect } = require('chai');
const {
    currentCourseTemplateVersion,
    getCourseTemplate,
    listCourseTemplates
} = require('../services/scorm/ScormTemplateCatalog');
const {
    createTemplateBinding,
    resolveExistingCourseTemplateBinding
} = require('../services/scorm/ScormTemplateBindingService');
const { planExperienceForTemplate } = require('../services/scorm/ScormTemplateExperiencePlanner');
const { validateTemplateAnalysis } = require('../services/scorm/ScormTemplateValidator');
const { inject: injectCourseChrome } = require('../services/scorm/ScormCourseChromeRuntime');

function sourceAnalysis() {
    return {
        title: 'Security awareness',
        summary: 'Recognise warning signs and follow secure behaviour.',
        slides: [
            {
                title: 'Recognise warning signs',
                content: 'Unexpected requests, unusual urgency and unfamiliar senders should make employees stop and verify before acting.',
                keyPoints: ['Unexpected request', 'Urgent language', 'Unknown sender', 'Verify independently'],
                layout: 'hub'
            },
            {
                title: 'Follow the secure process',
                content: 'Pause before acting, check the context, verify through a trusted route and report suspicious activity.',
                keyPoints: ['Pause', 'Check', 'Verify', 'Report'],
                layout: 'process'
            },
            {
                title: 'Remember the essentials',
                content: 'Use the same careful habits whenever a request is unexpected or asks you to bypass a normal process.',
                keyPoints: ['Slow down', 'Check the request', 'Use trusted channels', 'Report concerns'],
                layout: 'spotlight'
            }
        ],
        quiz: []
    };
}

describe('Professional classic flip-card course', () => {
    it('publishes Professional 1.1 as a balanced flip-card-only experience', () => {
        expect(currentCourseTemplateVersion('professional-classic')).to.equal('1.1.0');
        const template = getCourseTemplate('professional-classic', '1.1.0');
        expect([...template.interactionLevels]).to.deep.equal(['balanced']);
        expect([...template.allowedInteractions]).to.deep.equal(['click_reveal']);
        expect(template.layoutIds.cards).to.equal('professional-classic.flip-cards');

        const listed = listCourseTemplates().find((item) => item.id === 'professional-classic');
        expect(listed.version).to.equal('1.1.0');
        expect(listed.description).to.match(/flip-card reveals/i);
    });

    it('forces every learning slide in a fresh Professional course into the classic flip-card layout', () => {
        const binding = createTemplateBinding('professional-classic', { interactionLevel: 'high' });
        expect(binding.templateVersion).to.equal('1.1.0');
        expect(binding.interactionLevel).to.equal('balanced');

        const planned = planExperienceForTemplate(sourceAnalysis(), binding);
        expect(planned.templateBinding.templateVersion).to.equal('1.1.0');
        expect(planned.slides).to.have.length(3);
        expect(planned.slides.every((slide) => slide.layout === 'cards')).to.equal(true);
        expect(planned.slides.every((slide) => slide.layoutId === 'professional-classic.flip-cards')).to.equal(true);
        expect(planned.slides.every((slide) => slide.screenType === 'reveal')).to.equal(true);
        expect(planned.slides.every((slide) => slide.interaction?.type === 'click_reveal')).to.equal(true);
        expect(planned.slides.every((slide) => slide.interaction?.prompt === 'Reveal each key point before continuing.')).to.equal(true);
        expect(() => validateTemplateAnalysis(planned, binding)).not.to.throw();
    });

    it('keeps Professional 1.0 courses on their original renderer during rebuilds', () => {
        const legacyBinding = createTemplateBinding('professional-classic', {
            templateVersion: '1.0.0',
            interactionLevel: 'balanced'
        });
        const planned = planExperienceForTemplate(sourceAnalysis(), legacyBinding);

        expect(legacyBinding.templateVersion).to.equal('1.0.0');
        expect(planned.templateBinding.templateVersion).to.equal('1.0.0');
        expect(planned.slides.every((slide) => slide.interaction?.type === 'click_reveal')).to.equal(false);
        expect(() => validateTemplateAnalysis(planned, legacyBinding)).not.to.throw();

        const preTemplateCourse = resolveExistingCourseTemplateBinding({ analysis: { experienceVersion: 5 } });
        expect(preTemplateCourse.templateId).to.equal('professional-classic');
        expect(preTemplateCourse.templateVersion).to.equal('1.0.0');
    });

    it('keeps the current course menu as an add-on for Professional flip-card courses', () => {
        const html = '<!doctype html><html><head></head><body><main><section class="slide active">Hello</section></main></body></html>';
        const patched = injectCourseChrome(html, 'professional-classic');
        expect(patched).to.include('quizmoto-course-chrome-v1');
        expect(patched).to.include('quizmoto-course-chrome-script-v1');
        expect(patched).to.include('qmx-course-sidebar');
    });
});
