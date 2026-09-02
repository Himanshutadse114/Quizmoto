const { sequelize } = require('../../config/database');
const logger = require('../../utils/logger');

let started = false;
let promise = null;

const INDEXES = [
    {
        table: 'scorm_campaigns',
        fields: ['workspaceId', 'hostId', 'createdAt'],
        name: 'scorm_campaigns_workspace_host_created_idx'
    },
    {
        table: 'scorm_campaigns',
        fields: ['workspaceId', 'hostId', 'status'],
        name: 'scorm_campaigns_workspace_host_status_idx'
    },
    {
        table: 'scorm_courses',
        fields: ['hostId', 'status', 'createdAt'],
        name: 'scorm_courses_host_status_created_idx'
    },
    {
        table: 'scorm_registrations',
        fields: ['campaignId', 'isPreview', 'status', 'learnerEmail'],
        name: 'scorm_registrations_campaign_learner_runtime_idx'
    }
];

async function ensureIndex(queryInterface, spec) {
    const indexes = await queryInterface.showIndex(spec.table);
    if ((indexes || []).some((index) => index.name === spec.name)) return false;
    await queryInterface.addIndex(spec.table, spec.fields, { name: spec.name });
    return true;
}

async function ensureCampaignPerformanceIndexes() {
    const queryInterface = sequelize.getQueryInterface();
    const created = [];
    for (const spec of INDEXES) {
        try {
            if (await ensureIndex(queryInterface, spec)) created.push(spec.name);
        } catch (error) {
            // Index creation is an optimisation, not a reason to take the LMS
            // offline. Log the exact index and allow the application to start.
            logger.warn('scorm_campaign_performance_index_failed', {
                module: 'scorm',
                index: spec.name,
                error: error.message
            });
        }
    }
    if (created.length) {
        logger.info('scorm_campaign_performance_indexes_created', {
            module: 'scorm',
            indexes: created
        });
    }
    return created;
}

function startCampaignPerformanceIndexEnsure() {
    if (started) return promise;
    started = true;
    promise = ensureCampaignPerformanceIndexes().catch((error) => {
        logger.warn('scorm_campaign_performance_index_bootstrap_failed', {
            module: 'scorm',
            error: error.message
        });
        return [];
    });
    return promise;
}

module.exports = {
    ensureCampaignPerformanceIndexes,
    startCampaignPerformanceIndexEnsure
};
