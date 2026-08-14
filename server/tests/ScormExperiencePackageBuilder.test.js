const { expect } = require('chai');
const {
    enrichAnalysis,
    inferLayout,
    inferScreenType,
    inferBackground,
    inferMetaphor,
    dedupePoints
} = require('../services/scorm/ScormExperiencePackageBuilder');

describe('ScormExperiencePackageBuilder V5', () => {
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

    it('maps semantic layouts to professional screen types', () => {
        expect(inferScreenType({}, 'process', 0)).to.equal('process');
        expect(inferScreenType({}, 'timeline', 0)).to.equal('timeline');
        expect(inferScreenType({}, 'comparison', 0)).to.equal('comparison');
        expect(inferScreenType({}, 'hub', 0)).to.equal('hotspot');
        expect(inferScreenType({ screenType: 'scenario' }, 'cards', 0)).to.equal('scenario');
    });

    it('adds V5 visual, interaction and progressive-disclosure metadata without dropping source content', () => {
        const input = {
            title: 'Security Awareness',
            slides: [
                {
                    title: 'Phishing Process',
                    content: 'A phishing attack moves through several steps. The learner should verify the sender and destination before entering credentials.',
                    keyPoints: ['Email arrives', 'Link clicked', 'Credentials entered']
                }
            ],
            quiz: []
        };
        const result = enrichAnalysis(input);
        expect(result.experienceVersion).to.equal(5);
        expect(result.slides).to.have.length(1);
        expect(result.slides[0].title).to.equal('Phishing Process');
        expect(result.slides[0].layout).to.equal('process');
        expect(result.slides[0].screenType).to.equal('process');
        expect(result.slides[0].visualTitle).to.equal('Phishing Process');
        expect(result.slides[0].interaction.type).to.equal('step_explore');
        expect(result.slides[0].introText).to.equal('A phishing attack moves through several steps.');
        expect(result.slides[0].revealText).to.equal('The learner should verify the sender and destination before entering credentials.');
        expect(result.slides[0].keyPoints).to.deep.equal(input.slides[0].keyPoints);
    });

    it('keeps explicit V5 experience instructions from the authoring blueprint', () => {
        const result = enrichAnalysis({
            slides: [{
                title: 'Critical Action',
                content: 'Report suspicious activity.',
                layout: 'spotlight',
                screenType: 'takeaway',
                backgroundStyle: 'glow',
                visualMetaphor: 'warning',
                interaction: { type: 'focus_reveal', prompt: 'Select the takeaway.' }
            }]
        });
        expect(result.slides[0].screenType).to.equal('takeaway');
        expect(result.slides[0].backgroundStyle).to.equal('glow');
        expect(result.slides[0].visualMetaphor).to.equal('warning');
        expect(result.slides[0].interaction).to.deep.equal({
            type: 'focus_reveal',
            prompt: 'Select the takeaway.'
        });
    });

    it('selects backgrounds and metaphors from learning meaning', () => {
        expect(inferBackground({}, 'scenario', 1)).to.equal('focus');
        expect(inferBackground({}, 'hotspot', 1)).to.equal('orbit');
        expect(inferMetaphor({ title: 'Suspicious email in your inbox' })).to.equal('email');
        expect(inferMetaphor({ title: 'Protect your password and login' })).to.equal('lock');
        expect(inferMetaphor({ title: 'Deepfake voice warning' })).to.equal('ai-wave');
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
