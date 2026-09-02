const { packageAnalysis } = require('./ScormProgressService');

function valuesFromState(state) {
    if (!state || typeof state !== 'object') return {};
    if (state.values && typeof state.values === 'object' && !Array.isArray(state.values)) return state.values;
    return {};
}

function text(value) {
    return value == null ? '' : String(value).trim();
}

function numericIndex(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 ? n : null;
}

function normalizedResult(value) {
    const key = text(value).toLowerCase();
    if (['correct', 'right', 'passed', 'true'].includes(key)) return 'Correct';
    if (['wrong', 'incorrect', 'failed', 'false'].includes(key)) return 'Incorrect';
    if (!key) return 'Recorded';
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function quizForPackage(packageRow) {
    const analysis = packageAnalysis(packageRow);
    return analysis && Array.isArray(analysis.quiz) ? analysis.quiz : [];
}

function interactionBuckets(values) {
    const buckets = new Map();
    const ensure = (index) => {
        const key = Number(index);
        if (!buckets.has(key)) buckets.set(key, {});
        return buckets.get(key);
    };

    Object.entries(values || {}).forEach(([key, raw]) => {
        let match = key.match(/^quizmoto\.quiz\.(\d+)\.(question|selected|correct|selected_index|correct_index|result|explanation)$/i);
        if (match) {
            ensure(match[1])[match[2].toLowerCase()] = raw;
            return;
        }

        match = key.match(/^cmi\.interactions\.(\d+)\.(id|type|description|student_response|learner_response|result|latency|timestamp|time|weighting)$/i);
        if (match) {
            ensure(match[1])[`scorm_${match[2].toLowerCase()}`] = raw;
            return;
        }

        match = key.match(/^cmi\.interactions\.(\d+)\.correct_responses\.0\.pattern$/i);
        if (match) ensure(match[1]).scorm_correct_pattern = raw;
    });

    return buckets;
}

function answerFromIndex(options, value) {
    const index = numericIndex(value);
    if (index == null || !Array.isArray(options) || index >= options.length) return '';
    return text(options[index]);
}

function extractInteractions({ state, packageRow } = {}) {
    const values = valuesFromState(state);
    const quiz = quizForPackage(packageRow);
    const buckets = interactionBuckets(values);

    return Array.from(buckets.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([index, row]) => {
            const authored = quiz[index] && typeof quiz[index] === 'object' ? quiz[index] : {};
            const options = Array.isArray(authored.options) ? authored.options.map(text) : [];
            const selectedIndex = numericIndex(row.selected_index ?? row.scorm_student_response ?? row.scorm_learner_response);
            const correctIndex = numericIndex(row.correct_index ?? row.scorm_correct_pattern ?? authored.correctAnswer);
            const selectedAnswer = text(row.selected) || answerFromIndex(options, selectedIndex) || text(row.scorm_student_response ?? row.scorm_learner_response);
            const correctAnswer = text(row.correct) || answerFromIndex(options, correctIndex) || text(row.scorm_correct_pattern);
            const result = normalizedResult(row.result || row.scorm_result || (selectedIndex != null && correctIndex != null ? (selectedIndex === correctIndex ? 'correct' : 'incorrect') : ''));

            return {
                index,
                id: text(row.scorm_id) || `question_${index + 1}`,
                type: text(row.scorm_type) || 'choice',
                question: text(row.question) || text(authored.question) || text(row.scorm_description) || text(row.scorm_id) || `Question ${index + 1}`,
                selectedAnswer: selectedAnswer || '—',
                correctAnswer: correctAnswer || '—',
                selectedIndex,
                correctIndex,
                result,
                explanation: text(row.explanation) || text(authored.explanation),
                latency: text(row.scorm_latency),
                timestamp: text(row.scorm_timestamp || row.scorm_time),
                weighting: text(row.scorm_weighting),
                options
            };
        })
        .filter((item) => item.question || item.selectedAnswer !== '—' || item.correctAnswer !== '—');
}

function answerSummary(interactions) {
    const rows = Array.isArray(interactions) ? interactions : [];
    const graded = rows.filter((r) => ['Correct', 'Incorrect'].includes(r.result));
    const correct = graded.filter((r) => r.result === 'Correct').length;
    return {
        captured: rows.length,
        graded: graded.length,
        correct,
        incorrect: graded.length - correct,
        accuracy: graded.length ? Math.round((correct / graded.length) * 1000) / 10 : null
    };
}

module.exports = {
    valuesFromState,
    extractInteractions,
    answerSummary,
    normalizedResult
};
