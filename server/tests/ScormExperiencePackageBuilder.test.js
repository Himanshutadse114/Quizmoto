const { expect } = require('chai');
const {
    enrichAnalysis,
    inferLayout,
    dedupePoints
} = require('../services/scorm/ScormExperiencePackageBuilder');

describe('ScormExperiencePackageBuilder', () => {
    it('preserves explicit supported layouts', () => {
        expect(inferLayout({ layout: 'matrix', title: 'Risk' }, 0)).to.equal('matrix');
        expect(inferLayout({ layout: 'cycle', title: 'Lifecycle' }, 0)).to.equal('cycle');
    });

    it('infers semantic layouts from learning content', () => {
        expect(inferLayout({ title: 'How the attack works', content: 'Step one then step two' }, 0)).to.equal('process');
        expect(inferLayout({ title: 'Likelihood and impact matrix' }, 0)).to.equal('matrix');
        expect(inferLayout({ title: 'Continuous security cycle' }, 0)).to.equal('cycle');
        expect(inferLayout({ title: 'Safe vs unsafe behaviour' }, 0)).to.equal('comparison');
    });

    it('adds visual and interaction metadata without dropping source content', () => {
        const input = {
            title: 'Security Awareness',
            slides: [
                {
                    title: 'Phishing Process',
                    content: 'A phishing attack moves through several steps.',
                    keyPoints: ['Email arrives', 'Link clicked', 'Credentials entered']
                }
            ],
            quiz: []
        };
        const result = enrichAnalysis(input);
        expect(result.experienceVersion).to.equal(4);
        expect(result.slides).to.have.length(1);
        expect(result.slides[0].title).to.equal('Phishing Process');
        expect(result.slides[0].layout).to.equal('process');
        expect(result.slides[0].visualTitle).to.equal('Phishing Process');
        expect(result.slides[0].interaction.type).to.equal('step_explore');
        expect(result.slides[0].keyPoints).to.deep.equal(input.slides[0].keyPoints);
    });

    it('keeps explicit interaction instructions from the AI blueprint', () => {
        const result = enrichAnalysis({
            slides: [{
                title: 'Critical Action',
                content: 'Report suspicious activity.',
                layout: 'spotlight',
                interaction: { type: 'focus_reveal', prompt: 'Select the takeaway.' }
            }]
        });
        expect(result.slides[0].interaction).to.deep.equal({
            type: 'focus_reveal',
            prompt: 'Select the takeaway.'
        });
    });

    it('cleans duplicate visual points before vector generation', () => {
        expect(dedupePoints([
            'Verify the sender',
            '  Verify   the sender  ',
            'Report suspicious email',
            '',
            null
        ])).to.deep.equal([
            'Verify the sender',
            'Report suspicious email'
        ]);
    });

    it('normalizes quiz copy without changing scoring metadata', () => {
        const result = enrichAnalysis({
            slides: [],
            quiz: [{
                question: '  What should you do?  ',
                options: [' Report it ', 'Ignore it', 'Reply', 'Forward it'],
                correctAnswer: 0,
                explanation: '  Reporting allows the organisation to investigate.  '
            }]
        });
        expect(result.quiz[0].question).to.equal('What should you do?');
        expect(result.quiz[0].options[0]).to.equal('Report it');
        expect(result.quiz[0].correctAnswer).to.equal(0);
        expect(result.quiz[0].explanation).to.equal('Reporting allows the organisation to investigate.');
    });
});
