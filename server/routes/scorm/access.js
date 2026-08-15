const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const {
    ADMIN_CONTACT_EMAIL,
    SUPER_ADMIN_EMAIL,
    listGrants,
    listAccessRequests,
    addGrant,
    approveAccessRequest,
    removeGrant
} = require('../../services/scorm/ScormAccessService');

function requireSuperAdmin(req, res, next) {
    if (req.scormRole !== 'super_admin') {
        return res.status(403).json({
            message: 'Super administrator access is required.',
            code: 'SCORM_SUPER_ADMIN_REQUIRED'
        });
    }
    next();
}

function serializeGrant(grant) {
    return {
        id: grant.id,
        email: grant.email,
        role: grant.role,
        addedByEmail: grant.addedByEmail || null,
        createdAt: grant.createdAt,
        updatedAt: grant.updatedAt,
        protected: grant.role === 'super_admin' || grant.email === SUPER_ADMIN_EMAIL
    };
}

function serializeRequest(request) {
    return {
        id: request.id,
        userId: request.userId || null,
        email: request.email,
        username: request.username || null,
        authMethod: request.authMethod || 'password',
        status: request.status || 'pending',
        requestedAt: request.requestedAt || request.createdAt,
        approvedAt: request.approvedAt || null,
        approvedByEmail: request.approvedByEmail || null,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt
    };
}

router.get('/me', auth, async (req, res) => {
    res.json({
        email: req.scormEmail || null,
        role: req.scormRole || 'user',
        isSuperAdmin: req.scormRole === 'super_admin',
        adminContact: ADMIN_CONTACT_EMAIL
    });
});

router.get('/', auth, requireSuperAdmin, async (req, res) => {
    try {
        const [grants, requests] = await Promise.all([
            listGrants(),
            listAccessRequests()
        ]);
        res.json({
            superAdminEmail: SUPER_ADMIN_EMAIL,
            adminContact: ADMIN_CONTACT_EMAIL,
            grants: grants.map(serializeGrant),
            requests: requests.map(serializeRequest),
            pendingRequests: requests.filter((request) => request.status === 'pending').map(serializeRequest)
        });
    } catch (err) {
        console.error('[scorm-access] list failed', err);
        res.status(500).json({ message: 'Could not load SCORM AI access control data.' });
    }
});

// Proactive approval by exact email. Useful when the Super Admin wants to allow
// an account before the person registers or tries Google Sign-In.
router.post('/', auth, requireSuperAdmin, async (req, res) => {
    try {
        const result = await addGrant({
            email: req.body?.email,
            addedByUserId: req.userId,
            addedByEmail: req.scormEmail
        });
        res.status(201).json({ grant: serializeGrant(result.grant) });
    } catch (err) {
        if (err.code === 'INVALID_EMAIL') {
            return res.status(400).json({ message: err.message });
        }
        console.error('[scorm-access] add failed', err);
        res.status(500).json({ message: 'Could not add SCORM AI access.' });
    }
});

// Approve a captured SCORM registration/Google access request. The underlying
// user account and password remain unchanged, so the user signs in with the
// same credentials they registered before approval.
router.post('/requests/:id/approve', auth, requireSuperAdmin, async (req, res) => {
    try {
        const result = await approveAccessRequest(req.params.id, {
            approvedByUserId: req.userId,
            approvedByEmail: req.scormEmail
        });
        if (!result.ok && result.reason === 'not_found') {
            return res.status(404).json({ message: 'Pending SCORM AI registration not found.' });
        }
        if (!result.ok && result.reason === 'super_admin') {
            return res.status(400).json({ message: 'The SCORM AI super administrator is already authorised.' });
        }
        res.json({
            approved: true,
            grant: serializeGrant(result.grant),
            request: serializeRequest(result.request)
        });
    } catch (err) {
        console.error('[scorm-access] approve request failed', err);
        res.status(500).json({ message: 'Could not approve this SCORM AI registration.' });
    }
});

router.delete('/:id', auth, requireSuperAdmin, async (req, res) => {
    try {
        const result = await removeGrant(req.params.id);
        if (!result.removed && result.reason === 'not_found') {
            return res.status(404).json({ message: 'Access grant not found.' });
        }
        if (!result.removed && result.reason === 'super_admin') {
            return res.status(400).json({ message: 'The SCORM AI super administrator cannot be removed.' });
        }
        res.json({
            removed: true,
            id: Number(req.params.id) || req.params.id,
            pendingAgain: Boolean(result.request)
        });
    } catch (err) {
        console.error('[scorm-access] remove failed', err);
        res.status(500).json({ message: 'Could not remove SCORM AI access.' });
    }
});

module.exports = router;
