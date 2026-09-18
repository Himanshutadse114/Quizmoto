const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');
const JSZip = require('jszip');
const {
    acceptedVideoType,
    playerHtml,
    manifestXml,
    createZipFile,
    readAnalysis
} = require('../services/scorm/ScormVideoCourseService');
const contentRouter = require('../routes/scorm/content');

describe('SCORM video course', () => {
    let tempDir;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lmsgen-video-course-test-'));
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('accepts supported browser video types and rejects unrelated files', () => {
        expect(acceptedVideoType('video/mp4')).to.equal('video/mp4');
        expect(acceptedVideoType('video/webm; charset=binary')).to.equal('video/webm');
        expect(acceptedVideoType('application/pdf')).to.equal(null);
    });

    it('safely reads stored video metadata used by the replace workflow', () => {
        expect(readAnalysis('{"revision":2,"mimeType":"video/mp4"}')).to.deep.equal({ revision: 2, mimeType: 'video/mp4' });
        expect(readAnalysis('not-json')).to.deep.equal({});
        expect(readAnalysis('[]')).to.deep.equal({});
    });

    it('recognizes valid media ranges used by desktop and mobile video players', () => {
        expect(contentRouter.isVideoContent('media/course-video.mp4')).to.equal(true);
        expect(contentRouter.isVideoContent('index.html')).to.equal(false);
        expect(contentRouter.requestedByteRange('bytes=0-')).to.deep.equal({ start: 0, end: undefined });
        expect(contentRouter.requestedByteRange('bytes=1024-2047')).to.deep.equal({ start: 1024, end: 2047 });
        expect(contentRouter.requestedByteRange('bytes=20-10')).to.equal(null);
    });

    it('builds a responsive player with resume and genuine watched-coverage tracking', () => {
        const html = playerHtml({
            title: 'Safe handling',
            description: 'A short learning video.',
            mediaPath: 'media/course-video.mp4',
            mimeType: 'video/mp4',
            durationSeconds: 120
        });

        expect(html).to.include('controlslist="nodownload noremoteplayback"');
        expect(html).to.include('cmi.core.lesson_location');
        expect(html).to.include('cmi.suspend_data');
        expect(html).to.include('quizmotoProgress');
        expect(html).to.include('seekCount');
        expect(html).to.include('@media(max-width:520px)');
        expect(html).to.include('to-from<=allowed');
        expect(html).to.include('Skipping ahead is disabled');
        expect(html).to.include('furthestPosition');
        expect(html).to.include('webkitEnterFullscreen');
        expect(html).to.include('requestFullscreen');
    });

    it('creates a portable SCORM 1.2 ZIP with the video and runtime files', async () => {
        const sourcePath = path.join(tempDir, 'source.mp4');
        const outputPath = path.join(tempDir, 'course.zip');
        fs.writeFileSync(sourcePath, Buffer.from('fake-video-content'));
        const mediaPath = 'media/course-video.mp4';
        const html = playerHtml({ title: 'Video course', mediaPath, mimeType: 'video/mp4' });
        const manifest = manifestXml({ title: 'Video course', mediaPath });

        await createZipFile({ outputPath, videoPath: sourcePath, mediaPath, html, manifest });
        const zip = await JSZip.loadAsync(fs.readFileSync(outputPath));

        expect(Object.keys(zip.files)).to.include.members([
            'imsmanifest.xml',
            'index.html',
            'scorm_api_wrapper.js',
            mediaPath
        ]);
        expect(await zip.file(mediaPath).async('string')).to.equal('fake-video-content');
        expect(await zip.file('imsmanifest.xml').async('string')).to.include('adlcp:scormtype="sco"');
    });
});
