const { expect } = require('chai');
const JSZip = require('jszip');
const { buildRasterCoursePackageZip, buildIndexHtml } = require('../services/scorm/ScormRasterCoursePackageBuilder');

function analysisFixture() {
    return {
        title: 'Understanding Emotions',
        summary: 'A practical course about emotional awareness, communication and thoughtful responses.',
        visualMode: 'raster',
        coverImageAsset: 'assets/media/course-cover.webp',
        coverVisualAsset: 'assets/media/course-cover.webp',
        slides: [
            {
                title: 'Why Emotional Understanding Matters',
                content: 'Emotional understanding supports self-awareness, empathy and better decisions.',
                keyPoints: ['Self-awareness', 'Empathy', 'Thoughtful decisions'],
                layout: 'cards',
                visualAsset: 'assets/media/slide-001.webp',
                rasterVisualAsset: 'assets/media/slide-001.webp'
            },
            {
                title: 'Recognising Emotional Cues',
                content: 'Context and behaviour help you understand emotional cues more accurately.',
                keyPoints: ['Context matters', 'Look for patterns', 'Avoid assumptions'],
                layout: 'process',
                visualAsset: 'assets/media/slide-002.webp',
                rasterVisualAsset: 'assets/media/slide-002.webp'
            }
        ],
        quiz: [{
            question: 'What is the best first step when interpreting an emotional cue?',
            options: ['Assume the meaning', 'Consider context', 'Ignore it', 'React immediately'],
            correctAnswer: 1,
            explanation: 'Considering the context helps you avoid assumptions and respond more accurately to the situation.'
        }]
    };
}

describe('native raster SCORM course builder', () => {
    it('renders canonical images directly in learner HTML without SVG or image-injection runtimes', () => {
        const analysis = analysisFixture();
        const html = buildIndexHtml(analysis, {
            primary: '#f97316', primaryDark: '#ea580c', accent: '#fdba74'
        }, '');
        expect(html).to.include('assets/media/course-cover.webp');
        expect(html).to.include('assets/media/slide-001.webp');
        expect(html).to.include('assets/media/slide-002.webp');
        expect(html).to.include('<img src="assets/media/slide-001.webp"');
        expect(html).to.not.include('<svg');
        expect(html).to.not.include('quizmoto-replicate-media-script');
        expect(html).to.not.include('quizmoto-course-visual-v6-script');
    });

    it('packages every canonical generated image and lists it in the SCORM manifest', async () => {
        const analysis = analysisFixture();
        const mediaFiles = [
            { path: 'assets/media/course-cover.webp', body: Buffer.alloc(700, 1), contentType: 'image/webp' },
            { path: 'assets/media/slide-001.webp', body: Buffer.alloc(700, 2), contentType: 'image/webp' },
            { path: 'assets/media/slide-002.webp', body: Buffer.alloc(700, 3), contentType: 'image/webp' }
        ];
        const buffer = await buildRasterCoursePackageZip(analysis, { templateId: 1, mediaFiles });
        const zip = await JSZip.loadAsync(buffer);
        expect(zip.file('assets/media/course-cover.webp')).to.not.equal(null);
        expect(zip.file('assets/media/slide-001.webp')).to.not.equal(null);
        expect(zip.file('assets/media/slide-002.webp')).to.not.equal(null);
        const manifest = await zip.file('imsmanifest.xml').async('string');
        expect(manifest).to.include('assets/media/course-cover.webp');
        expect(manifest).to.include('assets/media/slide-001.webp');
        expect(manifest).to.include('assets/media/slide-002.webp');
        const index = await zip.file('index.html').async('string');
        expect(index).to.not.include('<svg');
    });
});
