const { expect } = require('chai');
const ScormAccessGrant = require('../models/ScormAccessGrant');
const Access = require('../services/scorm/ScormAccessService');

function fakeGrant(values = {}) {
    return {
        id: values.id || 1,
        email: values.email || 'user@example.com',
        role: values.role || 'user',
        addedByUserId: values.addedByUserId || null,
        addedByEmail: values.addedByEmail || null,
        registrationCodeHash: values.registrationCodeHash || null,
        registrationCodeUsedAt: values.registrationCodeUsedAt || null,
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

describe('ScormAccessService', () => {
    const originals = {
        findOrCreate: ScormAccessGrant.findOrCreate,
        findOne: ScormAccessGrant.findOne,
        findAll: ScormAccessGrant.findAll,
        findByPk: ScormAccessGrant.findByPk
    };

    afterEach(() => {
        ScormAccessGrant.findOrCreate = originals.findOrCreate;
        ScormAccessGrant.findOne = originals.findOne;
        ScormAccessGrant.findAll = originals.findAll;
        ScormAccessGrant.findByPk = originals.findByPk;
    });

    it('forces the configured super-admin identity to remain protected', async () => {
        const row = fakeGrant({
            email: Access.SUPER_ADMIN_EMAIL,
            role: 'user',
            addedByEmail: 'someone@example.com',
            registrationCodeHash: 'a'.repeat(64)
        });
        ScormAccessGrant.findOrCreate = async ({ where, defaults }) => {
            expect(where).to.deep.equal({ email: Access.SUPER_ADMIN_EMAIL });
            expect(defaults.role).to.equal('super_admin');
            return [row, false];
        };

        const grant = await Access.ensureSuperAdminGrant();

        expect(grant.role).to.equal('super_admin');
        expect(grant.addedByEmail).to.equal(Access.SUPER_ADMIN_EMAIL);
        expect(grant.registrationCodeHash).to.equal(null);
        expect(grant.saveCount).to.equal(1);
        expect(await Access.getAccessRole(Access.SUPER_ADMIN_EMAIL)).to.equal('super_admin');
    });

    it('creates a one-time activation code for a newly approved user', async () => {
        const row = fakeGrant({ email: 'approved@example.com' });
        ScormAccessGrant.findOrCreate = async ({ where, defaults }) => {
            expect(where).to.deep.equal({ email: 'approved@example.com' });
            expect(defaults.role).to.equal('user');
            return [row, true];
        };

        const result = await Access.addGrant({
            email: ' APPROVED@EXAMPLE.COM ',
            addedByUserId: 9,
            addedByEmail: Access.SUPER_ADMIN_EMAIL
        });

        expect(result.grant).to.equal(row);
        expect(result.activationCode).to.match(/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
        expect(row.registrationCodeHash).to.match(/^[a-f0-9]{64}$/);
        expect(row.registrationCodeUsedAt).to.equal(null);
        expect(row.saveCount).to.equal(1);
    });

    it('accepts the matching activation code once and rejects reuse after consumption', async () => {
        const row = fakeGrant({ email: 'activate@example.com' });
        ScormAccessGrant.findOrCreate = async () => [row, true];

        const { activationCode } = await Access.addGrant({ email: row.email });
        ScormAccessGrant.findOne = async ({ where }) => {
            expect(where).to.deep.equal({ email: row.email });
            return row;
        };

        expect(await Access.verifyRegistrationCode(row.email, '0000-0000-0000')).to.equal(false);
        expect(await Access.verifyRegistrationCode(row.email, activationCode)).to.equal(true);

        await Access.markRegistrationCodeUsed(row.email);
        expect(row.registrationCodeHash).to.equal(null);
        expect(row.registrationCodeUsedAt).to.be.instanceOf(Date);
        expect(await Access.verifyRegistrationCode(row.email, activationCode)).to.equal(false);
    });

    it('rotates a lost activation code without storing the plaintext value', async () => {
        const row = fakeGrant({
            id: 77,
            email: 'rotate@example.com',
            registrationCodeHash: 'b'.repeat(64)
        });
        const oldHash = row.registrationCodeHash;
        ScormAccessGrant.findByPk = async (id) => {
            expect(String(id)).to.equal('77');
            return row;
        };

        const result = await Access.rotateRegistrationCode('77');

        expect(result.ok).to.equal(true);
        expect(result.activationCode).to.match(/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
        expect(row.registrationCodeHash).to.match(/^[a-f0-9]{64}$/);
        expect(row.registrationCodeHash).to.not.equal(oldHash);
        expect(row.registrationCodeHash).to.not.equal(result.activationCode);
        expect(row.registrationCodeUsedAt).to.equal(null);
    });

    it('revokes a normal grant but refuses to remove the super-admin grant', async () => {
        const normal = fakeGrant({ id: 3, email: 'remove@example.com' });
        ScormAccessGrant.findByPk = async (id) => id === 3 ? normal : fakeGrant({
            id: 4,
            email: Access.SUPER_ADMIN_EMAIL,
            role: 'super_admin'
        });

        const removed = await Access.removeGrant(3);
        expect(removed.removed).to.equal(true);
        expect(normal.destroyCount).to.equal(1);

        const protectedResult = await Access.removeGrant(4);
        expect(protectedResult.removed).to.equal(false);
        expect(protectedResult.reason).to.equal('super_admin');
    });

    it('returns a consistent administrator contact message for denied access', () => {
        const payload = Access.accessDeniedPayload();
        expect(payload.code).to.equal('SCORM_ACCESS_DENIED');
        expect(payload.adminContact).to.equal(Access.ADMIN_CONTACT_EMAIL);
        expect(payload.message).to.include(Access.ADMIN_CONTACT_EMAIL);
    });
});
