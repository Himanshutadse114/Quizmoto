const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const {
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
} = require('../../models/scorm');
const ScormCampaignFlipbook = require('../../models/scorm/ScormCampaignFlipbook');
const ScormFlipbookAssignment = require('../../models/scorm/ScormFlipbookAssignment');
const FlipbookReaderContext = require('../../models/FlipbookReaderContext');
const FlipbookReaderEvent = require('../../models/FlipbookReaderEvent');
const FlipbookReaderSession = require('../../models/FlipbookReaderSession');
const { ensureFlipbookAssignmentSchema } = require('./ScormFlipbookAssignmentService');
const { ensureVideoSchema } = require('./ScormVideoService');

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
    let removedRegistrations = 0;
    let removedFlipbookAssignments = 0;
    let removedReaderSessions = 0;

    await Promise.all([ensureFlipbookAssignmentSchema(), ensureVideoSchema()]);

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

        // A permanent campaign deletion removes its learner runtime history as
        // well as the campaign shell. Keeping this in one transaction prevents
        // partially deleted campaigns and immediately invalidates learner links.
        const registrations = await ScormRegistration.findAll({
            where: { campaignId: campaign.id },
            attributes: ['id'],
            raw: true,
            transaction
        });
        const registrationIds = registrations.map((row) => row.id);
        if (registrationIds.length) {
            const registrationWhere = { registrationId: { [Op.in]: registrationIds } };
            await Promise.all([
                ScormCmiState.destroy({ where: registrationWhere, transaction }),
                ScormRuntimeSnapshot.destroy({ where: registrationWhere, transaction }),
                ScormXapiStatement.destroy({ where: registrationWhere, transaction })
            ]);
            await ScormAttempt.destroy({ where: registrationWhere, transaction });
            removedRegistrations = await ScormRegistration.destroy({
                where: { id: { [Op.in]: registrationIds } },
                transaction
            });
        }

        const flipbookAssignments = await ScormFlipbookAssignment.findAll({
            where: { campaignId: campaign.id },
            attributes: ['id'],
            raw: true,
            transaction
        });
        const assignmentIds = flipbookAssignments.map((row) => row.id);
        const contextClauses = [{ campaignId: campaign.id }];
        if (assignmentIds.length) contextClauses.push({ assignmentId: { [Op.in]: assignmentIds } });
        const readerContexts = await FlipbookReaderContext.findAll({
            where: { [Op.or]: contextClauses },
            attributes: ['sessionId'],
            raw: true,
            transaction
        });
        const readerSessionIds = [...new Set(readerContexts.map((row) => row.sessionId).filter(Boolean))];
        if (readerSessionIds.length) {
            await FlipbookReaderEvent.destroy({
                where: { sessionId: { [Op.in]: readerSessionIds } },
                transaction
            });
            await FlipbookReaderContext.destroy({
                where: { sessionId: { [Op.in]: readerSessionIds } },
                transaction
            });
            removedReaderSessions = await FlipbookReaderSession.destroy({
                where: { id: { [Op.in]: readerSessionIds } },
                transaction
            });
        }
        removedFlipbookAssignments = await ScormFlipbookAssignment.destroy({
            where: { campaignId: campaign.id },
            transaction
        });

        await Promise.all([
            ScormCampaignFlipbook.destroy({ where: { campaignId: campaign.id }, transaction }),
            ScormCampaignVideo.destroy({ where: { campaignId: campaign.id }, transaction }),
            ScormVideoProgress.destroy({ where: { campaignId: campaign.id }, transaction }),
            ScormCampaignCourse.destroy({ where: { campaignId: campaign.id }, transaction }),
            ScormCampaignLearner.destroy({ where: { campaignId: campaign.id }, transaction })
        ]);

        removedId = campaign.id;
        await campaign.destroy({ transaction });
    });

    return {
        removed: true,
        id: removedId,
        removedRegistrations: Number(removedRegistrations || 0),
        removedFlipbookAssignments: Number(removedFlipbookAssignments || 0),
        removedReaderSessions: Number(removedReaderSessions || 0)
    };
}

module.exports = {
    stopCampaign,
    deleteCampaign
};
