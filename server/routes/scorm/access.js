const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const ScormAccessGrant = require('../../models/ScormAccessGrant');
const {
    ADMIN_CONTACT_EMAIL,
    SUPER_ADMIN_EMAIL,
    normalizeScormRole,
    listGrants,
    listAccessRequests,
    approveAccessRequest,
    removeGrant
} = require('../../services/scorm/ScormAccessService');
const { serializeWorkspace } = require('../../services/scorm/ScormWorkspaceService');
const {
    listTenants,
    createTenant,
    updateTenantEntitlement,
    changeTenantAdmin,
    setTenantStatus
} = require('../../services/scorm/ScormTenantService');
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
    const role = normalizeScormRole(grant.role);
    const protectedGrant = role === 'super_admin' || grant.email === SUPER_ADMIN_EMAIL;
    const [entitlement, usage] = await Promise.all([
        getEntitlement(grant.email, protectedGrant ? 'super_admin' : role),
        getUsageForEmail(grant.email)
    ]);
    return {
        id: grant.id,
        email: grant.email,
        role,
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
        role: normalizeScormRole(req.scormRole || 'admin'),
        isSuperAdmin: req.scormRole === 'super_admin',
        adminContact: ADMIN_CONTACT_EMAIL,
        workspace: serializeWorkspace(req.scormWorkspace),
        tenant: serializeWorkspace(req.scormWorkspace),
        workspaceId: req.scormWorkspaceId || null,
        tenantId: req.scormWorkspaceId || null,
        hostId: req.scormHostId || req.userId || null,
        entitlementOwnerEmail: req.scormEntitlementEmail || req.scormEmail || null,
        entitlement: req.scormEntitlement || await getEntitlement(
            req.scormEntitlementEmail || req.scormEmail,
            req.scormRole === 'super_admin' ? 'super_admin' : 'admin'
        )
    });
});

router.get('/tenants', auth, requireSuperAdmin, async (req, res) => {
    try {
        res.json({ tenants: await listTenants() });
    } catch (err) {
        console.error('[scorm-access] tenant list failed', err);
        res.status(err.status || 500).json({ message: err.message || 'Could not load tenants.', code: err.code });
    }
});

router.post('/tenants', auth, requireSuperAdmin, async (req, res) => {
    try {
        const tenant = await createTenant({
            name: req.body?.name,
            adminEmail: req.body?.adminEmail,
            adminName: req.body?.adminName,
            entitlement: req.body?.entitlement || {},
            actorUserId: req.authenticatedUserId || req.userId,
            actorEmail: req.scormEmail
        });
        res.status(201).json({ tenant });
    } catch (err) {
        console.error('[scorm-access] tenant create failed', err);
        res.status(err.status || 500).json({ message: err.message || 'Could not create tenant.', code: err.code });
    }
});

router.patch('/tenants/:workspaceId/entitlement', auth, requireSuperAdmin, async (req, res) => {
    try {
        const tenant = await updateTenantEntitlement({
            workspaceId: req.params.workspaceId,
            patch: req.body || {},
            actorUserId: req.authenticatedUserId || req.userId,
            actorEmail: req.scormEmail
        });
        res.json({ tenant });
    } catch (err) {
        console.error('[scorm-access] tenant entitlement update failed', err);
        res.status(err.status || 500).json({ message: err.message || 'Could not update tenant limits and features.', code: err.code });
    }
});

router.patch('/tenants/:workspaceId/admin', auth, requireSuperAdmin, async (req, res) => {
    try {
        const tenant = await changeTenantAdmin({
            workspaceId: req.params.workspaceId,
            adminEmail: req.body?.adminEmail,
            adminName: req.body?.adminName,
            actorUserId: req.authenticatedUserId || req.userId,
            actorEmail: req.scormEmail
        });
        res.json({ tenant });
    } catch (err) {
        console.error('[scorm-access] tenant admin change failed', err);
        res.status(err.status || 500).json({ message: err.message || 'Could not change Tenant Admin.', code: err.code });
    }
});

