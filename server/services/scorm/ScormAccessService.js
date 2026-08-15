const crypto = require('crypto');
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

function normalizeRegistrationCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-F0-9]/g, '');
}

function hashRegistrationCode(value) {
    return crypto.createHash('sha256').update(normalizeRegistrationCode(value)).digest('hex');
}

function generateRegistrationCode() {
    const raw = crypto.randomBytes(6).toString('hex').toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

async function assignRegistrationCode(grant) {
    const activationCode = generateRegistrationCode();
    grant.registrationCodeHash = hashRegistrationCode(activationCode);
    grant.registrationCodeUsedAt = null;
    await grant.save();
    return activationCode;
}

async function ensureSuperAdminGrant() {
    const [grant] = await ScormAccessGrant.findOrCreate({
        where: { email: SUPER_ADMIN_EMAIL },
        defaults: {
            email: SUPER_ADMIN_EMAIL,
            role: 'super_admin',
            addedByEmail: SUPER_ADMIN_EMAIL,
            registrationCodeHash: null,
            registrationCodeUsedAt: null
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
    if (grant.registrationCodeHash) {
        grant.registrationCodeHash = null;
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

function registrationCodeDeniedPayload() {
    return {
        message: `A valid SCORM AI activation code is required for password registration. Please contact the administrator at ${ADMIN_CONTACT_EMAIL}.`,
        code: 'SCORM_ACTIVATION_CODE_REQUIRED',
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

    if (isSuperAdminEmail(normalized)) {
        return { grant: await ensureSuperAdminGrant(), activationCode: null };
    }

    const [grant, created] = await ScormAccessGrant.findOrCreate({
        where: { email: normalized },
        defaults: {
            email: normalized,
            role: 'user',
            addedByUserId,
            addedByEmail: normalizeEmail(addedByEmail) || null
        }
    });

    let changed = false;
    if (!created && grant.role !== 'user') {
        grant.role = 'user';
        changed = true;
    }
    if (!grant.addedByEmail && addedByEmail) {
        grant.addedByEmail = normalizeEmail(addedByEmail);
        changed = true;
    }
    if (!grant.addedByUserId && addedByUserId) {
        grant.addedByUserId = addedByUserId;
        changed = true;
    }
    if (changed) await grant.save();

    let activationCode = null;
    if (created || (!grant.registrationCodeHash && !grant.registrationCodeUsedAt)) {
        activationCode = await assignRegistrationCode(grant);
    }

    return { grant, activationCode };
}

async function rotateRegistrationCode(id) {
    const grant = await ScormAccessGrant.findByPk(id);
    if (!grant) return { ok: false, reason: 'not_found' };
    if (isSuperAdminEmail(grant.email) || grant.role === 'super_admin') {
        return { ok: false, reason: 'super_admin' };
    }
    const activationCode = await assignRegistrationCode(grant);
    return { ok: true, grant, activationCode };
}

async function verifyRegistrationCode(email, code) {
    const normalized = normalizeEmail(email);
    if (!normalized || isSuperAdminEmail(normalized)) return false;
    const suppliedHash = hashRegistrationCode(code);
    const grant = await ScormAccessGrant.findOne({ where: { email: normalized } });
    if (!grant || !grant.registrationCodeHash || grant.registrationCodeUsedAt) return false;

    const expected = Buffer.from(grant.registrationCodeHash, 'hex');
    const supplied = Buffer.from(suppliedHash, 'hex');
    if (expected.length !== supplied.length) return false;
    return crypto.timingSafeEqual(expected, supplied);
}

async function markRegistrationCodeUsed(email) {
    const normalized = normalizeEmail(email);
    const grant = await ScormAccessGrant.findOne({ where: { email: normalized } });
    if (!grant) return;
    grant.registrationCodeHash = null;
    grant.registrationCodeUsedAt = new Date();
    await grant.save();
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
    normalizeRegistrationCode,
    ensureSuperAdminGrant,
    findGrant,
    getAccessRole,
    hasAccess,
    accessDeniedPayload,
    registrationCodeDeniedPayload,
    listGrants,
    addGrant,
    rotateRegistrationCode,
    verifyRegistrationCode,
    markRegistrationCodeUsed,
    removeGrant
};
