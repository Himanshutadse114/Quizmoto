const { expect } = require('chai');
const {
    parseQuizJson,
    normalizeQuiz,
    buildSourceParts
} = require('../services/QuizAiGenerationService');

function validQuiz() {
    return {
        title: 'Phishing Awareness',
        questions: Array.from({ length: 5 }, (_, index) => ({
            questionText: `Question ${index + 1}?`,
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correctIndex: index % 4,
            timer: 20,
            explanation: 'A short learning explanation.'
        }))
    };
}

describe('QuizAiGenerationService', () => {
    it('parses normal structured quiz JSON', () => {
        const parsed = parseQuizJson(JSON.stringify(validQuiz()));
        expect(parsed.title).to.equal('Phishing Awareness');
        expect(parsed.questions).to.have.length(5);
    });

    it('recovers fenced JSON and harmless trailing commas', () => {
        const quiz = validQuiz();
        const text = `\`\`\`json\n${JSON.stringify(quiz).replace(/}$/, ',}')}\n\`\`\``;
        const parsed = parseQuizJson(text);
        expect(parsed.questions).to.have.length(5);
    });

    it('extracts a quiz object surrounded by explanatory text', () => {
        const parsed = parseQuizJson(`Generated quiz:\n${JSON.stringify(validQuiz())}\nDone.`);
        expect(parsed.title).to.equal('Phishing Awareness');
    });

    it('normalizes timers while preserving four answer choices', () => {
        const quiz = validQuiz();
        quiz.questions[0].timer = 500;
        const normalized = normalizeQuiz(quiz);
        expect(normalized.questions[0].timer).to.equal(60);
        expect(normalized.questions[0].options).to.have.length(4);
    });

    it('rejects incomplete quiz output', () => {
        const quiz = validQuiz();
        quiz.questions = quiz.questions.slice(0, 2);
        expect(() => normalizeQuiz(quiz))
            .to.throw('Gemini returned an incomplete quiz')
            .with.property('code', 'QUIZ_AI_INCOMPLETE');
    });

    it('builds a source from topic and description without requiring a file', async () => {
        const parts = await buildSourceParts({
            topic: 'Password security',
            description: 'Teach employees how to use unique passphrases.'
        });
        expect(parts).to.have.length(1);
        expect(parts[0].text).to.include('TOPIC: Password security');
        expect(parts[0].text).to.include('unique passphrases');
    });

    it('extracts text documents into the source context', async () => {
        const content = 'Callback phishing combines an email with a fraudulent phone call.';
        const parts = await buildSourceParts({
            topic: '',
            description: '',
            fileBase64: Buffer.from(content, 'utf8').toString('base64'),
            mimeType: 'text/plain',
            fileName: 'awareness.txt'
        });
        expect(parts).to.have.length(1);
        expect(parts[0].text).to.include('UPLOADED DOCUMENT');
        expect(parts[0].text).to.include('fraudulent phone call');
    });

    it('rejects malformed JSON so model fallback can run', () => {
        expect(() => parseQuizJson('{"title":"Quiz","questions":['))
            .to.throw('Gemini returned invalid quiz JSON')
            .with.property('code', 'QUIZ_AI_BAD_JSON');
    });
});
