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
        update: sinon.stub().resolves([3])
    };

    const service = proxyquire('../services/scorm/ScormCampaignLifecycleService', {
        '../../config/database': { sequelize },
        '../../models/scorm': { ScormCampaign, ScormRegistration }
    });

    return { service, campaign, ScormCampaign, ScormRegistration, sequelize, transaction };
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

    it('refuses to delete a campaign while it is active', async () => {
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
        expect(ScormRegistration.update.called).to.equal(false);
        expect(campaign.destroy.called).to.equal(false);
    });

    it('deletes a stopped campaign only after keeping its registrations revoked', async () => {
        const { service, campaign, ScormRegistration } = loadService({
            status: 'stopped',
            endedAt: new Date('2026-09-02T00:00:00Z')
        });

        const result = await service.deleteCampaign({
            campaignId: campaign.id,
            hostId: 10,
            workspaceId: 'workspace-1'
        });

        expect(ScormRegistration.update.calledOnce).to.equal(true);
        expect(ScormRegistration.update.firstCall.args[0]).to.deep.equal({
            campaignId: null,
            status: 'revoked'
        });
        expect(campaign.destroy.calledOnce).to.equal(true);
        expect(result).to.deep.equal({ removed: true, id: campaign.id });
    });
});
