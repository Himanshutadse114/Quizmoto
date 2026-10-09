const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

function loadService(personalAccess = false) {
    const getEntitlement = sinon.stub().resolves({
        permissions: { avatarStudioFreeExports: personalAccess }
    });
    const service = proxyquire('../services/scorm/AvatarStudioAccessService', {
        './ScormEntitlementService': { getEntitlement }
    });
    return { service, getEntitlement };
}

describe('Avatar Studio complimentary export access', () => {
    it('always grants the Super Admin without loading another entitlement', async () => {
        const { service, getEntitlement } = loadService(false);
        const source = await service.complimentaryAvatarExportSource({
            scormRole: 'super_admin',
            scormEmail: 'super@example.com'
        });

        expect(source).to.equal('super_admin');
        expect(getEntitlement.called).to.equal(false);
    });

    it('grants every member when the tenant permission is enabled', async () => {
        const { service, getEntitlement } = loadService(false);
        const source = await service.complimentaryAvatarExportSource({
            scormRole: 'co_admin',
            scormEmail: 'member@example.com',
            scormEntitlement: { permissions: { avatarStudioFreeExports: true } }
        });

        expect(source).to.equal('tenant');
        expect(getEntitlement.called).to.equal(false);
    });

    it('supports an individual grant without enabling the tenant', async () => {
        const { service, getEntitlement } = loadService(true);
        const source = await service.complimentaryAvatarExportSource({
            scormRole: 'analytics_viewer',
            scormEmail: 'member@example.com',
            scormEntitlement: { permissions: { avatarStudioFreeExports: false } }
        });

        expect(source).to.equal('user');
        expect(getEntitlement.calledOnceWith('member@example.com', 'user')).to.equal(true);
    });

    it('keys paid exports to the authenticated person rather than the tenant host', () => {
        const { service } = loadService(false);
        expect(service.avatarExportBuyerId({ authenticatedUserId: 42, userId: 900 })).to.equal(42);
    });
});
