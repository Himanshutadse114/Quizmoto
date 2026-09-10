const crypto = require('crypto');
const { Op } = require('sequelize');
const User = require('../../models/User');
const Flipbook = require('../../models/Flipbook');
const FlipbookTenantLink = require('../../models/FlipbookTenantLink');
const FlipbookReaderSession = require('../../models/FlipbookReaderSession');
const FlipbookReaderContext = require('../../models/FlipbookReaderContext');
const ScormCampaignFlipbook = require('../../models/scorm/ScormCampaignFlipbook');
const ScormFlipbookAssignment = require('../../models/scorm/ScormFlipbookAssignment');
const {
    ScormCampaign,
    ScormCampaignLearner,
    ScormCourse,
    ScormWorkspaceMember
} = require('../../models/scorm');
const { linkFlipbookToTenant, ensureFlipbookTenantSchema } = require('../FlipbookTenantService');

const PUBLIC_APP_URL = String(
    process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || 'https://www.lmsgen.in'
).replace(/\/+$/, '');
let schemaPromise = null;

function fail(message, code, status = 400) {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    return err;
}

function normaliseEmail(value) {
    return String(value || '').trim().toLowerCase();
}

async function ensureFlipbookAssignmentSchema() {
    if (!schemaPromise) {
        schemaPromise = Promise.all([
            ensureFlipbookTenantSchema(),
            ScormCampaignFlipbook.sync(),
            ScormFlipbookAssignment.sync(),
            FlipbookReaderContext.sync()
        ]).catch((err) => {
            schemaPromise = null;
            throw err;
        });
    }
    await schemaPromise;
}

async function backfillWorkspaceFlipbookLinks(workspaceId, hostId) {
    await ensureFlipbookAssignmentSchema();
    const members = await ScormWorkspaceMember.findAll({
        where: { workspaceId, status: { [Op.ne]: 'disabled' }, userId: { [Op.ne]: null } },
        attributes: ['userId', 'email'],
        raw: true
    });
    if (!members.length) return;
    const users = await User.findAll({ where: { id: { [Op.in]: members.map((member) => member.userId) } } });
    for (const user of users) {
        const books = await Flipbook.findAll({ where: { ownerUserId: user.id } });
        for (const book of books) {
            const existing = await FlipbookTenantLink.findOne({ where: { flipbookId: book.id } });
            if (existing) continue;
            await linkFlipbookToTenant({
                flipbook: book,
                user,
                scope: { mode: 'tenant', workspaceId, hostId, workspace: null, member: null }
            });
        }
    }
}

async function listPublishedTenantFlipbooks({ workspaceId, hostId }) {
    await backfillWorkspaceFlipbookLinks(workspaceId, hostId);
    const links = await FlipbookTenantLink.findAll({ where: { workspaceId }, attributes: ['flipbookId'], raw: true });
    const ids = links.map((row) => row.flipbookId);
    if (!ids.length) return [];
    const books = await Flipbook.findAll({
        where: { id: { [Op.in]: ids }, status: 'published', shareEnabled: true },
        order: [['publishedAt', 'DESC'], ['updatedAt', 'DESC']]
    });
    return books.map((book) => ({
        id: book.id,
        title: book.title,
        description: book.description || null,
        pageCount: Number(book.pageCount || 0),
        publishedAt: book.publishedAt || null,
        viewCount: Number(book.viewCount || 0)
    }));
}

function normaliseSelections(value) {
    const input = Array.isArray(value) ? value : [];
    const seen = new Set();
    const output = [];
    for (const raw of input) {
        const flipbookId = String(typeof raw === 'string' ? raw : raw?.flipbookId || '').trim();
        if (!flipbookId || seen.has(flipbookId)) continue;
        seen.add(flipbookId);
        output.push({
            flipbookId,
            courseId: String(typeof raw === 'object' && raw?.courseId ? raw.courseId : '').trim() || null,
            required: typeof raw === 'object' ? raw.required !== false : true
        });
    }
    return output;
}

