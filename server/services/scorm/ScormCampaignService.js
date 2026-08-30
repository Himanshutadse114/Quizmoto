const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const User = require('../../models/User');
const {
    ScormCampaign,
    ScormCampaignLearner,
    ScormCampaignCourse,
    ScormCourse,
    ScormRegistration,
    ScormLearnerRoster
} = require('../../models/scorm');
const { getAccessRole } = require('./ScormAccessService');
const { getEntitlement } = require('./ScormEntitlementService');
const {
    getWorkspaceAndConfig,
    verifyGoogleCredential,
    verifyMicrosoftCredential,
    launchLearnerCourse
} = require('./ScormLearnerAuthService');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const MAX_CAMPAIGN_COMBINATIONS = 5000;
const ACTIVE_REGISTRATION_STATUSES = { [Op.notIn]: ['revoked', 'superseded'] };

function fail(message, code, status = 400) {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    return err;
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function parseCsvRows(text) {
    const source = String(text || '').replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < source.length; i += 1) {
        const ch = source[i];
        if (quoted) {
            if (ch === '"' && source[i + 1] === '"') {
                field += '"';
                i += 1;
            } else if (ch === '"') {
                quoted = false;
            } else {
                field += ch;
            }
            continue;
        }
        if (ch === '"') quoted = true;
        else if (ch === ',') {
            row.push(field.trim());
            field = '';
        } else if (ch === '\n') {
            row.push(field.trim());
            field = '';
            if (row.some((item) => item !== '')) rows.push(row);
            row = [];
        } else if (ch !== '\r') {
            field += ch;
        }
    }
    row.push(field.trim());
    if (row.some((item) => item !== '')) rows.push(row);
    return rows;
}

function normalizedHeader(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseCampaignCsv(text) {
    const rows = parseCsvRows(text);
    if (!rows.length) throw fail('The CSV file is empty.', 'SCORM_CAMPAIGN_CSV_EMPTY', 400);

    const headers = rows[0].map(normalizedHeader);
    const emailIndex = headers.findIndex((value) => ['email', 'emailaddress', 'learneremail', 'useremail'].includes(value));
    const nameIndex = headers.findIndex((value) => ['name', 'fullname', 'learnername', 'displayname'].includes(value));
    const firstNameIndex = headers.findIndex((value) => ['firstname', 'givenname'].includes(value));
    const lastNameIndex = headers.findIndex((value) => ['lastname', 'surname', 'familyname'].includes(value));

    if (emailIndex < 0) {
        throw fail('CSV must contain an Email column. Optional columns: Name, First Name, Last Name.', 'SCORM_CAMPAIGN_CSV_EMAIL_COLUMN_REQUIRED', 400);
    }

    const learners = [];
    const invalidRows = [];
    const seen = new Set();
    rows.slice(1).forEach((columns, index) => {
        const email = normalizeEmail(columns[emailIndex]);
        if (!email) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            invalidRows.push({ row: index + 2, email, reason: 'Invalid email address' });
            return;
        }
        if (seen.has(email)) return;
        seen.add(email);
        let learnerName = nameIndex >= 0 ? String(columns[nameIndex] || '').trim() : '';
        if (!learnerName) {
            learnerName = [
                firstNameIndex >= 0 ? String(columns[firstNameIndex] || '').trim() : '',
                lastNameIndex >= 0 ? String(columns[lastNameIndex] || '').trim() : ''
            ].filter(Boolean).join(' ');
        }
        learners.push({ email, learnerName: learnerName.slice(0, 180) || email.split('@')[0] });
    });

    if (!learners.length) {
        throw fail('The CSV does not contain any valid learner email addresses.', 'SCORM_CAMPAIGN_CSV_NO_VALID_LEARNERS', 400);
    }
    return { learners, invalidRows, totalRows: Math.max(0, rows.length - 1) };
}

