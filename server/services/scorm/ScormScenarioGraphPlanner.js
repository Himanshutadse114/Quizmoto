'use strict';

const SAFE_PATTERN = /\b(verify|confirm|report|pause|stop|refuse|escalate|contact|official|known|independent|check|inspect|lock|protect|avoid|do not|don't|never|follow|validate)\b/i;
const RISKY_PATTERN = /\b(click|open|approve|pay|transfer|share|send|disclose|ignore|bypass|continue|trust|allow|install|enter|provide|reply|download|scan the code|use the link)\b/i;

function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function clip(value, max = 220) {
    const text = clean(value);
    if (text.length <= max) return text;
    return `${text.slice(0, Math.max(1, max - 1)).replace(/[,:;\s]+$/, '')}…`;
}

function shortLabel(value, index) {
    const source = clean(value).replace(/^[0-9]+[.)\s-]*/, '').replace(/[.!?]+$/, '');
    if (!source) return `Response ${index + 1}`;
    const words = source.split(/\s+/);
    return clip(words.slice(0, 8).join(' '), 72);
}

function classifySafety(label, index, total) {
    const value = clean(label);
    if (SAFE_PATTERN.test(value) && !RISKY_PATTERN.test(value)) return 'safe';
    if (RISKY_PATTERN.test(value) && !SAFE_PATTERN.test(value)) return 'risky';

    // Scenario AI is asked to provide meaningful alternatives, but legacy
    // courses may not have explicit safety language. Keep a deterministic
    // spread so the learner still sees different consequences rather than
    // four identical neutral responses.
    if (total >= 3 && index === 0) return 'risky';
    if (total >= 3 && index === total - 1) return 'safe';
    return 'mixed';
}

function riskDeltaFor(safety) {
    if (safety === 'safe') return -15;
    if (safety === 'risky') return 25;
    return 8;
}

function consequenceFor(label, safety) {
    const action = shortLabel(label, 0);
    if (safety === 'safe') {
        return `${action} creates a verification checkpoint before the situation can cause further harm.`;
    }
    if (safety === 'risky') {
        return `${action} lets the situation progress before the request, person or channel has been independently verified.`;
    }
    return `${action} adds some caution, but the situation still needs a stronger independent check before action continues.`;
}

function coachingFor(safety) {
    if (safety === 'safe') {
        return 'Good judgement. Keep the verification step separate from the original request and follow the approved reporting or escalation route.';
    }
    if (safety === 'risky') {
        return 'A safer response is to pause, verify through a trusted route and avoid acting through the same channel that created the pressure.';
    }
    return 'This is a partial safeguard. Strengthen it by independently validating the request before sharing information, approving access or taking action.';
}

function scenarioSourceChoices(slide) {
    const structured = Array.isArray(slide?.scenario?.choices) ? slide.scenario.choices : [];
    if (structured.length >= 2) {
        return structured.slice(0, 4).map((choice, index) => ({
            label: shortLabel(choice?.label || choice?.text || choice, index),
            consequence: clip(choice?.consequence || '', 260),
            coaching: clip(choice?.coaching || choice?.feedback || '', 260),
            safety: ['safe', 'mixed', 'risky'].includes(String(choice?.safety || '').toLowerCase())
                ? String(choice.safety).toLowerCase()
                : null,
            riskDelta: Number.isFinite(Number(choice?.riskDelta)) ? Number(choice.riskDelta) : null
        }));
    }

    return (Array.isArray(slide?.keyPoints) ? slide.keyPoints : [])
        .map(clean)
        .filter(Boolean)
        .slice(0, 4)
        .map((point, index) => ({ label: shortLabel(point, index) }));
}

function isDecisionSlide(slide) {
    const type = String(slide?.interaction?.type || '').toLowerCase();
    const screenType = String(slide?.screenType || '').toLowerCase();
    return type === 'decision_explore' || screenType === 'scenario';
}