async function validateSelections({ workspaceId, hostId, selections }) {
    const normalized = normaliseSelections(selections);
    if (!normalized.length) return [];
    const available = await listPublishedTenantFlipbooks({ workspaceId, hostId });
    const availableIds = new Set(available.map((book) => String(book.id)));
    const invalid = normalized.filter((item) => !availableIds.has(String(item.flipbookId)));
    if (invalid.length) throw fail('One or more selected Flipbooks are not published tenant Flipbooks.', 'SCORM_FLIPBOOK_ASSIGNMENT_INVALID', 400);

    const courseIds = [...new Set(normalized.map((item) => item.courseId).filter(Boolean))];
    if (courseIds.length) {
        const courses = await ScormCourse.findAll({ where: { id: { [Op.in]: courseIds }, hostId } });
        if (courses.length !== courseIds.length) throw fail('A Flipbook is linked to a course outside this tenant.', 'SCORM_FLIPBOOK_COURSE_INVALID', 400);
    }
    return normalized;
}

async function saveCampaignFlipbooks({ campaign, selections }) {
    await ensureFlipbookAssignmentSchema();
    const normalized = await validateSelections({
        workspaceId: campaign.workspaceId,
        hostId: campaign.hostId,
        selections
    });
    await ScormCampaignFlipbook.destroy({ where: { campaignId: campaign.id } });
    if (!normalized.length) return [];
    return ScormCampaignFlipbook.bulkCreate(normalized.map((item) => ({
        campaignId: campaign.id,
        flipbookId: item.flipbookId,
        courseId: item.courseId,
        required: item.required
    })));
}

async function campaignFlipbooks(campaignId) {
    await ensureFlipbookAssignmentSchema();
    const links = await ScormCampaignFlipbook.findAll({ where: { campaignId }, order: [['createdAt', 'ASC']] });
    if (!links.length) return [];
    const books = await Flipbook.findAll({ where: { id: { [Op.in]: links.map((link) => link.flipbookId) } } });
    const map = new Map(books.map((book) => [String(book.id), book]));
    return links.map((link) => {
        const book = map.get(String(link.flipbookId));
        return {
            id: link.id,
            flipbookId: link.flipbookId,
            courseId: link.courseId || null,
            required: link.required !== false,
            title: book?.title || 'Flipbook',
            description: book?.description || null,
            pageCount: Number(book?.pageCount || 0),
            status: book?.status || null
        };
    });
}

function createAssignmentToken() {
    return crypto.randomBytes(24).toString('hex');
}

async function createCampaignAssignments({ campaignId, actorUserId = null }) {
    await ensureFlipbookAssignmentSchema();
    const campaign = await ScormCampaign.findByPk(campaignId);
    if (!campaign) throw fail('Campaign not found.', 'SCORM_CAMPAIGN_NOT_FOUND', 404);
    const [learners, links] = await Promise.all([
        ScormCampaignLearner.findAll({ where: { campaignId } }),
        ScormCampaignFlipbook.findAll({ where: { campaignId } })
    ]);
    if (!links.length || !learners.length) return { created: 0 };

    let created = 0;
    for (const learner of learners) {
        const email = normaliseEmail(learner.email);
        for (const link of links) {
            const existing = await ScormFlipbookAssignment.findOne({
                where: {
                    campaignId,
                    flipbookId: link.flipbookId,
                    learnerEmail: email,
                    status: { [Op.ne]: 'revoked' }
                }
            });
            if (existing) continue;
            await ScormFlipbookAssignment.create({
                workspaceId: campaign.workspaceId,
                hostId: campaign.hostId,
                campaignId,
                courseId: link.courseId || null,
                flipbookId: link.flipbookId,
                learnerEmail: email,
                learnerName: learner.learnerName || null,
                assignmentToken: createAssignmentToken(),
                status: 'assigned',
                required: link.required !== false && campaign.required !== false,
                assignedAt: new Date(),
                dueAt: campaign.dueAt || null,
                createdByUserId: actorUserId || campaign.createdByUserId || campaign.hostId
            });
            created += 1;
        }
    }
    return { created };
}

