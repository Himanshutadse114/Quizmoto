const { expect } = require('chai');
const {
    parseAnalysis,
    jsonParseCandidates,
    openAiCandidate
} = require('../services/scorm/PolicyAnalysisService');

function validAnalysis(overrides = {}) {
    return {
        title: 'Phishing awareness',
        summary: 'Learn how to recognise and respond to suspicious requests.',
        slides: [],
        quiz: [],
        ...overrides
    };
}

describe('PolicyAnalysisService OpenAI JSON resilience', () => {
    it('parses normal structured JSON', () => {
        const parsed = parseAnalysis(JSON.stringify(validAnalysis()));
        expect(parsed.title).to.equal('Phishing awareness');
        expect(parsed.slides).to.deep.equal([]);
        expect(parsed.quiz).to.deep.equal([]);
    });

    it('recovers JSON wrapped in markdown code fences', () => {
        const text = `\`\`\`json\n${JSON.stringify(validAnalysis())}\n\`\`\``;
        const parsed = parseAnalysis(text);
        expect(parsed.summary).to.include('suspicious requests');
    });

    it('recovers a JSON object surrounded by explanatory text', () => {
        const text = `Here is the requested course JSON:\n${JSON.stringify(validAnalysis())}\nGenerated from the supplied policy.`;
        const parsed = parseAnalysis(text);
        expect(parsed.title).to.equal('Phishing awareness');
    });

    it('repairs harmless trailing commas without attempting destructive quote repair', () => {
        const text = `{
            "title": "Phishing awareness",
            "summary": "Recognise suspicious requests",
            "slides": [],
            "quiz": [],
        }`;
        const parsed = parseAnalysis(text);
        expect(parsed.quiz).to.deep.equal([]);
        expect(jsonParseCandidates(text).length).to.be.greaterThan(1);
    });

    it('rejects genuinely truncated JSON so the caller can try another model', () => {
        expect(() => parseAnalysis('{"title":"Course","summary":"Test","slides":['))
            .to.throw('OpenAI returned invalid JSON')
            .with.property('code', 'OPENAI_BAD_JSON');
    });

    it('rejects structurally incomplete JSON', () => {
        try {
            parseAnalysis(JSON.stringify({ title: 'Course', slides: [] }));
            throw new Error('Expected parseAnalysis to fail');
        } catch (err) {
            expect(err.code).to.equal('OPENAI_INCOMPLETE');
        }
    });

    it('normalizes the structured OpenAI result', () => {
        const candidate = openAiCandidate({ text: JSON.stringify(validAnalysis()), model: 'gpt-5.6-luna' });

        expect(candidate.finishReason).to.equal('completed');
        expect(candidate.candidateCount).to.equal(1);
        expect(candidate.text).to.equal(JSON.stringify(validAnalysis()));
        expect(parseAnalysis(candidate.text).title).to.equal('Phishing awareness');
    });
});
