const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
}

describe('SCORM generation progress reliability', () => {
    it('keeps course-writing progress alive and bounds long-running content calls', () => {
        const source = read('../services/scorm/CourseAiService.js');
        expect(source).to.include('runWithProgressHeartbeat');
        expect(source).to.include('OPENAI_SCORM_CONTENT_TIMEOUT_MS');
        expect(source).to.include("stage: 'Creating course content'");
        expect(source).to.include('maxPercent: 24');
        expect(source).to.include("stage: 'Course content ready'");
    });

    it('aborts a provider request instead of allowing an indefinite 2% stall', () => {
        const source = read('../services/scorm/PolicyAnalysisService.js');
        expect(source).to.include('OPENAI_SCORM_REQUEST_TIMEOUT_MS');
        const client = read('../services/openai/OpenAiClient.js');
        expect(client).to.include('controller.abort()');
        expect(client).to.include("timeoutError.code = timeoutCode");
    });

    it('keeps visual planning and image generation moving beyond content progress', () => {
        const media = read('../services/scorm/OpenAiCourseMediaService.js');
        expect(media).to.include('OPENAI_SCORM_MEDIA_DEADLINE_MS');
        expect(media).to.include("status: 'working'");
        expect(media).to.include('percent: 28');
        expect(media).to.include('percent: 30');
        expect(media).to.include('percent: 38');
        expect(media).to.include('percent: 78');
    });

    it('never lets browser progress move backwards and expires orphaned jobs', () => {
        const source = read('../../client/src/services/courseGenerationJobs.js');
        expect(source).to.include('Math.max(Math.max(1, Number(floorPercent) || 1), reported)');
        expect(source).to.include('publicCourseGenerationProgress');
        expect(source).to.include('Adding course progress tracking');
        expect(source).to.include('Course generation could not be completed. Please try again.');
        expect(source).to.include('MISSING_PROGRESS_LIMIT');
        expect(source).to.include('STALE_PROGRESS_MS');
        expect(source).to.include("stage: 'Generation interrupted'");
    });

    it('never renders raw generation stages or details in the background course panel', () => {
        const panel = read('../../client/src/components/BackgroundCourseJobs.jsx');
        expect(panel).to.include('publicCourseGenerationProgress(job, percent)');
        expect(panel).to.include('visibleProgress.stage');
        expect(panel).to.include('visibleProgress.detail');
        expect(panel).to.not.include("job.detail || 'The course is actively being created");
    });
});
