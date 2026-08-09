const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

function source(relative) {
    return fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
}

describe('SCORM learner invite flow', () => {
    const registrations = source('routes/scorm/registrations.js');
    const landing = source('../client/src/pages/Scorm/LearnLanding.jsx');

    it('uses the same canonical registration endpoint on client and server', () => {
        expect(registrations).to.include("router.post('/accept', joinInvite)");
        expect(registrations).to.include("router.post('/join', joinInvite)");
        expect(landing).to.include("apiUrl('/api/scorm/registrations/accept')");
    });

    it('returns both current and legacy token fields for safe rolling deploys', () => {
        expect(registrations).to.include('token: result.token');
        expect(registrations).to.include('playToken: result.token');
        expect(landing).to.include('const registrationToken = token || playToken ||');
    });

    it('launches the learner directly into the backend player in the same tab', () => {
        expect(landing).to.include('window.location.assign(apiUrl(`/api/scorm/play/${registrationId}?${q.toString()}`))');
        expect(landing).to.include('entryHref,');
        expect(landing).to.include('packageId: packageId ||');
        expect(landing).to.not.include('useNavigate');
        expect(landing).to.not.include('window.open');
    });

    it('caches launch credentials before leaving the invite page', () => {
        expect(landing).to.include('sessionStorage.setItem(`scorm_reg_${registrationId}`');
    });
});
