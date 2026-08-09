const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

describe('SCORM runtime production schema migration', () => {
    const source = fs.readFileSync(path.join(__dirname, '../config/database.js'), 'utf8');

    it('adds runtime CMI persistence columns for existing PostgreSQL databases', () => {
        [
            'rawMapJson',
            'sessionTime',
            'totalTime',
            'lessonLocation',
            'suspendData',
            'stateVersion',
            'initialized',
            'scoreRaw',
            'scoreMin',
            'scoreMax'
        ].forEach((column) => {
            expect(source).to.include(`ALTER TABLE \"scorm_cmi_states\" ADD COLUMN \"${column}\"`);
        });
    });

    it('adds preview and report snapshot fields for existing registrations', () => {
        [
            'isPreview',
            'lastLessonStatus',
            'lastScoreRaw',
            'lastTotalTime',
            'lastCommitAt'
        ].forEach((column) => {
            expect(source).to.include(`ALTER TABLE \"scorm_registrations\" ADD COLUMN \"${column}\"`);
        });
    });

    it('keeps equivalent MySQL runtime upgrades', () => {
        expect(source).to.include('ALTER TABLE `scorm_cmi_states` ADD COLUMN `rawMapJson`');
        expect(source).to.include('ALTER TABLE `scorm_cmi_states` ADD COLUMN `initialized`');
        expect(source).to.include('ALTER TABLE `scorm_registrations` ADD COLUMN `isPreview`');
    });
});
