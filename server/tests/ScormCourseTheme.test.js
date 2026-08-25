const { expect } = require('chai');
const JSZip = require('jszip');
const {
    COURSE_THEMES,
    resolveCourseTheme,
    buildIndexHtml,
    buildRasterCoursePackageZip
} = require('../services/scorm/ScormRasterCoursePackageBuilder');

describe('SCORM course appearance', () => {
    it('offers curated colour themes for generated learner courses', () => {
        expect(Object.keys(COURSE_THEMES)).to.include.members(['neutral', 'teal', 'blue', 'orange', 'purple', 'forest']);
        expect(resolveCourseTheme({ courseTheme: 'blue' }, 1).primary).to.equal(COURSE_THEMES.blue.primary);
        expect(resolveCourseTheme({ courseTheme: 'purple' }, 1).paper).to.equal(COURSE_THEMES.purple.paper);
    });

    it('uses Inter as the course font and includes a browser-loadable Inter stylesheet', () => {
        const html = buildIndexHtml({ title: 'Test', slides: [], quiz: [] }, COURSE_THEMES.teal, '');
        expect(html).to.include('family=Inter:wght@400;500;600;700');
        expect(html).to.include('font-family:"Inter"');
    });

    it('applies the selected theme to course surfaces and accent controls', () => {
        const html = buildIndexHtml({ title: 'Test', slides: [], quiz: [] }, COURSE_THEMES.orange, '');
        expect(html).to.include(`--primary:${COURSE_THEMES.orange.primary}`);
        expect(html).to.include(`--paper:${COURSE_THEMES.orange.paper}`);
        expect(html).to.include('background:var(--primary)');
        expect(html).to.include('background:var(--surface)');
    });

    it('stores the selected theme in the generated SCORM content metadata', async () => {
        const buffer = await buildRasterCoursePackageZip({
            title: 'Theme test',
            courseTheme: 'forest',
            visualMode: 'raster',
            coverImageAsset: 'assets/media/course-cover.webp',
            slides: [],
            quiz: []
        }, {
            templateId: 1,
            mediaFiles: [{ path: 'assets/media/course-cover.webp', body: Buffer.from('image') }]
        });
        const zip = await JSZip.loadAsync(buffer);
        const content = JSON.parse(await zip.file('content.json').async('string'));
        expect(content.courseTheme).to.equal('forest');
        expect(content.courseFont).to.equal('Inter');
    });
});