async function assertLearnerLimit(hostId, emails) {
    const host = await User.findByPk(hostId);
    if (!host?.email) return;
    const role = await getAccessRole(host.email);
    const entitlement = await getEntitlement(host.email, role || 'admin');
    const maxLearners = entitlement?.maxLearners;
    if (maxLearners === null || maxLearners === undefined) return;

    const courses = await ScormCourse.findAll({ where: { hostId }, attributes: ['id'], raw: true });
    const courseIds = courses.map((course) => course.id);
    const existingRows = courseIds.length ? await ScormRegistration.findAll({
        where: {
            courseId: { [Op.in]: courseIds },
            isPreview: false,
            status: ACTIVE_REGISTRATION_STATUSES,
            learnerEmail: { [Op.ne]: null }
        },
        attributes: ['learnerEmail'],
        raw: true
    }) : [];
    const enrolled = new Set(existingRows.map((row) => normalizeEmail(row.learnerEmail)).filter(Boolean));
    const requested = [...new Set((emails || []).map(normalizeEmail).filter(Boolean))];
    const additional = requested.filter((email) => !enrolled.has(email)).length;
    if (enrolled.size + additional > Number(maxLearners)) {
        throw fail(`This campaign would exceed the workspace learner limit (${enrolled.size + additional}/${maxLearners}).`, 'SCORM_LEARNER_LIMIT_REACHED', 403);
    }
}

function registrationStatus(registration) {
    const lesson = String(registration.lastLessonStatus || '').toLowerCase();
    if (registration.status === 'completed' || ['completed', 'passed', 'failed'].includes(lesson)) return 'completed';
    if (registration.status === 'active' || registration.lastCommitAt) return 'in_progress';
    return 'not_started';
}

function serializeRegistration(registration) {
    return {
        registrationId: registration.id,
        courseId: registration.courseId,
        title: registration.course?.title || 'Course',
        description: registration.course?.description || null,
        status: registrationStatus(registration),
        lessonStatus: registration.lastLessonStatus || 'not attempted',
        score: registration.lastScoreRaw == null ? null : Number(registration.lastScoreRaw),
        totalTime: registration.lastTotalTime || null,
        assignedAt: registration.assignedAt || registration.createdAt,
        dueAt: registration.dueAt || null,
        required: registration.required !== false,
        lastActivityAt: registration.lastCommitAt || null
    };
}

async function campaignSummary(campaign) {
    const [learnerCount, courseCount, registrations] = await Promise.all([
        ScormCampaignLearner.count({ where: { campaignId: campaign.id } }),
        ScormCampaignCourse.count({ where: { campaignId: campaign.id } }),
        ScormRegistration.findAll({
            where: { campaignId: campaign.id, isPreview: false, status: ACTIVE_REGISTRATION_STATUSES },
            attributes: ['id', 'status', 'lastLessonStatus', 'lastCommitAt']
        })
    ]);
    const completed = registrations.filter((registration) => registrationStatus(registration) === 'completed').length;
    const inProgress = registrations.filter((registration) => registrationStatus(registration) === 'in_progress').length;
    return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        dueAt: campaign.dueAt || null,
        required: campaign.required !== false,
        createdAt: campaign.createdAt,
        startedAt: campaign.startedAt || null,
        learnerCount,
        courseCount,
        assignmentCount: registrations.length,
        completedCount: completed,
        inProgressCount: inProgress,
        completionPercent: registrations.length ? Math.round((completed / registrations.length) * 100) : 0,
        portalPath: campaign.status === 'active' ? `/campaign/${campaign.id}` : null
    };
}

async function listCampaigns({ hostId, workspaceId }) {
    const rows = await ScormCampaign.findAll({
        where: { hostId, workspaceId },
        order: [['createdAt', 'DESC']]
    });
    const campaigns = [];
    for (const campaign of rows) campaigns.push(await campaignSummary(campaign));
    const courses = await ScormCourse.findAll({
        where: { hostId, status: { [Op.ne]: 'archived' } },
        order: [['createdAt', 'DESC']]
    });
    return {
        campaigns,
        courses: courses.map((course) => ({
            id: course.id,
            title: course.title,
            description: course.description || null,
            status: course.status,
            publishedAt: course.publishedAt || null
        }))
    };
}

