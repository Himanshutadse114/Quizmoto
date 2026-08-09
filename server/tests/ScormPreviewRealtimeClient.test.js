const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

describe('SCORM admin preview realtime refresh', () => {
    const courseDetail = fs.readFileSync(
        path.join(__dirname, '../../client/src/pages/Scorm/CourseDetail.jsx'),
        'utf8'
    );
    const realtime = fs.readFileSync(
        path.join(__dirname, '../services/scorm/ScormRealtime.js'),
        'utf8'
    );

    it('marks preview registration events explicitly on the realtime payload', () => {
        expect(realtime).to.include("isPreview: payload.registration?.isPreview === true");
    });

    it('routes preview runtime events to preview stats instead of learner roster refresh', () => {
        expect(courseDetail).to.include("const isPreviewUpdate = payload.isPreview === true || payload.registration?.isPreview === true;");
        expect(courseDetail).to.include("if (isPreviewUpdate) {");
        expect(courseDetail).to.include("loadPreviewStats({ silent: true });");
        expect(courseDetail).to.include("return;\n      }\n      loadRoster().catch(() => {});");
    });

    it('refreshes preview stats again when the popup exits', () => {
        expect(courseDetail).to.include("type !== 'quizmoto-scorm-exit' && type !== 'quizmoto-scorm-progress'");
        expect(courseDetail).to.include("window.addEventListener('message', onPlayerMessage)");
    });
});
