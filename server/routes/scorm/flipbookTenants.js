const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const {
    listTenantFlipbookManagement,
    setTenantEntitlement
} = require('../../services/FlipbookTenantService');

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
        res.json({ tenants: await listTenantFlipbookManagement(), defaultLimit: 3 });
    } catch (err) {
        console.error('[flipbook-tenants] list failed', err);
        res.status(err.status || 500).json({ message: err.message || 'Could not load tenant Flipbook controls.', code: err.code });
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
        res.status(err.status || 500).json({ message: err.message || 'Could not update tenant Flipbook controls.', code: err.code });
    }
});

module.exports = router;
