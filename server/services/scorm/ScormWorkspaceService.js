const User = require('../../models/User');
const {
    ScormWorkspace,
    ScormWorkspaceMember
} = require('../../models/scorm');
const {
    normalizeEmail,
    normalizeScormRole,
    isValidEmail,
    isSuperAdminEmail,
    getAccessRole,
    addGrant,
    removeGrantByEmail
} = require('./ScormAccessService');

const TEAM_ROLES = Object.freeze(['co_admin', 'analytics_viewer']);

function fail(message, code, status = 400) {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    return err;
}

function normalizeTeamRole(value) {
    const role = normalizeScormRole(value);
    if (!TEAM_ROLES.includes(role)) {
        throw fail('Choose either Co-admin or Analytics viewer.', 'SCORM_TEAM_ROLE_INVALID', 400);
    }
    return role;
}

function defaultWorkspaceName(user) {
    const label = String(user?.username || '').trim() || normalizeEmail(user?.email).split('@')[0] || 'LMSGEN';
    return `${label} tenant`.slice(0, 160);
}

function serializeWorkspace(workspace) {
    if (!workspace) return null;
    return {
        id: workspace.id,
        // ownerUserId is retained as the internal SCORM host/data-partition id.
        // It is not the human Tenant Admin identity for newly-created tenants.
        ownerUserId: workspace.ownerUserId,
        hostId: workspace.ownerUserId,
        name: workspace.name,
        status: workspace.status,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt
    };
}

function serializeMember(member) {
    if (!member) return null;
    return {
        id: member.id,
        workspaceId: member.workspaceId,
        userId: member.userId || null,
        email: member.email,
        displayName: member.displayName || null,
        role: normalizeScormRole(member.role),
        status: member.status || 'invited',
        invitedByEmail: member.invitedByEmail || null,
        joinedAt: member.joinedAt || null,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt
    };
}

// Compatibility bootstrap for historical installations and for the protected
// Super Admin's own LMSGEN space. New customer tenants are created explicitly
// by ScormTenantService and are not owned by a human Admin user.
async function ensureOwnerWorkspace(user) {
    if (!user?.id || !isValidEmail(user.email)) {
        throw fail('A valid administrator account is required to create a tenant.', 'SCORM_WORKSPACE_OWNER_INVALID', 403);
    }

    const email = normalizeEmail(user.email);
    const [workspace] = await ScormWorkspace.findOrCreate({
        where: { ownerUserId: user.id },
        defaults: {
            ownerUserId: user.id,
            name: defaultWorkspaceName(user),
            status: 'active'
        }
    });

    let member = await ScormWorkspaceMember.findOne({ where: { email } });
    if (member && String(member.workspaceId) !== String(workspace.id)) {
        throw fail(
            'This administrator is already attached to another LMSGEN tenant.',
            'SCORM_WORKSPACE_MEMBERSHIP_CONFLICT',
            409
        );
    }

    if (!member) {
        member = await ScormWorkspaceMember.create({
            workspaceId: workspace.id,
            userId: user.id,
            email,
            displayName: user.username || null,
            role: 'admin',
            status: 'active',
            invitedByUserId: user.id,
            invitedByEmail: email,
            joinedAt: new Date()
        });
    } else {
        let changed = false;
        if (member.userId !== user.id) {
            member.userId = user.id;
            changed = true;
        }
        if (member.role !== 'admin') {
            member.role = 'admin';
            changed = true;
        }
        if (member.status !== 'active') {
            member.status = 'active';
            changed = true;
        }
        if (!member.joinedAt) {
            member.joinedAt = new Date();
            changed = true;
        }
        if (!member.displayName && user.username) {
            member.displayName = user.username;
            changed = true;
        }
        if (changed) await member.save();
    }

    return {
        workspace,
        member,
        hostId: workspace.ownerUserId,
        role: 'admin'
    };
}

async function resolveWorkspaceContext({ user, role }) {
    const accessRole = normalizeScormRole(role);
    if (!user?.id) {
        throw fail('SCORM account no longer exists.', 'SCORM_AUTH_REQUIRED', 401);
    }

    // Super Admin retains a private first-class tenant for platform operations
    // while also holding global Tenant Management privileges.
    if (accessRole === 'super_admin') {
        const context = await ensureOwnerWorkspace(user);
        return {
            ...context,
            role: 'super_admin'
        };
    }

    const email = normalizeEmail(user.email);
    const member = email ? await ScormWorkspaceMember.findOne({ where: { email } }) : null;

    // New architecture: a platform grant alone never creates a customer tenant.
    // Super Admin must explicitly create the tenant and assign its Admin email.
    if (!member) {
        throw fail(
            'Your LMSGEN account is authorised but has not been assigned to a tenant. Contact the Super Admin.',
            'SCORM_TENANT_MEMBERSHIP_REQUIRED',
            403
        );
    }
    if (member.status === 'disabled') {
        throw fail('Your LMSGEN tenant membership is disabled.', 'SCORM_WORKSPACE_MEMBER_DISABLED', 403);
    }

    const workspace = await ScormWorkspace.findByPk(member.workspaceId);
    if (!workspace || workspace.status !== 'active') {
        throw fail('This LMSGEN tenant is not active.', 'SCORM_WORKSPACE_INACTIVE', 403);
    }

    let changed = false;
    if (member.userId !== user.id) {
        member.userId = user.id;
        changed = true;
    }
    if (member.status !== 'active') {
        member.status = 'active';
        changed = true;
    }
    if (!member.joinedAt) {
        member.joinedAt = new Date();
        changed = true;
    }
    if (!member.displayName && user.username) {
        member.displayName = user.username;
        changed = true;
    }
    if (changed) await member.save();

    // Role authority comes from the tenant membership. The workspace host id is
    // only an internal data partition and is deliberately independent from the
    // human Admin user.
    return {
        workspace,
        member,
        hostId: workspace.ownerUserId,
        role: normalizeScormRole(member.role)
    };
}

