const { Op } = require('sequelize');
const User = require('../../models/User');
const ScormUserEntitlement = require('../../models/scorm/ScormUserEntitlement');
const {
    ScormCourse,
    ScormLearnerRoster,
    ScormRegistration
} = require('../../models/scorm');

const DEFAULT_PERMISSIONS = Object.freeze({
    courseAuthoring: true,
    coursePublishing: true,
    coursePreview: true,
    learnerRoster: true,
    learnerTracking: true,
    reports: true,
    library: true,
    contentEditor: true
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
            permissions: { ...DEFAULT_PERMISSIONS },
            unlimited: true,
            protected: true
        };
    }

    return {
        maxCourses: normalizeLimit(row?.maxCourses),
        maxLearners: normalizeLimit(row?.maxLearners),
        permissions: normalizePermissions(row?.permissions),
        unlimited: false,
        protected: false
    };
}

async function getEntitlement(email, role = 'user') {
    const normalized = normalizeEmail(email);
    if (role === 'super_admin') return serializeEntitlement(null, role);
    if (!normalized) return serializeEntitlement(null, role);

    const [row] = await ScormUserEntitlement.findOrCreate({
        where: { email: normalized },
        defaults: {
            email: normalized,
            maxCourses: null,
            maxLearners: null,
            permissions: { ...DEFAULT_PERMISSIONS }
        }
    });

    const normalizedPermissions = normalizePermissions(row.permissions);
    const changed = JSON.stringify(normalizedPermissions) !== JSON.stringify(row.permissions || {});
    if (changed) {
        row.permissions = normalizedPermissions;
        await row.save();
    }

    return serializeEntitlement(row, role);
}

async function updateEntitlement(email, patch = {}, actor = {}) {
    const normalized = normalizeEmail(email);
    if (!normalized) throw new Error('User email is required.');

    const [row] = await ScormUserEntitlement.findOrCreate({
        where: { email: normalized },
        defaults: {
            email: normalized,
            maxCourses: null,
            maxLearners: null,
            permissions: { ...DEFAULT_PERMISSIONS }
        }
    });

    if (Object.prototype.hasOwnProperty.call(patch, 'maxCourses')) {
        row.maxCourses = normalizeLimit(patch.maxCourses);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'maxLearners')) {
        row.maxLearners = normalizeLimit(patch.maxLearners);
    }
    if (patch.permissions && typeof patch.permissions === 'object') {
        row.permissions = normalizePermissions({
            ...normalizePermissions(row.permissions),
            ...patch.permissions
        });
    } else {
        row.permissions = normalizePermissions(row.permissions);
    }
    row.updatedByUserId = actor.userId || null;
    row.updatedByEmail = normalizeEmail(actor.email) || null;
    await row.save();
    return serializeEntitlement(row, 'user');
}

async function enrolledLearnerCount(hostId) {
    const courses = await ScormCourse.findAll({
        where: { hostId },
        attributes: ['id'],
        raw: true
    });
    const courseIds = courses.map((course) => course.id);
    if (!courseIds.length) return 0;
    return ScormRegistration.count({
        distinct: true,
        col: 'learnerEmail',
        where: {
            courseId: { [Op.in]: courseIds },
            isPreview: false,
            learnerEmail: { [Op.ne]: null }
        }
    });
}

async function getUsageForEmail(email) {
    const normalized = normalizeEmail(email);
    const user = normalized ? await User.findOne({ where: { email: normalized } }) : null;
    if (!user) return { courses: 0, learners: 0, rosterLearners: 0 };

    const [courses, learners, rosterLearners] = await Promise.all([
        ScormCourse.count({
            where: {
                hostId: user.id,
                status: { [Op.ne]: 'archived' }
            }
        }),
        enrolledLearnerCount(user.id),
        ScormLearnerRoster.count({ where: { hostId: user.id } })
    ]);
    return { courses, learners, rosterLearners };
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
    if (path.startsWith('/api/scorm/packages')) return 'library';
    if (path.startsWith('/api/scorm/courses/reports') || /\/api\/scorm\/courses\/[^/]+\/report$/.test(path)) return 'reports';
    if (/\/api\/scorm\/courses\/[^/]+\/preview$/.test(path) && method === 'POST') return 'coursePreview';
    if (/\/api\/scorm\/courses\/[^/]+$/.test(path) && method === 'PATCH' && req.body?.status === 'published') return 'coursePublishing';
    return null;
}

async function assertCourseLimit(userId, entitlement) {
    const max = normalizeLimit(entitlement?.maxCourses);
    if (max === null) return;
    const current = await ScormCourse.count({
        where: {
            hostId: userId,
            status: { [Op.ne]: 'archived' }
        }
    });
    if (current >= max) {
        throw deny(
            `Course creation limit reached (${current}/${max}). Contact the super administrator to increase your limit.`,
            'SCORM_COURSE_LIMIT_REACHED'
        );
    }
}

