const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const {
    getWorkspaceAndConfig,
    serializeAuthConfig,
    saveAuthConfig
} = require('../../services/scorm/ScormLearnerAuthService');
const {
    serializeStaffAuthConfig,
    saveStaffAuthConfig
} = require('../../services/scorm/ScormStaffAuthService');

function requireWorkspaceAdmin(req, res, next) {
    if (req.scormRole !== 'admin') {
        return res.status(403).json({
            message: 'Only the primary workspace Admin can change authentication settings.',
            code: 'SCORM_WORKSPACE_ADMIN_REQUIRED'
        });
    }
    if (!req.scormWorkspaceId) {
        return res.status(400).json({ message: 'Workspace is required.', code: 'SCORM_WORKSPACE_REQUIRED' });
    }
    next();
}

function linkPayload(workspaceId) {
    return {
        learnerPortalPath: `/learn/${workspaceId}`,
        staffLoginPath: `/login?workspace=${encodeURIComponent(workspaceId)}`,
        staffMicrosoftCallbackPath: `/login/workspace/${workspaceId}/microsoft/callback`,
        learnerMicrosoftCallbackPath: `/learn/${workspaceId}/microsoft/callback`
    };
}

router.get('/', auth, requireWorkspaceAdmin, async (req, res) => {
    try {
        const { workspace, config } = await getWorkspaceAndConfig(req.scormWorkspaceId);
        res.json({
            ok: true,
            config: {
                ...serializeAuthConfig(config, { workspace }),
                ...serializeStaffAuthConfig(config, { workspace })
            },
            ...linkPayload(workspace.id)
        });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to load authentication settings.', code: err.code });
    }
});

router.put('/', auth, requireWorkspaceAdmin, async (req, res) => {
    try {
        const learnerConfig = await saveAuthConfig({
            workspaceId: req.scormWorkspaceId,
            actorUserId: req.authenticatedUserId || req.userId,
            values: req.body || {}
        });
        const staffConfig = await saveStaffAuthConfig({
            workspaceId: req.scormWorkspaceId,
            actorUserId: req.authenticatedUserId || req.userId,
            values: req.body || {}
        });
        res.json({
            ok: true,
            config: { ...learnerConfig, ...staffConfig },
            ...linkPayload(req.scormWorkspaceId)
        });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to save authentication settings.', code: err.code });
    }
});

module.exports = router;
