const path = require('path').posix;
const { getObjectStorage } = require('../../storage/ObjectStorage');
const { packageContentKey, packageMetaKey } = require('./storageKeys');

const COMMON_ENTRY_FILES = [
    'index.html',
    'index.htm',
    'launch.html',
    'story.html',
    'story_html5.html'
];

function decodeXml(value) {
    return String(value || '')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>');
}

function normalizeEntryHref(value) {
    let href = String(value || '').trim();
    if (!href) return null;

    href = decodeXml(href).replace(/\\/g, '/');
    href = href.split('#')[0].split('?')[0].trim();
    if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return null;

    href = href.replace(/^\/+/, '');
    let decoded = href;
    try { decoded = decodeURIComponent(href); } catch (_) {}
    decoded = decoded.replace(/\\/g, '/');
    if (decoded.split('/').some((part) => part === '..')) return null;

    const normalized = path.normalize(decoded).replace(/^\.\//, '');
    if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) return null;
    return normalized;
}

function manifestEntryHref(xml) {
    const source = String(xml || '');
    if (!source) return null;

    const resources = source.match(/<resource\b[^>]*>/gi) || [];
    const hrefFromTag = (tag) => {
        const match = tag.match(/\bhref\s*=\s*(["'])(.*?)\1/i);
        return match ? normalizeEntryHref(match[2]) : null;
    };

    for (const tag of resources) {
        if (/adlcp:scormtype\s*=\s*(["'])sco\1/i.test(tag)) {
            const href = hrefFromTag(tag);
            if (href) return href;
        }
    }
    for (const tag of resources) {
        const href = hrefFromTag(tag);
        if (href) return href;
    }
    return null;
}

function isObjectMissing(err) {
    return Boolean(err && (
        err.code === 'OBJECT_NOT_FOUND' ||
        err.name === 'NotFound' ||
        err.name === 'NoSuchKey' ||
        err.$metadata?.httpStatusCode === 404
    ));
}

async function objectJson(storage, key) {
    try {
        if (!(await storage.exists(key))) return null;
        const buf = await storage.getObjectBuffer(key);
        const parsed = JSON.parse(Buffer.from(buf).toString('utf8'));
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (err) {
        if (isObjectMissing(err) || err instanceof SyntaxError) return null;
        throw err;
    }
}

async function objectText(storage, key) {
    try {
        if (!(await storage.exists(key))) return null;
        const buf = await storage.getObjectBuffer(key);
        return Buffer.from(buf).toString('utf8');
    } catch (err) {
        if (isObjectMissing(err)) return null;
        throw err;
    }
}

async function existingEntry(storage, packageId, candidate) {
    const href = normalizeEntryHref(candidate);
    if (!href) return null;
    return await storage.exists(packageContentKey(packageId, href)) ? href : null;
}

async function recoverEntryHref(pkg, { storage = getObjectStorage() } = {}) {
    if (!pkg || !pkg.id) return null;

    let found = await existingEntry(storage, pkg.id, pkg.entryHref);
    if (found) return found;

    const meta = await objectJson(storage, packageMetaKey(pkg.id));
    found = await existingEntry(storage, pkg.id, meta?.entryHref);
    if (found) return found;

    const manifestCandidates = [
        normalizeEntryHref(meta?.manifestPath),
        'imsmanifest.xml'
    ].filter(Boolean);

    for (const manifestPath of [...new Set(manifestCandidates)]) {
        const xml = await objectText(storage, packageContentKey(pkg.id, manifestPath));
        if (!xml) continue;
        found = await existingEntry(storage, pkg.id, manifestEntryHref(xml));
        if (found) return found;
    }

    for (const candidate of COMMON_ENTRY_FILES) {
        found = await existingEntry(storage, pkg.id, candidate);
        if (found) return found;
    }

    return null;
}

async function ensurePackageLaunchMetadata(pkg, { storage = getObjectStorage(), transaction = null } = {}) {
    if (!pkg) {
        const err = new Error('Course package is missing');
        err.code = 'PACKAGE_NOT_READY';
        throw err;
    }
    if (pkg.status !== 'ready') {
        const err = new Error('Course package is not ready');
        err.code = 'PACKAGE_NOT_READY';
        throw err;
    }

    const entryHref = await recoverEntryHref(pkg, { storage });
    if (!entryHref) {
        const err = new Error('Course launch file is unavailable. Please rebuild or re-upload this course package.');
        err.code = 'PACKAGE_LAUNCH_MISSING';
        throw err;
    }

    if (String(pkg.entryHref || '') !== entryHref) {
        pkg.entryHref = entryHref;
        if (typeof pkg.save === 'function') {
            const options = transaction ? { transaction } : undefined;
            await pkg.save(options);
        }
    }
    return entryHref;
}

module.exports = {
    COMMON_ENTRY_FILES,
    normalizeEntryHref,
    manifestEntryHref,
    recoverEntryHref,
    ensurePackageLaunchMetadata
};