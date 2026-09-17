const { expect } = require('chai');
const {
    DETAIL_CONFIG,
    normalizeDetailLevel,
    qualityIssues,
    averageSentenceWords,
    instructionalSignals,
    professionalInstruction,
    semanticDuplicationIssues,
    uniquenessRefinementInstruction
} = require('../services/scorm/PolicyAnalysisService');

describe('SCORM professional course authoring quality', () => {
    it('uses genuinely different concise, detailed and comprehensive depth profiles', () => {
        expect(normalizeDetailLevel('concise')).to.equal('concise');
        expect(normalizeDetailLevel('detailed')).to.equal('detailed');
        expect(normalizeDetailLevel('comprehensive')).to.equal('comprehensive');
        expect(DETAIL_CONFIG.detailed.slides).to.equal('10-14');
        expect(DETAIL_CONFIG.detailed.minWords).to.equal(120);
        expect(DETAIL_CONFIG.comprehensive.minWords).to.be.greaterThan(DETAIL_CONFIG.detailed.minWords);
        expect(DETAIL_CONFIG.concise.minWords).to.be.lessThan(DETAIL_CONFIG.detailed.minWords);
    });

    it('measures sentence readability independently of total word count', () => {
        const readable = 'Pause before acting. Verify the request through a trusted channel. Report anything suspicious to the security team.';
        const dense = 'Before acting on any suspicious request that appears to come from a manager, supplier, colleague, customer, or support team, employees should carefully verify every detail through a trusted channel.';
        expect(averageSentenceWords(readable)).to.be.lessThan(averageSentenceWords(dense));
    });

    it('recognises practical application, rationale and learner action signals', () => {
        const signals = instructionalSignals('For example, when you receive an urgent payment request, verify it through a trusted channel because impersonation can lead to financial loss.');
        expect(signals.application).to.equal(true);
        expect(signals.action).to.equal(true);
        expect(signals.rationale).to.equal(true);
    });

    it('rejects thin AI-summary style detailed content even when the JSON shape is valid', () => {
        const weak = {
            title: 'Social Engineering Awareness',
            summary: 'Learn about social engineering and how to stay safe at work.',
            slides: [{
                title: 'Understanding Social Engineering',
                content: 'Social engineering is a type of cyber threat. Attackers may try to trick people. Employees should stay vigilant.',
                keyPoints: ['Human manipulation', 'Urgent requests', 'Sensitive information', 'Security awareness'],
                layout: 'cards'
            }],
            quiz: []
        };
        const issues = qualityIssues(weak, 'detailed').join(' ');
        expect(issues).to.include('under-developed');
        expect(issues).to.include('workplace example');
        expect(issues).to.include('only 1 learning screens');
    });

    it('prompts OpenAI as an instructional designer rather than a summariser', () => {
        const prompt = professionalInstruction('detailed', DETAIL_CONFIG.detailed);
        expect(prompt).to.include('experienced human learning designer');
        expect(prompt).to.include('10-14');
        expect(prompt).to.include('135-175');
        expect(prompt).to.include('12-18 words per sentence');
        expect(prompt).to.include('realistic workplace');
        expect(prompt).to.include('learner could act differently');
        expect(prompt).to.include('exclusive screen ledger');
        expect(prompt).to.include('learningPurpose');
        expect(prompt).to.include('visualDirection');
        expect(prompt).to.include('semantic repetition');
    });

    it('detects paraphrased learning points across different screens', () => {
        const analysis = {
            slides: [
                {
                    title: 'Verify unusual payment requests',
                    learningPurpose: 'Confirm unusual payment requests through an independent trusted channel.',
                    content: 'A changed payment request needs independent confirmation before any records are updated.',
                    keyPoints: ['Confirm payment changes independently']
                },
                {
                    title: 'Check a changed supplier account',
                    learningPurpose: 'Check changed supplier payment requests using a separate official contact route.',
                    content: 'Use known supplier details to validate a changed account before making a payment.',
                    keyPoints: ['Verify payment changes through a trusted route']
                }
            ]
        };
        const issues = semanticDuplicationIssues(analysis).join(' ');
        expect(issues).to.include('primary lesson');
        expect(issues).to.include('supporting points');
    });

    it('gives the corrective pass an explicit premium no-repetition contract', () => {
        const prompt = uniquenessRefinementInstruction(
            { title: 'Course', slides: [], quiz: [] },
            ['Two screens repeat the same lesson.'],
            'detailed',
            DETAIL_CONFIG.detailed
        );
        expect(prompt).to.include('exclusive coverage ledger');
        expect(prompt).to.include('semantic repetition');
        expect(prompt).to.include('Do not repeat generic desk');
    });
});
