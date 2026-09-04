const { expect } = require('chai');
const { createTemplateBinding } = require('../services/scorm/ScormTemplateBindingService');
const { planExperienceForTemplate } = require('../services/scorm/ScormTemplateExperiencePlanner');
const { fitSlidePresentationContent } = require('../services/scorm/ScormTemplateContentFitter');
const {
    SCRIPT_ID,
    STYLE_ID,
    inject,
    script
} = require('../services/scorm/ScormScenarioLearningRuntime');
const { templateInstruction } = require('../services/scorm/VertexPolicyAnalysisService');

function course(slides) {
    return {
        title: 'Tailgating awareness',
        summary: 'A practical course about recognising and preventing unauthorised physical access while applying safe workplace behaviours and reporting suspicious activity through the appropriate internal process.',
        slides,
        quiz: []
    };
}

describe('Scenario Learning template runtime', () => {
    it('does not turn ordinary factual cards into fake learner decisions just because interaction level is high', () => {
        const binding = createTemplateBinding('scenario-learning', { interactionLevel: 'high' });
        const planned = planExperienceForTemplate(course([
            {
                title: 'Common tactics used by tailgaters',
                content: 'Tailgaters may exploit human courtesy to enter a secure area. They can use distraction, urgency or a busy doorway to reduce attention. These are warning patterns to recognise rather than response choices. Employees should notice the behaviour and follow the approved access process.',
                keyPoints: ['Exploits human courtesy', 'Distraction techniques', 'Feigned urgency', 'Blends into crowds'],
                layout: 'cards'
            }
        ]), binding);

        expect(planned.slides[0].interaction.type).to.not.equal('decision_explore');
        expect(planned.slides[0].screenType).to.not.equal('scenario');
    });

    it('keeps genuine workplace situations as decisions', () => {
        const binding = createTemplateBinding('scenario-learning', { interactionLevel: 'high' });
        const planned = planExperienceForTemplate(course([
            {
                title: 'A stranger follows you through the door',
                content: 'Imagine you badge into a restricted office and an unfamiliar person reaches for the door behind you. They say they forgot their badge and ask you to hold the door. You need to decide how to respond without creating unnecessary confrontation. The safest response is to follow the approved access and visitor process rather than granting access yourself.',
                keyPoints: ['Hold the door for them', 'Ask them to use approved access', 'Ignore the situation', 'Let them follow another employee'],
                layout: 'spotlight'
            }
        ]), binding);

        expect(planned.slides[0].interaction.type).to.equal('decision_explore');
        expect(planned.slides[0].screenType).to.equal('scenario');
        expect(planned.slides[0].layout).to.equal('cards');
    });

    it('enriches Scenario Learning interaction details from the teaching copy', () => {
        const fitted = fitSlidePresentationContent({
            layout: 'cards',
            content: 'Tailgaters often exploit human courtesy by carrying boxes or asking someone to hold a secure door. A distracted employee can unintentionally allow an unauthorised person to enter. Always follow the approved access process and require individual authentication.',
            keyPoints: ['Exploit human courtesy', 'Distracted employee', 'Individual authentication']
        }, 'scenario-learning');

        expect(fitted.keyPoints[0]).to.match(/courtesy/i);
        expect(fitted.keyPoints[0].split(/\s+/).length).to.be.greaterThan(4);
    });

    it('injects a dedicated Scenario Learning experience without affecting other templates', () => {
        const html = '<!doctype html><html><head></head><body data-qmx-course-template="scenario-learning"><div id="app"><main><section class="slide active" data-kind="learning" data-section="1" data-qmx-template-stage="true" data-qmx-interaction="decision_explore"><div class="qmx-learning-shell no-image"><div class="qmx-copy"><div class="eyebrow">Section 1</div><h2>Decision</h2><p>Situation</p><div class="qmx-cards"><div class="qmx-card"><span>01</span><p>Ask the visitor to use the approved access process.</p></div><div class="qmx-card"><span>02</span><p>Hold the door open because they look familiar.</p></div></div></div></div></section></main><footer><button id="next-btn">Next</button></footer></div></body></html>';
        const patched = inject(html, 'scenario-learning');

        expect(patched).to.include(STYLE_ID);
        expect(patched).to.include(SCRIPT_ID);
        expect(patched).to.include('Learning path');
        expect(patched).to.include('Consequence and coaching');
        expect(patched).to.include('data-qmx-scenario-locked');
        expect(patched).to.include('These points are guidance, not alternative choices');
        expect(patched).to.not.include('qmx-hotspot-marker');
        expect(inject(html, 'highly-interactive')).to.equal(html);
    });

    it('emits syntactically valid browser JavaScript', () => {
        const tag = script();
        const js = tag.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
        expect(() => new Function(js)).not.to.throw();
    });

    it('adds a scenario-specific authoring contract only for Scenario Learning', () => {
        const scenario = templateInstruction('scenario-learning', 'high');
        expect(scenario).to.include('SCENARIO LEARNING');
        expect(scenario).to.include('Do not force every screen into a decision');
        expect(scenario).to.include('keyPoints must be 3-7 word response choices');
        expect(templateInstruction('highly-interactive', 'high')).to.equal('');
    });
});
