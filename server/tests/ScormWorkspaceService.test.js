const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeScormRole(value) {
    const role = String(value || '').trim().toLowerCase();
    if (!role || role === 'user') return 'admin';
    return ['super_admin', 'admin', 'co_admin', 'analytics_viewer'].includes(role) ? role : 'admin';
}

function loadService({ workspace = {}, member = {}, user = {}, access = {} } = {}) {
    const ScormWorkspace = {
        findOrCreate: sinon.stub(),
        findByPk: sinon.stub(),
        ...workspace
    };
    const ScormWorkspaceMember = {
        findOne: sinon.stub(),
        create: sinon.stub(),
        findAll: sinon.stub(),
        ...member
    };
    const User = {
        findOne: sinon.stub(),
        ...user
    };
    const addGrant = access.addGrant || sinon.stub().resolves({});
    const removeGrantByEmail = access.removeGrantByEmail || sinon.stub().resolves({ removed: true });
    const getAccessRole = access.getAccessRole || sinon.stub().resolves(null);

    const service = proxyquire('../services/scorm/ScormWorkspaceService', {
        '../../models/User': User,
        '../../models/scorm': {
            ScormWorkspace,
            ScormWorkspaceMember
        },
        './ScormAccessService': {
            normalizeEmail,
            normalizeScormRole,
            isValidEmail: (email) => /^\S+@\S+\.\S+$/.test(normalizeEmail(email)),
            isSuperAdminEmail: (email) => normalizeEmail(email) === 'super@example.com',
            getAccessRole,
            addGrant,
            removeGrantByEmail
        }
    });

    return { service, ScormWorkspace, ScormWorkspaceMember, User, addGrant, removeGrantByEmail, getAccessRole };
}

function activeMember(overrides = {}) {
    return {
        id: 'member-1',
        workspaceId: 'workspace-1',
        userId: 22,
        email: 'coadmin@example.com',
        displayName: 'Co Admin',
        role: 'co_admin',
        status: 'active',
        joinedAt: new Date('2026-08-30T00:00:00Z'),
        createdAt: new Date('2026-08-30T00:00:00Z'),
        updatedAt: new Date('2026-08-30T00:00:00Z'),
        save: sinon.stub().resolves(),
        ...overrides
    };
}