function outcomeForRisk(riskScore, decisionCount) {
    const count = Math.max(1, Number(decisionCount) || 1);
    const average = Number(riskScore || 0) / count;
    if (average <= 0) {
        return {
            id: 'protected',
            label: 'Strong judgement',
            title: 'You kept the situation under control',
            debrief: 'Your decisions consistently added verification, reduced exposure and created safer stopping points before action.'
        };
    }
    if (average <= 14) {
        return {
            id: 'caution',
            label: 'Caution needed',
            title: 'You reduced some risk, but not all of it',
            debrief: 'Several decisions helped, but one or more actions still relied on an unverified request or channel. Independent verification should happen earlier.'
        };
    }
    return {
        id: 'high-risk',
        label: 'High-risk path',
        title: 'The situation was allowed to escalate',
        debrief: 'The decision path created avoidable exposure. The safer pattern is to pause, verify independently and report or escalate before taking the requested action.'
    };
}

function buildScenarioGraph(analysis) {
    const slides = Array.isArray(analysis?.slides) ? analysis.slides : [];
    const decisions = slides
        .map((slide, slideIndex) => ({ slide, slideIndex }))
        .filter(({ slide }) => isDecisionSlide(slide) && scenarioSourceChoices(slide).length >= 2);

    const decisionNodes = [];
    const consequenceNodes = [];

    decisions.forEach(({ slide, slideIndex }, decisionIndex) => {
        const id = `decision-${String(decisionIndex + 1).padStart(2, '0')}`;
        const nextDecision = decisions[decisionIndex + 1]
            ? `decision-${String(decisionIndex + 2).padStart(2, '0')}`
            : 'outcome';
        const sourceChoices = scenarioSourceChoices(slide);
        const choices = sourceChoices.map((choice, choiceIndex) => {
            const choiceId = `${id}-choice-${choiceIndex + 1}`;
            const consequenceNodeId = `${id}-consequence-${choiceIndex + 1}`;
            const safety = choice.safety || classifySafety(choice.label, choiceIndex, sourceChoices.length);
            const riskDelta = Number.isFinite(choice.riskDelta) ? choice.riskDelta : riskDeltaFor(safety);
            const consequence = choice.consequence || consequenceFor(choice.label, safety);
            const coaching = choice.coaching || coachingFor(safety);

            consequenceNodes.push({
                id: consequenceNodeId,
                type: 'consequence',
                parentDecisionId: id,
                choiceId,
                safety,
                riskDelta,
                consequence,
                coaching,
                nextNodeId: nextDecision
            });

            return {
                id: choiceId,
                label: choice.label,
                safety,
                riskDelta,
                consequence,
                coaching,
                nextNodeId: consequenceNodeId
            };
        });

        decisionNodes.push({
            id,
            type: 'decision',
            slideIndex,
            ordinal: decisionIndex + 1,
            title: clean(slide?.title) || `Decision ${decisionIndex + 1}`,
            situation: clip(slide?.scenario?.situation || slide?.displayContent || slide?.content || '', 420),
            objective: clip(slide?.scenario?.objective || slide?.interaction?.prompt || 'Choose the response you would take, then review what happens.', 180),
            choices
        });
    });

    return {
        version: 2,
        mode: 'decision-consequence-branching',
        startNodeId: decisionNodes[0]?.id || null,
        decisionCount: decisionNodes.length,
        nodes: [...decisionNodes, ...consequenceNodes],
        outcomes: [
            outcomeForRisk(-15, 1),
            outcomeForRisk(8, 1),
            outcomeForRisk(25, 1)
        ]
    };
}

function planScenarioGraph(analysis, binding = null) {
    const templateId = String(binding?.templateId || analysis?.templateBinding?.templateId || '');
    if (templateId !== 'scenario-learning') return analysis;

    const graph = buildScenarioGraph(analysis);
    const nodeBySlide = new Map(
        graph.nodes
            .filter((node) => node.type === 'decision')
            .map((node) => [node.slideIndex, node])
    );

    return {
        ...(analysis || {}),
        scenarioEngineVersion: 2,
        scenarioGraph: graph,
        slides: (Array.isArray(analysis?.slides) ? analysis.slides : []).map((slide, index) => {
            const node = nodeBySlide.get(index);
            return node
                ? {
                    ...slide,
                    scenarioNodeId: node.id,
                    scenario: {
                        ...(slide?.scenario && typeof slide.scenario === 'object' ? slide.scenario : {}),
                        situation: node.situation,
                        objective: node.objective,
                        choices: node.choices.map((choice) => ({ ...choice }))
                    }
                }
                : slide;
        })
    };
}

module.exports = {
    buildScenarioGraph,
    classifySafety,
    outcomeForRisk,
    planScenarioGraph,
    riskDeltaFor,
    scenarioSourceChoices
};
