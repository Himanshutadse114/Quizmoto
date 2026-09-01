const jwt = require('jsonwebtoken');
const {
    accessDeniedPayload
} = require('../services/scorm/ScormAccessService');
const { enforceRequestEntitlement } = require('../services/scorm/ScormEntitlementService');
const { assertScormRouteAllowed } = require('../services/scorm/ScormRbacService');
const {
    getScormRequestContext,
    invalidateScormRequestContext
} = require('../services/scorm/ScormRequestContextCache');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

module.exports = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const url = String(req.originalUrl || req.baseUrl || '');
        const isScormAdminRequest = url.startsWith('/api/scorm/');

        req.userId = decoded.userId;
        req.authenticatedUserId = decoded.userId;
        req.authScope = decoded.scope || null;
        req.authMethod = decoded.authMethod || null;

        if (isScormAdminRequest && process.env.NODE_ENV !== 'test') {
            if (decoded.scope !== 'scorm') {
                return res.status(401).json({ message: 'LMSGEN login required', code: 'SCORM_AUTH_REQUIRED' });
            }

            const mutatingRequest = !SAFE_METHODS.has(String(req.method || 'GET').toUpperCase());
            if (mutatingRequest) invalidateScormRequestContext({ userId: decoded.userId });

            const context = await getScormRequestContext(decoded.userId, {
                bypassCache: mutatingRequest
            });
            const user = context.user;
            if (!user) {
                return res.status(401).json({ message: 'LMSGEN account no longer exists.', code: 'SCORM_AUTH_REQUIRED' });
            }

            const accessRole = context.accessRole;
            if (!accessRole) return res.status(403).json(accessDeniedPayload());

            const workspaceContext = context.workspaceContext;
            req.scormRole = workspaceContext.role;
            req.scormEmail = user.email || null;
            req.scormHostId = workspaceContext.hostId;
            req.scormWorkspace = workspaceContext.workspace || null;
            req.scormWorkspaceId = workspaceContext.workspace?.id || null;
            req.scormWorkspaceMember = workspaceContext.member || null;

            // Tenant SSO policy belongs to the tenant. Exact membership chooses
            // the tenant; domains are only optional provider restrictions.
            if (workspaceContext.workspace && workspaceContext.role !== 'super_admin') {
                const policy = context.staffPolicy;
                if (policy?.publicConfig?.staffSsoRequired) {
                    const tokenWorkspaceId = String(decoded.workspaceId || '');
                    const expectedWorkspaceId = String(workspaceContext.workspace.id);
                    const authMethod = String(decoded.authMethod || '').toLowerCase();
                    const providerAllowed =
                        (authMethod === 'google' && policy.publicConfig.staffGoogleEnabled) ||
                        (authMethod === 'microsoft' && policy.publicConfig.staffMicrosoftEnabled);

                    if (tokenWorkspaceId !== expectedWorkspaceId || !providerAllowed) {
                        return res.status(403).json({
                            message: 'This tenant requires an enabled organisation SSO provider. Use the tenant Staff SSO sign-in.',
                            code: 'SCORM_STAFF_SSO_REQUIRED',
                            workspaceId: expectedWorkspaceId,
                            tenantId: expectedWorkspaceId,
                            staffLoginPath: '/login'
                        });
                    }
                }
            }

            // Existing SCORM tables are partitioned by hostId. New tenants use
            // a non-login internal host user, so human Admin changes do not move
            // or duplicate course/learner data.
            req.userId = workspaceContext.hostId;

            assertScormRouteAllowed({
                role: req.scormRole,
                method: req.method,
                url
            });

            const entitlementOwner = context.entitlementOwner || user;
            if (!entitlementOwner) {
                const err = new Error('The LMSGEN tenant data host no longer exists.');
                err.status = 403;
                err.code = 'SCORM_TENANT_HOST_REQUIRED';
                throw err;
            }
            req.scormEntitlementEmail = entitlementOwner.email || user.email || null;

            await enforceRequestEntitlement(req, {
                userId: workspaceContext.hostId,
                email: req.scormEntitlementEmail,
                role: req.scormRole === 'super_admin' ? 'super_admin' : 'admin'
            });

            // Any write may change tenant membership, SSO settings or routing
            // metadata. Clear the whole tenant cache after the response so the
            // next request observes the committed database state immediately.
            if (mutatingRequest) {
                const workspaceId = req.scormWorkspaceId;
                res.once('finish', () => invalidateScormRequestContext({
                    userId: decoded.userId,
                    workspaceId
                }));
            }
        }

        next();
    } catch (err) {
        if (err?.status) {
            return res.status(err.status).json({
                message: err.message,
                code: err.code || 'SCORM_ENTITLEMENT_DENIED'
            });
        }
        res.status(401).json({ message: 'Token is not valid' });
    }
};