router.patch('/tenants/:workspaceId/status', auth, requireSuperAdmin, async (req, res) => {
    try {
        const tenant = await setTenantStatus({ workspaceId: req.params.workspaceId, status: req.body?.status });
        res.json({ tenant });
    } catch (err) {
        console.error('[scorm-access] tenant status change failed', err);
        res.status(err.status || 500).json({ message: err.message || 'Could not update tenant status.', code: err.code });
    }
});

// Legacy account-grant data remains readable during migration. New customer
// administration uses the first-class tenant endpoints above.
router.get('/', auth, requireSuperAdmin, async (req, res) => {
    try {
        const [grants, requests, tenants] = await Promise.all([listGrants(), listAccessRequests(), listTenants()]);
        res.json({
            superAdminEmail: SUPER_ADMIN_EMAIL,
            adminContact: ADMIN_CONTACT_EMAIL,
            tenants,
            grants: await Promise.all(grants.map(serializeGrant)),
            requests: requests.map(serializeRequest),
            pendingRequests: requests.filter((request) => request.status === 'pending').map(serializeRequest)
        });
    } catch (err) {
        console.error('[scorm-access] list failed', err);
        res.status(500).json({ message: 'Could not load LMSGEN access control data.' });
    }
});

router.post('/requests/:id/approve', auth, requireSuperAdmin, async (req, res) => {
    try {
        const result = await approveAccessRequest(req.params.id, {
            approvedByUserId: req.authenticatedUserId || req.userId,
            approvedByEmail: req.scormEmail
        });
        if (!result.ok && result.reason === 'not_found') return res.status(404).json({ message: 'Pending LMSGEN registration not found.' });
        if (!result.ok && result.reason === 'super_admin') return res.status(400).json({ message: 'The LMSGEN Super Admin is already authorised.' });
        res.json({
            approved: true,
            grant: await serializeGrant(result.grant),
            request: serializeRequest(result.request),
            warning: 'Account approval does not create a tenant. Assign this email through Tenant Management before LMSGEN access is available.'
        });
    } catch (err) {
        console.error('[scorm-access] approve request failed', err);
        res.status(500).json({ message: 'Could not approve this LMSGEN registration.' });
    }
});

router.patch('/:id/entitlement', auth, requireSuperAdmin, async (req, res) => {
    try {
        const grant = await ScormAccessGrant.findByPk(req.params.id);
        if (!grant) return res.status(404).json({ message: 'Access grant not found.' });
        const role = normalizeScormRole(grant.role);
        if (role === 'super_admin' || grant.email === SUPER_ADMIN_EMAIL) {
            return res.status(400).json({ message: 'The Super Admin always has unrestricted access.' });
        }
        if (role === 'co_admin' || role === 'analytics_viewer') {
            return res.status(400).json({ message: 'Team members inherit tenant limits and permissions.', code: 'SCORM_WORKSPACE_ENTITLEMENT_INHERITED' });
        }

        await updateEntitlement(grant.email, req.body || {}, {
            userId: req.authenticatedUserId || req.userId,
            email: req.scormEmail
        });
        res.json({ ok: true, grant: await serializeGrant(grant) });
    } catch (err) {
        console.error('[scorm-access] entitlement update failed', err);
        res.status(500).json({ message: 'Could not update limits and permissions.' });
    }
});

router.delete('/:id', auth, requireSuperAdmin, async (req, res) => {
    try {
        const result = await removeGrant(req.params.id);
        if (!result.removed && result.reason === 'not_found') return res.status(404).json({ message: 'Access grant not found.' });
        if (!result.removed && result.reason === 'super_admin') return res.status(400).json({ message: 'The LMSGEN Super Admin cannot be removed.' });
        res.json({ removed: true, id: Number(req.params.id) || req.params.id, pendingAgain: Boolean(result.request) });
    } catch (err) {
        console.error('[scorm-access] remove failed', err);
        res.status(500).json({ message: 'Could not remove LMSGEN access.' });
    }
});

module.exports = router;
