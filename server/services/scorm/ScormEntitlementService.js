const { Op } = require('sequelize');
const User = require('../../models/User');
const ScormUserEntitlement = require('../../models/scorm/ScormUserEntitlement');
const {
    ScormCourse,
    ScormLearnerRoster,
    ScormRegistration,
    ScormCampaign,
    ScormWorkspace,
    ScormWorkspaceMember
} = require('../../models/scorm');

const INACTIVE_ASSIGNMENT_STATUSES = ['revoked', 'superseded'];

const DEFAULT_PERMISSIONS = Object.freeze({
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
});

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeLimit(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.max(0, Math.floor(number));
}

function normalizePermissions(value) {
    const input = value && typeof value === 'object' ? value : {};
    return Object.fromEntries(
        Object.entries(DEFAULT_PERMISSIONS).map(([key, defaultValue]) => [
            key,
            input[key] === undefined ? defaultValue : Boolean(input[key])
        ])
    );
}

function serializeEntitlement(row, role = 'user') {
    if (role === 'super_admin') {
        return {
            maxCourses: null,
            maxLearners: null,
            maxStaff: null,
            maxCampaigns: null,
            maxAssignments: null,
            permissions: { ...DEFAULT_PERMISSIONS },
            unlimited: true,
            protected: true
        };
    }
    return {
        maxCourses: normalizeLimit(row?.maxCourses),
        maxLearners: normalizeLimit(row?.maxLearners),
        maxStaff: normalizeLimit(row?.maxStaff),
        maxCampaigns: normalizeLimit(row?.maxCampaigns),
        maxAssignments: normalizeLimit(row?.maxAssignments),
        permissions: normalizePermissions(row?.permissions),
        unlimited: false,
        protected: false
    };
}

function entitlementDefaults(email) {
    return {
        email,
        maxCourses: null,
        maxLearners: null,
        maxStaff: null,
        maxCampaigns: null,
        maxAssignments: null,
        permissions: { ...DEFAULT_PERMISSIONS }
    };
}

async function getEntitlement(email, role = 'user') {
    const normalized = normalizeEmail(email);
    if (role === 'super_admin') return serializeEntitlement(null, role);
    if (!normalized) return serializeEntitlement(null, role);
    const [row] = await ScormUserEntitlement.findOrCreate({ where: { email: normalized }, defaults: entitlementDefaults(normalized) });
    const normalizedPermissions = normalizePermissions(row.permissions);
    if (JSON.stringify(normalizedPermissions) !== JSON.stringify(row.permissions || {})) {
        row.permissions = normalizedPermissions;
        await row.save();
    }
    return serializeEntitlement(row, role);
}

async function updateEntitlement(email, patch = {}, actor = {}) {
    const normalized = normalizeEmail(email);
    if (!normalized) throw new Error('Entitlement owner email is required.');
    const [row] = await ScormUserEntitlement.findOrCreate({ where: { email: normalized }, defaults: entitlementDefaults(normalized) });
    for (const field of ['maxCourses', 'maxLearners', 'maxStaff', 'maxCampaigns', 'maxAssignments']) {
        if (Object.prototype.hasOwnProperty.call(patch, field)) row[field] = normalizeLimit(patch[field]);
    }
    row.permissions = patch.permissions && typeof patch.permissions === 'object'
        ? normalizePermissions({ ...normalizePermissions(row.permissions), ...patch.permissions })
        : normalizePermissions(row.permissions);
    row.updatedByUserId = actor.userId || null;
    row.updatedByEmail = normalizeEmail(actor.email) || null;
    await row.save();
    return serializeEntitlement(row, 'user');
}

async function courseIdsForHost(hostId) {
    const courses = await ScormCourse.findAll({ where: { hostId }, attributes: ['id'], raw: true });
    return courses.map((course) => course.id);
}

