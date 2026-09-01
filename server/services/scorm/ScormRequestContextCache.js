const User = require('../../models/User');
const { ScormWorkspaceAuthConfig } = require('../../models/scorm');
const { getAccessRole } = require('./ScormAccessService');
const { resolveWorkspaceContext } = require('./ScormWorkspaceService');
const { serializeStaffAuthConfig } = require('./ScormStaffAuthService');

const DEFAULT_TTL_MS = 10_000;
const contextCache = new Map();

function cacheTtlMs() {
    if (process.env.NODE_ENV === 'test') return 0;
    const configured = Number(process.env.SCORM_AUTH_CONTEXT_CACHE_MS);
    if (!Number.isFinite(configured)) return DEFAULT_TTL_MS;
    return Math.max(0, Math.min(60_000, Math.floor(configured)));
}

function cacheKey(userId) {
    return String(userId || '');
}

async function resolveFreshContext(userId) {
    const user = await User.findByPk(userId, {
        attributes: ['id', 'email', 'username']
    });
    if (!user) {
        return {
            user: null,
            accessRole: null,
            workspaceContext: null,
            staffPolicy: null,
            entitlementOwner: null
        };
    }

    const accessRole = await getAccessRole(user.email);
    if (!accessRole) {
        return {
            user,
            accessRole: null,
            workspaceContext: null,
            staffPolicy: null,
            entitlementOwner: user
        };
    }

    const workspaceContext = await resolveWorkspaceContext({ user, role: accessRole });
    const workspace = workspaceContext.workspace || null;
    const needsTenantPolicy = Boolean(workspace && workspaceContext.role !== 'super_admin');
    const needsHostOwner = Number(workspaceContext.hostId) !== Number(user.id);

    const [authConfig, entitlementOwner] = await Promise.all([
        needsTenantPolicy
            ? ScormWorkspaceAuthConfig.findOne({ where: { workspaceId: workspace.id } })
            : Promise.resolve(null),
        needsHostOwner
            ? User.findByPk(workspaceContext.hostId, { attributes: ['id', 'email', 'username'] })
            : Promise.resolve(user)
    ]);

    const staffPolicy = needsTenantPolicy
        ? {
            workspace,
            member: workspaceContext.member || null,
            config: authConfig || null,
            publicConfig: serializeStaffAuthConfig(authConfig, { workspace, publicView: true })
        }
        : null;

    return {
        user,
        accessRole,
        workspaceContext,
        staffPolicy,
        entitlementOwner
    };
}

async function getScormRequestContext(userId, { bypassCache = false } = {}) {
    const ttl = cacheTtlMs();
    const key = cacheKey(userId);
    if (!key || bypassCache || ttl <= 0) return resolveFreshContext(userId);

    const now = Date.now();
    const cached = contextCache.get(key);
    if (cached?.value && cached.expiresAt > now) return cached.value;
    if (cached?.promise) return cached.promise;

    const promise = resolveFreshContext(userId)
        .then((value) => {
            contextCache.set(key, {
                value,
                expiresAt: Date.now() + ttl,
                userId: Number(userId) || userId,
                workspaceId: value?.workspaceContext?.workspace?.id || null
            });
            return value;
        })
        .catch((err) => {
            contextCache.delete(key);
            throw err;
        });

    contextCache.set(key, {
        promise,
        expiresAt: now + ttl,
        userId: Number(userId) || userId,
        workspaceId: null
    });
    return promise;
}

function invalidateScormRequestContext({ userId = null, workspaceId = null } = {}) {
    if (!userId && !workspaceId) {
        contextCache.clear();
        return;
    }

    const userKey = userId ? cacheKey(userId) : null;
    for (const [key, entry] of contextCache.entries()) {
        if (userKey && key === userKey) {
            contextCache.delete(key);
            continue;
        }
        if (workspaceId && String(entry?.workspaceId || '') === String(workspaceId)) {
            contextCache.delete(key);
        }
    }
}

module.exports = {
    getScormRequestContext,
    invalidateScormRequestContext,
    cacheTtlMs
};
