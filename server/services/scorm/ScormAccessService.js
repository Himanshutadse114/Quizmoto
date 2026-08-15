const ScormAccessGrant = require('../../models/ScormAccessGrant');

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

function accessDeniedPayload() {
    return {
        message: `Your account does not have access to SCORM AI. Please contact the administrator at ${ADMIN_CONTACT_EMAIL}.`,
        code: 'SCORM_ACCESS_DENIED',
        adminContact: ADMIN_CONTACT_EMAIL
    };
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

async function addGrant({ email, addedByUserId = null, addedByEmail = null }) {
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
        const err = new Error('Enter a valid email address.');
        err.code = 'INVALID_EMAIL';
        throw err;
    }

    if (isSuperAdminEmail(normalized)) return ensureSuperAdminGrant();

    const [grant, created] = await ScormAccessGrant.findOrCreate({
        where: { email: normalized },
        defaults: {
            email: normalized,
            role: 'user',
            addedByUserId,
            addedByEmail: normalizeEmail(addedByEmail) || null
        }
    });

    if (!created && grant.role !== 'user') {
        grant.role = 'user';
        await grant.save();
    }

    return grant;
}

async function removeGrant(id) {
    const grant = await ScormAccessGrant.findByPk(id);
    if (!grant) return { removed: false, reason: 'not_found' };
    if (isSuperAdminEmail(grant.email) || grant.role === 'super_admin') {
        return { removed: false, reason: 'super_admin' };
    }
    await grant.destroy();
    return { removed: true, grant };
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
    accessDeniedPayload,
    listGrants,
    addGrant,
    removeGrant
};
