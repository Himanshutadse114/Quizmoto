const { expect } = require('chai');
const JSZip = require('jszip');

const {
    buildScenarioGraph,
    classifySafety,
    outcomeForRisk,
    planScenarioGraph
} = require('../services/scorm/ScormScenarioGraphPlanner');
const {
    fitSlidePresentationContent
} = require('../services/scorm/ScormTemplateContentFitter');
const {
    DATA_ID,
    SCRIPT_ID,
    STYLE_ID,
    applyScenarioBranchingRuntimeToZip,
    inject
} = require('../services/scorm/ScormScenarioBranchingRuntime');

describe('Scenario Learning branching engine v2', () => {
    const scenarioAnalysis = () => ({
        title: 'Phishing Decisions',
        templateBinding: {
            templateId: 'scenario-learning',
            templateVersion: '1.0.0',
            interactionLevel: 'high'
        },
        slides: [
            {
                title: 'The urgent payment request',
                content: 'A senior leader appears to request an urgent payment. The message asks you to act before the normal approval process can be completed.',
                displayContent: 'A senior leader appears to request an urgent payment.',
                keyPoints: [
                    'Pay immediately',
                    'Reply to the same email',
                    'Verify through a known number'
                ],
                layout: 'cards',
                screenType: 'scenario',
                interaction: {
                    type: 'decision_explore',
                    prompt: 'Choose what you would do next.'
                }
            },
            {
                title: 'A second request arrives',
                content: 'The requester now asks for confidential account information through chat.',
                keyPoints: [
                    'Share the information',
                    'Wait and ask the same chat',
                    'Report and verify independently'
                ],
                layout: 'cards',
                screenType: 'scenario',
                interaction: {
                    type: 'decision_explore',
                    prompt: 'Choose the safest response.'
                }
            }
        ]
    });

    it('preserves short learner response choices on Scenario decision slides', () => {
        const slide = scenarioAnalysis().slides[0];
        const fitted = fitSlidePresentationContent(slide, 'scenario-learning');
        expect(fitted.keyPoints).to.deep.equal(slide.keyPoints);
    });

    it('continues enriching non-decision Scenario learning screens', () => {
        const slide = {
            title: 'Warning signs',
            content: 'An urgent deadline is designed to reduce careful checking. A mismatched sender address can reveal impersonation.',
            keyPoints: ['Urgent deadline', 'Sender mismatch'],
            layout: 'hub',
            screenType: 'hotspot',
            interaction: { type: 'hotspot_explore', prompt: 'Explore the clues.' }
        };
        const fitted = fitSlidePresentationContent(slide, 'scenario-learning');
        expect(fitted.keyPoints).to.have.length(2);
        expect(fitted.keyPoints.join(' ')).to.include('urgent');
    });

    it('builds decision nodes with a unique consequence branch for every response', () => {
        const graph = buildScenarioGraph(scenarioAnalysis());
        expect(graph.version).to.equal(2);
        expect(graph.mode).to.equal('decision-consequence-branching');
        expect(graph.decisionCount).to.equal(2);

        const decision = graph.nodes.find((node) => node.id === 'decision-01');
        expect(decision.choices).to.have.length(3);
        expect(new Set(decision.choices.map((choice) => choice.nextNodeId)).size).to.equal(3);

        decision.choices.forEach((choice) => {
            const consequence = graph.nodes.find((node) => node.id === choice.nextNodeId);
            expect(consequence).to.include({ type: 'consequence', parentDecisionId: decision.id });
            expect(consequence.consequence).to.be.a('string').and.not.empty;
            expect(consequence.coaching).to.be.a('string').and.not.empty;
            expect(consequence.nextNodeId).to.equal('decision-02');
        });
    });

    it('stores graph identity and normalised choices on the Scenario analysis', () => {
        const analysis = planScenarioGraph(scenarioAnalysis(), { templateId: 'scenario-learning' });
        expect(analysis.scenarioEngineVersion).to.equal(2);
        expect(analysis.scenarioGraph.decisionCount).to.equal(2);
        expect(analysis.slides[0].scenarioNodeId).to.equal('decision-01');
        expect(analysis.slides[0].scenario.choices[0]).to.have.keys([
            'id', 'label', 'safety', 'riskDelta', 'consequence', 'coaching', 'nextNodeId'
        ]);
    });

    it('separates safer and riskier actions into different path effects', () => {
        expect(classifySafety('Verify through a known number', 2, 3)).to.equal('safe');
        expect(classifySafety('Click the link and continue', 0, 3)).to.equal('risky');
        expect(outcomeForRisk(-30, 2).id).to.equal('protected');
        expect(outcomeForRisk(16, 2).id).to.equal('caution');
        expect(outcomeForRisk(50, 2).id).to.equal('high-risk');
    });

    it('injects graph data, branching UI and persistent path state into learner HTML', () => {
        const graph = buildScenarioGraph(scenarioAnalysis());
        const html = '<!doctype html><html><head></head><body data-qmx-course-template="scenario-learning"><main></main></body></html>';
        const patched = inject(html, graph);
        expect(patched).to.include(STYLE_ID);
        expect(patched).to.include(DATA_ID);
        expect(patched).to.include(SCRIPT_ID);
        expect(patched).to.include('__QMX_SCENARIO_GRAPH__');
        expect(patched).to.include('__qmxScenarioState');
        expect(patched).to.include('Continue this path');
        expect(patched).to.include('Scenario outcome');
        expect(patched).to.include('__qmxScenarioBranchingRuntimeLoaded');
        expect(patched).to.include('scheduleGlobalSync');
        expect(patched).to.not.include('MutationObserver');
    });

    it('applies branching runtime only to Scenario Learning packages with decisions', async () => {
        const analysis = planScenarioGraph(scenarioAnalysis(), { templateId: 'scenario-learning' });
        const zip = new JSZip();
        zip.file('index.html', '<!doctype html><html><head></head><body data-qmx-course-template="scenario-learning"><main></main></body></html>');
        const raw = await zip.generateAsync({ type: 'nodebuffer' });
        const patched = await applyScenarioBranchingRuntimeToZip(raw, analysis);
        const opened = await JSZip.loadAsync(patched);
        const html = await opened.file('index.html').async('string');
        expect(html).to.include(SCRIPT_ID);
        expect(html).to.include('decision-01-consequence-1');
        expect(html).to.not.include('MutationObserver');
    });
});
