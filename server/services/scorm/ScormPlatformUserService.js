const User = require('../../models/User');
const ScormAccessGrant = require('../../models/ScormAccessGrant');
const ScormAccessRequest = require('../../models/ScormAccessRequest');
const {
    ScormWorkspace,
    ScormWorkspaceMember
} = require('../../models/scorm');
const {
    normalizeEmail,
    normalizeScormRole,
    isSuperAdminEmail,
    addGrant,
    removeGrantByEmail
} = require('./ScormAccessService');
const { getEntitlement } = require('./ScormEntitlementService');

const ASSIGNABLE_ROLES = new Set(['admin', 'co_admin', 'analytics_viewer']);

function fail(message, code, status = 400) {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    return err;
}

function authMethodForUser(user) {
    const google = Boolean(user?.googleId);
    const password = Boolean(user?.password);
    if (google && password) return 'Google SSO + password';
    if (google) return 'Google SSO';
    if (password) return 'Email & password';
    return 'Platform account';
}

function cleanRole(value) {
    const role = normalizeScormRole(value);
    if (!ASSIGNABLE_ROLES.has(role)) {
        throw fail('Choose Tenant Admin, Co-admin or Analytics Viewer.', 'SCORM_PLATFORM_USER_ROLE_INVALID', 400);
    }
    return role;
}

function isSyntheticTenantHost(user) {
    const email = normalizeEmail(user?.email);
    return email.endsWith('@lmsgen.internal') || String(user?.username || '').startsWith('tenant-');
}

async function listPlatformUsers({ search = '', scope = 'all' } = {}) {
    const [users, memberships, workspaces, grants, requests] = await Promise.all([
        User.findAll({ order: [['createdAt', 'DESC']], limit: 2500 }),
        ScormWorkspaceMember.findAll(),
        ScormWorkspace.findAll(),
        ScormAccessGrant.findAll(),
        ScormAccessRequest.findAll()
    ]);

    const membershipByUserId = new Map();
    const membershipByEmail = new Map();
    memberships.forEach((member) => {
        if (member.userId) membershipByUserId.set(String(member.userId), member);
        membershipByEmail.set(normalizeEmail(member.email), member);
    });
    const workspaceById = new Map(workspaces.map((workspace) => [String(workspace.id), workspace]));
    const grantByEmail = new Map(grants.map((grant) => [normalizeEmail(grant.email), grant]));
    const requestByEmail = new Map(requests.map((request) => [normalizeEmail(request.email), request]));
    const query = String(search || '').trim().toLowerCase();
    const wantedScope = ['assigned', 'unassigned'].includes(String(scope || '').toLowerCase())
        ? String(scope).toLowerCase()
        : 'all';

    return users
        .filter((user) => !isSyntheticTenantHost(user))
        .map((user) => {
            const email = normalizeEmail(user.email);
            const member = membershipByUserId.get(String(user.id)) || membershipByEmail.get(email) || null;
            const workspace = member ? workspaceById.get(String(member.workspaceId)) || null : null;
            const grant = grantByEmail.get(email) || null;
            const request = requestByEmail.get(email) || null;
            const protectedUser = isSuperAdminEmail(email) || normalizeScormRole(grant?.role) === 'super_admin';
            return {
                id: user.id,
                username: user.username || null,
                email: user.email || null,
                avatar: user.avatar || null,
                authMethod: authMethodForUser(user),
                googleConnected: Boolean(user.googleId),
                passwordEnabled: Boolean(user.password),
                registeredAt: user.createdAt,
                protected: protectedUser,
                accessRole: protectedUser ? 'super_admin' : (grant ? normalizeScormRole(grant.role) : null),
                requestStatus: request?.status || null,
                tenant: workspace ? {
                    id: workspace.id,
                    name: workspace.name,
                    status: workspace.status,
                    role: normalizeScormRole(member.role),
                    membershipStatus: member.status || 'active',
                    memberId: member.id
                } : null
            };
        })
        .filter((item) => {
            if (wantedScope === 'assigned' && !item.tenant) return false;
            if (wantedScope === 'unassigned' && item.tenant) return false;
            if (!query) return true;
            return [item.username, item.email, item.authMethod, item.tenant?.name]
                .some((value) => String(value || '').toLowerCase().includes(query));
        });
}

async function assertTenantSeatAvailable(workspace, existingMembership = null) {
    if (!workspace) throw fail('Tenant not found.', 'SCORM_TENANT_NOT_FOUND', 404);
    if (existingMembership && String(existingMembership.workspaceId) === String(workspace.id)) return;
    const host = await User.findByPk(workspace.ownerUserId);
    if (!host) throw fail('Tenant data host not found.', 'SCORM_TENANT_HOST_NOT_FOUND', 409);
    const entitlement = await getEntitlement(host.email, isSuperAdminEmail(host.email) ? 'super_admin' : 'admin');
    const maxStaff = entitlement?.maxStaff;
    if (maxStaff === null || maxStaff === undefined) return;
    const current = await ScormWorkspaceMember.count({ where: { workspaceId: workspace.id } });
    if (current >= Number(maxStaff)) {
        throw fail(`Tenant staff limit reached (${current}/${maxStaff}). Increase the staff allowance before assigning this user.`, 'SCORM_STAFF_LIMIT_REACHED', 403);
    }
}

