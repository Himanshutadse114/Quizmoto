const { expect } = require('chai');
const jwt = require('jsonwebtoken');

const {
    normalizeJoiningMode,
    normalizeDomains,
    serializeAuthConfig,
    issueLearnerToken,
    verifyLearnerToken
} = require('../services/scorm/ScormLearnerAuthService');

describe('ScormLearnerAuthService', () => {
    it('normalizes learner joining policy to supported modes only', () => {
        expect(normalizeJoiningMode('SSO_ONLY')).to.equal('sso_only');
        expect(normalizeJoiningMode('sso_preferred')).to.equal('sso_preferred');
        expect(normalizeJoiningMode('assigned_email')).to.equal('assigned_email');
        expect(normalizeJoiningMode('anything-else')).to.equal('assigned_email');
    });

    it('normalizes and deduplicates organisation email domains', () => {
        expect(normalizeDomains(['@Example.COM', 'example.com', ' sub.example.com ', 'bad domain']))
            .to.deep.equal(['example.com', 'sub.example.com']);
        expect(normalizeDomains('company.com, COMPANY.com; subsidiary.org'))
            .to.deep.equal(['company.com', 'subsidiary.org']);
    });

    it('serializes SSO-only policy without enabling free-form learner email', () => {
        const serialized = serializeAuthConfig({
            workspaceId: 'workspace-1',
            joiningMode: 'sso_only',
            googleEnabled: true,
            googleClientId: 'google-client.apps.googleusercontent.com',
            microsoftEnabled: true,
            microsoftClientId: 'microsoft-client',
            microsoftTenantId: 'tenant-id',
            allowedDomainsJson: JSON.stringify(['company.com'])
        }, {
            workspace: { id: 'workspace-1', name: 'Example Workspace' },
            publicView: true
        });

        expect(serialized.ssoRequired).to.equal(true);
        expect(serialized.emailEnabled).to.equal(false);
        expect(serialized.googleEnabled).to.equal(true);
        expect(serialized.microsoftEnabled).to.equal(true);
        expect(serialized.allowedDomains).to.deep.equal(['company.com']);
    });

    it('issues learner tokens scoped to workspace, host and verified email', () => {
        const previousSecret = process.env.JWT_SECRET;
        const workspace = { id: 'workspace-123', ownerUserId: 42 };
        const identity = {
            email: 'learner@company.com',
            name: 'Learner Example',
            provider: 'google'
        };

        const token = issueLearnerToken({ workspace, identity });
        const decoded = verifyLearnerToken(token);

        expect(decoded.typ).to.equal('scorm_learner');
        expect(decoded.workspaceId).to.equal('workspace-123');
        expect(decoded.hostId).to.equal(42);
        expect(decoded.email).to.equal('learner@company.com');
        expect(decoded.provider).to.equal('google');
        process.env.JWT_SECRET = previousSecret;
    });

    it('rejects a normal application token as a learner session', () => {
        const applicationToken = jwt.sign({ userId: 42, scope: 'scorm' }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '5m' });
        expect(() => verifyLearnerToken(applicationToken)).to.throw('Learner session expired');
    });
});
