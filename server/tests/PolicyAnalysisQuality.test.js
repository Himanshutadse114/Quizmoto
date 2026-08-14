const { expect } = require('chai');
const {
    qualityIssues,
    analysisNeedsRefinement
} = require('../services/scorm/PolicyAnalysisService');

describe('PolicyAnalysisService content quality', () => {
    const goodQuiz = Array.from({ length: 5 }, (_, index) => ({
        question: `What is the safest action in scenario ${index + 1}?`,
        options: ['Verify and report', 'Ignore the warning', 'Share credentials', 'Forward externally'],
        correctAnswer: 0,
        explanation: 'Verify the request and report suspicious activity so it can be investigated safely.'
    }));

    it('accepts substantial screens with concise diagram labels', () => {
        const analysis = {
            slides: Array.from({ length: 8 }, (_, index) => ({
                title: `Recognise the warning signal ${index + 1}`,
                content: 'A suspicious request can look familiar while still containing warning signs. Check the sender, context and requested action before responding. If the request is unexpected or asks for sensitive information, verify it through an approved channel and report anything suspicious to the organisation. This pause helps separate a genuine business request from a social-engineering attempt before sensitive information is exposed.',
                layout: 'process',
                keyPoints: ['Check the sender', 'Review the request', 'Verify another way', 'Report suspicious activity']
            })),
            quiz: goodQuiz
        };

        expect(qualityIssues(analysis, 'detailed')).to.deep.equal([]);
        expect(analysisNeedsRefinement(analysis, 'detailed')).to.equal(false);
    });

    it('flags generic titles and oversized visual labels', () => {
        const analysis = {
            slides: Array.from({ length: 8 }, (_, index) => ({
                title: index < 3 ? 'Overview' : `Useful screen ${index + 1}`,
                content: 'This screen contains enough meaningful explanatory copy to satisfy the minimum content threshold while keeping the example deterministic for the quality test. It explains a practical learner decision, the context around it, and the safe action the learner should take when the situation appears. The additional context ensures the example represents a substantial learning screen rather than a thin placeholder.',
                layout: 'cycle',
                keyPoints: index < 3
                    ? ['This visual point contains far too many words to fit comfortably inside a small cycle node', 'Verify safely', 'Report concerns']
                    : ['Recognise the signal', 'Verify the request', 'Report concerns']
            })),
            quiz: goodQuiz
        };

        const issues = qualityIssues(analysis, 'detailed').join(' ');
        expect(issues).to.include('screen titles are generic');
        expect(issues).to.include('visual points are too long');
        expect(analysisNeedsRefinement(analysis, 'detailed')).to.equal(true);
    });

    it('flags malformed knowledge checks', () => {
        const analysis = {
            slides: Array.from({ length: 8 }, (_, index) => ({
                title: `Apply the safe action ${index + 1}`,
                content: 'A suspicious message should be assessed in context before the learner acts. Check who sent it, whether the request was expected and whether it asks for sensitive information or urgent action. Verify through an approved route and report anything that cannot be confirmed safely. This gives the security team enough context to investigate while helping the learner avoid an unnecessary or risky response.',
                layout: 'cards',
                keyPoints: ['Check the sender', 'Confirm the context', 'Verify independently', 'Report concerns']
            })),
            quiz: [{
                question: 'What should you do?',
                options: ['Report it', 'Ignore it'],
                correctAnswer: 4,
                explanation: 'Correct.'
            }]
        };

        const issues = qualityIssues(analysis, 'detailed').join(' ');
        expect(issues).to.include('5–8 questions');
        expect(issues).to.include('quiz questions need stronger structure');
    });
});