async function createCampaign({ workspaceId, hostId, actorUserId, name, csvText, courseIds, dueAt, required = true }) {
    const cleanName = String(name || '').trim().slice(0, 180);
    if (cleanName.length < 2) throw fail('Enter a campaign name.', 'SCORM_CAMPAIGN_NAME_REQUIRED', 400);
    if (!workspaceId) throw fail('Workspace is required.', 'SCORM_WORKSPACE_REQUIRED', 400);
    const parsedDueAt = parseDate(dueAt);
    if (dueAt && !parsedDueAt) throw fail('Enter a valid due date.', 'SCORM_CAMPAIGN_DUE_DATE_INVALID', 400);

    const parsed = parseCampaignCsv(csvText);
    const selectedCourseIds = [...new Set((Array.isArray(courseIds) ? courseIds : []).map(String).filter(Boolean))];
    if (!selectedCourseIds.length) throw fail('Select at least one published course.', 'SCORM_CAMPAIGN_COURSE_REQUIRED', 400);
    if (parsed.learners.length * selectedCourseIds.length > MAX_CAMPAIGN_COMBINATIONS) {
        throw fail(`A campaign can create at most ${MAX_CAMPAIGN_COMBINATIONS} learner-course instances.`, 'SCORM_CAMPAIGN_TOO_LARGE', 413);
    }

    const courses = await ScormCourse.findAll({ where: { id: { [Op.in]: selectedCourseIds }, hostId } });
    if (courses.length !== selectedCourseIds.length) throw fail('One or more selected courses do not belong to this workspace.', 'SCORM_CAMPAIGN_COURSE_INVALID', 400);
    if (courses.some((course) => course.status !== 'published')) {
        throw fail('All campaign courses must be published before the campaign is created.', 'SCORM_CAMPAIGN_COURSE_NOT_PUBLISHED', 409);
    }
    await assertLearnerLimit(hostId, parsed.learners.map((learner) => learner.email));

    const campaign = await sequelize.transaction(async (transaction) => {
        const created = await ScormCampaign.create({
            workspaceId,
            hostId,
            name: cleanName,
            status: 'draft',
            dueAt: parsedDueAt,
            required: required !== false,
            createdByUserId: actorUserId || hostId
        }, { transaction });

        await ScormCampaignLearner.bulkCreate(parsed.learners.map((learner) => ({
            campaignId: created.id,
            email: learner.email,
            learnerName: learner.learnerName
        })), { transaction });

        await ScormCampaignCourse.bulkCreate(selectedCourseIds.map((courseId) => ({
            campaignId: created.id,
            courseId
        })), { transaction });

        for (const learner of parsed.learners) {
            const [roster] = await ScormLearnerRoster.findOrCreate({
                where: { hostId, email: learner.email },
                defaults: { hostId, email: learner.email, learnerName: learner.learnerName },
                transaction
            });
            if (!roster.learnerName && learner.learnerName) {
                roster.learnerName = learner.learnerName;
                await roster.save({ transaction });
            }
        }
        return created;
    });

    return {
        campaign: await campaignSummary(campaign),
        csv: {
            validLearners: parsed.learners.length,
            invalidRows: parsed.invalidRows,
            totalRows: parsed.totalRows
        }
    };
}

async function getCampaignDetail({ campaignId, hostId, workspaceId }) {
    const campaign = await ScormCampaign.findOne({ where: { id: campaignId, hostId, workspaceId } });
    if (!campaign) throw fail('Campaign not found.', 'SCORM_CAMPAIGN_NOT_FOUND', 404);
    const [learners, courseLinks, registrations] = await Promise.all([
        ScormCampaignLearner.findAll({ where: { campaignId }, order: [['learnerName', 'ASC'], ['email', 'ASC']] }),
        ScormCampaignCourse.findAll({ where: { campaignId }, include: [{ model: ScormCourse, as: 'course' }] }),
        ScormRegistration.findAll({
            where: { campaignId, isPreview: false, status: ACTIVE_REGISTRATION_STATUSES },
            include: [{ model: ScormCourse, as: 'course' }],
            order: [['learnerEmail', 'ASC'], ['assignedAt', 'ASC']]
        })
    ]);
    return {
        ...(await campaignSummary(campaign)),
        learners: learners.map((learner) => ({ id: learner.id, email: learner.email, learnerName: learner.learnerName || null })),
        courses: courseLinks.map((link) => ({ id: link.courseId, title: link.course?.title || 'Course', status: link.course?.status || null })),
        registrations: registrations.map((registration) => ({
            ...serializeRegistration(registration),
            learnerEmail: registration.learnerEmail,
            learnerName: registration.learnerName || null
        }))
    };
}

