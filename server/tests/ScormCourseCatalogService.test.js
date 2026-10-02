const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

function loadService() {
    const sourcePackage = {
        id: 'source-package',
        title: 'Security Basics',
        description: 'Source description',
        standard: 'scorm_1_2',
        storageKeyZip: 'courses/security.zip',
        storagePrefixContent: 'courses/security/',
        entryHref: 'index.html',
        manifestHash: 'hash',
        byteSize: 2048,
        fileCount: 4,
        status: 'ready',
        source: 'ai',
        templateId: null
    };
    const sourceCourse = {
        id: 'source-course',
        hostId: 1,
        packageId: sourcePackage.id,
        package: sourcePackage,
        title: 'Security Basics',
        description: 'Course description',
        status: 'published',
        settings: { theme: 'editorial' },
        publishedAt: new Date()
    };
    const clonedPackage = { id: 'cloned-package', save: sinon.stub().resolves() };
    const clonedCourse = { id: 'cloned-course', save: sinon.stub().resolves() };
    const provision = { id: 'provision-1', courseId: clonedCourse.id, active: true, save: sinon.stub().resolves() };
    const models = {
        ScormCourse: {
            findOne: sinon.stub().resolves(sourceCourse),
            findAll: sinon.stub().resolves([]),
            findByPk: sinon.stub().resolves(null),
            create: sinon.stub().resolves(clonedCourse),
            update: sinon.stub().resolves([1])
        },
        ScormPackage: {
            findByPk: sinon.stub().resolves(null),
            create: sinon.stub().resolves(clonedPackage)
        },
        ScormWorkspace: {
            findAll: sinon.stub().resolves([{ id: 'workspace-1', ownerUserId: 2, status: 'active' }]),
            findByPk: sinon.stub().resolves({ id: 'workspace-1', ownerUserId: 2, status: 'active' })
        },
        ScormCourseCatalogGrant: {
            findOrCreate: sinon.stub().resolves([{}]),
            findAll: sinon.stub().resolves([]),
            count: sinon.stub().resolves(0),
            destroy: sinon.stub().resolves(1)
        },
        ScormCourseProvision: {
            findOne: sinon.stub().resolves(null),
            findAll: sinon.stub().resolves([]),
            create: sinon.stub().resolves(provision),
            update: sinon.stub().resolves([1])
        }
    };
    const sequelize = { transaction: sinon.stub().callsFake(async (callback) => callback({ id: 'transaction' })) };
    const service = proxyquire('../services/scorm/ScormCourseCatalogService', {
        '../../config/database': { sequelize },
        '../../models/scorm': models,
        './ScormInviteService': { createInviteCode: sinon.stub().resolves('CATALOGCODE') }
    });
    return { service, models, sourceCourse, sourcePackage, provision };
}

describe('ScormCourseCatalogService', () => {
    it('provisions a lightweight tenant copy while reusing the source storage objects', async () => {
        const { service, models, sourceCourse, sourcePackage } = loadService();
        await service.setDefaultCourse({ courseId: sourceCourse.id, sourceHostId: 1, actorUserId: 1 });

        expect(models.ScormCourseCatalogGrant.findOrCreate.calledOnce).to.equal(true);
        expect(models.ScormPackage.create.firstCall.args[0]).to.include({
            hostId: 2,
            source: 'catalog',
            storageKeyZip: sourcePackage.storageKeyZip,
            storagePrefixContent: sourcePackage.storagePrefixContent
        });
        expect(models.ScormCourse.create.firstCall.args[0]).to.deep.include({
            hostId: 2,
            packageId: 'cloned-package',
            status: 'published'
        });
        expect(models.ScormCourseProvision.create.firstCall.args[0]).to.include({
            sourceCourseId: sourceCourse.id,
            targetHostId: 2,
            targetWorkspaceId: 'workspace-1'
        });
    });

    it('retires grants and every managed copy before source storage is deleted', async () => {
        const { service, models, sourceCourse, provision } = loadService();
        models.ScormCourse.findAll.resolves([{ id: sourceCourse.id }]);
        models.ScormCourseProvision.findAll.resolves([provision]);

        const retired = await service.retireCatalogSourcesForPackage({
            packageId: sourceCourse.packageId,
            sourceHostId: sourceCourse.hostId
        });

        expect(retired).to.equal(1);
        expect(models.ScormCourseCatalogGrant.destroy.calledOnce).to.equal(true);
        expect(models.ScormCourseProvision.update.calledWith({ active: false })).to.equal(true);
        expect(models.ScormCourse.update.firstCall.args[0]).to.deep.equal({ status: 'archived' });
    });
});