async function resolveAssignmentToken({ token, flipbookId = null }) {
    await ensureFlipbookAssignmentSchema();
    const where = { assignmentToken: String(token || ''), status: { [Op.ne]: 'revoked' } };
    if (flipbookId) where.flipbookId = flipbookId;
    const assignment = await ScormFlipbookAssignment.findOne({ where });
    if (!assignment) throw fail('This Flipbook assignment is no longer available.', 'SCORM_FLIPBOOK_ASSIGNMENT_NOT_FOUND', 404);
    const campaign = assignment.campaignId ? await ScormCampaign.findByPk(assignment.campaignId) : null;
    if (campaign && campaign.status !== 'active') throw fail('This learning campaign is not active.', 'SCORM_CAMPAIGN_NOT_ACTIVE', 403);
    return assignment;
}

async function attachReaderContext({ sessionId, assignment = null, flipbookId, sourceType = 'public_share' }) {
    await ensureFlipbookAssignmentSchema();
    if (!sessionId) return null;
    const defaults = {
        sessionId,
        assignmentId: assignment?.id || null,
        workspaceId: assignment?.workspaceId || null,
        campaignId: assignment?.campaignId || null,
        courseId: assignment?.courseId || null,
        flipbookId,
        sourceType: assignment ? 'assignment' : sourceType
    };
    const [context] = await FlipbookReaderContext.findOrCreate({ where: { sessionId }, defaults });
    return context;
}

async function updateAssignmentFromSession(sessionId) {
    await ensureFlipbookAssignmentSchema();
    const context = await FlipbookReaderContext.findOne({ where: { sessionId } });
    if (!context?.assignmentId) return null;
    const [assignment, session] = await Promise.all([
        ScormFlipbookAssignment.findByPk(context.assignmentId),
        FlipbookReaderSession.findByPk(sessionId)
    ]);
    if (!assignment || !session) return null;
    const pageCount = Math.max(0, Number(session.pageCount || 0));
    const pages = Array.isArray(session.uniquePages) ? session.uniquePages.length : 0;
    const complete = Boolean(session.completedAt) || (pageCount > 0 && pages >= pageCount);
    assignment.status = complete ? 'completed' : pages > 0 ? 'in_progress' : 'assigned';
    assignment.startedAt = assignment.startedAt || session.startedAt || new Date();
    assignment.lastActivityAt = session.lastSeenAt || new Date();
    if (complete) assignment.completedAt = assignment.completedAt || session.completedAt || new Date();
    await assignment.save();
    return assignment;
}

async function assignmentProgress(assignment) {
    const contexts = await FlipbookReaderContext.findAll({ where: { assignmentId: assignment.id }, attributes: ['sessionId'], raw: true });
    const sessionIds = contexts.map((row) => row.sessionId);
    const sessions = sessionIds.length ? await FlipbookReaderSession.findAll({ where: { id: { [Op.in]: sessionIds } } }) : [];
    const pages = new Set();
    let activeSeconds = 0;
    let lastSeenAt = assignment.lastActivityAt || null;
    for (const session of sessions) {
        (Array.isArray(session.uniquePages) ? session.uniquePages : []).forEach((page) => pages.add(Number(page)));
        activeSeconds += Number(session.durationSeconds || 0);
        if (!lastSeenAt || new Date(session.lastSeenAt) > new Date(lastSeenAt)) lastSeenAt = session.lastSeenAt;
    }
    const book = await Flipbook.findByPk(assignment.flipbookId);
    const pageCount = Math.max(0, Number(book?.pageCount || 0));
    const progressPercent = pageCount ? Math.min(100, Math.round((pages.size / pageCount) * 100)) : 0;
    return { book, sessions, pagesReached: pages.size, pageCount, progressPercent, activeSeconds, lastSeenAt };
}

