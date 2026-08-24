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
    const options = Array.isArray(question?.options) ? question.options : [];
    const correctIndex = Number(question?.correctAnswer);
    const correct = clean(options[correctIndex]) || 'the selected safe action';
    const slide = relevantSlide(question?.question, analysis?.slides);
    const evidence = usefulSentence(slide?.content);
    const title = clean(slide?.title);

    const parts = [
        `${correct} is the best answer because it follows the safe behaviour taught in this course.`,
        evidence,
        title ? `This reflects the lesson on ${title.toLowerCase()} and helps the learner make the safer workplace decision before proceeding.` : 'Applying this behaviour helps the learner make the safer workplace decision before proceeding.',
        'It also reduces the chance of acting on an unverified, misleading or risky request.'
    ].filter(Boolean);

    return clean(parts.join(' '));
}

function repairQuizExplanations(rawAnalysis) {
    const analysis = rawAnalysis && typeof rawAnalysis === 'object' ? { ...rawAnalysis } : {};
    const quiz = Array.isArray(analysis.quiz) ? analysis.quiz : [];
    let repaired = 0;

    analysis.quiz = quiz.map((raw, index) => {
        const item = raw && typeof raw === 'object' ? { ...raw } : {};
        const options = Array.isArray(item.options)
            ? item.options.map(clean).filter(Boolean).slice(0, 4)
            : [];
        while (options.length < 4) options.push(`Alternative ${options.length + 1}`);

        let correctAnswer = Number(item.correctAnswer);
        if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) correctAnswer = 0;

        let explanation = clean(item.explanation);
        if (explanationWordCount(explanation) < 20) {
            explanation = buildExplanation({ ...item, options, correctAnswer }, analysis);
            repaired += 1;
        }

        return {
            ...item,
            question: clean(item.question) || `Knowledge check ${index + 1}`,
            options,
            correctAnswer,
            explanation
        };
    });

    analysis.quizIntegrity = {
        explanationsGuaranteed: true,
        repairedExplanations: repaired
    };
    return analysis;
}

module.exports = {
    repairQuizExplanations,
    buildExplanation,
    relevantSlide,
    overlapScore,
    explanationWordCount
};
