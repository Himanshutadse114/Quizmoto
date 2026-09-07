'use strict';

const SAFE_PATTERN = /\b(verify|confirm|report|pause|stop|refuse|escalate|contact|official|known|independent|check|inspect|lock|protect|avoid|do not|don't|never|follow|validate)\b/i;
const RISKY_PATTERN = /\b(click|open|approve|pay|transfer|share|send|disclose|ignore|bypass|continue|trust|allow|install|enter|provide|reply|download|scan the code|use the link)\b/i;
const ACTION_CHOICE_PATTERN = /^(ask|avoid|challenge|check|confirm|contact|decline|deny|do not|don't|escort|follow|hold|ignore|immediately|never|notify|offer|open|pause|politely|refuse|report|request|stop|tell|use|verify|wait|allow|approve|assume|block|call|click|continue|direct|enter|install|pay|reply|scan|send|share|transfer)\b/i;
const ACTION_QUESTION_PATTERN = /\b(what should|what would|what is your (?:best|first|next|most appropriate)|best (?:immediate )?action|most appropriate action|first action|first step|next step|correct response|how should|what do you do|what should you do)\b/i;
const TOKEN_STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being', 'but', 'by', 'can', 'could', 'did', 'do', 'does',
    'for', 'from', 'had', 'has', 'have', 'he', 'her', 'here', 'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is',
    'it', 'its', 'may', 'might', 'of', 'on', 'or', 'our', 'she', 'should', 'so', 'some', 'than', 'that', 'the', 'their',
    'them', 'then', 'there', 'these', 'they', 'this', 'those', 'to', 'was', 'we', 'were', 'what', 'when', 'where', 'which',
    'who', 'why', 'will', 'with', 'would', 'you', 'your'
]);

function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function clip(value, max = 220) {
    const text = clean(value);
    if (text.length <= max) return text;
    return `${text.slice(0, Math.max(1, max - 1)).replace(/[,:;\s]+$/, '')}…`;
}

function shortLabel(value, index) {
    const source = clean(value)
        .replace(/^[A-D][.)]\s*/i, '')
        .replace(/^[0-9]+[.)\s-]*/, '')
        .replace(/[.!?]+$/, '');
    if (!source) return `Response ${index + 1}`;
    const words = source.split(/\s+/);
    return clip(words.slice(0, 16).join(' '), 120);
}

function classifySafety(label) {
    const value = clean(label);
    if (SAFE_PATTERN.test(value) && !RISKY_PATTERN.test(value)) return 'safe';
    if (RISKY_PATTERN.test(value) && !SAFE_PATTERN.test(value)) return 'risky';

    // Never invent correctness from option position. If an older/action-only
    // scenario has no explicit safety signal, keep it neutral rather than
    // declaring the first or last response safe/risky arbitrarily.
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
        return `Choosing “${action}” creates a safer checkpoint before the situation can cause further harm.`;
    }
    if (safety === 'risky') {
        return `Choosing “${action}” leaves the situation exposed because the safest verification or escalation step has not happened yet.`;
    }
    return `Choosing “${action}” changes how the situation develops. Review the coaching before deciding how this action should be strengthened.`;
}

function coachingFor(safety) {
    if (safety === 'safe') {
        return 'Good judgement. Keep the verification step separate from the original request and follow the approved reporting or escalation route.';
    }
    if (safety === 'risky') {
        return 'A safer response is to pause, verify through a trusted route and avoid acting before the situation has been checked.';
    }
    return 'This response is not classified as clearly safe or risky from the available source. Use the coaching and source guidance to identify the stronger action.';
}

function normalizeStructuredChoices(slide) {
    const structured = Array.isArray(slide?.scenario?.choices) ? slide.scenario.choices : [];
    if (structured.length < 2) return [];
    const normalized = structured.slice(0, 4).map((choice, index) => ({
        label: shortLabel(choice?.label || choice?.text || choice, index),
        consequence: clip(choice?.consequence || '', 280),
        coaching: clip(choice?.coaching || choice?.feedback || '', 320),
        safety: ['safe', 'mixed', 'risky'].includes(String(choice?.safety || '').toLowerCase())
            ? String(choice.safety).toLowerCase()
            : null,
        riskDelta: Number.isFinite(Number(choice?.riskDelta)) ? Number(choice.riskDelta) : null
    }));
    if (!normalized.every((choice) => ACTION_CHOICE_PATTERN.test(choice.label))) return [];
    return normalized;
}

function actionableKeyPointChoices(slide) {
    const points = (Array.isArray(slide?.keyPoints) ? slide.keyPoints : [])
        .map(clean)
        .filter(Boolean)
        .slice(0, 4);
    if (points.length < 2) return [];

    // Do not turn clues/facts such as “No badge displayed” or “Unusual package”
    // into fake learner decisions. Every fallback key point must read as an
    // action the learner could actually choose.
    const actionable = points.every((point) => ACTION_CHOICE_PATTERN.test(point));
    if (!actionable) return [];
    return points.map((point, index) => ({ label: shortLabel(point, index) }));
}

