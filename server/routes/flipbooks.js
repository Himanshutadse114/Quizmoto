const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const Flipbook = require('../models/Flipbook');
const { getObjectStorage } = require('../storage/ObjectStorage');
const {
    ensureFlipbookSchema,
    isSuperAdmin,
    getQuota,
    assertCanCreate,
    setUserLimit,
    createShareToken,
    appendPage,
    clearPages,
    deleteFlipbook,
    listAdminUsers,
    MAX_PAGES
} = require('../services/FlipbookService');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

function sanitiseText(value, maxLength) {
    const text = String(value || '').trim();
    return text ? text.slice(0, maxLength) : '';
}

function ownerPayload(book) {
    const pageCount = Number(book.pageCount || 0);
    const published = book.status === 'published' && book.shareEnabled;
    return {
        id: book.id,
        title: book.title,
        description: book.description || '',
        status: book.status,
        shareEnabled: Boolean(book.shareEnabled),
        shareToken: book.shareToken,
        sharePath: published ? `/flipbook/${book.shareToken}` : null,
        coverPath: published && pageCount ? `/api/scorm/flipbooks/public/${book.shareToken}/pages/0` : null,
        pageCount,
        viewCount: Number(book.viewCount || 0),
        lastViewedAt: book.lastViewedAt || null,
        publishedAt: book.publishedAt || null,
        theme: book.theme || {},
        createdAt: book.createdAt,
        updatedAt: book.updatedAt
    };
}

