const { expect } = require('chai');
const {
    inferScene,
    fallbackSpec,
    planSvgScenes,
    specSignature
} = require('../services/scorm/ScormSvgScenePlanner');
const {
    sanitizeSvg,
    renderSmartSvg
} = require('../services/scorm/ScormSmartSvgRenderer');
const {
    generateSmartSvgAssets,
    useLegacyEngine
} = require('../services/scorm/ScormVisualAssetService');

describe('SCORM Gemini Smart SVG visuals', function () {
    this.timeout(15000);
    const originalEngine = process.env.SCORM_VISUAL_ENGINE;
    const originalEnabled = process.env.SCORM_SMART_SVG_ENABLED;
    const originalGemini = process.env.SCORM_SMART_SVG_USE_GEMINI;

    beforeEach(() => {
        delete process.env.SCORM_VISUAL_ENGINE;
        process.env.SCORM_SMART_SVG_ENABLED = 'true';
        process.env.SCORM_SMART_SVG_USE_GEMINI = 'false';
    });

    after(() => {
        if (originalEngine === undefined) delete process.env.SCORM_VISUAL_ENGINE;
        else process.env.SCORM_VISUAL_ENGINE = originalEngine;
        if (originalEnabled === undefined) delete process.env.SCORM_SMART_SVG_ENABLED;
        else process.env.SCORM_SMART_SVG_ENABLED = originalEnabled;
        if (originalGemini === undefined) delete process.env.SCORM_SMART_SVG_USE_GEMINI;
        else process.env.SCORM_SMART_SVG_USE_GEMINI = originalGemini;
    });

    it('maps learning meaning into dedicated scene systems instead of generic icons', () => {
        expect(inferScene({ title: 'Fake HTTPS login page', content: 'Check the browser URL before signing in.' })).to.equal('browser-phishing');
        expect(inferScene({ title: 'Malicious apps', content: 'Review app-store permissions before installing.' })).to.equal('malicious-app');
        expect(inferScene({ title: 'Voice cloning', content: 'Deepfake audio can impersonate an executive.' })).to.equal('deepfake');
        expect(inferScene({ title: 'Ransomware', content: 'Malware encrypts files.', visualMetaphor: 'file' })).to.equal('ransomware-file');
    });

    it('creates a complete deterministic art-direction fallback when Gemini is unavailable', async () => {
        const analysis = {
            title: 'Security course',
            slides: [
                { title: 'QR attack', content: 'Scan carefully', visualMetaphor: 'qr', screenType: 'takeaway' },
                { title: 'Password safety', content: 'MFA reduces credential risk', visualMetaphor: 'lock' }
            ]
        };
        const plans = await planSvgScenes(analysis);
        expect(plans).to.have.length(2);
        expect(plans[0].scene).to.equal('qr-phishing');
        expect(plans[0].composition).to.equal('full-bleed');
        expect(plans[0].secondaryObjects.length).to.be.greaterThan(1);
        expect(plans[1].scene).to.equal('password-mfa');
        expect(fallbackSpec(analysis.slides[1], 1).focalObject).to.equal('lock');
    });

    it('forces different scenes across a course so slides do not look like the same vector repeated', async () => {
        const analysis = {
            title: 'Phishing awareness',
            slides: [
                { title: 'A phishing email asks you to reset your password', content: 'Check the sender before you click.' },
                { title: 'Another phishing email pretends to be IT support', content: 'Verify the sender through another channel.' },
                { title: 'A third phishing email demands urgent action', content: 'Do not click the link in the message.' },
                { title: 'A fourth suspicious email requests your login', content: 'Report anything unexpected to security.' }
            ]
        };
        const plans = await planSvgScenes(analysis);
        expect(plans).to.have.length(4);
        // Must not collapse to a single scene (old bug: 4–5× email-threat with only mirror/scale changes).
        expect(new Set(plans.map((p) => p.scene)).size).to.be.at.least(2);
        // Consecutive slides must never share the same scene.
        for (let i = 1; i < plans.length; i += 1) {
            expect(plans[i].scene).to.not.equal(plans[i - 1].scene);
        }
        const signatures = plans.map(specSignature);
        expect(new Set(signatures).size).to.equal(signatures.length);
    });

    it('maps platform/provider/comparison slides away from email-threat', () => {
        expect(inferScene({
            title: 'Key Certified Phishing Simulation Providers',
            content: 'AP2T Labs, Arctic Wolf and Proofpoint SAT are certified platforms.',
            layout: 'cards',
            keyPoints: ['AP2T Labs & Arctic Wolf', 'Proofpoint SAT Program']
        })).to.not.equal('email-threat');
        expect(inferScene({
            title: 'Palo Alto Networks: Awareness vs. Simulation',
            content: 'Awareness training is certified; live phishing tests are not included.',
            layout: 'comparison'
        })).to.equal('process-diagram');
        expect(inferScene({
            title: 'Sophos Phish Threat: Cloud-Based Efficiency',
            content: 'Cloud delivery with volume-based pricing and automated follow-ups.',
            layout: 'cards',
            visualMetaphor: 'cloud'
        })).to.equal('cloud-data');
        expect(inferScene({
            title: 'Scalability and Reporting for Large Organizations',
            content: 'Supporting 1,000+ users with campaign analytics and risk metrics.',
            layout: 'hub'
        })).to.equal('statistics');
    });

    it('renders rich resolution-independent SVG scenes without external dependencies', () => {
        const spec = fallbackSpec({
            title: 'Suspicious sign-in',
            content: 'A fake website imitates a login page.',
            visualMetaphor: 'browser'
        }, 0);
        const svg = renderSmartSvg(spec, { title: 'Suspicious sign-in' });
        expect(svg).to.include('viewBox="0 0 1200 1000"');
        expect(svg).to.include('data-scorm-smart-svg="1"');
        expect(svg).to.include('data-smart-svg-scene="browser-phishing"');
        expect((svg.match(/<rect\b/g) || []).length).to.be.greaterThan(12);
        expect((svg.match(/<path\b/g) || []).length).to.be.greaterThan(5);
        expect(svg).to.include('linearGradient');
        expect(svg).to.include('softShadow');
    });

    it('sanitises scriptable or externally loaded SVG content', () => {
        const dirty = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><foreignObject><div>bad</div></foreignObject><a href="https://evil.example/x"><rect onclick="javascript:alert(1)" width="2" height="2"/></a><image href="data:text/html,bad"/></svg>`;
        const safe = sanitizeSvg(dirty);
        expect(safe).to.not.match(/<script\b/i);
        expect(safe).to.not.match(/foreignObject/i);
        expect(safe).to.not.match(/onclick=/i);
        expect(safe).to.not.match(/javascript:/i);
        expect(safe).to.not.match(/href="https?:/i);
        expect(safe).to.not.match(/data:text\/html/i);
    });

    it('packages desktop and mobile Smart SVGs using the existing visual-asset contract', async () => {
        const assets = await generateSmartSvgAssets({
            title: 'Mobile Security',
            slides: [{
                title: 'Unexpected SMS',
                content: 'A text message creates urgency and sends the user to a suspicious link.',
                visualMetaphor: 'phone',
                layout: 'spotlight',
                screenType: 'scenario'
            }]
        });
        expect(assets).to.have.length(1);
        expect(assets[0].desktopZipPath).to.equal('assets/visuals/smart-visual-001.svg');
        expect(assets[0].mobileZipPath).to.equal('assets/visuals/smart-visual-001-mobile.svg');
        expect(Buffer.isBuffer(assets[0].desktopBody)).to.equal(true);
        expect(Buffer.isBuffer(assets[0].mobileBody)).to.equal(true);
        expect(assets[0].desktopBody.toString()).to.include('data-scene="smartphone-scam"');
        expect(assets[0].mobileBody.toString()).to.include('viewBox="0 0 900 1100"');
    });

    it('keeps the old Python renderer behind an explicit opt-in only', () => {
        expect(useLegacyEngine()).to.equal(false);
        process.env.SCORM_VISUAL_ENGINE = 'legacy-python';
        expect(useLegacyEngine()).to.equal(true);
    });
});