function scenarioSourceChoices(slide) {
    const structured = normalizeStructuredChoices(slide);
    if (structured.length >= 2) return structured;
    return actionableKeyPointChoices(slide);
}

function tokenSet(value) {
    return new Set(
        clean(value)
            .toLowerCase()
            .replace(/[^a-z0-9'’-]+/g, ' ')
            .split(/\s+/)
            .map((token) => token.replace(/[’']/g, ''))
            .filter((token) => token.length >= 3 && !TOKEN_STOP_WORDS.has(token))
    );
}

function overlapCount(left, right) {
    let count = 0;
    left.forEach((token) => {
        if (right.has(token)) count += 1;
    });
    return count;
}

function quizDecisionScore(slide, quizItem) {
    const question = clean(quizItem?.question);
    const options = Array.isArray(quizItem?.options) ? quizItem.options : [];
    const correctAnswer = Number(quizItem?.correctAnswer);
    if (!ACTION_QUESTION_PATTERN.test(question)) return -1;
    if (options.length < 3 || options.length > 5) return -1;
    if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) return -1;

    const titleTokens = tokenSet(slide?.title);
    const bodyTokens = tokenSet(slide?.scenario?.situation || slide?.displayContent || slide?.content);
    const questionTokens = tokenSet(question);
    const titleOverlap = overlapCount(titleTokens, questionTokens);
    const bodyOverlap = overlapCount(bodyTokens, questionTokens);
    return (titleOverlap * 4) + bodyOverlap;
}

function quizChoicesForSlide(slide, analysis, usedQuizIndexes = new Set()) {
    const quiz = Array.isArray(analysis?.quiz) ? analysis.quiz : [];
    let best = null;

    quiz.forEach((item, index) => {
        if (usedQuizIndexes.has(index)) return;
        const score = quizDecisionScore(slide, item);
        if (score < 2) return;
        if (!best || score > best.score) best = { item, index, score };
    });

    if (!best) return null;
    const correctAnswer = Number(best.item.correctAnswer);
    const explanation = clip(best.item.explanation || '', 360);
    const choices = best.item.options.slice(0, 4).map((option, index) => {
        const safety = index === correctAnswer ? 'safe' : 'risky';
        const label = shortLabel(option, index);
        return {
            label,
            safety,
            riskDelta: riskDeltaFor(safety),
            consequence: consequenceFor(label, safety),
            coaching: explanation || coachingFor(safety)
        };
    });

    return {
        quizIndex: best.index,
        objective: clip(best.item.question, 260),
        choices
    };
}

function decisionSourceForSlide(slide, analysis, usedQuizIndexes = new Set()) {
    // A matched knowledge check is the strongest grounded source because it
    // carries an explicit question and correct answer. Prefer it over inferred
    // key-point actions whenever one clearly matches this situation.
    const quizSource = quizChoicesForSlide(slide, analysis, usedQuizIndexes);
    if (quizSource) {
        usedQuizIndexes.add(quizSource.quizIndex);
        return {
            choices: quizSource.choices,
            objective: quizSource.objective,
            source: 'matched-quiz'
        };
    }

    const directChoices = scenarioSourceChoices(slide);
    if (directChoices.length >= 2) {
        return {
            choices: directChoices,
            objective: clip(slide?.scenario?.objective || slide?.interaction?.prompt || 'Choose the response you would take, then review what happens.', 220),
            source: Array.isArray(slide?.scenario?.choices) && slide.scenario.choices.length >= 2 ? 'structured' : 'actionable-keypoints'
        };
    }

    return { choices: [], objective: '', source: 'none' };
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
    const usedQuizIndexes = new Set();
    const decisions = [];

    slides.forEach((slide, slideIndex) => {
        if (!isDecisionSlide(slide)) return;
        const source = decisionSourceForSlide(slide, analysis, usedQuizIndexes);
        if (source.choices.length < 2) return;
        decisions.push({ slide, slideIndex, source });
    });

    const decisionNodes = [];
    const consequenceNodes = [];

    decisions.forEach(({ slide, slideIndex, source }, decisionIndex) => {
        const id = `decision-${String(decisionIndex + 1).padStart(2, '0')}`;
        const nextDecision = decisions[decisionIndex + 1]
            ? `decision-${String(decisionIndex + 2).padStart(2, '0')}`
            : 'outcome';
        const sourceChoices = source.choices;
        const choices = sourceChoices.map((choice, choiceIndex) => {
            const choiceId = `${id}-choice-${choiceIndex + 1}`;
            const consequenceNodeId = `${id}-consequence-${choiceIndex + 1}`;
            const safety = choice.safety || classifySafety(choice.label);
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
            objective: source.objective || clip(slide?.scenario?.objective || slide?.interaction?.prompt || 'Choose the response you would take, then review what happens.', 220),
            source: source.source,
            choices
        });
    });

    return {
        version: 3,
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
        scenarioEngineVersion: 3,
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
                        source: node.source,
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
    decisionSourceForSlide,
    outcomeForRisk,
    planScenarioGraph,
    quizChoicesForSlide,
    quizDecisionScore,
    riskDeltaFor,
    scenarioSourceChoices
};
