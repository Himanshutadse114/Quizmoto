const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const ScormAccessGrant = require('../../models/ScormAccessGrant');
const {
    ADMIN_CONTACT_EMAIL,
    SUPER_ADMIN_EMAIL,
    listGrants,
    listAccessRequests,
    approveAccessRequest,
    removeGrant
} = require('../../services/scorm/ScormAccessService');
const {
    getEntitlement,
    updateEntitlement,
    getUsageForEmail
} = require('../../services/scorm/ScormEntitlementService');

function requireSuperAdmin(req, res, next) {
    if (req.scormRole !== 'super_admin') {
        return res.status(403).json({
            message: 'Super administrator access is required.',
            code: 'SCORM_SUPER_ADMIN_REQUIRED'
        });
    }
    next();
}

async function serializeGrant(grant) {
    const protectedGrant = grant.role === 'super_admin' || grant.email === SUPER_ADMIN_EMAIL;
    const [entitlement, usage] = await Promise.all([
        getEntitlement(grant.email, protectedGrant ? 'super_admin' : grant.role),
        getUsageForEmail(grant.email)
    ]);
    return {
        id: grant.id,
        email: grant.email,
        role: grant.role,
        addedByEmail: grant.addedByEmail || null,
        createdAt: grant.createdAt,
        updatedAt: grant.updatedAt,
        protected: protectedGrant,
        entitlement,
        usage
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
        adminContact: ADMIN_CONTACT_EMAIL,
        entitlement: req.scormEntitlement || await getEntitlement(req.scormEmail, req.scormRole)
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
            grants: await Promise.all(grants.map(serializeGrant)),
            requests: requests.map(serializeRequest),
            pendingRequests: requests.filter((request) => request.status === 'pending').map(serializeRequest)
        });
    } catch (err) {
        console.error('[scorm-access] list failed', err);
        res.status(500).json({ message: 'Could not load SCORM AI access control data.' });
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
            grant: await serializeGrant(result.grant),
            request: serializeRequest(result.request)
        });
    } catch (err) {
        console.error('[scorm-access] approve request failed', err);
        res.status(500).json({ message: 'Could not approve this SCORM AI registration.' });
    }
});

router.patch('/:id/entitlement', auth, requireSuperAdmin, async (req, res) => {
    try {
        const grant = await ScormAccessGrant.findByPk(req.params.id);
        if (!grant) return res.status(404).json({ message: 'Access grant not found.' });
        if (grant.role === 'super_admin' || grant.email === SUPER_ADMIN_EMAIL) {
            return res.status(400).json({ message: 'The super administrator always has unrestricted access.' });
        }

        await updateEntitlement(grant.email, req.body || {}, {
            userId: req.userId,
            email: req.scormEmail
        });
        res.json({
            ok: true,
            grant: await serializeGrant(grant)
        });
    } catch (err) {
        console.error('[scorm-access] entitlement update failed', err);
        res.status(500).json({ message: 'Could not update this user’s limits and permissions.' });
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