async function assignPlatformUser({
    userId,
    workspaceId,
    role,
    moveExisting = false,
    actorUserId = null,
    actorEmail = null
}) {
    const user = await User.findByPk(userId);
    if (!user || isSyntheticTenantHost(user)) throw fail('Platform user not found.', 'SCORM_PLATFORM_USER_NOT_FOUND', 404);
    const email = normalizeEmail(user.email);
    if (!email) throw fail('This account does not have an email address and cannot be assigned.', 'SCORM_PLATFORM_USER_EMAIL_REQUIRED', 400);
    if (isSuperAdminEmail(email)) throw fail('The platform Super Admin cannot be assigned to a customer tenant.', 'SCORM_PLATFORM_USER_PROTECTED', 400);

    const workspace = await ScormWorkspace.findByPk(workspaceId);
    if (!workspace) throw fail('Tenant not found.', 'SCORM_TENANT_NOT_FOUND', 404);
    if (workspace.status !== 'active') throw fail('Activate the tenant before assigning users.', 'SCORM_TENANT_INACTIVE', 409);
    const assignedRole = cleanRole(role);

    let membership = await ScormWorkspaceMember.findOne({ where: { email } });
    if (membership && String(membership.workspaceId) !== String(workspace.id)) {
        if (normalizeScormRole(membership.role) === 'admin') {
            throw fail('This user is the Tenant Admin of another tenant. Change that tenant Admin first before moving this account.', 'SCORM_PLATFORM_USER_ADMIN_MOVE_BLOCKED', 409);
        }
        if (!moveExisting) {
            throw fail('This user already belongs to another tenant. Confirm moving the user before continuing.', 'SCORM_PLATFORM_USER_ALREADY_ASSIGNED', 409);
        }
        await membership.destroy();
        await removeGrantByEmail(email).catch(() => null);
        membership = null;
    }

    await assertTenantSeatAvailable(workspace, membership);

    const currentAdmin = await ScormWorkspaceMember.findOne({ where: { workspaceId: workspace.id, role: 'admin' } });
    if (membership && normalizeScormRole(membership.role) === 'admin' && assignedRole !== 'admin') {
        throw fail('A Tenant Admin cannot be demoted without first assigning another Tenant Admin.', 'SCORM_PLATFORM_USER_ADMIN_DEMOTION_BLOCKED', 409);
    }

    if (!membership) {
        membership = await ScormWorkspaceMember.create({
            workspaceId: workspace.id,
            userId: user.id,
            email,
            displayName: String(user.username || '').trim().slice(0, 160) || null,
            role: assignedRole,
            status: 'active',
            invitedByUserId: actorUserId || null,
            invitedByEmail: normalizeEmail(actorEmail) || null,
            joinedAt: new Date()
        });
    } else {
        membership.userId = user.id;
        membership.displayName = membership.displayName || String(user.username || '').trim().slice(0, 160) || null;
        membership.role = assignedRole;
        membership.status = 'active';
        membership.joinedAt = membership.joinedAt || new Date();
        membership.invitedByUserId = actorUserId || membership.invitedByUserId || null;
        membership.invitedByEmail = normalizeEmail(actorEmail) || membership.invitedByEmail || null;
        await membership.save();
    }

    if (assignedRole === 'admin' && currentAdmin && currentAdmin.id !== membership.id) {
        currentAdmin.role = 'co_admin';
        await currentAdmin.save();
        await addGrant({
            email: currentAdmin.email,
            role: 'co_admin',
            addedByUserId: actorUserId || null,
            addedByEmail: actorEmail || null
        });
    }

    await addGrant({
        email,
        role: assignedRole,
        addedByUserId: actorUserId || null,
        addedByEmail: actorEmail || null
    });

    return {
        user: {
            id: user.id,
            username: user.username || null,
            email: user.email || null,
            authMethod: authMethodForUser(user)
        },
        tenant: {
            id: workspace.id,
            name: workspace.name,
            role: assignedRole,
            membershipStatus: membership.status
        }
    };
}

async function unassignPlatformUser({ userId }) {
    const user = await User.findByPk(userId);
    if (!user || isSyntheticTenantHost(user)) throw fail('Platform user not found.', 'SCORM_PLATFORM_USER_NOT_FOUND', 404);
    const email = normalizeEmail(user.email);
    if (isSuperAdminEmail(email)) throw fail('The platform Super Admin cannot be unassigned.', 'SCORM_PLATFORM_USER_PROTECTED', 400);
    const membership = await ScormWorkspaceMember.findOne({ where: { email } });
    if (!membership) return { removed: false, reason: 'not_assigned' };
    if (normalizeScormRole(membership.role) === 'admin') {
        throw fail('Change the Tenant Admin before unassigning this account.', 'SCORM_PLATFORM_USER_ADMIN_UNASSIGN_BLOCKED', 409);
    }
    const workspaceId = membership.workspaceId;
    await membership.destroy();
    await removeGrantByEmail(email).catch(() => null);
    return { removed: true, userId: user.id, workspaceId };
}

module.exports = {
    listPlatformUsers,
    assignPlatformUser,
    unassignPlatformUser
};