async function enrolledLearnerCount(hostId) {
    const courseIds = await courseIdsForHost(hostId);
    if (!courseIds.length) return 0;
    return ScormRegistration.count({
        distinct: true,
        col: 'learnerEmail',
        where: {
            courseId: { [Op.in]: courseIds },
            isPreview: false,
            status: { [Op.notIn]: INACTIVE_ASSIGNMENT_STATUSES },
            learnerEmail: { [Op.ne]: null }
        }
    });
}

async function activeAssignmentCount(hostId) {
    const courseIds = await courseIdsForHost(hostId);
    if (!courseIds.length) return 0;
    return ScormRegistration.count({
        where: {
            courseId: { [Op.in]: courseIds },
            isPreview: false,
            status: { [Op.notIn]: INACTIVE_ASSIGNMENT_STATUSES }
        }
    });
}

async function getUsageForHost(hostId, workspaceId = null) {
    if (!hostId) return { courseCreations: 0, activeCourses: 0, learners: 0, rosterLearners: 0, staff: 0, campaigns: 0, assignments: 0 };
    let resolvedWorkspaceId = workspaceId;
    if (!resolvedWorkspaceId) {
        const workspace = await ScormWorkspace.findOne({ where: { ownerUserId: hostId }, attributes: ['id'], raw: true });
        resolvedWorkspaceId = workspace?.id || null;
    }
    const [courseCreations, activeCourses, learners, rosterLearners, staff, campaigns, assignments] = await Promise.all([
        ScormCourse.count({ where: { hostId } }),
        ScormCourse.count({ where: { hostId, status: { [Op.ne]: 'archived' } } }),
        enrolledLearnerCount(hostId),
        ScormLearnerRoster.count({ where: { hostId } }),
        resolvedWorkspaceId ? ScormWorkspaceMember.count({ where: { workspaceId: resolvedWorkspaceId } }) : 0,
        resolvedWorkspaceId ? ScormCampaign.count({ where: { workspaceId: resolvedWorkspaceId } }) : 0,
        activeAssignmentCount(hostId)
    ]);
    return { courseCreations, activeCourses, learners, rosterLearners, staff, campaigns, assignments };
}

async function getUsageForEmail(email) {
    const normalized = normalizeEmail(email);
    const user = normalized ? await User.findOne({ where: { email: normalized } }) : null;
    if (!user) return { courses: 0, courseCreations: 0, activeCourses: 0, learners: 0, rosterLearners: 0, staff: 0, campaigns: 0, assignments: 0 };
    const usage = await getUsageForHost(user.id);
    return { ...usage, courses: usage.activeCourses };
}

function deny(message, code) {
    const err = new Error(message);
    err.code = code;
    err.status = 403;
    return err;
}

function capabilityForRequest(req) {
    const path = String(req.originalUrl || '').split('?')[0];
    const method = String(req.method || 'GET').toUpperCase();
    if (path.startsWith('/api/scorm/author')) return 'courseAuthoring';
    if (path.startsWith('/api/scorm/content') || path.startsWith('/api/scorm/slide-preview')) return 'contentEditor';
    if (path.startsWith('/api/scorm/roster')) return 'learnerRoster';
    if (path.startsWith('/api/scorm/tracking')) return 'learnerTracking';
    if (path.startsWith('/api/scorm/assignments')) return 'assignments';
    if (path.startsWith('/api/scorm/campaigns')) return 'campaigns';
    if (path.startsWith('/api/scorm/team')) return 'teamManagement';
    if (path.startsWith('/api/scorm/learner-access')) return 'ssoManagement';
    if (path.startsWith('/api/scorm/packages')) return 'library';
    if (path.startsWith('/api/scorm/courses/reports') || /\/api\/scorm\/courses\/[^/]+\/report$/.test(path)) return 'reports';
    if (/\/api\/scorm\/courses\/[^/]+\/preview$/.test(path) && method === 'POST') return 'coursePreview';
    if (/\/api\/scorm\/courses\/[^/]+$/.test(path) && method === 'PATCH' && req.body?.status === 'published') return 'coursePublishing';
    return null;
}

