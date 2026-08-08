const { expect } = require('chai');
const {
    enrichAnalysis,
    inferLayout
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
        expect(result.experienceVersion).to.equal(3);
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
});
