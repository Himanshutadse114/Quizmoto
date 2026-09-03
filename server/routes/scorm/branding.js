const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const { getWorkspaceBranding, saveWorkspaceBranding } = require('../../services/scorm/ScormBrandingService');

function requireWorkspaceAdmin(req, res, next) {
    const canManageWorkspace = req.scormRole === 'admin' || req.scormRole === 'super_admin';
    if (!canManageWorkspace) {
        return res.status(403).json({
            message: 'Only the primary workspace Admin can change branding settings.',
            code: 'SCORM_WORKSPACE_ADMIN_REQUIRED'
        });
    }
    if (!req.scormWorkspaceId) {
        return res.status(400).json({ message: 'Workspace is required.', code: 'SCORM_WORKSPACE_REQUIRED' });
    }
    next();
}

router.get('/', auth, requireWorkspaceAdmin, async (req, res) => {
    try {
        const branding = await getWorkspaceBranding(req.scormWorkspaceId);
        res.json({ ok: true, ...branding });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to load branding settings.', code: err.code });
    }
});

router.put('/', auth, requireWorkspaceAdmin, async (req, res) => {
    try {
        const branding = await saveWorkspaceBranding({
            workspaceId: req.scormWorkspaceId,
            logoDataUrl: req.body?.logoDataUrl || null
        });
        res.json({ ok: true, ...branding });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to save branding settings.', code: err.code });
    }
});

module.exports = router;