async function listWorkspaceMembers(workspaceId) {
    const rows = await ScormWorkspaceMember.findAll({
        where: { workspaceId },
        order: [
            ['role', 'ASC'],
            ['email', 'ASC']
        ]
    });
    return rows.map(serializeMember);
}

async function inviteWorkspaceMember({ workspace, actorUserId, actorEmail, email, displayName = null, role }) {
    if (!workspace?.id) throw fail('Tenant not found.', 'SCORM_WORKSPACE_REQUIRED', 404);
    const normalized = normalizeEmail(email);
    const assignedRole = normalizeTeamRole(role);

    if (!isValidEmail(normalized)) throw fail('Enter a valid email address.', 'INVALID_EMAIL', 400);
    if (isSuperAdminEmail(normalized)) {
        throw fail('The platform Super Admin cannot be added as a tenant member.', 'SCORM_TEAM_SUPER_ADMIN_PROTECTED', 400);
    }
    if (normalized === normalizeEmail(actorEmail)) {
        throw fail('You are already the Admin of this tenant.', 'SCORM_TEAM_SELF_INVITE', 400);
    }

    let member = await ScormWorkspaceMember.findOne({ where: { email: normalized } });
    if (member && String(member.workspaceId) !== String(workspace.id)) {
        throw fail(
            'This email is already attached to another LMSGEN tenant.',
            'SCORM_TEAM_EMAIL_IN_OTHER_WORKSPACE',
            409
        );
    }
    if (member && normalizeScormRole(member.role) === 'admin') {
        throw fail('The Tenant Admin cannot be changed here. The Super Admin controls primary Tenant Admin assignment.', 'SCORM_TEAM_OWNER_PROTECTED', 400);
    }

    const existingAccessRole = await getAccessRole(normalized);
    if (!member && (existingAccessRole === 'super_admin' || existingAccessRole === 'admin')) {
        throw fail(
            'This email already has administrator access outside this tenant.',
            'SCORM_TEAM_EMAIL_ALREADY_ADMIN',
            409
        );
    }

    const linkedUser = await User.findOne({ where: { email: normalized } });
    const cleanName = String(displayName || linkedUser?.username || '').trim().slice(0, 160) || null;

    if (!member) {
        member = await ScormWorkspaceMember.create({
            workspaceId: workspace.id,
            userId: linkedUser?.id || null,
            email: normalized,
            displayName: cleanName,
            role: assignedRole,
            status: 'invited',
            invitedByUserId: actorUserId || null,
            invitedByEmail: normalizeEmail(actorEmail) || null
        });
    } else {
        member.userId = linkedUser?.id || member.userId || null;
        member.displayName = cleanName || member.displayName || null;
        member.role = assignedRole;
        member.status = member.status === 'active' ? 'active' : 'invited';
        member.invitedByUserId = actorUserId || member.invitedByUserId || null;
        member.invitedByEmail = normalizeEmail(actorEmail) || member.invitedByEmail || null;
        await member.save();
    }

    await addGrant({
        email: normalized,
        role: assignedRole,
        addedByUserId: actorUserId || null,
        addedByEmail: actorEmail || null
    });

    return serializeMember(member);
}

async function changeWorkspaceMemberRole({ workspaceId, memberId, actorUserId, actorEmail, role }) {
    const assignedRole = normalizeTeamRole(role);
    const member = await ScormWorkspaceMember.findOne({ where: { id: memberId, workspaceId } });
    if (!member) throw fail('Team member not found.', 'SCORM_TEAM_MEMBER_NOT_FOUND', 404);
    if (normalizeScormRole(member.role) === 'admin') {
        throw fail('The Tenant Admin role can only be changed by the Super Admin.', 'SCORM_TEAM_OWNER_PROTECTED', 400);
    }

    member.role = assignedRole;
    await member.save();
    await addGrant({
        email: member.email,
        role: assignedRole,
        addedByUserId: actorUserId || null,
        addedByEmail: actorEmail || null
    });
    return serializeMember(member);
}

async function removeWorkspaceMember({ workspaceId, memberId }) {
    const member = await ScormWorkspaceMember.findOne({ where: { id: memberId, workspaceId } });
    if (!member) throw fail('Team member not found.', 'SCORM_TEAM_MEMBER_NOT_FOUND', 404);
    if (normalizeScormRole(member.role) === 'admin') {
        throw fail('The Tenant Admin cannot be removed here.', 'SCORM_TEAM_OWNER_PROTECTED', 400);
    }

    const email = member.email;
    await member.destroy();
    const accessRole = await getAccessRole(email);
    if (accessRole === 'co_admin' || accessRole === 'analytics_viewer') {
        await removeGrantByEmail(email);
    }

    return { removed: true, id: memberId, email };
}

module.exports = {
    TEAM_ROLES,
    normalizeTeamRole,
    serializeWorkspace,
    serializeMember,
    ensureOwnerWorkspace,
    resolveWorkspaceContext,
    listWorkspaceMembers,
    inviteWorkspaceMember,
    changeWorkspaceMemberRole,
    removeWorkspaceMember
};
