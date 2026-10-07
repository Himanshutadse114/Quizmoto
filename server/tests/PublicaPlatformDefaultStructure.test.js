const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

function source(relative) {
    return fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
}

describe('platform-default Publica distribution', () => {
    const model = source('models/Flipbook.js');
    const service = source('services/FlipbookService.js');
    const tenantRoute = source('routes/scorm/flipbookTenants.js');
    const workspaceRoute = source('routes/flipbooks.js');
    const assignmentService = source('services/scorm/ScormFlipbookAssignmentService.js');
    const admin = source('../client/src/pages/Scorm/FlipbookTenantAdmin.jsx');
    const publica = source('../client/src/pages/Scorm/Flipbooks.jsx');

    it('stores a single selected publication and validates the Super Admin source', () => {
        expect(model).to.include('isPlatformDefault');
        expect(model).to.not.include("{ fields: ['isPlatformDefault'] }");
        expect(service).to.include("await qi.addColumn(table, 'isPlatformDefault'");
        expect(service).to.include("await qi.addIndex(table, ['isPlatformDefault']");
        expect(service).to.include('await Flipbook.update({ isPlatformDefault: false }');
        expect(service).to.include("status: 'published'");
        expect(service).to.include('ownerUserId');
        expect(tenantRoute).to.include("router.put('/default/:flipbookId'");
        expect(tenantRoute).to.include("router.delete('/default'");
    });

    it('adds the selected publication to every user workspace as read-only content', () => {
        expect(workspaceRoute).to.include('getPlatformDefaultFlipbook()');
        expect(workspaceRoute).to.include('readOnly: true, isPlatformDefault: true');
        expect(publica).to.include('Included by LMSGEN');
        expect(publica).to.include('does not use your Publica allowance');
    });

    it('makes the default publication available for approved tenant campaigns', () => {
        expect(assignmentService).to.include('getPlatformDefaultFlipbook()');
        expect(assignmentService).to.include('isPlatformDefault: Boolean(book.isPlatformDefault)');
    });

    it('provides Super Admin selection and removal controls', () => {
        expect(admin).to.include('Default Publica for everyone');
        expect(admin).to.include('/api/scorm/flipbook-tenants/default/${defaultId}');
        expect(admin).to.include("axios.delete(apiUrl('/api/scorm/flipbook-tenants/default')");
    });
});
