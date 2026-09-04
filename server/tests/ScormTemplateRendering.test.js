const { expect } = require('chai');
const { createTemplateBinding } = require('../services/scorm/ScormTemplateBindingService');
const { planExperienceForTemplate } = require('../services/scorm/ScormTemplateExperiencePlanner');
const { preserveCourseDesign } = require('../services/scorm/ScormRebuildDesignPreserver');
const {
    BODY_WORD_BUDGETS,
    fitSlidePresentationContent,
    trimToWordBudget
} = require('../services/scorm/ScormTemplateContentFitter');
const {
    SCRIPT_ID,
    injectTemplateRuntime,
    runtimeScript,
    slideDescriptors
} = require('../services/scorm/ScormTemplateRuntime');

function wordCount(value) {
    return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function longBody(prefix = 'Learning') {
    return Array.from({ length: 18 }, (_, index) => `${prefix} sentence ${index + 1} explains an important workplace behaviour and gives the learner enough context to understand the risk before taking the safest action.`).join(' ');
}

function analysisWithLongSlides() {
    return {
        title: 'Malware awareness',
        summary: 'Understand common malware and respond safely.',
        slides: [
            {
                title: 'Trojan horses and deceptive software',
                content: longBody('Trojan'),
                keyPoints: ['Disguises itself as useful software', 'Creates a hidden backdoor', 'Can steal information', 'Use trusted download sources'],
                layout: 'spotlight'
            },
            {
                title: 'Ransomware impact',
                content: longBody('Ransomware'),
                keyPoints: ['Encrypts important files', 'Demands payment', 'Payment does not guarantee recovery', 'Offline backups reduce impact'],
                layout: 'cards'
            }
        ],
        quiz: []
    };
}

describe('SCORM template fixed-stage rendering', () => {
    it('keeps full authoring content while producing layout-budgeted display copy', () => {
        const binding = createTemplateBinding('highly-interactive', { interactionLevel: 'high' });
        const course = planExperienceForTemplate(analysisWithLongSlides(), binding);

        expect(wordCount(course.slides[0].content)).to.be.greaterThan(120);
        expect(wordCount(course.slides[0].displayContent)).to.be.at.most(BODY_WORD_BUDGETS['highly-interactive'][course.slides[0].layout]);
        expect(wordCount(course.slides[1].displayContent)).to.be.at.most(BODY_WORD_BUDGETS['highly-interactive'][course.slides[1].layout]);
        expect(course.slides[0].content).to.not.equal(course.slides[0].displayContent);
    });

    it('recalculates display copy after an edit without changing the saved slide design', () => {
        const binding = createTemplateBinding('highly-interactive', { interactionLevel: 'high' });
        const stored = planExperienceForTemplate(analysisWithLongSlides(), binding);
        const edited = JSON.parse(JSON.stringify(stored));
        edited.slides[0].content = longBody('Updated');
        edited.slides[0].displayContent = 'Stale display copy that must not survive.';
        edited.slides[0].layoutId = 'scenario-learning.scene';

        const rebuilt = preserveCourseDesign(edited, stored);
        expect(rebuilt.slides[0].layoutId).to.equal(stored.slides[0].layoutId);
        expect(rebuilt.slides[0].content).to.equal(edited.slides[0].content);
        expect(rebuilt.slides[0].displayContent).to.not.equal('Stale display copy that must not survive.');
        expect(rebuilt.slides[0].displayContent).to.match(/Updated/);
    });

    it('uses sentence-aware trimming rather than relying on overflow clipping', () => {
        const source = longBody('Safety');
        const trimmed = trimToWordBudget(source, 52);
        expect(wordCount(trimmed)).to.be.at.most(52);
        expect(trimmed).to.match(/[.!?]$/);
    });

    it('injects template metadata before generic body interaction scripts and has no 78 percent clipping floor', () => {
        const binding = createTemplateBinding('highly-interactive', { interactionLevel: 'high' });
        const course = planExperienceForTemplate(analysisWithLongSlides(), binding);
        const html = '<!doctype html><html><head></head><body><main><section class="slide active" data-kind="learning" data-section="1"><div class="qmx-learning-shell"><div class="qmx-copy"><h2>Title</h2><p>Long copy</p><div class="qmx-cards"><div class="qmx-card"><span>01</span><p>Point</p></div></div></div></div></section></main><script id="generic-interactions"></script></body></html>';
        const patched = injectTemplateRuntime(html, course);

        expect(patched).to.include(SCRIPT_ID);
        expect(patched.indexOf(SCRIPT_ID)).to.be.lessThan(patched.indexOf('<body>'));
        expect(patched).to.include('data-qmx-layout-id');
        expect(patched).to.include('disableGenericFlip');
        expect(patched).to.not.include('MIN_SCALE=.78');
    });

    it('emits syntactically valid browser runtime JavaScript', () => {
        const binding = createTemplateBinding('highly-interactive', { interactionLevel: 'high' });
        const course = planExperienceForTemplate(analysisWithLongSlides(), binding);
        const scriptTag = runtimeScript('highly-interactive', slideDescriptors(course));
        const js = scriptTag.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
        expect(() => new Function(js)).not.to.throw();
    });

    it('recomputes runtime descriptors from current content instead of trusting stale display content', () => {
        const binding = createTemplateBinding('highly-interactive', { interactionLevel: 'high' });
        const course = planExperienceForTemplate(analysisWithLongSlides(), binding);
        course.slides[0].content = longBody('Fresh');
        course.slides[0].displayContent = 'Stale';

        const descriptors = slideDescriptors(course);
        expect(descriptors[0].displayContent).to.match(/Fresh/);
        expect(descriptors[0].displayContent).to.not.equal('Stale');
    });

    it('does not force display-copy fitting onto the professional compatibility path', () => {
        const slide = { layout: 'spotlight', content: longBody('Professional') };
        const fitted = fitSlidePresentationContent(slide, 'professional-classic');
        expect(fitted.displayContent).to.equal(undefined);
        expect(fitted.content).to.equal(slide.content);
    });
});
