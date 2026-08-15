const ScormAccessGrant = require('../../models/ScormAccessGrant');
const ScormAccessRequest = require('../../models/ScormAccessRequest');

const SUPER_ADMIN_EMAIL = String(
    process.env.SCORM_SUPER_ADMIN_EMAIL || 'tadsehimanshu@gmail.com'
).trim().toLowerCase();

const ADMIN_CONTACT_EMAIL = String(
    process.env.SCORM_ADMIN_CONTACT_EMAIL || SUPER_ADMIN_EMAIL
).trim().toLowerCase();

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function isValidEmail(email) {
    return /^\S+@\S+\.\S+$/.test(normalizeEmail(email));
}

function isSuperAdminEmail(email) {
    return normalizeEmail(email) === SUPER_ADMIN_EMAIL;
}

async function ensureSuperAdminGrant() {
    const [grant] = await ScormAccessGrant.findOrCreate({
        where: { email: SUPER_ADMIN_EMAIL },
        defaults: {
            email: SUPER_ADMIN_EMAIL,
            role: 'super_admin',
            addedByEmail: SUPER_ADMIN_EMAIL
        }
    });

    let changed = false;
    if (grant.role !== 'super_admin') {
        grant.role = 'super_admin';
        changed = true;
    }
    if (normalizeEmail(grant.addedByEmail) !== SUPER_ADMIN_EMAIL) {
        grant.addedByEmail = SUPER_ADMIN_EMAIL;
        changed = true;
    }
    if (changed) await grant.save();
    return grant;
}

async function findGrant(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    if (isSuperAdminEmail(normalized)) return ensureSuperAdminGrant();
    return ScormAccessGrant.findOne({ where: { email: normalized } });
}

async function getAccessRole(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    if (isSuperAdminEmail(normalized)) return 'super_admin';
    const grant = await ScormAccessGrant.findOne({ where: { email: normalized } });
    return grant ? grant.role || 'user' : null;
}

async function hasAccess(email) {
    return Boolean(await getAccessRole(email));
}

function pendingApprovalPayload({ captured = true } = {}) {
    return {
        message: captured
            ? `Your registration has been captured, but your SCORM AI account is not authorised yet. Please contact the administrator at ${ADMIN_CONTACT_EMAIL} to unlock access. After approval, you can sign in using the same credentials you just registered.`
            : `Your SCORM AI account is registered but not authorised yet. Please contact the administrator at ${ADMIN_CONTACT_EMAIL} to unlock access. After approval, use the same registered credentials to sign in.`,
        code: 'SCORM_APPROVAL_PENDING',
        pendingApproval: true,
        registrationCaptured: captured,
        adminContact: ADMIN_CONTACT_EMAIL
    };
}

function accessDeniedPayload() {
    return pendingApprovalPayload({ captured: false });
}

async function captureAccessRequest({ userId = null, email, username = null, authMethod = 'password' }) {
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized) || isSuperAdminEmail(normalized)) return null;

    const role = await getAccessRole(normalized);
    const desiredStatus = role ? 'approved' : 'pending';
    const [request] = await ScormAccessRequest.findOrCreate({
        where: { email: normalized },
        defaults: {
            userId,
            email: normalized,
            username: username || null,
            authMethod: authMethod || 'password',
            status: desiredStatus,
            requestedAt: new Date(),
            approvedAt: role ? new Date() : null
        }
    });

    let changed = false;
    if (userId && request.userId !== userId) {
        request.userId = userId;
        changed = true;
    }
    if (username && request.username !== username) {
        request.username = username;
        changed = true;
    }
    if (authMethod && request.authMethod !== authMethod) {
        request.authMethod = request.authMethod && request.authMethod !== authMethod ? 'mixed' : authMethod;
        changed = true;
    }
    if (request.status !== desiredStatus) {
        request.status = desiredStatus;
        request.approvedAt = role ? (request.approvedAt || new Date()) : null;
        if (!role) {
            request.approvedByUserId = null;
            request.approvedByEmail = null;
        }
        changed = true;
    }
    request.requestedAt = new Date();
    changed = true;
    if (changed) await request.save();
    return request;
}

