const { expect } = require('chai');
const JSZip = require('jszip');
const {
    slideInstruction,
    coverInstruction
} = require('../services/scorm/GeminiSlideVisualPromptService');
const {
    clearLegacyVisuals,
    assignRasterVisual
} = require('../services/scorm/ReplicateCourseMediaService');
const {
    canonicalizeRasterAnalysis,
    enrichAnalysis,
    isRasterCourse,
    experienceScript,
    experienceCss
} = require('../services/scorm/ScormExperiencePackageBuilder');
const { buildScormPackageZip } = require('../services/scorm/ScormReplicateMediaFinalizer');

describe('SCORM course generation pipeline V6', () => {
    it('asks Gemini for a prompt grounded only in the actual emotions slide', () => {
        const instruction = slideInstruction({
            title: 'Applying Emotional Understanding at Work',
            content: 'Emotional understanding improves teamwork, leadership and client interactions. Recognising frustration helps you adjust your communication and respond with empathy.',
            keyPoints: ['Improve teamwork', 'Enhance client interactions', 'Respond with empathy'],
            visualTitle: 'Workplace emotional understanding'
        }, { title: 'Understanding and Navigating Types of Emotions' }, 4);

        expect(instruction).to.include('Slide topic: Applying Emotional Understanding at Work');
        expect(instruction).to.include('Emotional understanding improves teamwork');
        expect(instruction).to.include('Respond with empathy');
        expect(instruction).to.include('Do not introduce cybersecurity objects');
        expect(instruction).to.include('unless the supplied lesson itself is genuinely about those concepts');
        expect(instruction).to.include('NON-HUMAN VISUAL ONLY');
        expect(instruction).to.include('ABSOLUTELY NO TEXT IN THE IMAGE');
    });

    it('does not hard-code cyber imagery into a non-cyber course cover', () => {
        const instruction = coverInstruction({
            title: 'Understanding and Navigating Types of Emotions',
            summary: 'A practical course about recognising emotions and responding constructively.'
        });
        expect(instruction).to.include('Understanding and Navigating Types of Emotions');
        expect(instruction).to.include('Do not introduce cybersecurity objects');
        expect(instruction).to.not.include('suspicious email ->');
        expect(instruction).to.not.include('credential safety ->');
    });

    it('clears all old generated visual paths before FLUX media is attached', () => {
        const clean = clearLegacyVisuals({
            title: 'Lesson',
            visualAsset: 'assets/visuals/slide-001.svg',
            mobileVisualAsset: 'assets/visuals/slide-001-mobile.svg',
            rasterVisualAsset: 'old.webp'
        });
        expect(clean.visualAsset).to.equal(undefined);
        expect(clean.mobileVisualAsset).to.equal(undefined);
        expect(clean.rasterVisualAsset).to.equal(undefined);
    });

    it('makes the generated WebP the canonical renderer asset', () => {
        const slide = assignRasterVisual({ title: 'Emotions' }, 'assets/media/slide-001.webp', {
            prompt: '16:9 abstract emotional balance visual, no people, no text',
            model: 'gemini-2.5-flash'
        });
        expect(slide.rasterVisualAsset).to.equal('assets/media/slide-001.webp');
        expect(slide.visualAsset).to.equal('assets/media/slide-001.webp');
        expect(slide.mobileVisualAsset).to.equal('assets/media/slide-001.webp');
        expect(slide.visualSource).to.equal('ai_raster');
        expect(slide.imagePromptProvider).to.equal('gemini');
    });

    it('strips SVG fallback paths from raster-authored courses', () => {
        const analysis = canonicalizeRasterAnalysis({
            visualMode: 'raster',
            coverImageAsset: 'assets/media/course-cover.webp',
            slides: [
                { title: 'Has image', rasterVisualAsset: 'assets/media/slide-001.webp', visualAsset: 'assets/visuals/slide-001.svg' },
                { title: 'No image', visualAsset: 'assets/visuals/slide-002.svg', mobileVisualAsset: 'assets/visuals/slide-002-mobile.svg' }
            ]
        });

        expect(isRasterCourse(analysis)).to.equal(true);
        expect(analysis.coverVisualAsset).to.equal('assets/media/course-cover.webp');
        expect(analysis.slides[0].visualAsset).to.equal('assets/media/slide-001.webp');
        expect(analysis.slides[1].visualAsset).to.equal(undefined);
        expect(JSON.stringify(analysis)).to.not.include('assets/visuals/slide-002.svg');
    });

    it('keeps raster paths after course enrichment instead of replacing them with SVGs', () => {
        const analysis = enrichAnalysis({
            visualMode: 'raster',
            coverVisualAsset: 'assets/media/course-cover.webp',
            slides: [{
                title: 'Types of Emotions',
                content: 'Emotions can be grouped and understood through patterns of intensity, context and response.',
                keyPoints: ['Intensity', 'Context', 'Response'],
                rasterVisualAsset: 'assets/media/slide-001.webp',
                visualAsset: 'assets/media/slide-001.webp'
            }],
            quiz: []
        });
        expect(analysis.visualMode).to.equal('raster');
        expect(analysis.experienceVersion).to.equal(6);
        expect(analysis.slides[0].visualAsset).to.equal('assets/media/slide-001.webp');
        expect(analysis.slides[0].visualAsset).to.not.match(/\.svg$/i);
    });

    it('renders canonical visuals in responsive 16:9 learner frames', () => {
        const css = experienceCss();
        const script = experienceScript();
        expect(css).to.include('aspect-ratio:16/9!important');
        expect(script).to.include('s.visualAsset');
        expect(script).to.include('qmx-raster-native-panel');
        expect(script).to.include('qmx-native-cover-raster');
    });

    it('builds a full SCORM ZIP with WebPs and no generated SVG asset package in raster mode', async () => {
        const analysis = {
            title: 'Understanding Types of Emotions',
            summary: 'Recognise emotional patterns and respond constructively in everyday situations.',
            visualMode: 'raster',
            coverImageAsset: 'assets/media/course-cover.webp',
            coverVisualAsset: 'assets/media/course-cover.webp',
            slides: [
                {
                    title: 'Recognising Emotional Patterns',
                    content: 'Emotional patterns vary by intensity, context and personal interpretation. For example, frustration can be recognised through repeated reactions and can be managed by pausing before responding. Notice the context, identify the emotion and choose a constructive response because awareness improves communication.',
                    keyPoints: ['Notice context', 'Identify emotion', 'Choose a constructive response'],
                    layout: 'spotlight',
                    rasterVisualAsset: 'assets/media/slide-001.webp',
                    visualAsset: 'assets/media/slide-001.webp',
                    mobileVisualAsset: 'assets/media/slide-001.webp',
                    visualSource: 'ai_raster'
                },
                {
                    title: 'Responding Constructively',
                    content: 'A constructive response begins with recognising what you feel and why. For example, if a situation creates frustration, pause and choose language that keeps the conversation productive. This reduces avoidable conflict and supports better decisions.',
                    keyPoints: ['Pause', 'Reflect', 'Respond constructively'],
                    layout: 'cards'
                }
            ],
            quiz: []
        };

        const files = [
            { path: 'assets/media/course-cover.webp', body: Buffer.alloc(1024, 1), contentType: 'image/webp' },
            { path: 'assets/media/slide-001.webp', body: Buffer.alloc(1024, 2), contentType: 'image/webp' }
        ];

        const buffer = await buildScormPackageZip(analysis, { replicateMediaFiles: files });
        const zip = await JSZip.loadAsync(buffer);
        const names = Object.keys(zip.files);
        const generatedSvgs = names.filter((name) => /^assets\/visuals\/.*\.svg$/i.test(name));
        expect(generatedSvgs).to.deep.equal([]);
        expect(zip.file('assets/media/course-cover.webp')).to.not.equal(null);
        expect(zip.file('assets/media/slide-001.webp')).to.not.equal(null);

        const content = JSON.parse(await zip.file('content.json').async('string'));
        expect(content.visualEngine).to.equal('gemini-prompted-flux-raster');
        expect(content.canonicalRasterVisuals).to.equal(true);
        expect(content.slides[0].visualAsset).to.equal('assets/media/slide-001.webp');
        expect(content.slides[1].visualAsset).to.equal(undefined);
        expect(JSON.stringify(content)).to.not.match(/assets\/visuals\/.*\.svg/i);

        const html = await zip.file('index.html').async('string');
        expect(html).to.include('assets/media/slide-001.webp');
        expect(html).to.include('quizmoto-course-visual-v6');
    });
});
