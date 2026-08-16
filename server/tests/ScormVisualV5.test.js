const { expect } = require('chai');
const { generateVisualAssets } = require('../services/scorm/ScormVisualAssetService');

describe('SCORM Smart SVG visual engine', function () {
    this.timeout(15000);

    it('generates high-definition desktop and portrait-mobile Smart SVG assets', async () => {
        const assets = await generateVisualAssets({
            title: 'Phishing Awareness',
            visualTheme: {
                primary: '#4FC9BF',
                primaryDark: '#177E78'
            },
            slides: [{
                title: 'How phishing captures credentials',
                content: 'A phishing message creates urgency and sends the learner to a fake sign-in page.',
                keyPoints: ['Message arrives', 'Urgent link opened', 'Fake sign-in shown', 'Credentials submitted'],
                layout: 'process',
                screenType: 'process',
                visualTitle: 'Phishing flow',
                visualMetaphor: 'email'
            }],
            quiz: []
        });

        expect(assets).to.have.length(1);
        const asset = assets[0];
        expect(asset.visualEngine).to.equal('gemini-smart-svg');
        expect(asset.desktopZipPath).to.match(/smart-visual-001\.svg$/);
        expect(asset.mobileZipPath).to.match(/smart-visual-001-mobile\.svg$/);
        expect(asset.sceneSpec.scene).to.equal('email-threat');

        const desktop = asset.desktopBody.toString('utf8');
        const mobile = asset.mobileBody.toString('utf8');
        expect(desktop).to.include('viewBox="0 0 1600 1000"');
        expect(mobile).to.include('viewBox="0 0 900 1200"');
        expect(desktop).to.include('data-scorm-smart-svg="1"');
        expect(mobile).to.include('data-scorm-smart-svg="1"');
        expect(desktop).to.include('data-scene="email-threat"');
        expect(desktop).to.include('#4FC9BF');
        expect(desktop).to.include('filter="url(#softShadow)"');
        expect(desktop).to.not.match(/<script\b/i);
        expect(desktop).to.not.match(/<foreignObject\b/i);
        expect(desktop).to.not.match(/https?:\/\//i);
    });

    it('honours an explicit QR metaphor even when the learning text also says phishing', async () => {
        const assets = await generateVisualAssets({
            title: 'QR Phishing Awareness',
            slides: [{
                title: 'QR phishing warning',
                content: 'A phishing QR code can move the learner from a physical prompt to a malicious website.',
                keyPoints: ['Pause before scanning', 'Inspect the destination', 'Verify unexpected prompts'],
                layout: 'spotlight',
                screenType: 'takeaway',
                visualTitle: 'Check the QR',
                visualMetaphor: 'qr'
            }],
            quiz: []
        });

        expect(assets).to.have.length(1);
        expect(assets[0].sceneSpec.scene).to.equal('qr-phishing');
        const desktop = assets[0].desktopBody.toString('utf8');
        const mobile = assets[0].mobileBody.toString('utf8');
        expect(desktop).to.include('data-scene="qr-phishing"');
        expect(mobile).to.include('data-scene="qr-phishing"');
        expect(desktop).to.include('data-smart-svg-scene="qr-phishing"');
    });
});
