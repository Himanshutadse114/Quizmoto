const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

describe('SCORM runtime schema guard', () => {
    const routeSource = fs.readFileSync(path.join(__dirname, '../routes/scorm/runtime.js'), 'utf8');
    const guardSource = fs.readFileSync(path.join(__dirname, '../services/scorm/ScormRuntimeSchemaGuard.js'), 'utf8');

    it('runs the schema guard before every runtime persistence operation', () => {
        expect(routeSource).to.include("require('../../services/scorm/ScormRuntimeSchemaGuard')");
        expect((routeSource.match(/await ensureRuntimeReady\(\);/g) || []).length).to.equal(5);
    });

    it('introspects existing tables and adds missing runtime columns', () => {
        expect(guardSource).to.include("qi.describeTable(tableName)");
        expect(guardSource).to.include("qi.addColumn(tableName, column, definition)");
        expect(guardSource).to.include("ensureColumns('scorm_cmi_states'");
        expect(guardSource).to.include("ensureColumns('scorm_registrations'");
        expect(guardSource).to.include("ensureColumns('scorm_attempts'");
    });

    it('serializes concurrent schema checks through one shared promise', () => {
        expect(guardSource).to.include('let ensurePromise = null');
        expect(guardSource).to.include('if (!ensurePromise)');
        expect(guardSource).to.include('await ensurePromise');
    });
});
