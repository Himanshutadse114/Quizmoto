const crypto = require('crypto');
const User = require('../models/User');
const Flipbook = require('../models/Flipbook');
const FlipbookEntitlement = require('../models/FlipbookEntitlement');
const { getObjectStorage } = require('../storage/ObjectStorage');
const { getAccessRole } = require('./scorm/ScormAccessService');

const DEFAULT_FREE_FLIPBOOKS = 3;
const MAX_PAGES = 100;
const MAX_PAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_PAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
let schemaPromise = null;

function normaliseEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function normaliseLimit(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_FREE_FLIPBOOKS;
    return Math.max(0, Math.floor(parsed));
}

async function ensureFlipbookSchema() {
    if (!schemaPromise) {
        schemaPromise = Promise.all([
            Flipbook.sync(),
            FlipbookEntitlement.sync()
        ]).catch((err) => {
            schemaPromise = null;
            throw err;
        });
    }
    await schemaPromise;
}

async function isSuperAdmin(user) {
    if (!user?.email) return false;
    const role = await getAccessRole(user.email);
    return role === 'super_admin';
}

async function getUserEntitlement(user) {
    await ensureFlipbookSchema();
    if (!user) throw Object.assign(new Error('User not found.'), { status: 404 });
    if (await isSuperAdmin(user)) {
        return { maxFlipbooks: null, unlimited: true, protected: true };
    }
    const email = normaliseEmail(user.email) || null;
    const [row] = await FlipbookEntitlement.findOrCreate({
        where: { userId: user.id },
        defaults: { userId: user.id, email, maxFlipbooks: DEFAULT_FREE_FLIPBOOKS }
    });
    if (email && row.email !== email) {
        row.email = email;
        await row.save();
    }
    return {
        maxFlipbooks: normaliseLimit(row.maxFlipbooks),
        unlimited: row.maxFlipbooks === null,
        protected: false
    };
}

async function getQuota(user) {
    const entitlement = await getUserEntitlement(user);
    const used = await Flipbook.count({ where: { ownerUserId: user.id } });
    const max = entitlement.maxFlipbooks;
    return {
        used,
        max,
        remaining: max === null ? null : Math.max(0, max - used),
        unlimited: max === null,
        protected: entitlement.protected
    };
}

async function assertCanCreate(user) {
    const quota = await getQuota(user);
    if (quota.max !== null && quota.used >= quota.max) {
        const err = new Error(`Flipbook allowance reached (${quota.used}/${quota.max}). Delete an existing flipbook or ask the Super Admin to increase the limit.`);
        err.status = 403;
        err.code = 'FLIPBOOK_LIMIT_REACHED';
        err.quota = quota;
        throw err;
    }
    return quota;
}

async function setUserLimit({ userId, maxFlipbooks, actorUserId, actorEmail }) {
    await ensureFlipbookSchema();
    const user = await User.findByPk(userId);
    if (!user) throw Object.assign(new Error('User not found.'), { status: 404 });
    if (await isSuperAdmin(user)) {
        const err = new Error('The Super Admin always has unlimited flipbook access.');
        err.status = 400;
        throw err;
    }
    const email = normaliseEmail(user.email) || null;
    const [row] = await FlipbookEntitlement.findOrCreate({
        where: { userId: user.id },
        defaults: { userId: user.id, email, maxFlipbooks: DEFAULT_FREE_FLIPBOOKS }
    });
    row.maxFlipbooks = normaliseLimit(maxFlipbooks);
    row.email = email;
    row.updatedByUserId = actorUserId || null;
    row.updatedByEmail = normaliseEmail(actorEmail) || null;
    await row.save();
    return { user, quota: await getQuota(user) };
}

function createShareToken() {
    return crypto.randomBytes(24).toString('hex');
}

function parsePageData(dataUrl) {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(String(dataUrl || ''));
    if (!match) {
        const err = new Error('Page image must be a JPEG, PNG or WebP data URL.');
        err.status = 400;
        throw err;
    }
    const contentType = match[1].toLowerCase();
    if (!ALLOWED_PAGE_TYPES.has(contentType)) {
        const err = new Error('Unsupported page image type.');
        err.status = 400;
        throw err;
    }
    const body = Buffer.from(match[2], 'base64');
    if (!body.length || body.length > MAX_PAGE_BYTES) {
        const err = new Error(`Each flipbook page must be smaller than ${Math.floor(MAX_PAGE_BYTES / (1024 * 1024))} MB.`);
        err.status = 413;
        throw err;
    }
    return { body, contentType };
}

function extensionFor(contentType) {
    if (contentType === 'image/png') return 'png';
    if (contentType === 'image/webp') return 'webp';
    return 'jpg';
}

async function appendPage({ flipbook, dataUrl, width, height }) {
    const pages = Array.isArray(flipbook.pages) ? [...flipbook.pages] : [];
    if (pages.length >= MAX_PAGES) {
        const err = new Error(`A flipbook can contain up to ${MAX_PAGES} pages.`);
        err.status = 400;
        err.code = 'FLIPBOOK_PAGE_LIMIT_REACHED';
        throw err;
    }
    const { body, contentType } = parsePageData(dataUrl);
    const extension = extensionFor(contentType);
    const key = `flipbooks/${flipbook.ownerUserId}/${flipbook.id}/${String(pages.length + 1).padStart(3, '0')}-${crypto.randomBytes(8).toString('hex')}.${extension}`;
    await getObjectStorage().putObject({ key, body, contentType });
    pages.push({
        key,
        contentType,
        width: Number.isFinite(Number(width)) ? Math.max(1, Math.floor(Number(width))) : null,
        height: Number.isFinite(Number(height)) ? Math.max(1, Math.floor(Number(height))) : null
    });
    flipbook.pages = pages;
    flipbook.pageCount = pages.length;
    await flipbook.save();
    return pages[pages.length - 1];
}

async function clearPages(flipbook) {
    const pages = Array.isArray(flipbook.pages) ? flipbook.pages : [];
    const storage = getObjectStorage();
    await Promise.all(pages.map((page) => storage.deleteObject(page.key).catch(() => null)));
    flipbook.pages = [];
    flipbook.pageCount = 0;
    await flipbook.save();
}

async function deleteFlipbook(flipbook) {
    await clearPages(flipbook);
    await flipbook.destroy();
}

async function listAdminUsers(search = '') {
    await ensureFlipbookSchema();
    const users = await User.findAll({ order: [['createdAt', 'DESC']], limit: 500 });
    const query = String(search || '').trim().toLowerCase();
    const filtered = users.filter((user) => {
        if (!query) return true;
        return [user.email, user.username].some((value) => String(value || '').toLowerCase().includes(query));
    });
    return Promise.all(filtered.map(async (user) => ({
        id: user.id,
        username: user.username || null,
        email: user.email || null,
        isSuperAdmin: await isSuperAdmin(user),
        quota: await getQuota(user)
    })));
}

module.exports = {
    DEFAULT_FREE_FLIPBOOKS,
    MAX_PAGES,
    ensureFlipbookSchema,
    isSuperAdmin,
    getQuota,
    assertCanCreate,
    setUserLimit,
    createShareToken,
    appendPage,
    clearPages,
    deleteFlipbook,
    listAdminUsers
};
