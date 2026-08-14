const { expect } = require('chai');
const { THEMES, getTheme, listThemes, normalizeThemeId } = require('../services/scorm/ScormThemeCatalog');
const { planExperienceV5, splitCopy, metaphorFor } = require('../services/scorm/ScormExperiencePlanner');

describe('Course Experience V5', () => {
    it('provides eight stable selectable course themes', () => {
        expect(Object.keys(THEMES)).to.have.length(8);
        expect(listThemes()).to.have.length(8);
        expect(getTheme(1).name).to.equal('Midnight Blue');
        expect(getTheme(3).name).to.equal('Amber Signal');
        expect(getTheme(4).name).to.equal('Emerald Atlas');
        expect(getTheme(5).name).to.equal('Modern Rose');
        expect(normalizeThemeId(999)).to.equal(1);
    });

    it('gives every theme a complete integrated visual palette', () => {
        listThemes().forEach((theme) => {
            ['primary', 'primaryDark', 'accent', 'bg', 'bg2', 'surface', 'visualBg', 'visualBg2', 'visualCard', 'visualText'].forEach((key) => {
                expect(theme[key], `${theme.name}.${key}`).to.match(/^#[0-9a-f]{6}$/i);
            });
            expect(theme.motif).to.be.a('string').and.not.equal('');
        });
    });

    it('splits dense source copy into initial context and progressive detail', () => {
        const result = splitCopy('A suspicious email arrives from an unexpected sender. The message creates urgency and sends the learner to a sign-in page. The learner should verify the request through a trusted channel before entering credentials.');
        expect(result.introText).to.equal('A suspicious email arrives from an unexpected sender.');
        expect(result.revealText).to.include('The message creates urgency');
    });

    it('plans varied screen experiences without repeating the same screen type consecutively', () => {
        const result = planExperienceV5({
            title: 'Awareness',
            slides: [
                { title: 'Core ideas', content: 'Learn the main concepts.', layout: 'cards', keyPoints: ['One', 'Two', 'Three'] },
                { title: 'More concepts', content: 'Learn supporting concepts.', layout: 'cards', keyPoints: ['Four', 'Five', 'Six'] },
                { title: 'How the attack works', content: 'The attack moves through steps.', layout: 'process', keyPoints: ['Message', 'Click', 'Login'] },
                { title: 'A realistic example', content: 'Imagine you receive an urgent sign-in request from an unexpected sender.', layout: 'spotlight', keyPoints: ['Sender', 'Link', 'Urgency'] }
            ],
            quiz: []
        });
        expect(result.experienceVersion).to.equal(5);
        expect(result.experiencePlanner).to.equal('content-aware-v5');
        for (let i = 1; i < result.slides.length; i += 1) {
            expect(result.slides[i].screenType).to.not.equal(result.slides[i - 1].screenType);
        }
        expect(result.slides[2].screenType).to.equal('process');
        expect(result.slides[3].screenType).to.equal('scenario');
    });

    it('selects cybersecurity visual metaphors from the learning content', () => {
        expect(metaphorFor({ title: 'Check the sender of an email' })).to.equal('email');
        expect(metaphorFor({ title: 'Use strong authentication and MFA' })).to.equal('lock');
        expect(metaphorFor({ title: 'QR phishing warning' })).to.equal('qr');
        expect(metaphorFor({ title: 'Deepfake voice scam' })).to.equal('ai-wave');
    });
});
