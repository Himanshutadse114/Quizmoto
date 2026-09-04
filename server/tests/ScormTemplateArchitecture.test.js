const { expect } = require('chai');
const {
    DEFAULT_COURSE_TEMPLATE_ID,
    getCourseTemplate,
    listCourseTemplates
} = require('../services/scorm/ScormTemplateCatalog');
const {
    assertRequestedTemplateMatchesBinding,
    createTemplateBinding,
    resolveExistingCourseTemplateBinding
} = require('../services/scorm/ScormTemplateBindingService');
const { planExperienceForTemplate } = require('../services/scorm/ScormTemplateExperiencePlanner');
const { validateTemplateAnalysis } = require('../services/scorm/ScormTemplateValidator');
const { preserveCourseDesign } = require('../services/scorm/ScormRebuildDesignPreserver');
const {
    injectTemplateRuntime,
    shouldUseTemplateRuntime
} = require('../services/scorm/ScormTemplateRuntime');

function sourceAnalysis() {
    return {
        title: 'Phishing awareness',
        summary: 'Recognise suspicious requests and verify them safely.',
        slides: [
            {
                title: 'Recognise a suspicious request',
                content: 'Attackers often create urgency so employees act before checking the sender, context and requested action. Verify unusual requests through a separate trusted channel before sharing information or approving a transaction.',
                keyPoints: ['Check the sender', 'Question unusual urgency', 'Verify another way', 'Report suspicious activity']
            },
            {
                title: 'Warning signs to explore',
                content: 'Look for unexpected requests, unusual domains, pressure to bypass normal processes and links that do not match the stated destination.',
                keyPoints: ['Unexpected request', 'Lookalike domain', 'Urgent pressure', 'Unusual link']
            },
            {
                title: 'Verification process',
                content: 'Pause, inspect the request, contact the requester through a known channel and report anything that cannot be independently verified.',
                keyPoints: ['Pause', 'Inspect', 'Verify', 'Report']
            },
            {
                title: 'A payment scenario',
                content: 'Imagine receiving an urgent message from a senior leader asking for a payment outside the normal approval process. Consider what should happen before anyone acts.',
                keyPoints: ['Approve immediately', 'Verify independently', 'Share credentials', 'Ignore the process']
            }
        ],
        quiz: []
    };
}

describe('SCORM versioned template architecture', () => {
    it('publishes four isolated course templates while keeping the current style as the default', () => {
        const templates = listCourseTemplates();
        expect(templates.map((item) => item.id)).to.deep.equal([
            'professional-classic',
            'highly-interactive',
            'scenario-learning',
            'visual-product-training'
        ]);
        expect(DEFAULT_COURSE_TEMPLATE_ID).to.equal('professional-classic');
        expect(getCourseTemplate(DEFAULT_COURSE_TEMPLATE_ID).legacyThemeId).to.equal(1);
    });

    it('maps old courses without template metadata to the professional template without enabling a new renderer', () => {
        const binding = resolveExistingCourseTemplateBinding({
            analysis: { experienceVersion: 5 },
            pkg: { templateId: 1 }
        });
        expect(binding.templateId).to.equal('professional-classic');
        expect(binding.templateVersion).to.equal('1.0.0');
        expect(binding.locked).to.equal(true);
    });

    it('gives each template its own stable layout identities', () => {
        const professional = createTemplateBinding('professional-classic', { interactionLevel: 'balanced' });
        const interactive = createTemplateBinding('highly-interactive', { interactionLevel: 'high' });
        const scenario = createTemplateBinding('scenario-learning', { interactionLevel: 'high' });

        const proCourse = planExperienceForTemplate(sourceAnalysis(), professional);
        const interactiveCourse = planExperienceForTemplate(sourceAnalysis(), interactive);
        const scenarioCourse = planExperienceForTemplate(sourceAnalysis(), scenario);

        expect(proCourse.slides.every((slide) => slide.layoutId.startsWith('professional-classic.'))).to.equal(true);
        expect(interactiveCourse.slides.every((slide) => slide.layoutId.startsWith('highly-interactive.'))).to.equal(true);
        expect(scenarioCourse.slides.every((slide) => slide.layoutId.startsWith('scenario-learning.'))).to.equal(true);
        expect(() => validateTemplateAnalysis(interactiveCourse, interactive)).not.to.throw();
        expect(() => validateTemplateAnalysis(scenarioCourse, scenario)).not.to.throw();
    });

    it('rejects cross-template layout contamination instead of trying to render it', () => {
        const binding = createTemplateBinding('highly-interactive', { interactionLevel: 'high' });
        const course = planExperienceForTemplate(sourceAnalysis(), binding);
        course.slides[1].layoutId = 'scenario-learning.scene';

        expect(() => validateTemplateAnalysis(course, binding))
            .to.throw(/does not satisfy the locked Highly Interactive template contract/);
    });

    it('prevents a normal rebuild request from switching templates', () => {
        const binding = createTemplateBinding('highly-interactive', { interactionLevel: 'high' });
        expect(() => assertRequestedTemplateMatchesBinding({ courseTemplateId: 'scenario-learning' }, binding))
            .to.throw(/locked to highly-interactive/);
        expect(() => assertRequestedTemplateMatchesBinding({ courseTemplateId: 'highly-interactive' }, binding))
            .not.to.throw();
    });

    it('preserves saved layout and interaction identity while allowing edited learner text', () => {
        const binding = createTemplateBinding('highly-interactive', { interactionLevel: 'high' });
        const stored = planExperienceForTemplate(sourceAnalysis(), binding);
        const edited = JSON.parse(JSON.stringify(stored));
        edited.slides[1].title = 'Updated warning signs';
        edited.slides[1].content = 'Updated learner-visible explanation.';
        edited.slides[1].layout = 'spotlight';
        edited.slides[1].layoutId = 'highly-interactive.focus-reveal';
        edited.slides[1].interaction = { type: 'focus_reveal', prompt: 'Changed by editor payload' };

        const rebuilt = preserveCourseDesign(edited, stored);
        expect(rebuilt.slides[1].title).to.equal('Updated warning signs');
        expect(rebuilt.slides[1].content).to.equal('Updated learner-visible explanation.');
        expect(rebuilt.slides[1].layout).to.equal(stored.slides[1].layout);
        expect(rebuilt.slides[1].layoutId).to.equal(stored.slides[1].layoutId);
        expect(rebuilt.slides[1].interaction).to.deep.equal(stored.slides[1].interaction);
    });

    it('injects a no-document-scroll stage only for courses using the new template engine', () => {
        const binding = createTemplateBinding('highly-interactive', { interactionLevel: 'high' });
        const course = planExperienceForTemplate(sourceAnalysis(), binding);
        const html = '<!doctype html><html><head></head><body><section class="slide active"><div class="layout">Hello</div></section></body></html>';
        const patched = injectTemplateRuntime(html, course);

        expect(shouldUseTemplateRuntime(course)).to.equal(true);
        expect(patched).to.include('quizmoto-template-stage-v1');
        expect(patched).to.include('overflow:hidden!important');
        expect(patched).to.include('highly-interactive');

        const legacy = { experienceVersion: 5, slides: [] };
        expect(shouldUseTemplateRuntime(legacy)).to.equal(false);
        expect(injectTemplateRuntime(html, legacy)).to.equal(html);
    });
});
