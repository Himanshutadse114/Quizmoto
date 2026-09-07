const { expect } = require('chai');

const {
    buildScenarioGraph,
    planScenarioGraph,
    scenarioSourceChoices
} = require('../services/scorm/ScormScenarioGraphPlanner');
const {
    inject: injectDecisionUx,
    removeLegacyObserver,
    STYLE_ID,
    SCRIPT_ID
} = require('../services/scorm/ScormScenarioDecisionUxRuntime');

describe('Scenario Learning decision quality and navigation', () => {
    function clueSlide() {
        return {
            title: 'Spotting Suspicious Behavior',
            content: 'Imagine you are entering the office building. A person walks in right behind you, but you did not see them swipe a badge. They are carrying a large unmarked box, avoid eye contact and quickly head towards a restricted area.',
            displayContent: 'A person enters behind you without swiping a badge and heads towards a restricted area.',
            keyPoints: [
                'No badge displayed',
                'Unusual package',
                'Avoids interaction',
                'Moves to restricted zone'
            ],
            layout: 'hub',
            screenType: 'scenario',
            interaction: {
                type: 'decision_explore',
                prompt: 'Consider the situation and choose a response.'
            }
        };
    }

    function piggybackQuiz() {
        return {
            question: 'You are entering the building and hold the door for someone right behind you. They do not swipe a badge and quickly walk past you. What is your best immediate action?',
            options: [
                'Assume they forgot their badge and continue to your desk.',
                'Politely ask if they need help finding someone or if they have a badge.',
                'Immediately block their path and demand to see their identification.',
                'Wait to see where they go before deciding what to do.'
            ],
            correctAnswer: 1,
            explanation: 'Politely engaging the person creates a safe checkpoint without making assumptions or escalating unnecessarily. If the situation remains suspicious, follow the approved security or reporting process.'
        };
    }

    it('does not convert observable warning signs into fake response choices', () => {
        const slide = clueSlide();
        expect(scenarioSourceChoices(slide)).to.deep.equal([]);

        const graph = buildScenarioGraph({
            templateBinding: { templateId: 'scenario-learning' },
            slides: [slide],
            quiz: []
        });
        expect(graph.decisionCount).to.equal(0);
    });

    it('uses a relevant action question when a scenario slide only contains clues', () => {
        const graph = buildScenarioGraph({
            templateBinding: { templateId: 'scenario-learning' },
            slides: [clueSlide()],
            quiz: [piggybackQuiz()]
        });

        expect(graph.version).to.equal(3);
        expect(graph.decisionCount).to.equal(1);
        const decision = graph.nodes.find((node) => node.type === 'decision');
        expect(decision.source).to.equal('matched-quiz');
        expect(decision.objective).to.include('best immediate action');
        expect(decision.choices.map((choice) => choice.label).join(' ')).to.not.include('Unusual package');
        expect(decision.choices[1].label).to.include('Politely ask');
        expect(decision.choices[1].safety).to.equal('safe');
        expect(decision.choices[0].safety).to.equal('risky');
        expect(decision.choices[2].safety).to.equal('risky');
    });

    it('repairs old generated clue choices instead of trusting their positional risk labels', () => {
        const slide = clueSlide();
        slide.scenario = {
            situation: slide.content,
            objective: 'Choose a response.',
            choices: [
                { label: 'No badge displayed', safety: 'risky', riskDelta: 25 },
                { label: 'Unusual package', safety: 'mixed', riskDelta: 8 },
                { label: 'Avoids interaction', safety: 'mixed', riskDelta: 8 },
                { label: 'Moves to restricted zone', safety: 'safe', riskDelta: -15 }
            ]
        };

        const planned = planScenarioGraph({
            templateBinding: { templateId: 'scenario-learning' },
            slides: [slide],
            quiz: [piggybackQuiz()]
        }, { templateId: 'scenario-learning' });

        expect(planned.scenarioEngineVersion).to.equal(3);
        expect(planned.scenarioGraph.decisionCount).to.equal(1);
        expect(planned.slides[0].scenario.source).to.equal('matched-quiz');
        expect(planned.slides[0].scenario.objective).to.include('best immediate action');
        expect(planned.slides[0].scenario.choices.map((choice) => choice.label)).to.not.include('Moves to restricted zone');
    });

    it('keeps Next visible while locked and makes consequence review fit the learner view', () => {
        const html = '<!doctype html><html><head></head><body data-qmx-course-template="scenario-learning"><main><div class="slide"></div></main><footer><button id="next-btn" data-qmx-scenario-locked="true">Next</button></footer></body></html>';
        const patched = injectDecisionUx(html);
        expect(patched).to.include(STYLE_ID);
        expect(patched).to.include(SCRIPT_ID);
        expect(patched).to.include('visibility:visible!important');
        expect(patched).to.include('qmx-branch-choice-made .qmx-branch-grid{display:none!important}');
        expect(patched).to.include('qmx-branch-consequence:not([hidden])');
        expect(patched).to.include('position:sticky!important');
    });

    it('removes the legacy ScenarioLearning MutationObserver that could retrigger on its own DOM changes', () => {
        const observer = "var main=document.querySelector('main');if(main){var observer=new MutationObserver(function(changes){var nav=changes.some(function(c){return c.type==='attributes'&&c.attributeName==='class'&&c.target&&c.target.classList&&c.target.classList.contains('slide');});if(nav){prepare();syncPath(false);}else syncNext();});observer.observe(main,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-qmx-scenario-visited','data-qmx-scenario-focus-complete','data-qmx-scenario-decision-complete']});}";
        const html = `<html><head></head><body><script>${observer}</script></body></html>`;
        const cleaned = removeLegacyObserver(html);
        expect(cleaned).to.not.include('new MutationObserver');
        expect(cleaned).to.include("var main=document.querySelector('main');");
    });
});
