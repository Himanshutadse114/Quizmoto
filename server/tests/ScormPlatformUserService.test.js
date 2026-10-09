const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

function loadService() {
    const user = {
        id: 41,
        email: 'admin@example.com',
        username: 'Admin',
        accountStatus: 'active',
        authVersion: 0,
        save: sinon.stub().resolves()
    };
    const membership = {
        id: 'admin-member',
        workspaceId: 'workspace-1',
        email: user.email,
        role: 'admin',
        status: 'active'
    };
    const successor = {
        id: 'coadmin-member',
        workspaceId: 'workspace-1',
        email: 'coadmin@example.com',
        role: 'co_admin',
        status: 'active',
        save: sinon.stub().resolves()
    };
    const workspace = {
        id: 'workspace-1',
        ownerUserId: 900,
        name: 'Acme',
        status: 'active',
        save: sinon.stub().resolves()
    };
    const User = { findByPk: sinon.stub().resolves(user), findAll: sinon.stub().resolves([]) };
    const ScormWorkspace = { findByPk: sinon.stub().resolves(workspace), findAll: sinon.stub().resolves([]) };
    const ScormWorkspaceMember = {
        findOne: sinon.stub(),
        destroy: sinon.stub().resolves(1),
        findAll: sinon.stub().resolves([]),
        count: sinon.stub().resolves(1)
    };
    const addGrant = sinon.stub().resolves({});
    const removeGrantByEmail = sinon.stub().resolves({ removed: true });
    const getEntitlement = sinon.stub().resolves({ maxStaff: null });
    const updateEntitlement = sinon.stub().resolves({
        permissions: { avatarStudioFreeExports: true }
    });
    const ScormAccessRequest = { findAll: sinon.stub().resolves([]), update: sinon.stub().resolves([1]) };
    const service = proxyquire('../services/scorm/ScormPlatformUserService', {
        '../../models/User': User,
        '../../models/ScormAccessGrant': { findAll: sinon.stub().resolves([]) },
        '../../models/ScormAccessRequest': ScormAccessRequest,
        '../../models/FlipbookLibrary': { findAll: sinon.stub().resolves([]) },
        '../../models/scorm/ScormUserEntitlement': { findAll: sinon.stub().resolves([]) },
        '../../models/scorm': { ScormWorkspace, ScormWorkspaceMember },
        './ScormAccessService': {
            normalizeEmail: (value) => String(value || '').trim().toLowerCase(),
            normalizeScormRole: (value) => String(value || '').trim().toLowerCase() || 'admin',
            isSuperAdminEmail: (value) => String(value || '').toLowerCase() === 'super@example.com',
            addGrant,
            removeGrantByEmail
        },
        './ScormEntitlementService': { getEntitlement, updateEntitlement },
        '../AccountProfileService': {
            accountStatus: (value) => value?.accountStatus || 'active',
            cleanAvatar: (value) => value,
            cleanDisplayName: (value) => value,
            cleanLibraryTitle: (value) => value,
            getOrCreateLibrary: sinon.stub()
        }
    });
    return {
        service, user, membership, successor, workspace, User,
        ScormWorkspace, ScormWorkspaceMember, addGrant, removeGrantByEmail,
        getEntitlement, updateEntitlement
    };
}

describe('ScormPlatformUserService account lifecycle', () => {
    it('promotes an active Co-admin when the Tenant Admin is removed', async () => {
        const ctx = loadService();
        ctx.ScormWorkspaceMember.findOne.onFirstCall().resolves(ctx.membership);
        ctx.ScormWorkspaceMember.findOne.onSecondCall().resolves(ctx.successor);

        const result = await ctx.service.setPlatformUserStatus({ userId: ctx.user.id, action: 'remove' });

        expect(ctx.successor.role).to.equal('admin');
        expect(ctx.successor.save.calledOnce).to.equal(true);
        expect(ctx.addGrant.calledWith(sinon.match({ email: ctx.successor.email, role: 'admin' }))).to.equal(true);
        expect(result.tenantTransition).to.deep.equal({
            workspaceId: 'workspace-1', action: 'admin_promoted', adminEmail: ctx.successor.email
        });
        expect(ctx.ScormWorkspaceMember.destroy.calledWith({ where: { email: ctx.user.email } })).to.equal(true);
    });

    it('disables an orphaned tenant when its only Admin is removed', async () => {
        const ctx = loadService();
        ctx.ScormWorkspaceMember.findOne.onFirstCall().resolves(ctx.membership);
        ctx.ScormWorkspaceMember.findOne.onSecondCall().resolves(null);

        const result = await ctx.service.setPlatformUserStatus({ userId: ctx.user.id, action: 'block' });

        expect(ctx.workspace.status).to.equal('disabled');
        expect(ctx.workspace.save.calledOnce).to.equal(true);
        expect(result.tenantTransition.action).to.equal('tenant_disabled');
        expect(ctx.user.accountStatus).to.equal('blocked');
        expect(ctx.user.authVersion).to.equal(1);
    });

    it('rejects assigning a customer user into the protected Super Admin tenant', async () => {
        const ctx = loadService();
        const customer = { ...ctx.user, id: 42, email: 'customer@example.com', accountStatus: 'active' };
        const protectedHost = { id: 900, email: 'super@example.com' };
        ctx.User.findByPk.onFirstCall().resolves(customer);
        ctx.User.findByPk.onSecondCall().resolves(protectedHost);

        let caught;
        try {
            await ctx.service.assignPlatformUser({ userId: customer.id, workspaceId: ctx.workspace.id, role: 'co_admin' });
        } catch (err) {
            caught = err;
        }
        expect(caught).to.be.an('error');
        expect(caught.code).to.equal('SCORM_TENANT_PROTECTED');
        expect(ctx.ScormWorkspaceMember.findOne.called).to.equal(false);
    });

    it('stores an individual free Avatar Studio export grant', async () => {
        const ctx = loadService();
        const result = await ctx.service.setPlatformUserAvatarStudioAccess({
            userId: ctx.user.id,
            enabled: true,
            actorUserId: 1,
            actorEmail: 'super@example.com'
        });

        expect(ctx.updateEntitlement.calledOnce).to.equal(true);
        expect(ctx.updateEntitlement.firstCall.args[0]).to.equal(ctx.user.email);
        expect(ctx.updateEntitlement.firstCall.args[1]).to.deep.equal({
            permissions: { avatarStudioFreeExports: true }
        });
        expect(result.avatarStudioFreeExportsPersonal).to.equal(true);
    });
});