async function getCampaignDashboardFlipbooks(context) {
    await ensureFlipbookAssignmentSchema();
    const email = normaliseEmail(context.email);
    const assignments = await ScormFlipbookAssignment.findAll({
        where: {
            campaignId: context.campaignId,
            learnerEmail: email,
            status: { [Op.ne]: 'revoked' }
        },
        order: [['assignedAt', 'ASC']]
    });
    const rows = [];
    for (const assignment of assignments) {
        const progress = await assignmentProgress(assignment);
        if (!progress.book || progress.book.status !== 'published' || !progress.book.shareEnabled) continue;
        rows.push({
            assignmentId: assignment.id,
            flipbookId: assignment.flipbookId,
            courseId: assignment.courseId || null,
            title: progress.book.title,
            description: progress.book.description || null,
            pageCount: progress.pageCount,
            pagesReached: progress.pagesReached,
            progressPercent: progress.progressPercent,
            status: assignment.status,
            required: assignment.required !== false,
            dueAt: assignment.dueAt || null,
            completedAt: assignment.completedAt || null,
            activeSeconds: progress.activeSeconds,
            lastActivityAt: progress.lastSeenAt
        });
    }
    return rows;
}

async function launchCampaignFlipbook(context, assignmentId) {
    await ensureFlipbookAssignmentSchema();
    const assignment = await ScormFlipbookAssignment.findOne({
        where: {
            id: assignmentId,
            campaignId: context.campaignId,
            learnerEmail: normaliseEmail(context.email),
            status: { [Op.ne]: 'revoked' }
        }
    });
    if (!assignment) throw fail('Flipbook assignment not found.', 'SCORM_FLIPBOOK_ASSIGNMENT_NOT_FOUND', 404);
    const book = await Flipbook.findOne({ where: { id: assignment.flipbookId, status: 'published', shareEnabled: true } });
    if (!book) throw fail('This Flipbook is no longer published.', 'SCORM_FLIPBOOK_NOT_AVAILABLE', 404);
    return {
        assignmentId: assignment.id,
        flipbookId: book.id,
        title: book.title,
        url: `${PUBLIC_APP_URL}/flipbook/${book.shareToken}?source=campaign&assignment=${encodeURIComponent(assignment.assignmentToken)}`
    };
}

async function listAssignmentAnalytics({ workspaceId = null, campaignId = null, courseId = null, flipbookId = null }) {
    await ensureFlipbookAssignmentSchema();
    const where = { status: { [Op.ne]: 'revoked' } };
    if (workspaceId) where.workspaceId = workspaceId;
    if (campaignId) where.campaignId = campaignId;
    if (courseId) where.courseId = courseId;
    if (flipbookId) where.flipbookId = flipbookId;
    const assignments = await ScormFlipbookAssignment.findAll({ where, order: [['assignedAt', 'DESC']] });
    const rows = [];
    for (const assignment of assignments) {
        const progress = await assignmentProgress(assignment);
        rows.push({
            id: assignment.id,
            workspaceId: assignment.workspaceId,
            campaignId: assignment.campaignId || null,
            courseId: assignment.courseId || null,
            flipbookId: assignment.flipbookId,
            flipbookTitle: progress.book?.title || 'Flipbook',
            learnerEmail: assignment.learnerEmail,
            learnerName: assignment.learnerName || null,
            status: assignment.status,
            required: assignment.required !== false,
            assignedAt: assignment.assignedAt,
            dueAt: assignment.dueAt || null,
            completedAt: assignment.completedAt || null,
            pagesReached: progress.pagesReached,
            pageCount: progress.pageCount,
            progressPercent: progress.progressPercent,
            activeSeconds: progress.activeSeconds,
            sessionCount: progress.sessions.length,
            lastActivityAt: progress.lastSeenAt
        });
    }
    return rows;
}

module.exports = {
    ensureFlipbookAssignmentSchema,
    listPublishedTenantFlipbooks,
    validateSelections,
    saveCampaignFlipbooks,
    campaignFlipbooks,
    createCampaignAssignments,
    resolveAssignmentToken,
    attachReaderContext,
    updateAssignmentFromSession,
    getCampaignDashboardFlipbooks,
    launchCampaignFlipbook,
    listAssignmentAnalytics
};
