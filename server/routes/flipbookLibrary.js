const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const { DataTypes } = require('sequelize');
const router = express.Router();
const User = require('../models/User');
const Flipbook = require('../models/Flipbook');
const FlipbookLibrary = require('../models/FlipbookLibrary');
const { getQuota } = require('../services/FlipbookService');
const {
    cleanShareSlug,
    cleanSubdomain,
    shareIdentifier,
    publicationUrl,
    libraryUrl,
    rootDomain,
    hasPaidBranding,
    assertLibrarySlugAvailable,
    assertSubdomainAvailable,
    publicIdentifierWhere
} = require('../services/PublicaBrandingService');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
let schemaPromise = null;

async function ensureLibrarySchema() {
    if (!schemaPromise) {
        schemaPromise = FlipbookLibrary.sync().then(async () => {
            const qi = FlipbookLibrary.sequelize.getQueryInterface();
            const table = FlipbookLibrary.getTableName();
            const columns = await qi.describeTable(table);
            if (!columns.shareSlug) await qi.addColumn(table, 'shareSlug', { type: DataTypes.STRING(64), allowNull: true });
            if (!columns.customSubdomain) await qi.addColumn(table, 'customSubdomain', { type: DataTypes.STRING(63), allowNull: true });
            const indexes = await qi.showIndex(table);
            const indexed = (field) => indexes.some((index) => index.unique && index.fields?.some((item) => item.attribute === field || item.name === field));
            if (!indexed('shareSlug')) await qi.addIndex(table, ['shareSlug'], { unique: true, name: 'flipbook_libraries_share_slug_unique' });
            if (!indexed('customSubdomain')) await qi.addIndex(table, ['customSubdomain'], { unique: true, name: 'flipbook_libraries_subdomain_unique' });
        }).catch((err) => {
            schemaPromise = null;
            throw err;
        });
    }
    await schemaPromise;
}

function shareToken() {
    return crypto.randomBytes(24).toString('hex');
}

function cleanText(value, maxLength) {
    const text = String(value || '').trim();
    return text ? text.slice(0, maxLength) : '';
}

function bookShareUrl(book, library, source = '') {
    const base = publicationUrl(book, { customSubdomain: library?.customSubdomain });
    return source ? `${base}?source=${encodeURIComponent(source)}` : base;
}

function publicTitleForLegacyLibrary(title) {
    const value = String(title || '').trim();
    const match = /^(?:(.+?)\s+)?Flipbook Library$/i.exec(value);
    if (!match) return value;
    return `${match[1] ? `${match[1]} ` : ''}Publica Library`.slice(0, 180);
}

async function getOrCreateLibrary(user) {
    await ensureLibrarySchema();
    const [library] = await FlipbookLibrary.findOrCreate({
        where: { ownerUserId: user.id },
        defaults: {
            ownerUserId: user.id,
            ownerEmail: String(user.email || '').trim().toLowerCase() || null,
            title: `${user.username || 'My'} Publica Library`.slice(0, 180),
            description: null,
            shareToken: shareToken(),
            shareEnabled: true
        }
    });
    const email = String(user.email || '').trim().toLowerCase() || null;
    const migratedTitle = publicTitleForLegacyLibrary(library.title);
    let changed = false;
    if (library.ownerEmail !== email) {
        library.ownerEmail = email;
        changed = true;
    }
    if (migratedTitle && migratedTitle !== library.title) {
        library.title = migratedTitle;
        changed = true;
    }
    if (changed) await library.save();
    return library;
}

async function publishedBooks(ownerUserId) {
    return Flipbook.findAll({
        where: { ownerUserId, status: 'published', shareEnabled: true },
        order: [['publishedAt', 'DESC'], ['updatedAt', 'DESC']]
    });
}

