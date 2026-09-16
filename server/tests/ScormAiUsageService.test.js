const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

function loadService({ aiCount = 0, activeCourses = 0, pending = 0 } = {}) {
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    const ScormAiUsageEvent = {
        count: sinon.stub().callsFake(async ({ where }) => (where.status === 'reserved' ? pending : aiCount)),
        findOne: sinon.stub().resolves(null),
        create: sinon.stub().callsFake(async (values) => ({ id: 'usage-1', ...values })),
        update: sinon.stub().resolves([1])
    };
    const ScormCourse = { count: sinon.stub().resolves(activeCourses) };
    const sequelize = { transaction: sinon.stub().callsFake(async (callback) => callback(transaction)) };
    const service = proxyquire('../services/scorm/ScormAiUsageService', {
        '../../config/database': { sequelize },
        '../../models/scorm/ScormUserEntitlement': { findOne: sinon.stub().resolves({ id: 'entitlement-1' }) },
        '../../models/scorm': { ScormAiUsageEvent, ScormCourse }
    });
    return { service, ScormAiUsageEvent };
}

describe('SCORM AI usage ledger', () => {
    it('bills new generated and presentation courses but not simple rebuilds', () => {
        const { service } = loadService();
        expect(service.isBillableAiGenerationPayload({ courseMode: 'generated' })).to.equal(true);
        expect(service.isBillableAiGenerationPayload({ courseMode: 'presentation' })).to.equal(true);
        expect(service.isBillableAiGenerationPayload({ replacePackageId: 'pkg-1' })).to.equal(false);
        expect(service.isBillableAiGenerationPayload({ replacePackageId: 'pkg-1', fullAiRegeneration: true })).to.equal(true);
    });

    it('blocks generation when permanent AI credits are exhausted', async () => {
        const { service } = loadService({ aiCount: 3 });
        let caught;
        try {
            await service.reserveAiCourseGeneration({
                hostId: 9,
                entitlementEmail: 'tenant@lmsgen.internal',
                entitlement: { maxCourses: 3, maxActiveCourses: 10 },
                operationKey: 'course-generation:abc'
            });
        } catch (error) { caught = error; }
        expect(caught?.code).to.equal('SCORM_AI_GENERATION_LIMIT_REACHED');
        expect(caught?.message).to.include('Deleting or archiving');
    });

    it('counts queued new generations against active course capacity', async () => {
        const { service } = loadService({ aiCount: 1, activeCourses: 2, pending: 1 });
        let caught;
        try {
            await service.reserveAiCourseGeneration({
                hostId: 9,
                entitlementEmail: 'tenant@lmsgen.internal',
                entitlement: { maxCourses: 10, maxActiveCourses: 3 },
                operationKey: 'course-generation:def'
            });
        } catch (error) { caught = error; }
        expect(caught?.code).to.equal('SCORM_ACTIVE_COURSE_LIMIT_REACHED');
    });

    it('records a reservation and releases it after a queue failure', async () => {
        const { service, ScormAiUsageEvent } = loadService({ aiCount: 1, activeCourses: 1 });
        const result = await service.reserveAiCourseGeneration({
            hostId: 9,
            entitlementEmail: 'tenant@lmsgen.internal',
            entitlement: { maxCourses: 10, maxActiveCourses: 5 },
            operationKey: 'course-generation:ghi',
            source: 'presentation'
        });
        expect(result.duplicate).to.equal(false);
        expect(ScormAiUsageEvent.create.firstCall.args[0]).to.include({
            operationKey: 'course-generation:ghi', status: 'reserved', reservesActiveSlot: true, source: 'presentation'
        });
        await service.finalizeAiCourseGeneration('course-generation:ghi', { status: 'released' });
        expect(ScormAiUsageEvent.update.calledWith(
            { status: 'released' },
            { where: { operationKey: 'course-generation:ghi' } }
        )).to.equal(true);
    });
});
