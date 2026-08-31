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
        id: 'member-admin', workspaceId: workspace.id, userId: 44, email: 'admin@acme.com',
        displayName: 'Acme Admin', role: 'admin', status: 'active', joinedAt: new Date(),
        createdAt: new Date(), updatedAt: new Date(), save: sinon.stub().resolves()
    };

    const linkedUser = { id: 44, username: 'Acme Admin', email: 'admin@acme.com' };
    const User = {
        findOne: sinon.stub().resolves(linkedUser),
        findByPk: sinon.stub().callsFake(async (id) => Number(id) === hostUser.id ? hostUser : linkedUser),
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
        findAll: sinon.stub().resolves([adminMember])
    };
    const ScormWorkspaceAuthConfig = { findOrCreate: sinon.stub().resolves([{}]) };
    const addGrant = sinon.stub().resolves({});
    const updateEntitlement = sinon.stub().resolves({});
    const entitlement = {
        maxCourses: 5,
        maxLearners: 20,
        maxStaff: 3,
        maxCampaigns: 4,
        maxAssignments: 40,
        permissions: { courseAuthoring: true }
    };
    const usage = {
        courseCreations: 2,
        activeCourses: 1,
        learners: 10,
        rosterLearners: 10,
        staff: 1,
        campaigns: 3,
        assignments: 12
    };

    const service = proxyquire('../services/scorm/ScormTenantService', {
        '../../models/User': User,
        '../../models/scorm': { ScormWorkspace, ScormWorkspaceMember, ScormWorkspaceAuthConfig },
        './ScormAccessService': {
            normalizeEmail: (value) => String(value || '').trim().toLowerCase(),
            isValidEmail: (value) => /^\S+@\S+\.\S+$/.test(String(value || '').trim()),
            isSuperAdminEmail: (value) => String(value || '').toLowerCase() === 'super@example.com',
            addGrant
        },
        './ScormEntitlementService': {
            getEntitlement: sinon.stub().resolves(entitlement),
            updateEntitlement,
            getUsageForHost: sinon.stub().resolves(usage),
            normalizeLimit: (value) => value === '' || value === null || value === undefined ? null : Math.max(0, Math.floor(Number(value)))
        }
    });

    return { service, User, ScormWorkspace, ScormWorkspaceMember, ScormWorkspaceAuthConfig, addGrant, updateEntitlement, hostUser, workspace, adminMember };
}

describe('ScormTenantService', () => {
    it('creates a tenant data host separately from the human Tenant Admin and stores limits on the tenant host', async () => {
        const ctx = loadService();
        const result = await ctx.service.createTenant({
            name: 'Acme Tenant',
            adminEmail: 'ADMIN@acme.com',
            adminName: 'Acme Admin',
            entitlement: { maxCourses: 5, maxLearners: 20, maxStaff: 3 },
            actorUserId: 1,
            actorEmail: 'super@example.com'
        });

        expect(ctx.User.create.calledOnce).to.equal(true);
        const hostValues = ctx.User.create.firstCall.args[0];
        expect(hostValues.email).to.match(/^tenant-.+@lmsgen\.internal$/);
        expect(hostValues.email).to.not.equal('admin@acme.com');
        expect(ctx.ScormWorkspace.create.firstCall.args[0].ownerUserId).to.equal(ctx.hostUser.id);
        expect(ctx.ScormWorkspaceMember.create.firstCall.args[0]).to.include({ workspaceId: 'tenant-uuid', userId: 44, email: 'admin@acme.com', role: 'admin', status: 'active' });
        expect(ctx.updateEntitlement.calledOnce).to.equal(true);
        expect(ctx.updateEntitlement.firstCall.args[0]).to.equal(ctx.hostUser.email);
        expect(ctx.updateEntitlement.firstCall.args[1]).to.include({ maxCourses: 5, maxLearners: 20, maxStaff: 3 });
        expect(ctx.addGrant.calledOnce).to.equal(true);
        expect(result.hostId).to.equal(901);
        expect(result.admin.email).to.equal('admin@acme.com');
        expect(result.usage).to.deep.equal({ staff: 1, courses: 1, courseCreations: 2, learners: 10, rosterLearners: 10, campaigns: 3, assignments: 12 });
    });

    it('does not allow the protected Super Admin email to become a customer Tenant Admin', async () => {
        const ctx = loadService();
        let caught;
        try { await ctx.service.createTenant({ name: 'Acme', adminEmail: 'super@example.com' }); } catch (err) { caught = err; }
        expect(caught).to.be.an('error');
        expect(caught.code).to.equal('SCORM_TENANT_SUPER_ADMIN_RESERVED');
        expect(ctx.User.create.called).to.equal(false);
    });

    it('requires at least one staff seat when a new tenant has a finite staff limit', async () => {
        const ctx = loadService();
        let caught;
        try { await ctx.service.createTenant({ name: 'Acme', adminEmail: 'admin@acme.com', entitlement: { maxStaff: 0 } }); } catch (err) { caught = err; }
        expect(caught).to.be.an('error');
        expect(caught.code).to.equal('SCORM_TENANT_STAFF_LIMIT_INVALID');
        expect(ctx.User.create.called).to.equal(false);
    });
});
