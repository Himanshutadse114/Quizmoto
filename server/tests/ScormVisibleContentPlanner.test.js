const { expect } = require('chai');
const {
    planExperienceV5,
    splitCopy,
    canonicalLearningCopy,
    metaphorFor,
    pointLimitFor
} = require('../services/scorm/ScormExperiencePlanner');
const { renderCourseCoverSvg } = require('../services/scorm/ScormCourseCoverRenderer');

function words(value) {
    return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

describe('SCORM learner-visible content planning', () => {
    it('keeps the full teaching passage visible instead of splitting it into hidden reveal copy', () => {
        const paragraph = [
            'Social engineering manipulates people rather than attacking software directly.',
            'Attackers use urgency, authority and trust to influence decisions.',
            'A realistic request may appear to come from a colleague or support team.',
            'The learner should pause before sharing information or approving an unusual action.',
            'Verification through a known channel prevents the attacker from controlling the conversation.',
            'Reporting the attempt also helps protect other employees from the same campaign.'
        ].join(' ');
        const split = splitCopy(paragraph);
        expect(split.introText).to.equal(paragraph);
        expect(split.revealText).to.equal('');
    });

    it('repairs legacy generated slides that stored most learning copy in revealText', () => {
        const intro = 'Social engineering manipulates people into compromising security.';
        const reveal = Array.from({ length: 110 }, (_, index) => `detail${index + 1}`).join(' ');
        const analysis = {
            title: 'Social engineering',
            slides: [{
                title: 'Recognise manipulation',
                content: intro,
                introText: intro,
                revealText: reveal,
                layout: 'spotlight',
                keyPoints: ['Pause before acting', 'Verify the request', 'Protect information', 'Report suspicious activity']
            }],
            quiz: []
        };
        const planned = planExperienceV5(analysis);
        expect(words(planned.slides[0].content)).to.be.greaterThan(110);
        expect(planned.slides[0].content).to.include('detail110');
        expect(planned.slides[0].introText).to.equal(planned.slides[0].content);
        expect(planned.slides[0].revealText).to.equal('');
        expect(planned.experiencePlanner).to.equal('content-visible-v6');
    });

    it('preserves deliberate Content Editor changes when visible copy differs from canonical content', () => {
        const oldContent = 'This is the original generated paragraph with enough explanation for the learner.';
        const edited = 'This is the revised learner paragraph written by the course editor.';
        expect(canonicalLearningCopy({ content: oldContent, introText: edited, revealText: '' })).to.equal(edited);
    });

    it('caps every flip/reveal card family at four items', () => {
        expect(pointLimitFor({ layout: 'cards' }, 'concept')).to.equal(4);
        expect(pointLimitFor({ layout: 'hub' }, 'hotspot')).to.equal(4);
        expect(pointLimitFor({ layout: 'process' }, 'process')).to.equal(4);
        expect(pointLimitFor({ layout: 'comparison' }, 'comparison')).to.equal(6);

        const five = ['One point', 'Two point', 'Three point', 'Four point', 'Five point'];
        const planned = planExperienceV5({
            title: 'Course',
            slides: [
                { title: 'Cards', content: 'A complete teaching paragraph for cards.', layout: 'cards', keyPoints: five },
                { title: 'Hub', content: 'A complete teaching paragraph for hub.', layout: 'hub', keyPoints: five }
            ],
            quiz: []
        });
        expect(planned.slides[0].keyPoints).to.have.length(4);
        expect(planned.slides[1].keyPoints).to.have.length(4);
    });

    it('chooses attack-specific visual metaphors before secondary consequence terms', () => {
        expect(metaphorFor({ title: 'Identify phishing attempts', content: 'A phishing email may steal login credentials.' })).to.equal('email');
        expect(metaphorFor({ title: 'Recognise pretexting', content: 'A caller pretends to be IT and asks for a password.' })).to.equal('phone');
        expect(metaphorFor({ title: 'Avoid baiting', content: 'An unknown USB can install malware.' })).to.equal('file');
    });
});

describe('SCORM course cover v2', () => {
    it('renders a browser-safe, topic-specific social-engineering cover with teal action hierarchy', () => {
        const svg = renderCourseCoverSvg(
            { scene: 'social-engineering' },
            { title: 'Protecting Against Social Engineering Attacks' },
            { palette: { teal: '#282824', tealDark: '#171715' } }
        );
        expect(svg).to.include('width="1200" height="720"');
        expect(svg).to.include('data-cover-version="2"');
        expect(svg).to.include('data-cover-scene="social-engineering"');
        expect(svg).to.include('#4FC9BF');
        expect(svg).to.include('URGENT');
        expect(svg).to.include('VERIFY FIRST');
        expect(svg).to.include('PAUSE');
        expect(svg).to.include('REPORT');
        expect(svg).to.not.include('feDropShadow');
    });

    it('keeps a dedicated portrait composition for mobile', () => {
        const svg = renderCourseCoverSvg(
            { scene: 'social-engineering' },
            { title: 'Social Engineering' },
            { mobile: true }
        );
        expect(svg).to.include('width="900" height="1100"');
        expect(svg).to.include('data-panel-ratio="9/11"');
    });
});
