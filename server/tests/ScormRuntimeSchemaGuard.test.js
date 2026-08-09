const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

describe('SCORM runtime schema guard', () => {
    const routeSource = fs.readFileSync(path.join(__dirname, '../routes/scorm/runtime.js'), 'utf8');
    const guardSource = fs.readFileSync(path.join(__dirname, '../services/scorm/ScormRuntimeSchemaGuard.js'), 'utf8');
    const snapshotSource = fs.readFileSync(path.join(__dirname, '../services/scorm/ScormRuntimeSnapshotStore.js'), 'utf8');

    it('uses the isolated snapshot store before every runtime operation', () => {
        expect(routeSource).to.include("require('../../services/scorm/ScormRuntimeSnapshotStore')");
        expect(routeSource).to.include('await RuntimeStore.ensureReady()');
        expect((routeSource.match(/await ensureRuntimeReady\(\);/g) || []).length).to.equal(5);
        expect(routeSource).to.not.include("require('../../services/scorm/ScormRuntimeSchemaGuard')");
        expect(snapshotSource).to.include('ScormRuntimeSnapshot.sync()');
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