async function assertCourseLimit(hostId, entitlement) {
    const max = normalizeLimit(entitlement?.maxCourses);
    if (max === null) return;
    const consumed = await ScormCourse.count({ where: { hostId } });
    if (consumed >= max) {
        throw deny(`Course creation allowance reached (${consumed}/${max}). Deleted or archived courses still count towards the tenant's lifetime allowance.`, 'SCORM_COURSE_LIMIT_REACHED');
    }
}

async function assertStaffLimit(workspaceId, entitlement) {
    const max = normalizeLimit(entitlement?.maxStaff);
    if (max === null || !workspaceId) return;
    const current = await ScormWorkspaceMember.count({ where: { workspaceId } });
    if (current >= max) throw deny(`Tenant staff limit reached (${current}/${max}).`, 'SCORM_STAFF_LIMIT_REACHED');
}

async function assertCampaignLimit(workspaceId, entitlement) {
    const max = normalizeLimit(entitlement?.maxCampaigns);
    if (max === null || !workspaceId) return;
    const current = await ScormCampaign.count({ where: { workspaceId } });
    if (current >= max) throw deny(`Tenant campaign limit reached (${current}/${max}).`, 'SCORM_CAMPAIGN_LIMIT_REACHED');
}

async function assertAssignmentLimit(hostId, req, entitlement) {
    const max = normalizeLimit(entitlement?.maxAssignments);
    if (max === null) return;
    const learnerIds = [...new Set((Array.isArray(req.body?.learnerIds) ? req.body.learnerIds : []).map(String).filter(Boolean))];
    const courseIds = [...new Set((Array.isArray(req.body?.courseIds) ? req.body.courseIds : []).map(String).filter(Boolean))];
    if (!learnerIds.length || !courseIds.length) return;

    const [learners, courses] = await Promise.all([
        ScormLearnerRoster.findAll({ where: { id: { [Op.in]: learnerIds }, hostId }, attributes: ['id', 'email'], raw: true }),
        ScormCourse.findAll({ where: { id: { [Op.in]: courseIds }, hostId }, attributes: ['id'], raw: true })
    ]);
    if (learners.length !== learnerIds.length || courses.length !== courseIds.length) return;

    const emails = [...new Set(learners.map((learner) => normalizeEmail(learner.email)).filter(Boolean))];
    const existingRows = await ScormRegistration.findAll({
        where: {
            courseId: { [Op.in]: courseIds },
            isPreview: false,
            status: { [Op.notIn]: INACTIVE_ASSIGNMENT_STATUSES },
            learnerEmail: { [Op.ne]: null }
        },
        attributes: ['courseId', 'learnerEmail'],
        raw: true
    });
    const requestedEmailSet = new Set(emails);
    const existingRequestedPairs = new Set(
        existingRows
            .filter((row) => requestedEmailSet.has(normalizeEmail(row.learnerEmail)))
            .map((row) => `${row.courseId}:${normalizeEmail(row.learnerEmail)}`)
    );
    let additions = 0;
    for (const course of courses) {
        for (const email of emails) {
            if (!existingRequestedPairs.has(`${course.id}:${email}`)) additions += 1;
        }
    }
    if (!additions) return;
    const current = await activeAssignmentCount(hostId);
    const projected = current + additions;
    if (projected > max) throw deny(`These assignments would exceed the tenant assignment limit (${projected}/${max}).`, 'SCORM_ASSIGNMENT_LIMIT_REACHED');
}

async function assertEnrollmentAllowed(hostId, learnerEmail) {
    const email = normalizeEmail(learnerEmail);
    if (!hostId || !email) return;
    const host = await User.findByPk(hostId);
    if (!host) return;
    const entitlement = await getEntitlement(host.email, 'admin');
    const max = normalizeLimit(entitlement.maxLearners);
    if (max === null) return;
    const courseIds = await courseIdsForHost(hostId);
    if (!courseIds.length) {
        if (max === 0) throw deny('Learner assignment is disabled for this tenant.', 'SCORM_LEARNER_LIMIT_REACHED');
        return;
    }
    const existing = await ScormRegistration.findOne({
        where: {
            courseId: { [Op.in]: courseIds },
            isPreview: false,
            status: { [Op.notIn]: INACTIVE_ASSIGNMENT_STATUSES },
            learnerEmail: email
        }
    });
    if (existing) return;
    const current = await enrolledLearnerCount(hostId);
    if (current >= max) throw deny(`Learner assignment limit reached (${current}/${max}).`, 'SCORM_LEARNER_LIMIT_REACHED');
}

