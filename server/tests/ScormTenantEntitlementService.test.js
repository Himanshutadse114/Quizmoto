const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

function entitlementRow(values = {}) {
    return {
        maxCourses: Object.prototype.hasOwnProperty.call(values, 'maxCourses') ? values.maxCourses : 3,
        maxActiveCourses: Object.prototype.hasOwnProperty.call(values, 'maxActiveCourses') ? values.maxActiveCourses : 2,
        maxLearners: values.maxLearners ?? null,
        maxStaff: values.maxStaff ?? null,
        maxCampaigns: values.maxCampaigns ?? null,
        maxAssignments: values.maxAssignments ?? null,
        permissions: {
            courseAuthoring: true,
            coursePublishing: true,
            coursePreview: true,
            learnerRoster: true,
            learnerTracking: true,
            assignments: true,
            campaigns: true,
            reports: true,
            library: true,
            contentEditor: true,
            teamManagement: true,
            ssoManagement: true
        },
        save: sinon.stub().resolves()
    };
}

function loadService(values = {}) {
    const row = entitlementRow(values);
    const ScormCourse = { count: sinon.stub().resolves(0), findAll: sinon.stub().resolves([]) };
    const ScormUserEntitlement = { findOrCreate: sinon.stub().resolves([row]) };
    const noopModel = {
        count: sinon.stub().resolves(0),
        findAll: sinon.stub().resolves([]),
        findOne: sinon.stub().resolves(null)
    };
    const aiUsage = {
        countAiGenerations: sinon.stub().resolves(values.aiCount ?? 0),
        assertAiGenerationAvailable: sinon.stub().resolves(),
        assertActiveCourseCapacity: sinon.stub().resolves(),
        isBillableAiGenerationPayload: (payload = {}) => !(payload.replacePackageId || payload.packageId)
    };

    const service = proxyquire('../services/scorm/ScormEntitlementService', {
        '../../models/User': { findOne: sinon.stub().resolves(null), findByPk: sinon.stub().resolves(null) },
        '../../models/scorm/ScormUserEntitlement': ScormUserEntitlement,
        '../../models/scorm': {
            ScormCourse,
            ScormLearnerRoster: noopModel,
            ScormRegistration: noopModel,
            ScormCampaign: noopModel,
            ScormWorkspace: noopModel,
            ScormWorkspaceMember: noopModel
        },
        './ScormAiUsageService': aiUsage
    });
    return { service, aiUsage };
}

describe('Scorm tenant entitlements', () => {
    it('defaults new and previously blank accounts to no course creation and 10 Quizmoto players', async () => {
        const { service } = loadService({ maxCourses: null, maxActiveCourses: null });
        const entitlement = await service.getEntitlement('new-user@example.com', 'admin');
        expect(entitlement.maxCourses).to.equal(0);
        expect(entitlement.maxActiveCourses).to.equal(0);
        expect(entitlement.maxQuizPlayers).to.equal(10);
    });

    it('blocks course authoring until the Super Admin assigns an allowance', async () => {
        const { service } = loadService({ maxCourses: 0, maxActiveCourses: 0 });
        let caught;
        try {
            await service.enforceRequestEntitlement({
                originalUrl: '/api/scorm/author/generate', method: 'POST', body: {}, scormWorkspaceId: 'tenant-1'
            }, { userId: 55, email: 'tenant@lmsgen.internal', role: 'admin' });
        } catch (error) { caught = error; }
        expect(caught?.code).to.equal('SCORM_COURSE_CREATION_NOT_ENABLED');
        expect(caught?.status).to.equal(403);
    });

    it('still permits cancellation when a course allowance is revoked', async () => {
        const { service } = loadService({ maxCourses: 0, maxActiveCourses: 0 });
        const entitlement = await service.enforceRequestEntitlement({
            originalUrl: '/api/scorm/author/progress/job-123/cancel', method: 'POST', body: {}, scormWorkspaceId: 'tenant-1'
        }, { userId: 55, email: 'tenant@lmsgen.internal', role: 'admin' });

        expect(entitlement.maxCourses).to.equal(0);
    });

    it('uses active capacity, not AI credits, for a manually created course', async () => {
        const { service, aiUsage } = loadService();
        await service.enforceRequestEntitlement({
            originalUrl: '/api/scorm/courses', method: 'POST', body: {}, scormWorkspaceId: 'tenant-1'
        }, { userId: 55, email: 'tenant@lmsgen.internal', role: 'admin' });

        expect(aiUsage.assertActiveCourseCapacity.calledOnceWith(55)).to.equal(true);
        expect(aiUsage.assertAiGenerationAvailable.called).to.equal(false);
    });

    it('exposes separate AI-credit and active-course limits to generation routes', async () => {
        const { service, aiUsage } = loadService();
        const entitlement = await service.enforceRequestEntitlement({
            originalUrl: '/api/scorm/author/generate', method: 'POST', body: { courseMode: 'generated' }, scormWorkspaceId: 'tenant-1'
        }, { userId: 55, email: 'tenant@lmsgen.internal', role: 'admin' });

        expect(entitlement.maxCourses).to.equal(3);
        expect(entitlement.maxActiveCourses).to.equal(2);
        // The author route creates an idempotent ledger reservation after it has
        // validated progressId. Middleware must not reject a safe retry first.
        expect(aiUsage.assertAiGenerationAvailable.called).to.equal(false);
        expect(aiUsage.assertActiveCourseCapacity.called).to.equal(false);
    });

    it('does not consume or require quota for an asset-reusing rebuild', async () => {
        const { service, aiUsage } = loadService();
        await service.enforceRequestEntitlement({
            originalUrl: '/api/scorm/author/generate', method: 'POST', body: { replacePackageId: 'existing-package' }, scormWorkspaceId: 'tenant-1'
        }, { userId: 55, email: 'tenant@lmsgen.internal', role: 'admin' });

        expect(aiUsage.assertAiGenerationAvailable.called).to.equal(false);
        expect(aiUsage.assertActiveCourseCapacity.called).to.equal(false);
    });
});
