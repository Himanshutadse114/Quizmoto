const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const { assertActiveAccount } = require('../services/AccountProfileService');
const Flipbook = require('../models/Flipbook');
const { getObjectStorage } = require('../storage/ObjectStorage');
const {
    isDirectUploadEnabled,
    prepareDirectUpload,
    redirectToSignedObject
} = require('../storage/DirectObjectDelivery');
const { renderFlipbookReader } = require('../views/flipbookReader');
const {
    ensureFlipbookSchema,
    isSuperAdmin,
    getQuota,
    assertCanCreate,
    setUserLimit,
    createShareToken,
    createPageStorageKey,
    validateStoredPage,
    appendStoredPage,
    appendPage,
    clearPages,
    deleteFlipbook,
    listAdminUsers,
    MAX_PAGES,
    MAX_PAGE_BYTES
} = require('../services/FlipbookService');
const {
    cleanShareSlug,
    shareIdentifier,
    publicationUrl,
    assertBookSlugAvailable,
    publicIdentifierWhere
} = require('../services/PublicaBrandingService');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
function sanitiseText(value, maxLength) {
    const text = String(value || '').trim();
    return text ? text.slice(0, maxLength) : '';
}

function publicFlipbookUrl(book) {
    return publicationUrl(book);
}

async function findPublicBook(identifier) {
    return Flipbook.findOne({
        where: { ...publicIdentifierWhere(identifier), status: 'published', shareEnabled: true }
    });
}

function renderPublicReader(book) {
    const publicUrl = publicFlipbookUrl(book);
    const publicTitle = String(book.title || 'Publication');
    const mobileOverrides = `
<style id="lmsgen-public-flipbook-mobile-overrides">
@media(max-width:760px){
  #zoomOutBtn,#zoomInBtn{display:none!important}
  .tool-group{grid-template-columns:1fr!important}
  #zoomResetBtn{width:100%!important}
}
</style>`;
    const canonicalShareScript = `
<script>
(() => {
  const publicUrl = ${JSON.stringify(publicUrl)};
  const publicTitle = ${JSON.stringify(publicTitle)};
  const shareButton = document.getElementById('shareBtn');
  if (!shareButton) return;
  shareButton.onclick = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: publicTitle, url: publicUrl });
      } else {
        await navigator.clipboard.writeText(publicUrl);
        const original = shareButton.innerHTML;
        shareButton.textContent = 'Copied';
        setTimeout(() => { shareButton.innerHTML = original; }, 1200);
      }
    } catch (_) {}
  };
})();
</script>`;

    return renderFlipbookReader(book)
        .replace('</head>', `${mobileOverrides}</head>`)
        .replace('</body>', `${canonicalShareScript}</body>`);
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
        shareSlug: book.shareSlug || '',
        shareIdentifier: shareIdentifier(book),
        sharePath: published ? publicFlipbookUrl(book) : null,
        coverPath: published && pageCount ? `/api/scorm/flipbooks/public/${shareIdentifier(book)}/pages/0` : null,
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
        shareUrl: publicFlipbookUrl(book),
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
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        const user = assertActiveAccount(await User.findByPk(decoded.userId));
        if (Number(decoded.authVersion || 0) !== Number(user.authVersion || 0)) {
            return res.status(401).json({ message: 'Session expired. Sign in again.', code: 'AUTH_SESSION_REVOKED' });
        }
        req.flipbookUser = user;
        req.authenticatedUserId = user.id;
        next();
    } catch (err) {
        return res.status(err.status || 401).json({ message: err.message || 'Token is not valid', code: err.code });
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
        if (!book) return res.status(404).json({ message: 'Publication not found.' });
        req.flipbook = book;
        next();
    } catch (err) {
        next(err);
    }
}

// Public reader endpoints deliberately sit before private authentication.
router.get('/public/:shareToken/view', async (req, res, next) => {
    try {
        await ensureFlipbookSchema();
        const book = await findPublicBook(req.params.shareToken);
        if (!book) {
            return res.status(404).type('html').send('<!doctype html><html><body style="font-family:Arial;padding:40px"><h1>Publication unavailable</h1><p>This link is invalid, unpublished or has been disabled.</p></body></html>');
        }
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
        res.setHeader('Content-Security-Policy', "default-src 'self' https://cdn.jsdelivr.net; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; connect-src 'self'; frame-ancestors *");
        res.type('html').send(renderPublicReader(book));
    } catch (err) {
        next(err);
    }
});

router.get('/public/:shareToken', async (req, res, next) => {
    try {
        await ensureFlipbookSchema();
        const book = await findPublicBook(req.params.shareToken);
        if (!book) return res.status(404).json({ message: 'This publication is not available.' });
        res.json({ flipbook: publicPayload(book) });
    } catch (err) {
        next(err);
    }
});

