function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function words(value) {
    return clean(value).toLowerCase().match(/[a-z0-9]{3,}/g) || [];
}

const STOP = new Set([
    'what','which','when','where','would','should','could','about','after','before','with','from','that','this','your','you','they','their','them','into','have','has','been','being','course','best','most','first','next','action','following','option'
]);

function keywordSet(value) {
    return new Set(words(value).filter((word) => !STOP.has(word)));
}

function overlapScore(question, slide) {
    const q = keywordSet(question);
    if (!q.size) return 0;
    const text = keywordSet(`${slide?.title || ''} ${slide?.content || ''} ${(slide?.keyPoints || []).join(' ')}`);
    let score = 0;
    q.forEach((word) => { if (text.has(word)) score += 1; });
    return score;
}

function relevantSlide(question, slides) {
    let best = null;
    let score = -1;
    (Array.isArray(slides) ? slides : []).forEach((slide) => {
        const current = overlapScore(question, slide);
        if (current > score) {
            score = current;
            best = slide;
        }
    });
    return best || (Array.isArray(slides) ? slides[0] : null) || {};
}

function usefulSentence(value) {
    const sentences = clean(value).match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
    const preferred = sentences.find((sentence) => {
        const text = clean(sentence);
        const count = text.split(/\s+/).filter(Boolean).length;
        return count >= 9 && count <= 24 && /because|risk|verify|report|confirm|check|avoid|protect|reduce|attacker|request|message|access|information|data|action|decision/i.test(text);
    });
    const fallback = sentences.find((sentence) => {
        const count = clean(sentence).split(/\s+/).filter(Boolean).length;
        return count >= 8 && count <= 24;
    });
    return clean(preferred || fallback || '');
}

function explanationWordCount(value) {
    return clean(value).split(/\s+/).filter(Boolean).length;
}

function buildExplanation(question, analysis) {
    const options = Array.isArray(question?.options) ? question.options.map(clean) : [];
    const correctIndex = Number(question?.correctAnswer);
    const correct = Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex < options.length
        ? clean(options[correctIndex])
        : '';
    const slide = relevantSlide(question?.question, analysis?.slides);
    const evidence = usefulSentence(slide?.content);
    const title = clean(slide?.title);

    const lead = correct
        ? `${correct} is the best answer because it follows the safe behaviour taught in this course.`
        : 'The correct response is the one that follows the safe behaviour taught in this course.';
    const parts = [
        lead,
        evidence,
        title ? `This reflects the lesson on ${title.toLowerCase()} and helps the learner make the safer workplace decision before proceeding.` : 'Applying this behaviour helps the learner make the safer workplace decision before proceeding.',
        'It also reduces the chance of acting on an unverified, misleading or risky request.'
    ].filter(Boolean);

    return clean(parts.join(' '));
}

function normalizeOption(value) {
    return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function quizIntegrityIssues(rawAnalysis) {
    const quiz = Array.isArray(rawAnalysis?.quiz) ? rawAnalysis.quiz : [];
    if (!quiz.length) return ['The course does not contain any knowledge-check questions.'];

    const issues = [];
    quiz.forEach((raw, index) => {
        const item = raw && typeof raw === 'object' ? raw : {};
        const label = `Knowledge check ${index + 1}`;
        const question = clean(item.question);
        const options = Array.isArray(item.options) ? item.options.map(clean) : [];
        const optionKeys = options.map(normalizeOption).filter(Boolean);
        const correctAnswer = Number(item.correctAnswer);

        if (!question) issues.push(`${label} is missing its question text.`);
        if (options.length !== 4 || options.some((option) => !option)) {
            issues.push(`${label} must contain exactly four non-empty answer options.`);
        } else if (new Set(optionKeys).size !== 4) {
            issues.push(`${label} contains duplicate answer options.`);
        }
        if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer >= 4) {
            issues.push(`${label} does not have a valid correct answer.`);
        }
        if (explanationWordCount(item.explanation) < 20) {
            issues.push(`${label} does not have a complete learner explanation.`);
        }
    });

    return issues;
}

function repairQuizExplanations(rawAnalysis) {
    const analysis = rawAnalysis && typeof rawAnalysis === 'object' ? { ...rawAnalysis } : {};
    const quiz = Array.isArray(analysis.quiz) ? analysis.quiz : [];
    let repaired = 0;

    analysis.quiz = quiz.map((raw) => {
        const item = raw && typeof raw === 'object' ? { ...raw } : {};
        const options = Array.isArray(item.options) ? item.options.map(clean).slice(0, 4) : [];
        const correctAnswer = Number(item.correctAnswer);
        let explanation = clean(item.explanation);

        if (explanationWordCount(explanation) < 20) {
            explanation = buildExplanation({ ...item, options, correctAnswer }, analysis);
            repaired += 1;
        }

        return {
            ...item,
            question: clean(item.question),
            options,
            correctAnswer,
            explanation
        };
    });

    const issues = quizIntegrityIssues(analysis);
    analysis.quizIntegrity = {
        explanationsGuaranteed: issues.every((issue) => !/explanation/i.test(issue)),
        repairedExplanations: repaired,
        valid: issues.length === 0,
        issueCount: issues.length
    };
    return analysis;
}

function ensureQuizIntegrity(rawAnalysis) {
    const analysis = repairQuizExplanations(rawAnalysis);
    const issues = quizIntegrityIssues(analysis);
    analysis.quizIntegrity = {
        ...(analysis.quizIntegrity || {}),
        valid: issues.length === 0,
        issueCount: issues.length
    };

    if (issues.length) {
        const err = new Error(`The AI returned an incomplete knowledge check: ${issues[0]} Please retry course generation.`);
        err.code = 'SCORM_QUIZ_INCOMPLETE';
        err.issues = issues;
        throw err;
    }
    return analysis;
}

module.exports = {
    repairQuizExplanations,
    ensureQuizIntegrity,
    quizIntegrityIssues,
    buildExplanation,
    relevantSlide,
    overlapScore,
    explanationWordCount
};
