const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

function loadService(campaignOverrides = {}) {
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    const sequelize = {
        transaction: sinon.stub().callsFake(async (work) => work(transaction))
    };
    const campaign = {
        id: 'campaign-1',
        name: 'Awareness Campaign',
        status: 'active',
        startedAt: new Date('2026-09-01T00:00:00Z'),
        endedAt: null,
        save: sinon.stub().resolves(),
        destroy: sinon.stub().resolves(),
        ...campaignOverrides
    };
    const ScormCampaign = {
        findOne: sinon.stub().resolves(campaign)
    };
    const ScormRegistration = {
        update: sinon.stub().resolves([3]),
        findAll: sinon.stub().resolves([{ id: 'registration-1' }]),
        destroy: sinon.stub().resolves(1)
    };
    const ScormAttempt = { destroy: sinon.stub().resolves(1) };
    const ScormCmiState = { destroy: sinon.stub().resolves(1) };
    const ScormRuntimeSnapshot = { destroy: sinon.stub().resolves(1) };
    const ScormXapiStatement = { destroy: sinon.stub().resolves(2) };
    const ScormCampaignCourse = { destroy: sinon.stub().resolves(1) };
    const ScormCampaignLearner = { destroy: sinon.stub().resolves(1) };
    const ScormCampaignVideo = { destroy: sinon.stub().resolves(0) };
    const ScormVideoProgress = { destroy: sinon.stub().resolves(0) };
    const ScormCampaignFlipbook = { destroy: sinon.stub().resolves(0) };
    const ScormFlipbookAssignment = {
        findAll: sinon.stub().resolves([{ id: 'flipbook-assignment-1' }]),
        destroy: sinon.stub().resolves(1)
    };
    const FlipbookReaderContext = {
        findAll: sinon.stub().resolves([{ sessionId: 'reader-session-1' }]),
        destroy: sinon.stub().resolves(1)
    };
    const FlipbookReaderEvent = { destroy: sinon.stub().resolves(4) };
    const FlipbookReaderSession = { destroy: sinon.stub().resolves(1) };

    const service = proxyquire('../services/scorm/ScormCampaignLifecycleService', {
        '../../config/database': { sequelize },
        '../../models/scorm': {
            ScormCampaign,
            ScormCampaignCourse,
            ScormCampaignLearner,
            ScormRegistration,
            ScormAttempt,
            ScormCmiState,
            ScormRuntimeSnapshot,
            ScormXapiStatement,
            ScormCampaignVideo,
            ScormVideoProgress
        },
        '../../models/scorm/ScormCampaignFlipbook': ScormCampaignFlipbook,
        '../../models/scorm/ScormFlipbookAssignment': ScormFlipbookAssignment,
        '../../models/FlipbookReaderContext': FlipbookReaderContext,
        '../../models/FlipbookReaderEvent': FlipbookReaderEvent,
        '../../models/FlipbookReaderSession': FlipbookReaderSession,
        './ScormFlipbookAssignmentService': { ensureFlipbookAssignmentSchema: sinon.stub().resolves() },
        './ScormVideoService': { ensureVideoSchema: sinon.stub().resolves() }
    });

    return {
        service,
        campaign,
        ScormCampaign,
        ScormRegistration,
        ScormAttempt,
        ScormCmiState,
        ScormRuntimeSnapshot,
        ScormXapiStatement,
        ScormCampaignVideo,
        ScormVideoProgress,
        ScormCampaignFlipbook,
        ScormFlipbookAssignment,
        FlipbookReaderContext,
        FlipbookReaderEvent,
        FlipbookReaderSession,
        sequelize,
        transaction
    };
}

describe('ScormCampaignLifecycleService', () => {
    it('stops an active campaign by revoking learner registrations before closing it', async () => {
        const { service, campaign, ScormRegistration } = loadService();

        const result = await service.stopCampaign({
            campaignId: campaign.id,
            hostId: 10,
            workspaceId: 'workspace-1'
        });

        expect(ScormRegistration.update.calledOnce).to.equal(true);
        expect(ScormRegistration.update.firstCall.args[0]).to.deep.equal({ status: 'revoked' });
        expect(ScormRegistration.update.firstCall.args[1].where).to.include({
            campaignId: campaign.id,
            isPreview: false
        });
        expect(campaign.status).to.equal('stopped');
        expect(campaign.endedAt).to.be.instanceOf(Date);
        expect(campaign.save.calledOnce).to.equal(true);
        expect(result.stoppedRegistrations).to.equal(3);
        expect(result.campaign.status).to.equal('stopped');
        expect(result.campaign.portalPath).to.equal(null);
    });

    it('requires an active campaign to be stopped before permanent deletion', async () => {
        const { service, campaign, ScormRegistration } = loadService({ status: 'active' });

        let caught = null;
        try {
            await service.deleteCampaign({
                campaignId: campaign.id,
                hostId: 10,
                workspaceId: 'workspace-1'
            });
        } catch (error) {
            caught = error;
        }

        expect(caught).to.not.equal(null);
        expect(caught.code).to.equal('SCORM_CAMPAIGN_STOP_REQUIRED');
        expect(caught.status).to.equal(409);
        expect(ScormRegistration.destroy.called).to.equal(false);
        expect(campaign.destroy.called).to.equal(false);
    });

    it('deletes Publica assignments and reading sessions with a stopped campaign', async () => {
        const {
            service,
            campaign,
            ScormRegistration,
            ScormAttempt,
            ScormCmiState,
            ScormRuntimeSnapshot,
            ScormXapiStatement,
            ScormFlipbookAssignment,
            FlipbookReaderContext,
            FlipbookReaderEvent,
            FlipbookReaderSession
        } = loadService({
            status: 'stopped',
            endedAt: new Date('2026-09-02T00:00:00Z')
        });

        const result = await service.deleteCampaign({
            campaignId: campaign.id,
            hostId: 10,
            workspaceId: 'workspace-1'
        });

        expect(ScormFlipbookAssignment.destroy.calledOnce).to.equal(true);
        expect(ScormRegistration.destroy.calledOnce).to.equal(true);
        expect(ScormAttempt.destroy.calledOnce).to.equal(true);
        expect(ScormCmiState.destroy.calledOnce).to.equal(true);
        expect(ScormRuntimeSnapshot.destroy.calledOnce).to.equal(true);
        expect(ScormXapiStatement.destroy.calledOnce).to.equal(true);
        expect(FlipbookReaderEvent.destroy.calledOnce).to.equal(true);
        expect(FlipbookReaderContext.destroy.calledOnce).to.equal(true);
        expect(FlipbookReaderSession.destroy.calledOnce).to.equal(true);
        expect(campaign.destroy.calledOnce).to.equal(true);
        expect(result).to.include({
            removed: true,
            id: campaign.id,
            removedFlipbookAssignments: 1,
            removedReaderSessions: 1
        });
    });
});
