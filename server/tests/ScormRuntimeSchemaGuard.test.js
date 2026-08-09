const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

describe('SCORM runtime schema guard', () => {
    const routeSource = fs.readFileSync(path.join(__dirname, '../routes/scorm/runtime.js'), 'utf8');
    const guardSource = fs.readFileSync(path.join(__dirname, '../services/scorm/ScormRuntimeSchemaGuard.js'), 'utf8');
    const snapshotSource = fs.readFileSync(path.join(__dirname, '../services/scorm/ScormRuntimeSnapshotStore.js'), 'utf8');
    const inviteSource = fs.readFileSync(path.join(__dirname, '../services/scorm/ScormInviteService.js'), 'utf8');

    it('uses the isolated snapshot store before every runtime operation', () => {
        expect(routeSource).to.include("require('../../services/scorm/ScormRuntimeSnapshotStore')");
        expect(routeSource).to.include('await RuntimeStore.ensureReady()');
        expect((routeSource.match(/await ensureRuntimeReady\(\);/g) || []).length).to.equal(5);
        expect(routeSource).to.not.include("require('../../services/scorm/ScormRuntimeSchemaGuard')");
        expect(snapshotSource).to.not.include('ScormRuntimeSnapshot.sync()');
    });

    it('creates and upserts the canonical PostgreSQL runtime snapshot explicitly', () => {
        expect(snapshotSource).to.include('CREATE TABLE IF NOT EXISTS "scorm_runtime_snapshots"');
        expect(snapshotSource).to.include('ON CONFLICT ("registrationId") DO UPDATE SET');
        expect(snapshotSource).to.include('"payloadJson" TEXT NOT NULL');
        expect(snapshotSource).to.include('"stateVersion" INTEGER NOT NULL DEFAULT 0');
        expect(snapshotSource).to.include('"initialized" BOOLEAN NOT NULL DEFAULT FALSE');
    });

    it('keeps initialize alive when optional attempt history fails', () => {
        expect(routeSource).to.include('initializeWithoutAttemptHistory');
        expect(routeSource).to.include('primary initialize failed; using safe runtime initialization');
        expect(routeSource).to.include('attemptHistoryAvailable: false');
    });

    it('classifies invalid or expired registration tokens as forbidden instead of server errors', () => {
        expect(inviteSource).to.include('Invalid or expired registration token');
        expect(inviteSource).to.include("err.code = 'FORBIDDEN'");
    });

    it('retains legacy repair only for compatibility/migration paths', () => {
        expect(guardSource).to.include("qi.describeTable(tableName)");
        expect(guardSource).to.include("qi.addColumn(tableName, column, definition)");
        expect(guardSource).to.include("ensureColumns('scorm_cmi_states'");
        expect(guardSource).to.include("ensureColumns('scorm_registrations'");
        expect(guardSource).to.include("ensureColumns('scorm_attempts'");
    });

    it('upgrades legacy bounded SCORM payload columns to TEXT', () => {
        expect(guardSource).to.include('qi.changeColumn(tableName, column');
        expect(guardSource).to.include("'lessonLocation'");
        expect(guardSource).to.include("'suspendData'");
        expect(guardSource).to.include("'interactionsJson'");
        expect(guardSource).to.include("'rawMapJson'");
        expect(guardSource).to.include('type: DataTypes.TEXT');
    });

    it('serializes concurrent legacy schema checks through one shared promise', () => {
        expect(guardSource).to.include('let ensurePromise = null');
        expect(guardSource).to.include('if (!ensurePromise)');
        expect(guardSource).to.include('await ensurePromise');
    });
});