function publicPayload(book) {
    const pageCount = Number(book.pageCount || 0);
    return {
        id: book.id,
        title: book.title,
        description: book.description || '',
        pageCount,
        viewCount: Number(book.viewCount || 0),
        publishedAt: book.publishedAt || null,
        theme: book.theme || {},
        pages: Array.from({ length: pageCount }, (_, index) => ({
            index,
            src: `/api/scorm/flipbooks/public/${book.shareToken}/pages/${index}`
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
        req.flipbookUser = user;
        req.authenticatedUserId = user.id;
        next();
    } catch (_) {
        return res.status(401).json({ message: 'Token is not valid' });
    }
}

async function requireSuperAdmin(req, res, next) {
    try {
        if (!(await isSuperAdmin(req.flipbookUser))) {
            return res.status(403).json({ message: 'Super administrator access is required.', code: 'FLIPBOOK_SUPER_ADMIN_REQUIRED' });
        }
        next();
    } catch (err) {
        next(err);
    }
}

async function findOwnedBook(req, res, next) {
    try {
        await ensureFlipbookSchema();
        const book = await Flipbook.findOne({ where: { id: req.params.id, ownerUserId: req.flipbookUser.id } });
        if (!book) return res.status(404).json({ message: 'Flipbook not found.' });
        req.flipbook = book;
        next();
    } catch (err) {
        next(err);
    }
}

// Public reader endpoints deliberately sit before private authentication.
router.get('/public/:shareToken', async (req, res, next) => {
    try {
        await ensureFlipbookSchema();
        const book = await Flipbook.findOne({
            where: { shareToken: req.params.shareToken, status: 'published', shareEnabled: true }
        });
        if (!book) return res.status(404).json({ message: 'This flipbook is not available.' });
        res.json({ flipbook: publicPayload(book) });
    } catch (err) {
        next(err);
    }
});

router.get('/public/:shareToken/pages/:index', async (req, res, next) => {
    try {
        await ensureFlipbookSchema();
        const book = await Flipbook.findOne({
            where: { shareToken: req.params.shareToken, status: 'published', shareEnabled: true }
        });
        if (!book) return res.status(404).end();
        const pages = Array.isArray(book.pages) ? book.pages : [];
        const index = Number(req.params.index);
        if (!Number.isInteger(index) || index < 0 || index >= pages.length) return res.status(404).end();
        const object = await getObjectStorage().getObjectStream(pages[index].key);
        res.setHeader('Content-Type', object.contentType || pages[index].contentType || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
        if (object.contentLength) res.setHeader('Content-Length', object.contentLength);
        object.stream.on('error', next);
        object.stream.pipe(res);
    } catch (err) {
        next(err);
    }
});

router.post('/public/:shareToken/view', async (req, res, next) => {
    try {
        await ensureFlipbookSchema();
        const book = await Flipbook.findOne({
            where: { shareToken: req.params.shareToken, status: 'published', shareEnabled: true }
        });
        if (!book) return res.status(404).json({ message: 'This flipbook is not available.' });
        book.viewCount = Number(book.viewCount || 0) + 1;
        book.lastViewedAt = new Date();
        await book.save();
        res.json({ ok: true, viewCount: book.viewCount });
    } catch (err) {
        next(err);
    }
});

router.use(genericPlatformAuth);

router.get('/admin/users', requireSuperAdmin, async (req, res, next) => {
    try {
        const users = await listAdminUsers(req.query.q || '');
        res.json({ defaultLimit: 3, users });
    } catch (err) {
        next(err);
    }
});

router.patch('/admin/users/:userId/limit', requireSuperAdmin, async (req, res, next) => {
    try {
        const result = await setUserLimit({
            userId: req.params.userId,
            maxFlipbooks: req.body?.maxFlipbooks,
            actorUserId: req.flipbookUser.id,
            actorEmail: req.flipbookUser.email
        });
        res.json({
            user: {
                id: result.user.id,
                username: result.user.username || null,
                email: result.user.email || null,
                quota: result.quota
            }
        });
    } catch (err) {
        next(err);
    }
});

router.get('/quota', async (req, res, next) => {
    try {
        res.json({ quota: await getQuota(req.flipbookUser), maxPages: MAX_PAGES });
    } catch (err) {
        next(err);
    }
});

router.get('/', async (req, res, next) => {
    try {
        await ensureFlipbookSchema();
        const books = await Flipbook.findAll({
            where: { ownerUserId: req.flipbookUser.id },
            order: [['updatedAt', 'DESC']]
        });
        res.json({
            flipbooks: books.map(ownerPayload),
            quota: await getQuota(req.flipbookUser),
            maxPages: MAX_PAGES
        });
    } catch (err) {
        next(err);
    }
});

router.post('/', async (req, res, next) => {
    try {
        await ensureFlipbookSchema();
        await assertCanCreate(req.flipbookUser);
        const title = sanitiseText(req.body?.title, 180) || 'Untitled flipbook';
        const description = sanitiseText(req.body?.description, 3000) || null;
        const book = await Flipbook.create({
            ownerUserId: req.flipbookUser.id,
            ownerEmail: String(req.flipbookUser.email || '').trim().toLowerCase() || null,
            title,
            description,
            shareToken: createShareToken(),
            status: 'draft',
            shareEnabled: true,
            pages: [],
            pageCount: 0,
            theme: {}
        });
        res.status(201).json({ flipbook: ownerPayload(book), quota: await getQuota(req.flipbookUser) });
    } catch (err) {
        next(err);
    }
});

router.get('/:id', findOwnedBook, async (req, res) => {
    res.json({ flipbook: ownerPayload(req.flipbook), quota: await getQuota(req.flipbookUser), maxPages: MAX_PAGES });
});

router.post('/:id/pages', findOwnedBook, async (req, res, next) => {
    try {
        const page = await appendPage({
            flipbook: req.flipbook,
            dataUrl: req.body?.dataUrl,
            width: req.body?.width,
            height: req.body?.height
        });
        res.status(201).json({ ok: true, page, pageCount: req.flipbook.pageCount });
    } catch (err) {
        next(err);
    }
});

router.delete('/:id/pages', findOwnedBook, async (req, res, next) => {
    try {
        await clearPages(req.flipbook);
        res.json({ ok: true, pageCount: 0 });
    } catch (err) {
        next(err);
    }
});

router.patch('/:id', findOwnedBook, async (req, res, next) => {
    try {
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'title')) {
            req.flipbook.title = sanitiseText(req.body.title, 180) || 'Untitled flipbook';
        }
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'description')) {
            req.flipbook.description = sanitiseText(req.body.description, 3000) || null;
        }
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'shareEnabled')) {
            req.flipbook.shareEnabled = Boolean(req.body.shareEnabled);
        }
        if (req.body?.theme && typeof req.body.theme === 'object' && !Array.isArray(req.body.theme)) {
            req.flipbook.theme = {
                background: sanitiseText(req.body.theme.background, 40) || undefined,
                accent: sanitiseText(req.body.theme.accent, 40) || undefined
            };
        }
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'status')) {
            const nextStatus = req.body.status === 'published' ? 'published' : 'draft';
            if (nextStatus === 'published' && Number(req.flipbook.pageCount || 0) < 1) {
                return res.status(400).json({ message: 'Add at least one page before publishing.' });
            }
            req.flipbook.status = nextStatus;
            if (nextStatus === 'published' && !req.flipbook.publishedAt) req.flipbook.publishedAt = new Date();
        }
        await req.flipbook.save();
        res.json({ flipbook: ownerPayload(req.flipbook), quota: await getQuota(req.flipbookUser) });
    } catch (err) {
        next(err);
    }
});

router.post('/:id/regenerate-share-link', findOwnedBook, async (req, res, next) => {
    try {
        req.flipbook.shareToken = createShareToken();
        await req.flipbook.save();
        res.json({ flipbook: ownerPayload(req.flipbook) });
    } catch (err) {
        next(err);
    }
});

router.delete('/:id', findOwnedBook, async (req, res, next) => {
    try {
        await deleteFlipbook(req.flipbook);
        res.json({ removed: true, id: req.params.id, quota: await getQuota(req.flipbookUser) });
    } catch (err) {
        next(err);
    }
});

router.use((err, req, res, next) => {
    console.error('[flipbooks]', err);
    if (res.headersSent) return next(err);
    res.status(err.status || 500).json({
        message: err.message || 'Flipbook request failed.',
        code: err.code || 'FLIPBOOK_ERROR',
        quota: err.quota || undefined
    });
});

module.exports = router;