function libraryPayload(library, books = [], options = {}) {
    const canUseCustomSubdomain = hasPaidBranding(options.quota);
    return {
        id: library.id,
        title: publicTitleForLegacyLibrary(library.title),
        description: library.description || '',
        shareEnabled: Boolean(library.shareEnabled),
        shareToken: library.shareToken,
        shareSlug: library.shareSlug || '',
        shareIdentifier: shareIdentifier(library),
        customSubdomain: library.customSubdomain || '',
        customDomainRoot: rootDomain(),
        canUseCustomSubdomain,
        shareUrl: library.shareEnabled ? libraryUrl(library) : null,
        bookCount: books.length,
        updatedAt: library.updatedAt,
        books: books.map((book) => ({
            id: book.id,
            title: book.title,
            description: book.description || '',
            pageCount: Number(book.pageCount || 0),
            viewCount: Number(book.viewCount || 0),
            publishedAt: book.publishedAt || null,
            shareUrl: bookShareUrl(book, library, 'library'),
            coverPath: Number(book.pageCount || 0) ? `/api/scorm/flipbooks/public/${shareIdentifier(book)}/pages/0` : null
        }))
    };
}

async function genericPlatformAuth(req, res, next) {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findByPk(decoded.userId);
        if (!user) return res.status(401).json({ message: 'Account no longer exists.' });
        req.flipbookLibraryUser = user;
        next();
    } catch (_) {
        return res.status(401).json({ message: 'Token is not valid' });
    }
}

router.get('/public-library/:shareToken', async (req, res, next) => {
    try {
        await ensureLibrarySchema();
        const library = await FlipbookLibrary.findOne({ where: { ...publicIdentifierWhere(req.params.shareToken), shareEnabled: true } });
        if (!library) return res.status(404).json({ message: 'This Publica library is not available.' });
        const books = await publishedBooks(library.ownerUserId);
        res.setHeader('Cache-Control', 'private, no-store');
        res.json({ library: libraryPayload(library, books) });
    } catch (err) {
        next(err);
    }
});

router.get('/library', genericPlatformAuth, async (req, res, next) => {
    try {
        const library = await getOrCreateLibrary(req.flipbookLibraryUser);
        const books = await publishedBooks(req.flipbookLibraryUser.id);
        const quota = await getQuota(req.flipbookLibraryUser);
        res.json({ library: libraryPayload(library, books, { quota }) });
    } catch (err) {
        next(err);
    }
});

router.patch('/library', genericPlatformAuth, async (req, res, next) => {
    try {
        const library = await getOrCreateLibrary(req.flipbookLibraryUser);
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'title')) {
            library.title = cleanText(req.body.title, 180) || 'Publica Library';
        }
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'description')) {
            library.description = cleanText(req.body.description, 2000) || null;
        }
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'shareEnabled')) {
            library.shareEnabled = Boolean(req.body.shareEnabled);
        }
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'shareSlug')) {
            const nextSlug = cleanShareSlug(req.body.shareSlug);
            await assertLibrarySlugAvailable(nextSlug, library.id);
            library.shareSlug = nextSlug;
        }
        const quota = await getQuota(req.flipbookLibraryUser);
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'customSubdomain')) {
            const nextSubdomain = cleanSubdomain(req.body.customSubdomain);
            if (nextSubdomain && !hasPaidBranding(quota)) {
                return res.status(403).json({ message: 'A paid Publica plan is required for a custom LMSGEN subdomain.', code: 'PUBLICA_PAID_SUBDOMAIN_REQUIRED' });
            }
            await assertSubdomainAvailable(nextSubdomain, library.id);
            library.customSubdomain = nextSubdomain;
        }
        await library.save();
        const books = await publishedBooks(req.flipbookLibraryUser.id);
        res.json({ library: libraryPayload(library, books, { quota }) });
    } catch (err) {
        next(err);
    }
});

router.post('/library/regenerate-share-link', genericPlatformAuth, async (req, res, next) => {
    try {
        const library = await getOrCreateLibrary(req.flipbookLibraryUser);
        library.shareToken = shareToken();
        library.shareSlug = null;
        await library.save();
        const books = await publishedBooks(req.flipbookLibraryUser.id);
        const quota = await getQuota(req.flipbookLibraryUser);
        res.json({ library: libraryPayload(library, books, { quota }) });
    } catch (err) {
        next(err);
    }
});

router.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    console.error('[flipbook-library]', err);
    res.status(err.status || 500).json({
        message: err.message || 'Publica library request failed.',
        code: err.code || 'FLIPBOOK_LIBRARY_ERROR'
    });
});

module.exports = router;
