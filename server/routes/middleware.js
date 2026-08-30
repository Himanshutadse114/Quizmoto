const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
    getAccessRole,
    accessDeniedPayload
} = require('../services/scorm/ScormAccessService');
const { enforceRequestEntitlement } = require('../services/scorm/ScormEntitlementService');
const { resolveWorkspaceContext } = require('../services/scorm/ScormWorkspaceService');
const { assertScormRouteAllowed } = require('../services/scorm/ScormRbacService');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

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

        // SCORM AI is a separately gated workspace. Protected administrator
        // endpoints must carry a SCORM token, a live access grant and (for team
        // roles) a live workspace membership. The compatibility assignment of
        // req.userId to the workspace owner means the existing hostId-based
        // course/roster/tracking code automatically becomes multi-admin without
        // rewriting every mature SCORM route at once. The signed-in actor remains
        // available as req.authenticatedUserId for audit fields.
        if (isScormAdminRequest && process.env.NODE_ENV !== 'test') {
            if (decoded.scope !== 'scorm') {
                return res.status(401).json({ message: 'SCORM AI login required', code: 'SCORM_AUTH_REQUIRED' });
            }

            const user = await User.findByPk(decoded.userId);
            if (!user) {
                return res.status(401).json({ message: 'SCORM AI account no longer exists.', code: 'SCORM_AUTH_REQUIRED' });
            }

            const accessRole = await getAccessRole(user.email);
            if (!accessRole) return res.status(403).json(accessDeniedPayload());

            const workspaceContext = await resolveWorkspaceContext({ user, role: accessRole });
            req.scormRole = workspaceContext.role;
            req.scormEmail = user.email || null;
            req.scormHostId = workspaceContext.hostId;
            req.scormWorkspace = workspaceContext.workspace || null;
            req.scormWorkspaceId = workspaceContext.workspace?.id || null;
            req.scormWorkspaceMember = workspaceContext.member || null;

            // Backward-compatible host identity used throughout the existing
            // SCORM codebase. Co-admins therefore work inside the owner's data
            // partition, while authenticatedUserId still identifies the actor.
            req.userId = workspaceContext.hostId;

            assertScormRouteAllowed({
                role: req.scormRole,
                method: req.method,
                url
            });

            // Entitlements belong to the workspace, not each individual team
            // member. Otherwise a co-admin could accidentally receive a fresh
            // quota and bypass the primary Admin's course/learner limits.
            let entitlementOwner = user;
            if (workspaceContext.workspace && workspaceContext.hostId !== user.id) {
                entitlementOwner = await User.findByPk(workspaceContext.hostId);
                if (!entitlementOwner) {
                    const err = new Error('The LMSGEN workspace owner account no longer exists.');
                    err.status = 403;
                    err.code = 'SCORM_WORKSPACE_OWNER_REQUIRED';
                    throw err;
                }
            }
            req.scormEntitlementEmail = entitlementOwner.email || user.email || null;

            await enforceRequestEntitlement(req, {
                userId: workspaceContext.hostId,
                email: req.scormEntitlementEmail,
                role: req.scormRole === 'super_admin' ? 'super_admin' : 'admin'
            });
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
