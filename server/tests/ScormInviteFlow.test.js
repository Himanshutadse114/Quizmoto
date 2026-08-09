const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

function source(relative) {
    return fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
}

describe('SCORM learner invite flow', () => {
    const registrations = source('routes/scorm/registrations.js');
    const landing = source('../client/src/pages/Scorm/LearnLanding.jsx');
    const app = source('../client/src/App.jsx');

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

    it('navigates to the React player route with the correct query names', () => {
        expect(app).to.include('path="/scorm/player/:registrationId"');
        expect(landing).to.include('navigate(`/scorm/player/${registrationId}?${q.toString()}`)');
        expect(landing).to.include('entryHref,');
        expect(landing).to.include('packageId: packageId ||');
        expect(landing).to.not.include('navigate(`/scorm/play/');
    });

    it('caches launch credentials for popup fallback/reload', () => {
        expect(landing).to.include('sessionStorage.setItem(`scorm_reg_${registrationId}`');
    });
});
