const { expect } = require('chai');
const ScormAccessGrant = require('../models/ScormAccessGrant');
const ScormAccessRequest = require('../models/ScormAccessRequest');
const Access = require('../services/scorm/ScormAccessService');

function fakeGrant(values = {}) {
    return {
        id: values.id || 1,
        email: values.email || 'user@example.com',
        role: values.role || 'user',
        addedByUserId: values.addedByUserId || null,
        addedByEmail: values.addedByEmail || null,
        createdAt: values.createdAt || new Date(),
        saveCount: 0,
        destroyCount: 0,
        async save() {
            this.saveCount += 1;
            return this;
        },
        async destroy() {
            this.destroyCount += 1;
        }
    };
}

function fakeRequest(values = {}) {
    return {
        id: values.id || 10,
        userId: values.userId || null,
        email: values.email || 'pending@example.com',
        username: values.username || 'Pending User',
        authMethod: values.authMethod || 'password',
        status: values.status || 'pending',
        requestedAt: values.requestedAt || new Date(),
        approvedAt: values.approvedAt || null,
        approvedByUserId: values.approvedByUserId || null,
        approvedByEmail: values.approvedByEmail || null,
        saveCount: 0,
        async save() {
            this.saveCount += 1;
            return this;
        }
    };
}

describe('ScormAccessService', () => {
    const grantOriginals = {
        findOrCreate: ScormAccessGrant.findOrCreate,
        findOne: ScormAccessGrant.findOne,
        findAll: ScormAccessGrant.findAll,
        findByPk: ScormAccessGrant.findByPk
    };
    const requestOriginals = {
        findOrCreate: ScormAccessRequest.findOrCreate,
        findOne: ScormAccessRequest.findOne,
        findAll: ScormAccessRequest.findAll,
        findByPk: ScormAccessRequest.findByPk
    };

    afterEach(() => {
        Object.assign(ScormAccessGrant, grantOriginals);
        Object.assign(ScormAccessRequest, requestOriginals);
    });

    it('forces the configured super-admin identity to remain protected', async () => {
        const row = fakeGrant({
            email: Access.SUPER_ADMIN_EMAIL,
            role: 'user',
            addedByEmail: 'someone@example.com'
        });
        ScormAccessGrant.findOrCreate = async ({ where, defaults }) => {
            expect(where).to.deep.equal({ email: Access.SUPER_ADMIN_EMAIL });
            expect(defaults.role).to.equal('super_admin');
            return [row, false];
        };

        const grant = await Access.ensureSuperAdminGrant();

        expect(grant.role).to.equal('super_admin');
        expect(grant.addedByEmail).to.equal(Access.SUPER_ADMIN_EMAIL);
        expect(grant.saveCount).to.equal(1);
        expect(await Access.getAccessRole(Access.SUPER_ADMIN_EMAIL)).to.equal('super_admin');
    });

    it('captures an unapproved registration as pending without granting access', async () => {
        const request = fakeRequest({ email: 'pending@example.com', status: 'pending' });
        ScormAccessGrant.findOne = async () => null;
        ScormAccessRequest.findOrCreate = async ({ where, defaults }) => {
            expect(where).to.deep.equal({ email: 'pending@example.com' });
            expect(defaults.status).to.equal('pending');
            expect(defaults.authMethod).to.equal('password');
            return [request, true];
        };

        const result = await Access.captureAccessRequest({
            userId: 44,
            email: ' PENDING@EXAMPLE.COM ',
            username: 'Pending User',
            authMethod: 'password'
        });

        expect(result.email).to.equal('pending@example.com');
        expect(result.status).to.equal('pending');
        expect(result.userId).to.equal(44);
        expect(await Access.hasAccess('pending@example.com')).to.equal(false);
    });

    it('approves an existing pending registration without changing its stored identity', async () => {
        const request = fakeRequest({ id: 22, email: 'ready@example.com', userId: 55 });
        const grant = fakeGrant({ id: 7, email: 'ready@example.com' });

        ScormAccessRequest.findByPk = async (id) => {
            expect(String(id)).to.equal('22');
            return request;
        };
        ScormAccessGrant.findOrCreate = async ({ where, defaults }) => {
            expect(where).to.deep.equal({ email: 'ready@example.com' });
            expect(defaults.addedByUserId).to.equal(1);
            return [grant, true];
        };
        ScormAccessRequest.findOne = async ({ where }) => {
            expect(where).to.deep.equal({ email: 'ready@example.com' });
            return request;
        };

        const result = await Access.approveAccessRequest(22, {
            approvedByUserId: 1,
            approvedByEmail: Access.SUPER_ADMIN_EMAIL
        });

        expect(result.ok).to.equal(true);
        expect(result.grant).to.equal(grant);
        expect(request.userId).to.equal(55);
        expect(request.status).to.equal('approved');
        expect(request.approvedByEmail).to.equal(Access.SUPER_ADMIN_EMAIL);
        expect(request.approvedAt).to.be.instanceOf(Date);
    });

    it('marks a registered user pending again when access is removed', async () => {
        const grant = fakeGrant({ id: 3, email: 'remove@example.com' });
        const request = fakeRequest({
            email: 'remove@example.com',
            status: 'approved',
            approvedAt: new Date(),
            approvedByUserId: 1,
            approvedByEmail: Access.SUPER_ADMIN_EMAIL
        });
        ScormAccessGrant.findByPk = async (id) => id === 3 ? grant : null;
        ScormAccessRequest.findOne = async ({ where }) => {
            expect(where).to.deep.equal({ email: 'remove@example.com' });
            return request;
        };

        const removed = await Access.removeGrant(3);

        expect(removed.removed).to.equal(true);
        expect(grant.destroyCount).to.equal(1);
        expect(request.status).to.equal('pending');
        expect(request.approvedAt).to.equal(null);
        expect(request.approvedByEmail).to.equal(null);
    });

    it('refuses to remove the super-admin grant', async () => {
        ScormAccessGrant.findByPk = async () => fakeGrant({
            id: 4,
            email: Access.SUPER_ADMIN_EMAIL,
            role: 'super_admin'
        });

        const protectedResult = await Access.removeGrant(4);
        expect(protectedResult.removed).to.equal(false);
        expect(protectedResult.reason).to.equal('super_admin');
    });

    it('returns the pending-approval message with the administrator contact', () => {
        const payload = Access.pendingApprovalPayload({ captured: true });
        expect(payload.code).to.equal('SCORM_APPROVAL_PENDING');
        expect(payload.pendingApproval).to.equal(true);
        expect(payload.registrationCaptured).to.equal(true);
        expect(payload.adminContact).to.equal(Access.ADMIN_CONTACT_EMAIL);
        expect(payload.message).to.include('registration has been captured');
        expect(payload.message).to.include(Access.ADMIN_CONTACT_EMAIL);
        expect(payload.message).to.include('same credentials');
    });
});