function requestedRosterEmails(req) {
    const rows = req.body?.learners || req.body?.emails || [];
    const list = Array.isArray(rows) ? rows : [];
    return [...new Set(list.map((row) => normalizeEmail(typeof row === 'string' ? row : row?.email)).filter(Boolean))];
}

async function assertLearnerLimit(req, hostId, entitlement) {
    const max = normalizeLimit(entitlement?.maxLearners);
    if (max === null) return;
    const method = String(req.method || 'GET').toUpperCase();
    if (!['POST', 'PUT'].includes(method)) return;
    if (method === 'POST') {
        const email = normalizeEmail(req.body?.email);
        if (!email) return;
        const exists = await ScormLearnerRoster.findOne({ where: { hostId, email } });
        if (exists) return;
        const current = await ScormLearnerRoster.count({ where: { hostId } });
        if (current + 1 > max) throw deny(`Learner roster limit reached (${current}/${max}).`, 'SCORM_LEARNER_LIMIT_REACHED');
        return;
    }
    const emails = requestedRosterEmails(req);
    const mode = String(req.body?.mode || 'append').toLowerCase() === 'replace' ? 'replace' : 'append';
    if (mode === 'replace') {
        if (emails.length > max) throw deny(`This roster contains ${emails.length} learners, but the tenant limit is ${max}.`, 'SCORM_LEARNER_LIMIT_REACHED');
        return;
    }
    const current = await ScormLearnerRoster.count({ where: { hostId } });
    if (!emails.length) return;
    const existing = await ScormLearnerRoster.count({ where: { hostId, email: { [Op.in]: emails } } });
    const projected = current + Math.max(0, emails.length - existing);
    if (projected > max) throw deny(`Adding these learners would exceed the tenant limit (${projected}/${max}).`, 'SCORM_LEARNER_LIMIT_REACHED');
}

async function enforceRequestEntitlement(req, { userId, email, role }) {
    const entitlement = await getEntitlement(email, role);
    req.scormEntitlement = entitlement;
    if (role === 'super_admin') return entitlement;
    const capability = capabilityForRequest(req);
    if (capability && entitlement.permissions[capability] === false) {
        throw deny('This capability has been disabled for this tenant by the Super Admin.', 'SCORM_CAPABILITY_DISABLED');
    }
    const path = String(req.originalUrl || '').split('?')[0];
    const method = String(req.method || 'GET').toUpperCase();
    if (method === 'POST' && path === '/api/scorm/courses') await assertCourseLimit(userId, entitlement);
    if (method === 'POST' && path === '/api/scorm/author/generate' && !req.body?.replacePackageId && !req.body?.packageId) await assertCourseLimit(userId, entitlement);
    if (path.startsWith('/api/scorm/roster')) await assertLearnerLimit(req, userId, entitlement);
    if (method === 'POST' && path === '/api/scorm/team') await assertStaffLimit(req.scormWorkspaceId, entitlement);
    if (method === 'POST' && path === '/api/scorm/campaigns') await assertCampaignLimit(req.scormWorkspaceId, entitlement);
    if (method === 'POST' && path === '/api/scorm/assignments/bulk') await assertAssignmentLimit(userId, req, entitlement);
    return entitlement;
}

module.exports = {
    DEFAULT_PERMISSIONS,
    normalizeLimit,
    normalizePermissions,
    getEntitlement,
    updateEntitlement,
    getUsageForEmail,
    getUsageForHost,
    activeAssignmentCount,
    assertEnrollmentAllowed,
    enforceRequestEntitlement
};
