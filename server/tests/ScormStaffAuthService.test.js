const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

function loadService({ user = null } = {}) {
    const member = {
        id: 'member-1',
        workspaceId: 'workspace-1',
        userId: user?.id || null,
        email: 'staff@example.com',
        role: 'co_admin',
        status: 'active',
        joinedAt: new Date(),
        save: sinon.stub().resolves()
    };
    const workspace = { id: 'workspace-1', name: 'Acme', status: 'active' };
    const config = { workspaceId: workspace.id, staffGoogleEnabled: true, staffGoogleClientId: 'tenant-google-client' };
    const User = {
        findOne: sinon.stub().resolves(user),
        create: sinon.stub().callsFake(async (values) => ({ id: 77, ...values }))
    };
    const ScormWorkspaceMember = { findOne: sinon.stub().resolves(member) };
    const service = proxyquire('../services/scorm/ScormStaffAuthService', {
        '../../models/User': User,
        '../../models/scorm': { ScormWorkspaceMember },
        './ScormLearnerAuthService': {
            async getWorkspaceAndConfig() { return { workspace, config }; },
            normalizeEmail: (value) => String(value || '').trim().toLowerCase(),
            normalizeDomains: () => [],
            async verifyGoogleCredential() {
                return { provider: 'google', email: 'staff@example.com', name: 'Staff User' };
            },
            async verifyMicrosoftCredential() {
                return { provider: 'microsoft', email: 'staff@example.com', name: 'Staff User' };
            }
        }
    });
    return { service, User, member };
}

describe('ScormStaffAuthService', () => {
    it('blocks tenant SSO for a platform account that has been blocked', async () => {
        const { service, member } = loadService({
            user: { id: 12, email: 'staff@example.com', username: 'Staff', accountStatus: 'blocked' }
        });
        let caught;
        try {
            await service.verifyStaffIdentity({ workspaceId: 'workspace-1', provider: 'google', credential: 'token' });
        } catch (err) {
            caught = err;
        }
        expect(caught).to.be.an('error');
        expect(caught.code).to.equal('PLATFORM_ACCOUNT_BLOCKED');
        expect(member.save.called).to.equal(false);
    });

    it('creates an active platform identity only after the tenant membership and SSO credential are verified', async () => {
        const { service, User } = loadService({ user: null });
        const result = await service.verifyStaffIdentity({ workspaceId: 'workspace-1', provider: 'google', credential: 'token' });
        expect(User.create.calledOnce).to.equal(true);
        expect(result.user.email).to.equal('staff@example.com');
        expect(result.role).to.equal('co_admin');
    });
});