router.get('/public/:shareToken/pages/:index', async (req, res, next) => {
    try {
        await ensureFlipbookSchema();
        const book = await findPublicBook(req.params.shareToken);
        if (!book) return res.status(404).end();
        const pages = Array.isArray(book.pages) ? book.pages : [];
        const index = Number(req.params.index);
        if (!Number.isInteger(index) || index < 0 || index >= pages.length) return res.status(404).end();
        const storage = getObjectStorage();
        if (await redirectToSignedObject(res, storage, pages[index].key, {
            expiresIn: 60 * 60,
            contentType: pages[index].contentType || 'image/jpeg'
        })) return;
        const object = await storage.getObjectStream(pages[index].key);
        res.setHeader('Content-Type', object.contentType || pages[index].contentType || 'image/jpeg');
        res.setHeader('Cache-Control', 'private, no-store, max-age=0');
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('X-Content-Type-Options', 'nosniff');
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
        const book = await findPublicBook(req.params.shareToken);
        if (!book) return res.status(404).json({ message: 'This publication is not available.' });
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
                username: result.user.displayName || result.user.username || null,
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
        const [books, quota] = await Promise.all([
            Flipbook.findAll({
                where: { ownerUserId: req.flipbookUser.id },
                order: [['updatedAt', 'DESC']]
            }),
            getQuota(req.flipbookUser)
        ]);
        res.json({
            flipbooks: books.map(ownerPayload),
            quota,
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
        const title = sanitiseText(req.body?.title, 180) || 'Untitled publication';
        const description = sanitiseText(req.body?.description, 3000) || null;
        const nextSlug = cleanShareSlug(req.body?.shareSlug);
        await assertBookSlugAvailable(nextSlug);
        const book = await Flipbook.create({
            ownerUserId: req.flipbookUser.id,
            ownerEmail: String(req.flipbookUser.email || '').trim().toLowerCase() || null,
            title,
            description,
            shareToken: createShareToken(),
            shareSlug: nextSlug,
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

router.post('/:id/pages/upload-ticket', findOwnedBook, async (req, res, next) => {
    try {
        const storage = getObjectStorage();
        if (!(await prepareDirectUpload(storage))) return res.json({ direct: false });
        if (Number(req.flipbook.pageCount || 0) >= MAX_PAGES) {
            return res.status(400).json({ message: `A publication can contain up to ${MAX_PAGES} pages.`, code: 'FLIPBOOK_PAGE_LIMIT_REACHED' });
        }
        const contentType = String(req.body?.contentType || '').toLowerCase();
        const byteSize = Number(req.body?.byteSize || 0);
        const key = createPageStorageKey(req.flipbook, contentType);
        validateStoredPage({ flipbook: req.flipbook, key, contentType, byteSize });
        const uploadUrl = await storage.createSignedPutUrl(key, { expiresIn: 10 * 60, contentType });
        res.setHeader('Cache-Control', 'private, no-store');
        res.json({
            direct: true,
            uploadUrl,
            sourceKey: key,
            contentType,
            byteSize,
            headers: { 'Content-Type': contentType },
            expiresIn: 10 * 60
        });
    } catch (err) {
        next(err);
    }
});

router.post('/:id/pages/upload-complete', findOwnedBook, async (req, res, next) => {
    const storage = getObjectStorage();
    const key = String(req.body?.sourceKey || '');
    try {
        if (!isDirectUploadEnabled(storage)) return res.status(409).json({ message: 'Direct page upload is unavailable.' });
        const expected = validateStoredPage({
            flipbook: req.flipbook,
            key,
            contentType: req.body?.contentType,
            byteSize: req.body?.byteSize
        });
        const head = await storage.headObject(expected.key);
        if (Number(head.contentLength) !== expected.byteSize || String(head.contentType || '').toLowerCase() !== expected.contentType) {
            await storage.deleteObject(expected.key).catch(() => {});
            return res.status(400).json({ message: 'The publication page upload was incomplete. Please retry.' });
        }
        const page = await appendStoredPage({
            flipbook: req.flipbook,
            ...expected,
            width: req.body?.width,
            height: req.body?.height
        });
        res.status(201).json({ ok: true, page, pageCount: req.flipbook.pageCount });
    } catch (err) {
        const alreadyAttached = (Array.isArray(req.flipbook.pages) ? req.flipbook.pages : [])
            .some((page) => page.key === key);
        if (key && !alreadyAttached) await storage.deleteObject(key).catch(() => {});
        next(err);
    }
});

router.post('/:id/pages', findOwnedBook, async (req, res, next) => {
    try {
        if (isDirectUploadEnabled(getObjectStorage())) {
            return res.status(409).json({
                message: 'Use the secure direct upload flow for publication pages.',
                code: 'DIRECT_UPLOAD_REQUIRED'
            });
        }
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
            req.flipbook.title = sanitiseText(req.body.title, 180) || 'Untitled publication';
        }
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'description')) {
            req.flipbook.description = sanitiseText(req.body.description, 3000) || null;
        }
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'shareEnabled')) {
            req.flipbook.shareEnabled = Boolean(req.body.shareEnabled);
        }
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'shareSlug')) {
            const nextSlug = cleanShareSlug(req.body.shareSlug);
            await assertBookSlugAvailable(nextSlug, req.flipbook.id);
            req.flipbook.shareSlug = nextSlug;
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
        req.flipbook.shareSlug = null;
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
        message: err.message || 'Publica request failed.',
        code: err.code || 'FLIPBOOK_ERROR',
        quota: err.quota || undefined
    });
});

module.exports = router;
