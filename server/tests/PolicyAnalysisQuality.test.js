const { expect } = require('chai');
const {
    qualityIssues,
    analysisNeedsRefinement
} = require('../services/scorm/PolicyAnalysisService');

describe('PolicyAnalysisService content quality', () => {
    const substantialSummary = 'This course teaches learners how to recognise suspicious requests, evaluate their context, verify identity through trusted channels and report concerns before information is exposed. It connects common social-engineering warning signs with practical workplace decisions. Learners understand what looks suspicious, why verification matters and what action to take next. They practise slowing down, checking a request independently and preserving useful evidence. By the end, they can respond safely without relying on urgency, familiarity or visual appearance alone.';

    const richContent = (index) => `Focus ${index + 1} begins with an unexpected business request that appears familiar but does not deserve automatic trust. The learner checks who sent it and whether its timing and context make sense. They identify exactly what action the sender wants them to take. Next, they compare the address, destination, attachment or link with an approved source. This check matters because visual familiarity can hide a changed domain or unsafe destination. For example, an urgent payment request should be confirmed through a separate trusted channel. Independent verification interrupts social-engineering pressure before sensitive information or money is exposed. The learner preserves useful evidence and avoids interacting with suspicious content. They report the event through the approved security process so the wider risk can be investigated.`;

    const goodQuiz = Array.from({ length: 6 }, (_, index) => ({
        question: `What is the safest action when scenario ${index + 1} creates an unexpected request?`,
        options: ['Verify and report', 'Ignore the warning', 'Share credentials', 'Forward externally'],
        correctAnswer: 0,
        explanation: 'The safest response is to verify the request through an approved independent channel and report suspicious activity. This breaks the attacker’s pressure cycle while giving the security team enough context to investigate.'
    }));

    it('accepts substantial screens with concise diagram labels', () => {
        const pointSets = [
            ['Check the sender', 'Review the request', 'Verify another way', 'Report suspicious activity'],
            ['Look for urgency cues', 'Confirm the domain', 'Avoid unexpected links', 'Ask before you click'],
            ['Compare the tone to normal', 'Hover before you trust a link', 'Call the real number', 'Flag it to security'],
            ['Check for spelling errors', 'Question surprise attachments', 'Use the approved channel', 'Note the sender address'],
            ['Slow down under pressure', 'Cross-check the request', 'Keep records secure', 'Loop in your manager'],
            ['Trust your instinct', 'Separate urgency from legitimacy', 'Confirm identity independently', 'Escalate anything unclear'],
            ['Inspect the display name', 'Match it to past contact', 'Avoid replying directly', 'Forward to the security inbox'],
            ['Recognise repeat patterns', 'Document what you saw', 'Warn nearby colleagues', 'Close the loop with a report'],
            ['Pause before acting', 'Use known contact details', 'Preserve useful evidence', 'Report through policy']
        ];
        const analysis = {
            summary: substantialSummary,
            slides: Array.from({ length: 9 }, (_, index) => ({
                title: `Recognise the warning signal ${index + 1}`,
                content: richContent(index),
                layout: 'process',
                keyPoints: pointSets[index],
                interactionPoints: pointSets[index].map((label) => ({
                    label,
                    detail: `${label} matters because it helps the learner assess the request, verify it independently and choose a safer response.`
                }))
            })),
            quiz: goodQuiz
        };

        expect(qualityIssues(analysis, 'detailed')).to.deep.equal([]);
        expect(analysisNeedsRefinement(analysis, 'detailed')).to.equal(false);
    });

    it('requires every detailed screen to meet the richer depth floor', () => {
        const analysis = {
            summary: substantialSummary,
            slides: Array.from({ length: 6 }, (_, index) => ({
                title: `Apply the verification step ${index + 1}`,
                content: index === 3
                    ? 'A suspicious request may look genuine. Check the sender, context and requested action before responding. Verify unexpected requests through a trusted channel and report anything that cannot be confirmed safely. This prevents urgency or familiarity from becoming the only reason a learner trusts a message.'
                    : richContent(index),
                layout: 'cards',
                keyPoints: ['Check the sender', 'Confirm the context', 'Verify independently', `Report concern ${index + 1}`]
            })),
            quiz: goodQuiz
        };

        const issues = qualityIssues(analysis, 'detailed').join(' ');
        expect(issues).to.include('1 screens are under-developed');
        expect(analysisNeedsRefinement(analysis, 'detailed')).to.equal(true);
    });

    it('flags generic titles and oversized visual labels', () => {
        const analysis = {
            summary: substantialSummary,
            slides: Array.from({ length: 8 }, (_, index) => ({
                title: index < 3 ? 'Overview' : `Useful screen ${index + 1}`,
                content: richContent(index),
                layout: 'cycle',
                keyPoints: index < 3
                    ? ['This visual point contains far too many words to fit comfortably inside a small cycle node', 'Verify through another channel', 'Report concerns promptly', `Review context ${index + 1}`]
                    : ['Recognise the signal', 'Verify the request', 'Report concerns safely', `Review context ${index + 1}`]
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
            summary: substantialSummary,
            slides: Array.from({ length: 8 }, (_, index) => ({
                title: `Apply the safe action ${index + 1}`,
                content: richContent(index),
                layout: 'cards',
                keyPoints: ['Check the sender', 'Confirm the context', 'Verify independently', `Report concern ${index + 1}`]
            })),
            quiz: [{
                question: 'What should you do?',
                options: ['Report it', 'Ignore it'],
                correctAnswer: 4,
                explanation: 'Correct.'
            }]
        };

        const issues = qualityIssues(analysis, 'detailed').join(' ');
        expect(issues).to.include('6-8 questions');
        expect(issues).to.include('quiz questions need stronger scenario wording');
    });
});
