const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
    getAccessRole,
    accessDeniedPayload
} = require('../services/scorm/ScormAccessService');
const { enforceRequestEntitlement } = require('../services/scorm/ScormEntitlementService');
const { resolveWorkspaceContext } = require('../services/scorm/ScormWorkspaceService');
const { getStaffPolicyForEmail } = require('../services/scorm/ScormStaffAuthService');
const { assertScormRouteAllowed } = require('../services/scorm/ScormRbacService');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const requestContextCache = new Map();

function requestContextCacheMs() {
    const configured = Number(process.env.SCORM_AUTH_CONTEXT_CACHE_MS);
    if (!Number.isFinite(configured)) return 5000;
    return Math.max(0, Math.min(30000, Math.floor(configured)));
}

function invalidateContext({ userId = null, workspaceId = null } = {}) {
    if (!userId && !workspaceId) {
        requestContextCache.clear();
        return;
    }
    for (const [key, entry] of requestContextCache.entries()) {
        if (userId && String(entry?.userId || key) === String(userId)) {
            requestContextCache.delete(key);
            continue;
        }
        if (workspaceId && String(entry?.workspaceId || '') === String(workspaceId)) {
            requestContextCache.delete(key);
        }
    }
}

async function resolveRequestContext(userId, { bypassCache = false } = {}) {
    const key = String(userId || '');
    const ttl = requestContextCacheMs();
    const now = Date.now();
    const cached = requestContextCache.get(key);
    if (!bypassCache && ttl > 0 && cached?.value && cached.expiresAt > now) return cached.value;
    if (!bypassCache && ttl > 0 && cached?.promise) return cached.promise;

    const loader = (async () => {
        const user = await User.findByPk(userId);
        if (!user) return { user: null, accessRole: null, workspaceContext: null, staffPolicy: null, entitlementOwner: null };

        const accessRole = await getAccessRole(user.email);
        if (!accessRole) return { user, accessRole: null, workspaceContext: null, staffPolicy: null, entitlementOwner: user };

        const workspaceContext = await resolveWorkspaceContext({ user, role: accessRole });
        const [staffPolicy, entitlementOwner] = await Promise.all([
            workspaceContext.workspace && workspaceContext.role !== 'super_admin'
                ? getStaffPolicyForEmail(user.email)
                : Promise.resolve(null),
            workspaceContext.workspace && workspaceContext.hostId !== user.id
                ? User.findByPk(workspaceContext.hostId)
                : Promise.resolve(user)
        ]);
        return { user, accessRole, workspaceContext, staffPolicy, entitlementOwner };
    })();

    if (!bypassCache && ttl > 0) {
        requestContextCache.set(key, { promise: loader, expiresAt: now + ttl, userId, workspaceId: null });
    }

    try {
        const value = await loader;
        if (!bypassCache && ttl > 0) {
            requestContextCache.set(key, {
                value,
                expiresAt: Date.now() + ttl,
                userId,
                workspaceId: value?.workspaceContext?.workspace?.id || null
            });
        }
        return value;
    } catch (err) {
        if (!bypassCache) requestContextCache.delete(key);
        throw err;
    }
}

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
            if (mutatingRequest) invalidateContext({ userId: decoded.userId });
            const context = await resolveRequestContext(decoded.userId, { bypassCache: mutatingRequest });
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

            if (mutatingRequest && typeof res.once === 'function') {
                const workspaceId = req.scormWorkspaceId;
                res.once('finish', () => invalidateContext({ userId: decoded.userId, workspaceId }));
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
