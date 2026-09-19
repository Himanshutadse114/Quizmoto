const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

function source(relative) {
    return fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
}

describe('LMSGEN account settings structure', () => {
    const app = source('../client/src/App.jsx');
    const shell = source('../client/src/pages/Scorm/ScormPlatformShell.jsx');
    const settings = source('../client/src/pages/Scorm/AccountSettings.jsx');
    const admin = source('../client/src/pages/Scorm/PlatformUsersAdmin.jsx');

    it('gives every platform user a visible settings route', () => {
        expect(app).to.include('<Route path="settings" element={<ScormAccountSettings />} />');
        expect(shell).to.include("{ to: '/scorm/settings', label: 'Settings'");
        expect(settings).to.include('Publica library name');
        expect(settings).to.include('Upload');
    });

    it('shows live infrastructure checks only to the Super Admin', () => {
        expect(settings).to.include("user?.role === 'super_admin'");
        expect(settings).to.include('/api/scorm/access/infrastructure-health');
        expect(settings).to.include('Platform infrastructure');
        expect(settings).to.include('R2 storage');
        expect(settings).to.include('Connection details and credentials are never displayed.');
    });

    it('gives the Super Admin profile and account lifecycle controls', () => {
        expect(admin).to.include('Edit profile');
        expect(admin).to.include('Remove & block');
        expect(admin).to.include("changeAccountStatus(user, 'restore')");
        expect(admin).to.include('Publica library name');
    });
});