async function listGrants() {
    await ensureSuperAdminGrant();
    return ScormAccessGrant.findAll({
        order: [
            ['role', 'DESC'],
            ['email', 'ASC']
        ]
    });
}

async function listAccessRequests({ status = null } = {}) {
    const where = status ? { status } : {};
    return ScormAccessRequest.findAll({
        where,
        order: [['requestedAt', 'ASC']]
    });
}

async function markRequestApproved(email, { approvedByUserId = null, approvedByEmail = null } = {}) {
    const normalized = normalizeEmail(email);
    const request = await ScormAccessRequest.findOne({ where: { email: normalized } });
    if (!request) return null;
    request.status = 'approved';
    request.approvedAt = new Date();
    request.approvedByUserId = approvedByUserId;
    request.approvedByEmail = normalizeEmail(approvedByEmail) || null;
    await request.save();
    return request;
}

async function addGrant({ email, addedByUserId = null, addedByEmail = null }) {
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
        const err = new Error('Enter a valid email address.');
        err.code = 'INVALID_EMAIL';
        throw err;
    }

    if (isSuperAdminEmail(normalized)) {
        return { grant: await ensureSuperAdminGrant(), request: null };
    }

    const [grant] = await ScormAccessGrant.findOrCreate({
        where: { email: normalized },
        defaults: {
            email: normalized,
            role: 'user',
            addedByUserId,
            addedByEmail: normalizeEmail(addedByEmail) || null
        }
    });

    let changed = false;
    if (grant.role !== 'user') {
        grant.role = 'user';
        changed = true;
    }
    if (addedByEmail && normalizeEmail(grant.addedByEmail) !== normalizeEmail(addedByEmail)) {
        grant.addedByEmail = normalizeEmail(addedByEmail);
        changed = true;
    }
    if (addedByUserId && grant.addedByUserId !== addedByUserId) {
        grant.addedByUserId = addedByUserId;
        changed = true;
    }
    if (changed) await grant.save();

    const request = await markRequestApproved(normalized, { approvedByUserId: addedByUserId, approvedByEmail: addedByEmail });
    return { grant, request };
}

async function approveAccessRequest(id, { approvedByUserId = null, approvedByEmail = null } = {}) {
    const request = await ScormAccessRequest.findByPk(id);
    if (!request) return { ok: false, reason: 'not_found' };
    if (isSuperAdminEmail(request.email)) return { ok: false, reason: 'super_admin' };

    const result = await addGrant({
        email: request.email,
        addedByUserId: approvedByUserId,
        addedByEmail: approvedByEmail
    });
    return { ok: true, request: result.request || request, grant: result.grant };
}

async function removeGrant(id) {
    const grant = await ScormAccessGrant.findByPk(id);
    if (!grant) return { removed: false, reason: 'not_found' };
    if (isSuperAdminEmail(grant.email) || grant.role === 'super_admin') {
        return { removed: false, reason: 'super_admin' };
    }

    const email = normalizeEmail(grant.email);
    await grant.destroy();

    const request = await ScormAccessRequest.findOne({ where: { email } });
    if (request) {
        request.status = 'pending';
        request.approvedAt = null;
        request.approvedByUserId = null;
        request.approvedByEmail = null;
        await request.save();
    }

    return { removed: true, grant, request };
}

module.exports = {
    SUPER_ADMIN_EMAIL,
    ADMIN_CONTACT_EMAIL,
    normalizeEmail,
    isValidEmail,
    isSuperAdminEmail,
    ensureSuperAdminGrant,
    findGrant,
    getAccessRole,
    hasAccess,
    pendingApprovalPayload,
    accessDeniedPayload,
    captureAccessRequest,
    listGrants,
    listAccessRequests,
    addGrant,
    approveAccessRequest,
    removeGrant
};