describe('ScormWorkspaceService', () => {
    it('keeps an existing primary admin on their historical hostId', async () => {
        const owner = { id: 10, email: 'owner@example.com', username: 'Owner' };
        const workspaceRow = {
            id: 'workspace-1',
            ownerUserId: 10,
            name: 'Owner workspace',
            status: 'active'
        };
        const ownerMember = activeMember({
            id: 'owner-member',
            userId: 10,
            email: owner.email,
            role: 'admin',
            displayName: 'Owner'
        });
        const { service, ScormWorkspace, ScormWorkspaceMember } = loadService();
        ScormWorkspace.findOrCreate.resolves([workspaceRow]);
        ScormWorkspaceMember.findOne.resolves(null);
        ScormWorkspaceMember.create.resolves(ownerMember);

        const context = await service.ensureOwnerWorkspace(owner);

        expect(context.hostId).to.equal(10);
        expect(context.role).to.equal('admin');
        expect(context.workspace).to.equal(workspaceRow);
        expect(ScormWorkspace.findOrCreate.calledOnce).to.equal(true);
        expect(ScormWorkspaceMember.create.calledOnce).to.equal(true);
        expect(ScormWorkspaceMember.create.firstCall.args[0]).to.include({
            workspaceId: 'workspace-1',
            userId: 10,
            email: 'owner@example.com',
            role: 'admin',
            status: 'active'
        });
    });

    it('gives the platform Super Admin an owner workspace without losing the global role', async () => {
        const superAdmin = { id: 1, email: 'super@example.com', username: 'Super Admin' };
        const workspaceRow = {
            id: 'super-workspace',
            ownerUserId: 1,
            name: 'Super Admin workspace',
            status: 'active'
        };
        const ownerMember = activeMember({
            id: 'super-owner-member',
            workspaceId: workspaceRow.id,
            userId: superAdmin.id,
            email: superAdmin.email,
            role: 'admin',
            displayName: superAdmin.username
        });
        const { service, ScormWorkspace, ScormWorkspaceMember } = loadService();
        ScormWorkspace.findOrCreate.resolves([workspaceRow]);
        ScormWorkspaceMember.findOne.resolves(null);
        ScormWorkspaceMember.create.resolves(ownerMember);

        const context = await service.resolveWorkspaceContext({ user: superAdmin, role: 'super_admin' });

        expect(context.workspace).to.equal(workspaceRow);
        expect(context.member).to.equal(ownerMember);
        expect(context.hostId).to.equal(superAdmin.id);
        expect(context.role).to.equal('super_admin');
        expect(context.member.role).to.equal('admin');
        expect(ScormWorkspace.findOrCreate.calledOnce).to.equal(true);
        expect(ScormWorkspaceMember.create.firstCall.args[0]).to.include({
            workspaceId: 'super-workspace',
            userId: 1,
            email: 'super@example.com',
            role: 'admin',
            status: 'active'
        });
    });

    it('resolves a co-admin to the primary admin workspace hostId', async () => {
        const coAdmin = { id: 22, email: 'coadmin@example.com', username: 'Co Admin' };
        const memberRow = activeMember();
        const workspaceRow = {
            id: 'workspace-1',
            ownerUserId: 10,
            name: 'Owner workspace',
            status: 'active'
        };
        const { service, ScormWorkspace, ScormWorkspaceMember } = loadService();
        ScormWorkspaceMember.findOne.resolves(memberRow);
        ScormWorkspace.findByPk.resolves(workspaceRow);

        const context = await service.resolveWorkspaceContext({ user: coAdmin, role: 'co_admin' });

        expect(context.hostId).to.equal(10);
        expect(context.role).to.equal('co_admin');
        expect(context.workspace).to.equal(workspaceRow);
        expect(context.member).to.equal(memberRow);
    });

    it('adds an analytics viewer to the workspace and grants the same role', async () => {
        const createdMember = activeMember({
            id: 'viewer-member',
            userId: null,
            email: 'viewer@example.com',
            displayName: 'Viewer',
            role: 'analytics_viewer',
            status: 'invited',
            joinedAt: null
        });
        const addGrant = sinon.stub().resolves({});
        const getAccessRole = sinon.stub().resolves(null);
        const { service, ScormWorkspaceMember, User } = loadService({
            access: { addGrant, getAccessRole }
        });
        ScormWorkspaceMember.findOne.resolves(null);
        ScormWorkspaceMember.create.resolves(createdMember);
        User.findOne.resolves(null);

        const result = await service.inviteWorkspaceMember({
            workspace: { id: 'workspace-1', ownerUserId: 10 },
            actorUserId: 10,
            actorEmail: 'owner@example.com',
            email: 'VIEWER@example.com',
            displayName: 'Viewer',
            role: 'analytics_viewer'
        });

        expect(result.role).to.equal('analytics_viewer');
        expect(result.status).to.equal('invited');
        expect(ScormWorkspaceMember.create.calledOnce).to.equal(true);
        expect(addGrant.calledOnce).to.equal(true);
        expect(addGrant.firstCall.args[0]).to.include({
            email: 'viewer@example.com',
            role: 'analytics_viewer',
            addedByUserId: 10,
            addedByEmail: 'owner@example.com'
        });
    });

    it('rejects attaching one team email to a second workspace', async () => {
        const existing = activeMember({ workspaceId: 'other-workspace' });
        const { service, ScormWorkspaceMember } = loadService();
        ScormWorkspaceMember.findOne.resolves(existing);

        let caught = null;
        try {
            await service.inviteWorkspaceMember({
                workspace: { id: 'workspace-1', ownerUserId: 10 },
                actorUserId: 10,
                actorEmail: 'owner@example.com',
                email: existing.email,
                role: 'co_admin'
            });
        } catch (err) {
            caught = err;
        }

        expect(caught).to.be.an('error');
        expect(caught.code).to.equal('SCORM_TEAM_EMAIL_IN_OTHER_WORKSPACE');
        expect(caught.status).to.equal(409);
    });
});
