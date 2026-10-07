const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const {
    listTenantFlipbookManagement,
    setTenantEntitlement
} = require('../../services/FlipbookTenantService');
const {
    getPlatformDefaultFlipbook,
    listPlatformDefaultCandidates,
    setPlatformDefaultFlipbook,
    clearPlatformDefaultFlipbook
} = require('../../services/FlipbookService');

function requireSuperAdmin(req, res, next) {
    if (req.scormRole !== 'super_admin') {
        return res.status(403).json({
            message: 'Super administrator access is required.',
            code: 'FLIPBOOK_SUPER_ADMIN_REQUIRED'
        });
    }
    next();
}

router.get('/', auth, requireSuperAdmin, async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store');
        const [tenants, selected, candidates] = await Promise.all([
            listTenantFlipbookManagement(),
            getPlatformDefaultFlipbook(),
            listPlatformDefaultCandidates(req.userId)
        ]);
        res.json({
            tenants,
            defaultLimit: 3,
            platformDefault: selected ? {
                id: selected.id,
                title: selected.title,
                pageCount: Number(selected.pageCount || 0),
                updatedAt: selected.updatedAt
            } : null,
            defaultCandidates: candidates.map((book) => ({
                id: book.id,
                title: book.title,
                description: book.description || null,
                pageCount: Number(book.pageCount || 0),
                updatedAt: book.updatedAt
            }))
        });
    } catch (err) {
        console.error('[flipbook-tenants] list failed', err);
        res.status(err.status || 500).json({ message: err.message || 'Could not load tenant Publica controls.', code: err.code });
    }
});

router.put('/default/:flipbookId', auth, requireSuperAdmin, async (req, res) => {
    try {
        const book = await setPlatformDefaultFlipbook({
            flipbookId: req.params.flipbookId,
            ownerUserId: req.userId
        });
        res.json({
            platformDefault: {
                id: book.id,
                title: book.title,
                pageCount: Number(book.pageCount || 0),
                updatedAt: book.updatedAt
            }
        });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Could not set the default Publica item.', code: err.code });
    }
});

router.delete('/default', auth, requireSuperAdmin, async (req, res) => {
    try {
        await clearPlatformDefaultFlipbook();
        res.json({ removed: true });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Could not clear the default Publica item.', code: err.code });
    }
});

router.patch('/:workspaceId', auth, requireSuperAdmin, async (req, res) => {
    try {
        const result = await setTenantEntitlement({
            workspaceId: req.params.workspaceId,
            enabled: Object.prototype.hasOwnProperty.call(req.body || {}, 'enabled') ? req.body.enabled : undefined,
            maxFlipbooks: Object.prototype.hasOwnProperty.call(req.body || {}, 'maxFlipbooks') ? req.body.maxFlipbooks : undefined,
            actorUserId: req.authenticatedUserId || req.userId,
            actorEmail: req.scormEmail
        });
        res.json({ tenant: { id: result.workspace.id, name: result.workspace.name, quota: result.quota } });
    } catch (err) {
        console.error('[flipbook-tenants] update failed', err);
        res.status(err.status || 500).json({ message: err.message || 'Could not update tenant Publica controls.', code: err.code });
    }
});

module.exports = router;
