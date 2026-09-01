const { expect } = require('chai');
const {
    normalizeRequestedAuthMode,
    normalizeStoredAuthMode,
    providerAllowedForCampaign,
    authModeLabel,
    campaignAccessCode,
    verifyCampaignAccessCode
} = require('../services/scorm/ScormCampaignAuthPolicy');

describe('SCORM campaign authentication policy', () => {
    it('defaults new campaigns to email plus access code', () => {
        expect(normalizeRequestedAuthMode()).to.equal('email_code');
        expect(normalizeRequestedAuthMode('unknown')).to.equal('email_code');
        expect(normalizeRequestedAuthMode('google')).to.equal('google');
        expect(normalizeRequestedAuthMode('microsoft')).to.equal('microsoft');
    });

    it('keeps missing legacy campaign modes on the previous SSO behaviour', () => {
        expect(normalizeStoredAuthMode()).to.equal('sso_any');
        expect(providerAllowedForCampaign('sso_any', 'google')).to.equal(true);
        expect(providerAllowedForCampaign('sso_any', 'microsoft')).to.equal(true);
        expect(providerAllowedForCampaign('sso_any', 'email_code')).to.equal(false);
    });

    it('enforces the selected campaign provider', () => {
        expect(providerAllowedForCampaign('google', 'google')).to.equal(true);
        expect(providerAllowedForCampaign('google', 'microsoft')).to.equal(false);
        expect(providerAllowedForCampaign('microsoft', 'microsoft')).to.equal(true);
        expect(providerAllowedForCampaign('email_code', 'email_code')).to.equal(true);
        expect(providerAllowedForCampaign('email_code', 'email')).to.equal(false);
        expect(authModeLabel('email_code')).to.equal('Email + access code');
    });

    it('creates a stable unique access code for each campaign learner', () => {
        const first = campaignAccessCode('campaign-a', 'Learner@Example.com');
        expect(first).to.match(/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
        expect(campaignAccessCode('campaign-a', 'learner@example.com')).to.equal(first);
        expect(campaignAccessCode('campaign-a', 'other@example.com')).to.not.equal(first);
        expect(campaignAccessCode('campaign-b', 'learner@example.com')).to.not.equal(first);
    });

    it('accepts only the code tied to that campaign and email', () => {
        const code = campaignAccessCode('campaign-a', 'learner@example.com');
        expect(verifyCampaignAccessCode('campaign-a', 'LEARNER@example.com', code.toLowerCase())).to.equal(true);
        expect(verifyCampaignAccessCode('campaign-a', 'other@example.com', code)).to.equal(false);
        expect(verifyCampaignAccessCode('campaign-b', 'learner@example.com', code)).to.equal(false);
        expect(verifyCampaignAccessCode('campaign-a', 'learner@example.com', 'AAAA-BBBB-CCCC')).to.equal(false);
    });
});
