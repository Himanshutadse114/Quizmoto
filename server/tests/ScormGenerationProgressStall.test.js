const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
}

describe('SCORM generation progress reliability', () => {
    it('keeps course-writing progress alive and bounds long-running content calls', () => {
        const source = read('../services/scorm/GeminiServiceAccountCourseAiService.js');
        expect(source).to.include('runWithProgressHeartbeat');
        expect(source).to.include('GEMINI_SCORM_CONTENT_TIMEOUT_MS');
        expect(source).to.include("stage: 'Creating course content'");
        expect(source).to.include('maxPercent: 26');
        expect(source).to.include("stage: 'Planning course visuals'");
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
