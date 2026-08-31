const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const {
    ScormWorkspace,
    ScormWorkspaceAuthConfig,
    ScormRegistration,
    ScormCourse
} = require('../../models/scorm');
const {
    normalizeEmail,
    normalizeDomains,
    getWorkspaceAndConfig,
    serializeAuthConfig
} = require('./ScormLearnerAuthService');

const SHARED_PUBLIC_DOMAINS = new Set([
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'outlook.com',
    'hotmail.com', 'live.com', 'icloud.com', 'me.com', 'proton.me', 'protonmail.com'
]);

function fail(message, code, status = 400) {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    return err;
}

function emailDomain(email) {
    return normalizeEmail(email).split('@')[1] || '';
}

function parseDomains(value) {
    if (!value) return [];
    try {
        return normalizeDomains(JSON.parse(value));
    } catch (_) {
        return normalizeDomains(value);
    }
}

async function workspacesFromAssignments(email) {
    const normalized = normalizeEmail(email);
    const rows = await ScormRegistration.findAll({
        where: {
            isPreview: false,
            status: { [Op.notIn]: ['revoked', 'superseded'] },
            [Op.and]: [
                sequelize.where(sequelize.fn('LOWER', sequelize.col('learnerEmail')), normalized)
            ]
        },
        attributes: ['id'],
        include: [{
            model: ScormCourse,
            as: 'course',
            required: true,
            where: { status: 'published' },
            attributes: ['hostId']
        }]
    });

    const hostIds = [...new Set(rows.map((row) => Number(row.course?.hostId)).filter(Number.isFinite))];
    if (!hostIds.length) return [];
    return ScormWorkspace.findAll({
        where: { ownerUserId: { [Op.in]: hostIds }, status: 'active' }
    });
}

async function workspacesFromDomain(domain) {
    if (!domain || SHARED_PUBLIC_DOMAINS.has(domain)) return [];
    const configs = await ScormWorkspaceAuthConfig.findAll();
    const ids = configs
        .filter((config) => {
            const domains = new Set([
                ...parseDomains(config.allowedDomainsJson),
                ...parseDomains(config.staffAllowedDomainsJson)
            ]);
            return domains.has(domain);
        })
        .map((config) => config.workspaceId);
    if (!ids.length) return [];
    return ScormWorkspace.findAll({ where: { id: { [Op.in]: ids }, status: 'active' } });
}

async function discoverLearnerPolicy(email) {
    const normalized = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        throw fail('Enter your assigned learner email address.', 'SCORM_LEARNER_EMAIL_REQUIRED', 400);
    }

    let source = 'assignment';
    let matches = await workspacesFromAssignments(normalized);
    if (!matches.length) {
        source = 'domain';
        matches = await workspacesFromDomain(emailDomain(normalized));
    }

    if (matches.length > 1) {
        throw fail(
            'This email is linked to more than one LMSGEN organisation. Ask your administrator for the correct tenant invitation.',
            'SCORM_LEARNER_WORKSPACE_AMBIGUOUS',
            409
        );
    }
    if (!matches.length) {
        throw fail(
            'We could not find an active LMSGEN learning assignment for this email.',
            'SCORM_LEARNER_WORKSPACE_NOT_FOUND',
            404
        );
    }

    const { workspace, config } = await getWorkspaceAndConfig(matches[0].id);
    return {
        workspace,
        config,
        source,
        publicConfig: serializeAuthConfig(config, { workspace, publicView: true })
    };
}

module.exports = { discoverLearnerPolicy };
