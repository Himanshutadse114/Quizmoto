const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const {
    ScormCampaign,
    ScormRegistration
} = require('../../models/scorm');

function fail(message, code, status = 400) {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    return err;
}

async function findCampaignForUpdate({ campaignId, hostId, workspaceId, transaction }) {
    const campaign = await ScormCampaign.findOne({
        where: { id: campaignId, hostId, workspaceId },
        transaction,
        lock: transaction?.LOCK?.UPDATE
    });
    if (!campaign) throw fail('Campaign not found.', 'SCORM_CAMPAIGN_NOT_FOUND', 404);
    return campaign;
}

async function stopCampaign({ campaignId, hostId, workspaceId }) {
    let stoppedCampaign = null;
    let stoppedRegistrations = 0;

    await sequelize.transaction(async (transaction) => {
        const campaign = await findCampaignForUpdate({ campaignId, hostId, workspaceId, transaction });

        if (campaign.status === 'stopped') {
            stoppedCampaign = campaign;
            return;
        }
        if (campaign.status !== 'active') {
            throw fail(
                campaign.status === 'draft'
                    ? 'This campaign has not started. Draft campaigns can be deleted directly.'
                    : 'Only an active campaign can be stopped.',
                'SCORM_CAMPAIGN_STOP_NOT_ACTIVE',
                409
            );
        }

        // Revoking every campaign registration immediately blocks existing learner
        // player tokens from committing any more score, progress or completion data.
        const [updated] = await ScormRegistration.update(
            { status: 'revoked' },
            {
                where: {
                    campaignId: campaign.id,
                    isPreview: false,
                    status: { [Op.notIn]: ['revoked', 'superseded'] }
                },
                transaction
            }
        );
        stoppedRegistrations = Number(updated || 0);

        campaign.status = 'stopped';
        campaign.endedAt = new Date();
        await campaign.save({ transaction });
        stoppedCampaign = campaign;
    });

    return {
        campaign: {
            id: stoppedCampaign.id,
            name: stoppedCampaign.name,
            status: stoppedCampaign.status,
            startedAt: stoppedCampaign.startedAt || null,
            endedAt: stoppedCampaign.endedAt || null,
            portalPath: null
        },
        stoppedRegistrations
    };
}

async function deleteCampaign({ campaignId, hostId, workspaceId }) {
    let removedId = campaignId;

    await sequelize.transaction(async (transaction) => {
        const campaign = await findCampaignForUpdate({ campaignId, hostId, workspaceId, transaction });

        if (campaign.status === 'active') {
            throw fail(
                'Stop the campaign before deleting it. Stopping closes learner access and stops further tracking.',
                'SCORM_CAMPAIGN_STOP_REQUIRED',
                409
            );
        }
        if (!['draft', 'stopped'].includes(String(campaign.status || '').toLowerCase())) {
            throw fail(
                'Only draft or stopped campaigns can be deleted.',
                'SCORM_CAMPAIGN_DELETE_STATUS_FORBIDDEN',
                409
            );
        }

        // Keep runtime history internally but detach it from the deleted campaign.
        // Revoked registrations are ignored by active learner/tracking queries.
        await ScormRegistration.update(
            { campaignId: null, status: 'revoked' },
            { where: { campaignId: campaign.id }, transaction }
        );

        removedId = campaign.id;
        await campaign.destroy({ transaction });
    });

    return { removed: true, id: removedId };
}

module.exports = {
    stopCampaign,
    deleteCampaign
};
