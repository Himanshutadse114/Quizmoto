const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

function entitlementRow(values = {}) {
    return {
        maxCourses: values.maxCourses ?? 1,
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
    const ScormCourse = {
        count: sinon.stub().resolves(values.courseCount ?? 1),
        findAll: sinon.stub().resolves([])
    };
    const ScormUserEntitlement = { findOrCreate: sinon.stub().resolves([row]) };
    const noopModel = {
        count: sinon.stub().resolves(0),
        findAll: sinon.stub().resolves([]),
        findOne: sinon.stub().resolves(null)
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
        }
    });
    return { service, ScormCourse };
}

describe('Scorm tenant entitlements', () => {
    it('does not refund lifetime course creation allowance when old courses are archived/deleted', async () => {
        const { service, ScormCourse } = loadService({ maxCourses: 1, courseCount: 1 });
        let caught;
        try {
            await service.enforceRequestEntitlement({
                originalUrl: '/api/scorm/courses',
                method: 'POST',
                body: {},
                scormWorkspaceId: 'tenant-1'
            }, { userId: 55, email: 'tenant@lmsgen.internal', role: 'admin' });
        } catch (err) {
            caught = err;
        }

        expect(caught).to.be.an('error');
        expect(caught.code).to.equal('SCORM_COURSE_LIMIT_REACHED');
        expect(caught.message).to.include('Deleted or archived courses still count');
        expect(ScormCourse.count.calledOnce).to.equal(true);
        // The quota query deliberately has no status filter: all historical
        // course rows consume the tenant's creation allowance.
        expect(ScormCourse.count.firstCall.args[0].where).to.deep.equal({ hostId: 55 });
    });

    it('allows another course only when lifetime consumption is below the configured allowance', async () => {
        const { service } = loadService({ maxCourses: 2, courseCount: 1 });
        const entitlement = await service.enforceRequestEntitlement({
            originalUrl: '/api/scorm/courses', method: 'POST', body: {}, scormWorkspaceId: 'tenant-1'
        }, { userId: 55, email: 'tenant@lmsgen.internal', role: 'admin' });
        expect(entitlement.maxCourses).to.equal(2);
    });
});