async function assertEnrollmentAllowed(hostId, learnerEmail) {
    const email = normalizeEmail(learnerEmail);
    if (!hostId || !email) return;
    const host = await User.findByPk(hostId);
    if (!host) return;

    const { getAccessRole } = require('./ScormAccessService');
    const role = await getAccessRole(host.email);
    const entitlement = await getEntitlement(host.email, role || 'user');
    const max = normalizeLimit(entitlement.maxLearners);
    if (max === null) return;

    const courses = await ScormCourse.findAll({
        where: { hostId },
        attributes: ['id'],
        raw: true
    });
    const courseIds = courses.map((course) => course.id);
    if (!courseIds.length) {
        if (max === 0) throw deny('Learner enrollment is disabled for this account.', 'SCORM_LEARNER_LIMIT_REACHED');
        return;
    }

    const existing = await ScormRegistration.findOne({
        where: {
            courseId: { [Op.in]: courseIds },
            isPreview: false,
            learnerEmail: email
        }
    });
    if (existing) return;

    const current = await enrolledLearnerCount(hostId);
    if (current >= max) {
        throw deny(
            `Learner enrollment limit reached (${current}/${max}). Contact the course administrator.`,
            'SCORM_LEARNER_LIMIT_REACHED'
        );
    }
}

function requestedRosterEmails(req) {
    const rows = req.body?.learners || req.body?.emails || [];
    const list = Array.isArray(rows) ? rows : [];
    const emails = list.map((row) => normalizeEmail(typeof row === 'string' ? row : row?.email)).filter(Boolean);
    return [...new Set(emails)];
}

async function assertLearnerLimit(req, userId, entitlement) {
    const max = normalizeLimit(entitlement?.maxLearners);
    if (max === null) return;

    const method = String(req.method || 'GET').toUpperCase();
    if (!['POST', 'PUT'].includes(method)) return;

    if (method === 'POST') {
        const email = normalizeEmail(req.body?.email);
        if (!email) return;
        const exists = await ScormLearnerRoster.findOne({ where: { hostId: userId, email } });
        if (exists) return;
        const current = await ScormLearnerRoster.count({ where: { hostId: userId } });
        if (current + 1 > max) {
            throw deny(
                `Learner roster limit reached (${current}/${max}). Contact the super administrator to increase your limit.`,
                'SCORM_LEARNER_LIMIT_REACHED'
            );
        }
        return;
    }

    const emails = requestedRosterEmails(req);
    const mode = String(req.body?.mode || 'append').toLowerCase() === 'replace' ? 'replace' : 'append';
    if (mode === 'replace') {
        if (emails.length > max) {
            throw deny(
                `This roster contains ${emails.length} learners, but your limit is ${max}.`,
                'SCORM_LEARNER_LIMIT_REACHED'
            );
        }
        return;
    }

    const current = await ScormLearnerRoster.count({ where: { hostId: userId } });
    if (!emails.length) return;
    const existing = await ScormLearnerRoster.count({
        where: { hostId: userId, email: { [Op.in]: emails } }
    });
    const projected = current + Math.max(0, emails.length - existing);
    if (projected > max) {
        throw deny(
            `Adding these learners would exceed your limit (${projected}/${max}).`,
            'SCORM_LEARNER_LIMIT_REACHED'
        );
    }
}

async function enforceRequestEntitlement(req, { userId, email, role }) {
    const entitlement = await getEntitlement(email, role);
    req.scormEntitlement = entitlement;
    if (role === 'super_admin') return entitlement;

    const capability = capabilityForRequest(req);
    if (capability && entitlement.permissions[capability] === false) {
        throw deny(
            'This capability has been disabled for your account by the super administrator.',
            'SCORM_CAPABILITY_DISABLED'
        );
    }

    const path = String(req.originalUrl || '').split('?')[0];
    const method = String(req.method || 'GET').toUpperCase();

    if (method === 'POST' && path === '/api/scorm/courses') {
        await assertCourseLimit(userId, entitlement);
    }
    if (method === 'POST' && path === '/api/scorm/author/generate' && !req.body?.replacePackageId && !req.body?.packageId) {
        await assertCourseLimit(userId, entitlement);
    }
    if (path.startsWith('/api/scorm/roster')) {
        await assertLearnerLimit(req, userId, entitlement);
    }

    return entitlement;
}

module.exports = {
    DEFAULT_PERMISSIONS,
    normalizeLimit,
    normalizePermissions,
    getEntitlement,
    updateEntitlement,
    getUsageForEmail,
    assertEnrollmentAllowed,
    enforceRequestEntitlement
};
