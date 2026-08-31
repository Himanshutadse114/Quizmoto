const crypto = require('crypto');
const User = require('../../models/User');
const {
    ScormWorkspace,
    ScormWorkspaceMember,
    ScormWorkspaceAuthConfig,
    ScormCourse,
    ScormLearnerRoster,
    ScormCampaign
} = require('../../models/scorm');
const {
    normalizeEmail,
    isValidEmail,
    isSuperAdminEmail,
    addGrant
} = require('./ScormAccessService');

function fail(message, code, status = 400) {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    return err;
}

function cleanTenantName(value) {
    const name = String(value || '').trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 160) {
        throw fail('Tenant name must be between 2 and 160 characters.', 'SCORM_TENANT_NAME_INVALID', 400);
    }
    return name;
}

async function tenantUsage(workspace) {
    const hostId = workspace.ownerUserId;
    const [courses, learners, campaigns, staff] = await Promise.all([
        ScormCourse.count({ where: { hostId } }),
        ScormLearnerRoster.count({ where: { hostId } }),
        ScormCampaign.count({ where: { workspaceId: workspace.id } }),
        ScormWorkspaceMember.count({ where: { workspaceId: workspace.id } })
    ]);
    return { courses, learners, campaigns, staff };
}

async function serializeTenant(workspace) {
    if (!workspace) return null;
    const [members, usage] = await Promise.all([
        ScormWorkspaceMember.findAll({
            where: { workspaceId: workspace.id },
            order: [['role', 'ASC'], ['email', 'ASC']]
        }),
        tenantUsage(workspace)
    ]);
    const admin = members.find((member) => String(member.role || '').toLowerCase() === 'admin') || null;
    return {
        id: workspace.id,
        name: workspace.name,
        status: workspace.status,
        hostId: workspace.ownerUserId,
        admin: admin ? {
            id: admin.id,
            email: admin.email,
            displayName: admin.displayName || null,
            status: admin.status || 'active',
            userId: admin.userId || null
        } : null,
        members: members.map((member) => ({
            id: member.id,
            email: member.email,
            displayName: member.displayName || null,
            role: String(member.role || '').toLowerCase(),
            status: member.status || 'active',
            userId: member.userId || null
        })),
        usage,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt
    };
}

async function listTenants() {
    const workspaces = await ScormWorkspace.findAll({ order: [['createdAt', 'DESC']] });
    return Promise.all(workspaces.map(serializeTenant));
}

async function assertEmailAvailableForTenant(email, workspaceId = null) {
    const existing = await ScormWorkspaceMember.findOne({ where: { email } });
    if (!existing) return null;
    if (workspaceId && String(existing.workspaceId) === String(workspaceId)) return existing;
    throw fail(
        'This email is already assigned to another LMSGEN tenant.',
        'SCORM_TENANT_EMAIL_ALREADY_ASSIGNED',
        409
    );
}

async function createTenant({ name, adminEmail, adminName = null, actorUserId = null, actorEmail = null }) {
    const tenantName = cleanTenantName(name);
    const email = normalizeEmail(adminEmail);
    if (!isValidEmail(email)) throw fail('Enter a valid Tenant Admin email address.', 'SCORM_TENANT_ADMIN_EMAIL_INVALID', 400);
    if (isSuperAdminEmail(email)) {
        throw fail('The platform Super Admin cannot be assigned as a Tenant Admin.', 'SCORM_TENANT_SUPER_ADMIN_RESERVED', 400);
    }
    await assertEmailAvailableForTenant(email);

    const tenantId = crypto.randomUUID();
    const internalEmail = `tenant-${tenantId}@lmsgen.internal`;
    const internalUsername = `tenant-${tenantId.slice(0, 12)}`;
    const linkedUser = await User.findOne({ where: { email } });

    const hostUser = await User.create({
        username: internalUsername,
        email: internalEmail
    });

    let workspace;
    try {
        workspace = await ScormWorkspace.create({
            id: tenantId,
            ownerUserId: hostUser.id,
            name: tenantName,
            status: 'active'
        });

        await ScormWorkspaceAuthConfig.findOrCreate({
            where: { workspaceId: workspace.id },
            defaults: { workspaceId: workspace.id }
        });

        await ScormWorkspaceMember.create({
            workspaceId: workspace.id,
            userId: linkedUser?.id || null,
            email,
            displayName: String(adminName || linkedUser?.username || '').trim().slice(0, 160) || null,
            role: 'admin',
            status: 'active',
            invitedByUserId: actorUserId || null,
            invitedByEmail: normalizeEmail(actorEmail) || null,
            joinedAt: linkedUser ? new Date() : null
        });

        await addGrant({
            email,
            role: 'admin',
            addedByUserId: actorUserId || null,
            addedByEmail: actorEmail || null
        });
    } catch (err) {
        if (workspace) {
            try { await workspace.destroy(); } catch (_) {}
        }
        try { await hostUser.destroy(); } catch (_) {}
        throw err;
    }

    return serializeTenant(workspace);
}

async function changeTenantAdmin({ workspaceId, adminEmail, adminName = null, actorUserId = null, actorEmail = null }) {
    const workspace = await ScormWorkspace.findByPk(workspaceId);
    if (!workspace) throw fail('Tenant not found.', 'SCORM_TENANT_NOT_FOUND', 404);

    const email = normalizeEmail(adminEmail);
    if (!isValidEmail(email)) throw fail('Enter a valid Tenant Admin email address.', 'SCORM_TENANT_ADMIN_EMAIL_INVALID', 400);
    if (isSuperAdminEmail(email)) {
        throw fail('The platform Super Admin cannot be assigned as a Tenant Admin.', 'SCORM_TENANT_SUPER_ADMIN_RESERVED', 400);
    }

    let target = await assertEmailAvailableForTenant(email, workspace.id);
    const currentAdmin = await ScormWorkspaceMember.findOne({ where: { workspaceId: workspace.id, role: 'admin' } });
    const linkedUser = await User.findOne({ where: { email } });

    if (!target) {
        target = await ScormWorkspaceMember.create({
            workspaceId: workspace.id,
            userId: linkedUser?.id || null,
            email,
            displayName: String(adminName || linkedUser?.username || '').trim().slice(0, 160) || null,
            role: 'admin',
            status: 'active',
            invitedByUserId: actorUserId || null,
            invitedByEmail: normalizeEmail(actorEmail) || null,
            joinedAt: linkedUser ? new Date() : null
        });
    } else {
        target.role = 'admin';
        target.status = 'active';
        target.userId = linkedUser?.id || target.userId || null;
        if (adminName) target.displayName = String(adminName).trim().slice(0, 160) || target.displayName;
        await target.save();
    }

    if (currentAdmin && currentAdmin.id !== target.id) {
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
        role: 'admin',
        addedByUserId: actorUserId || null,
        addedByEmail: actorEmail || null
    });

    return serializeTenant(workspace);
}

async function setTenantStatus({ workspaceId, status }) {
    const workspace = await ScormWorkspace.findByPk(workspaceId);
    if (!workspace) throw fail('Tenant not found.', 'SCORM_TENANT_NOT_FOUND', 404);
    const next = String(status || '').toLowerCase() === 'disabled' ? 'disabled' : 'active';
    workspace.status = next;
    await workspace.save();
    return serializeTenant(workspace);
}

module.exports = {
    cleanTenantName,
    serializeTenant,
    listTenants,
    createTenant,
    changeTenantAdmin,
    setTenantStatus
};