async function startCampaign({ campaignId, hostId, workspaceId, actorUserId }) {
    const { config } = await getWorkspaceAndConfig(workspaceId);
    const googleEnabled = Boolean(config.googleEnabled && config.googleClientId);
    const microsoftEnabled = Boolean(config.microsoftEnabled && config.microsoftClientId && config.microsoftTenantId);
    if (!googleEnabled && !microsoftEnabled) {
        throw fail('Configure Google or Microsoft learner SSO before starting a campaign.', 'SCORM_CAMPAIGN_SSO_REQUIRED', 409);
    }

    let campaign;
    await sequelize.transaction(async (transaction) => {
        campaign = await ScormCampaign.findOne({
            where: { id: campaignId, hostId, workspaceId },
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        if (!campaign) throw fail('Campaign not found.', 'SCORM_CAMPAIGN_NOT_FOUND', 404);
        if (campaign.status !== 'draft') throw fail('Only a draft campaign can be started.', 'SCORM_CAMPAIGN_ALREADY_STARTED', 409);

        const [learners, courseLinks] = await Promise.all([
            ScormCampaignLearner.findAll({ where: { campaignId }, transaction }),
            ScormCampaignCourse.findAll({ where: { campaignId }, transaction })
        ]);
        if (!learners.length || !courseLinks.length) throw fail('Campaign needs learners and courses before it can start.', 'SCORM_CAMPAIGN_EMPTY', 409);
        const courses = await ScormCourse.findAll({ where: { id: { [Op.in]: courseLinks.map((link) => link.courseId) }, hostId }, transaction });
        if (courses.length !== courseLinks.length || courses.some((course) => course.status !== 'published')) {
            throw fail('One or more campaign courses are no longer published.', 'SCORM_CAMPAIGN_COURSE_NOT_PUBLISHED', 409);
        }
        await assertLearnerLimit(hostId, learners.map((learner) => learner.email));

        const now = new Date();
        const registrations = [];
        for (const learner of learners) {
            for (const course of courses) {
                registrations.push({
                    courseId: course.id,
                    campaignId: campaign.id,
                    learnerEmail: learner.email,
                    learnerName: learner.learnerName || learner.email.split('@')[0],
                    status: 'invited',
                    isPreview: false,
                    assignedAt: now,
                    assignedByUserId: actorUserId || hostId,
                    dueAt: campaign.dueAt || null,
                    assignmentSource: 'campaign',
                    required: campaign.required !== false
                });
            }
        }
        await ScormRegistration.bulkCreate(registrations, { transaction });
        campaign.status = 'active';
        campaign.startedAt = now;
        await campaign.save({ transaction });
    });
    return campaignSummary(campaign);
}

async function deleteDraftCampaign({ campaignId, hostId, workspaceId }) {
    const campaign = await ScormCampaign.findOne({ where: { id: campaignId, hostId, workspaceId } });
    if (!campaign) throw fail('Campaign not found.', 'SCORM_CAMPAIGN_NOT_FOUND', 404);
    if (campaign.status !== 'draft') throw fail('Started campaigns are retained for reporting and cannot be deleted.', 'SCORM_CAMPAIGN_DELETE_STARTED_FORBIDDEN', 409);
    await campaign.destroy();
    return { removed: true, id: campaignId };
}

async function getPublicCampaign(campaignId) {
    const campaign = await ScormCampaign.findByPk(campaignId);
    if (!campaign || campaign.status !== 'active') throw fail('Campaign is not active.', 'SCORM_CAMPAIGN_NOT_ACTIVE', 404);
    const { workspace, config } = await getWorkspaceAndConfig(campaign.workspaceId);
    const googleEnabled = Boolean(config.googleEnabled && config.googleClientId);
    const microsoftEnabled = Boolean(config.microsoftEnabled && config.microsoftClientId && config.microsoftTenantId);
    if (!googleEnabled && !microsoftEnabled) throw fail('Campaign SSO is not configured.', 'SCORM_CAMPAIGN_SSO_REQUIRED', 409);
    return {
        campaign,
        workspace,
        config,
        publicConfig: {
            campaignId: campaign.id,
            campaignName: campaign.name,
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            googleEnabled,
            googleClientId: googleEnabled ? config.googleClientId : null,
            microsoftEnabled,
            microsoftClientId: microsoftEnabled ? config.microsoftClientId : null,
            microsoftTenantId: microsoftEnabled ? config.microsoftTenantId : null,
            ssoRequired: true,
            emailEnabled: false
        }
    };
}

function issueCampaignToken({ campaign, workspace, identity }) {
    return jwt.sign({
        typ: 'scorm_campaign_learner',
        campaignId: campaign.id,
        workspaceId: workspace.id,
        hostId: campaign.hostId,
        email: identity.email,
        name: identity.name,
        provider: identity.provider
    }, JWT_SECRET, { expiresIn: '12h' });
}

function verifyCampaignToken(token) {
    try {
        const decoded = jwt.verify(String(token || ''), JWT_SECRET);
        if (decoded.typ !== 'scorm_campaign_learner' || !decoded.campaignId || !decoded.email || !decoded.hostId) throw new Error('invalid campaign token');
        return decoded;
    } catch (_) {
        throw fail('Campaign session expired. Sign in again.', 'SCORM_CAMPAIGN_AUTH_REQUIRED', 401);
    }
}

function campaignAuthMiddleware(req, res, next) {
    try {
        const token = req.header('Authorization')?.replace(/^Bearer\s+/i, '') || '';
        req.scormCampaignLearner = verifyCampaignToken(token);
        next();
    } catch (err) {
        res.status(err.status || 401).json({ message: err.message, code: err.code });
    }
}

async function createCampaignSession({ campaignId, provider, credential }) {
    const { campaign, workspace, config } = await getPublicCampaign(campaignId);
    let identity;
    if (provider === 'google') identity = await verifyGoogleCredential(config, credential);
    else if (provider === 'microsoft') identity = await verifyMicrosoftCredential(config, credential);
    else throw fail('Use Google or Microsoft SSO to enter this campaign.', 'SCORM_CAMPAIGN_SSO_REQUIRED', 403);

    const learner = await ScormCampaignLearner.findOne({ where: { campaignId: campaign.id, email: normalizeEmail(identity.email) } });
    if (!learner) {
        throw fail('Your verified email is not included in this campaign CSV.', 'SCORM_CAMPAIGN_LEARNER_NOT_INCLUDED', 403);
    }
    const token = issueCampaignToken({ campaign, workspace, identity });
    return {
        token,
        learner: { email: identity.email, name: learner.learnerName || identity.name, provider: identity.provider },
        campaign: { id: campaign.id, name: campaign.name },
        workspace: { id: workspace.id, name: workspace.name }
    };
}

async function getCampaignDashboard(context) {
    const { campaign, workspace } = await getPublicCampaign(context.campaignId);
    if (Number(campaign.hostId) !== Number(context.hostId)) throw fail('Campaign access is no longer valid.', 'SCORM_CAMPAIGN_FORBIDDEN', 403);
    const learner = await ScormCampaignLearner.findOne({ where: { campaignId: campaign.id, email: normalizeEmail(context.email) } });
    if (!learner) throw fail('You are no longer included in this campaign.', 'SCORM_CAMPAIGN_LEARNER_NOT_INCLUDED', 403);
    const registrations = await ScormRegistration.findAll({
        where: {
            campaignId: campaign.id,
            learnerEmail: normalizeEmail(context.email),
            isPreview: false,
            status: ACTIVE_REGISTRATION_STATUSES
        },
        include: [{ model: ScormCourse, as: 'course', required: true, where: { hostId: campaign.hostId, status: 'published' } }],
        order: [['assignedAt', 'ASC']]
    });
    return {
        learner: { email: context.email, name: learner.learnerName || context.name || context.email, provider: context.provider },
        campaign: { id: campaign.id, name: campaign.name, dueAt: campaign.dueAt || null, required: campaign.required !== false },
        workspace: { id: workspace.id, name: workspace.name },
        courses: registrations.map(serializeRegistration)
    };
}

async function launchCampaignCourse(context, registrationId) {
    const registration = await ScormRegistration.findByPk(registrationId);
    if (!registration || String(registration.campaignId || '') !== String(context.campaignId) || normalizeEmail(registration.learnerEmail) !== normalizeEmail(context.email)) {
        throw fail('This course does not belong to your campaign assignment.', 'SCORM_CAMPAIGN_ASSIGNMENT_FORBIDDEN', 403);
    }
    return launchLearnerCourse(context, registrationId);
}

module.exports = {
    parseCampaignCsv,
    listCampaigns,
    createCampaign,
    getCampaignDetail,
    startCampaign,
    deleteDraftCampaign,
    getPublicCampaign,
    campaignAuthMiddleware,
    createCampaignSession,
    getCampaignDashboard,
    launchCampaignCourse
};
