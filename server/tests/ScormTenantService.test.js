const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

function loadService() {
    const hostUser = { id: 901, username: 'tenant-host', email: 'tenant@lmsgen.internal', destroy: sinon.stub().resolves() };
    const workspace = {
        id: 'tenant-uuid',
        ownerUserId: hostUser.id,
        name: 'Acme Tenant',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        save: sinon.stub().resolves(),
        destroy: sinon.stub().resolves()
    };
    const adminMember = {
        id: 'member-admin',
        workspaceId: workspace.id,
        userId: 44,
        email: 'admin@acme.com',
        displayName: 'Acme Admin',
        role: 'admin',
        status: 'active',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        save: sinon.stub().resolves()
    };

    const User = {
        findOne: sinon.stub().resolves({ id: 44, username: 'Acme Admin', email: 'admin@acme.com' }),
        create: sinon.stub().resolves(hostUser)
    };
    const ScormWorkspace = {
        create: sinon.stub().resolves(workspace),
        findAll: sinon.stub().resolves([workspace]),
        findByPk: sinon.stub().resolves(workspace)
    };
    const ScormWorkspaceMember = {
        findOne: sinon.stub().resolves(null),
        create: sinon.stub().resolves(adminMember),
        findAll: sinon.stub().resolves([adminMember]),
        count: sinon.stub().resolves(1)
    };
    const ScormWorkspaceAuthConfig = { findOrCreate: sinon.stub().resolves([{}]) };
    const ScormCourse = { count: sinon.stub().resolves(2) };
    const ScormLearnerRoster = { count: sinon.stub().resolves(10) };
    const ScormCampaign = { count: sinon.stub().resolves(3) };
    const addGrant = sinon.stub().resolves({});

    const service = proxyquire('../services/scorm/ScormTenantService', {
        '../../models/User': User,
        '../../models/scorm': {
            ScormWorkspace,
            ScormWorkspaceMember,
            ScormWorkspaceAuthConfig,
            ScormCourse,
            ScormLearnerRoster,
            ScormCampaign
        },
        './ScormAccessService': {
            normalizeEmail: (value) => String(value || '').trim().toLowerCase(),
            isValidEmail: (value) => /^\S+@\S+\.\S+$/.test(String(value || '').trim()),
            isSuperAdminEmail: (value) => String(value || '').toLowerCase() === 'super@example.com',
            addGrant
        }
    });

    return {
        service, User, ScormWorkspace, ScormWorkspaceMember, ScormWorkspaceAuthConfig,
        addGrant, hostUser, workspace, adminMember
    };
}

describe('ScormTenantService', () => {
    it('creates a tenant data host separately from the human Tenant Admin', async () => {
        const ctx = loadService();
        const result = await ctx.service.createTenant({
            name: 'Acme Tenant',
            adminEmail: 'ADMIN@acme.com',
            adminName: 'Acme Admin',
            actorUserId: 1,
            actorEmail: 'super@example.com'
        });

        expect(ctx.User.create.calledOnce).to.equal(true);
        const hostValues = ctx.User.create.firstCall.args[0];
        expect(hostValues.email).to.match(/^tenant-.+@lmsgen\.internal$/);
        expect(hostValues.email).to.not.equal('admin@acme.com');

        expect(ctx.ScormWorkspace.create.calledOnce).to.equal(true);
        expect(ctx.ScormWorkspace.create.firstCall.args[0].ownerUserId).to.equal(ctx.hostUser.id);

        expect(ctx.ScormWorkspaceMember.create.calledOnce).to.equal(true);
        expect(ctx.ScormWorkspaceMember.create.firstCall.args[0]).to.include({
            workspaceId: 'tenant-uuid',
            userId: 44,
            email: 'admin@acme.com',
            role: 'admin',
            status: 'active'
        });
        expect(ctx.addGrant.calledOnce).to.equal(true);
        expect(result.hostId).to.equal(901);
        expect(result.admin.email).to.equal('admin@acme.com');
        expect(result.usage).to.deep.equal({ courses: 2, learners: 10, campaigns: 3, staff: 1 });
    });

    it('does not allow the protected Super Admin email to become a customer Tenant Admin', async () => {
        const ctx = loadService();
        let caught;
        try {
            await ctx.service.createTenant({ name: 'Acme', adminEmail: 'super@example.com' });
        } catch (err) {
            caught = err;
        }
        expect(caught).to.be.an('error');
        expect(caught.code).to.equal('SCORM_TENANT_SUPER_ADMIN_RESERVED');
        expect(ctx.User.create.called).to.equal(false);
    });
});
