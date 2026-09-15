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
    const sessionRoute = fs.readFileSync(
        path.join(__dirname, '../routes/scorm/session.js'),
        'utf8'
    );
    const apiCache = fs.readFileSync(
        path.join(__dirname, '../../client/src/services/scormApiCache.js'),
        'utf8'
    );

    it('marks preview registration events explicitly on the realtime payload', () => {
        expect(realtime).to.include("isPreview: payload.registration?.isPreview === true");
    });

    it('routes preview runtime events to preview stats instead of learner roster refresh', () => {
        expect(courseDetail).to.include("const isPreviewUpdate = payload.isPreview === true || payload.registration?.isPreview === true;");
        expect(courseDetail).to.include("if (isPreviewUpdate) {");
        expect(courseDetail).to.include("loadPreviewStats({ silent: true });");
        expect(courseDetail).to.match(/return;\r?\n\s*}\r?\n\s*loadRoster\(\)\.catch\(\(\) => \{}\);/);
    });

    it('refreshes preview stats again when the popup exits', () => {
        expect(courseDetail).to.include("type !== 'quizmoto-scorm-exit' && type !== 'quizmoto-scorm-progress'");
        expect(courseDetail).to.include("window.addEventListener('message', onPlayerMessage)");
    });

    it('never serves preview-result refreshes from the platform read cache', () => {
        expect(apiCache).to.include("'/preview/'");
        expect(courseDetail).to.include("'X-LMSGEN-No-Cache': '1'");
        expect(courseDetail).to.include('params: { refresh: Date.now() }');
    });

    it('emits a realtime course update after the canonical session state is saved', () => {
        expect(sessionRoute).to.include("require('../../services/scorm/ScormRealtime')");
        expect(sessionRoute).to.include('Realtime.emitRegistrationUpdate({');
        expect(sessionRoute).to.include('registration: result.registration');
    });
});
