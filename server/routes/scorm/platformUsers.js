const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const {
    listPlatformUsers,
    assignPlatformUser,
    unassignPlatformUser
} = require('../../services/scorm/ScormPlatformUserService');

function requireSuperAdmin(req, res, next) {
    if (req.scormRole !== 'super_admin') {
        return res.status(403).json({
            message: 'Super administrator access is required.',
            code: 'SCORM_SUPER_ADMIN_REQUIRED'
        });
    }
    next();
}

router.use(auth, requireSuperAdmin);

router.get('/', async (req, res) => {
    try {
        const users = await listPlatformUsers({
            search: req.query.q || '',
            scope: req.query.scope || 'all'
        });
        res.json({ users });
    } catch (err) {
        console.error('[scorm-platform-users] list failed', err);
        res.status(err.status || 500).json({
            message: err.message || 'Could not load platform users.',
            code: err.code
        });
    }
});

router.patch('/:userId/tenant', async (req, res) => {
    try {
        const result = await assignPlatformUser({
            userId: req.params.userId,
            workspaceId: req.body?.workspaceId,
            role: req.body?.role,
            moveExisting: Boolean(req.body?.moveExisting),
            actorUserId: req.authenticatedUserId || req.userId,
            actorEmail: req.scormEmail
        });
        res.json({ ok: true, ...result });
    } catch (err) {
        console.error('[scorm-platform-users] assignment failed', err);
        res.status(err.status || 500).json({
            message: err.message || 'Could not assign this platform user.',
            code: err.code
        });
    }
});

router.delete('/:userId/tenant', async (req, res) => {
    try {
        const result = await unassignPlatformUser({ userId: req.params.userId });
        res.json({ ok: true, ...result });
    } catch (err) {
        console.error('[scorm-platform-users] unassign failed', err);
        res.status(err.status || 500).json({
            message: err.message || 'Could not unassign this platform user.',
            code: err.code
        });
    }
});

module.exports = router;
