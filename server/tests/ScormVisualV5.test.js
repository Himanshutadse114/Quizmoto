const { expect } = require('chai');
const { generateVisualAssets } = require('../services/scorm/ScormVisualAssetService');
const { getTheme } = require('../services/scorm/ScormThemeCatalog');

describe('SCORM responsive vector engine V5', function () {
    this.timeout(15000);

    it('generates separate themed desktop and portrait-mobile SVG assets', async () => {
        const theme = getTheme(2);
        const assets = await generateVisualAssets({
            title: 'Phishing Awareness',
            visualTheme: theme,
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
        expect(asset.desktopZipPath).to.match(/visual-001-process\.svg$/);
        expect(asset.mobileZipPath).to.match(/visual-001-process-mobile\.svg$/);

        const desktop = asset.desktopBody.toString('utf8');
        const mobile = asset.mobileBody.toString('utf8');
        expect(desktop).to.include('viewBox="0 0 960 560"');
        expect(mobile).to.include('viewBox="0 0 390 620"');
        expect(desktop).to.include(theme.visualBg);
        expect(mobile).to.include(theme.visualBg);
        expect(desktop).to.include('LEARNING VISUAL');
        expect(mobile).to.include('STEP 1');
        expect(desktop).to.include('data-qm-icon-kind="mail"');
    });

    it('honours an explicit QR metaphor even when the learning text also says phishing', async () => {
        const theme = getTheme(6);
        const assets = await generateVisualAssets({
            title: 'QR Phishing Awareness',
            visualTheme: theme,
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
        const desktop = assets[0].desktopBody.toString('utf8');
        const mobile = assets[0].mobileBody.toString('utf8');
        expect(desktop).to.include('data-qm-icon-kind="qr"');
        expect(mobile).to.include('data-qm-icon-kind="qr"');
        expect(desktop).to.not.include('data-qm-icon-kind="mail"');
    });
});
