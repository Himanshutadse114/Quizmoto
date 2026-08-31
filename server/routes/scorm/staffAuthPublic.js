const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {
    getPublicStaffAuthConfig,
    verifyStaffIdentity,
    discoverStaffPolicy
} = require('../../services/scorm/ScormStaffAuthService');
const {
    addGrant
} = require('../../services/scorm/ScormAccessService');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const staffSsoLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    message: {
        message: 'Too many staff sign-in attempts. Please wait a few minutes and try again.',
        code: 'SCORM_STAFF_AUTH_RATE_LIMITED'
    }
});

function issueScormToken(user, role, workspaceId) {
    return jwt.sign({
        userId: user.id,
        scope: 'scorm',
        scormRole: role,
        workspaceId
    }, JWT_SECRET, { expiresIn: '30d' });
}

function responseFor(result) {
    const token = issueScormToken(result.user, result.role, result.workspace.id);
    return {
        token,
        username: result.user.username,
        avatar: result.user.avatar || null,
        email: result.user.email || null,
        role: result.role,
        isSuperAdmin: false,
        product: 'scorm-ai',
        platformAccess: true,
        scormAccess: true,
        pendingApproval: false,
        workspaceId: result.workspace.id,
        workspaceName: result.workspace.name,
        authMethod: result.identity.provider,
        staffSso: true
    };
}

router.post('/discover', staffSsoLimiter, async (req, res) => {
    try {
        const result = await discoverStaffPolicy(req.body?.email);
        res.setHeader('Cache-Control', 'no-store');
        res.json({
            ok: true,
            workspaceId: result.workspace.id,
            workspaceName: result.workspace.name,
            discoverySource: result.source,
            config: result.publicConfig
        });
    } catch (err) {
        res.status(err.status || 500).json({
            message: err.message || 'Unable to identify your organisation.',
            code: err.code
        });
    }
});

router.get('/workspace/:workspaceId/config', async (req, res) => {
    try {
        const config = await getPublicStaffAuthConfig(req.params.workspaceId);
        res.setHeader('Cache-Control', 'no-store');
        res.json({ ok: true, config });
    } catch (err) {
        res.status(err.status || 500).json({
            message: err.message || 'Unable to load workspace staff sign-in.',
            code: err.code
        });
    }
});

async function login(req, res, provider) {
    try {
        const result = await verifyStaffIdentity({
            workspaceId: req.params.workspaceId,
            provider,
            credential: provider === 'microsoft'
                ? (req.body?.idToken || req.body?.credential)
                : req.body?.credential
        });

        await addGrant({
            email: result.user.email,
            role: result.role,
            addedByUserId: result.workspace.ownerUserId,
            addedByEmail: null
        });

        res.json(responseFor(result));
    } catch (err) {
        res.status(err.status || 500).json({
            message: err.message || `${provider === 'google' ? 'Google' : 'Microsoft'} staff sign-in failed.`,
            code: err.code
        });
    }
}

router.post('/workspace/:workspaceId/google', staffSsoLimiter, (req, res) => login(req, res, 'google'));
router.post('/workspace/:workspaceId/microsoft', staffSsoLimiter, (req, res) => login(req, res, 'microsoft'));

module.exports = router;
