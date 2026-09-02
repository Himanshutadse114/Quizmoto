const crypto = require('crypto');
const User = require('../../models/User');
const {
    ScormWorkspace,
    ScormWorkspaceMember,
    ScormWorkspaceAuthConfig,
    ScormPackage,
    ScormCourse,
    ScormCampaign,
    ScormLearnerRoster
} = require('../../models/scorm');
const {
    normalizeEmail,
    isValidEmail,
    isSuperAdminEmail,
    addGrant
} = require('./ScormAccessService');
const {
    getEntitlement,
    updateEntitlement,
    getUsageForHost = async () => ({
        courseCreations: 0,
        activeCourses: 0,
        learners: 0,
        rosterLearners: 0,
        staff: 0,
        campaigns: 0,
        assignments: 0
    }),
    normalizeLimit
} = require('./ScormEntitlementService');

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

function validateEntitlementPatch(patch = {}, { creating = false } = {}) {
    const normalized = { ...patch };
    for (const field of ['maxCourses', 'maxLearners', 'maxStaff', 'maxCampaigns', 'maxAssignments']) {
        if (Object.prototype.hasOwnProperty.call(normalized, field)) normalized[field] = normalizeLimit(normalized[field]);
    }
    if (creating && normalized.maxStaff !== null && normalized.maxStaff !== undefined && normalized.maxStaff < 1) {
        throw fail('A tenant needs at least 1 staff seat for its Tenant Admin.', 'SCORM_TENANT_STAFF_LIMIT_INVALID', 400);
    }
    return normalized;
}

async function hostForWorkspace(workspace) {
    const host = workspace?.ownerUserId ? await User.findByPk(workspace.ownerUserId) : null;
    if (!host) throw fail('Tenant data host not found.', 'SCORM_TENANT_HOST_NOT_FOUND', 409);
    return host;
}

async function tenantUsage(workspace) {
    const usage = await getUsageForHost(workspace.ownerUserId, workspace.id);
    return {
        staff: usage.staff,
        courses: usage.activeCourses,
        courseCreations: usage.courseCreations,
        learners: usage.learners,
        rosterLearners: usage.rosterLearners,
        campaigns: usage.campaigns,
        assignments: usage.assignments
    };
}

async function serializeTenant(workspace) {
    if (!workspace) return null;
    const host = await hostForWorkspace(workspace);
    const protectedTenant = isSuperAdminEmail(host.email);
    const [members, usage, entitlement] = await Promise.all([
        ScormWorkspaceMember.findAll({
            where: { workspaceId: workspace.id },
            order: [['role', 'ASC'], ['email', 'ASC']]
        }),
        tenantUsage(workspace),
        getEntitlement(host.email, protectedTenant ? 'super_admin' : 'admin')
    ]);
    const admin = members.find((member) => String(member.role || '').toLowerCase() === 'admin') || null;
    return {
        id: workspace.id,
        name: workspace.name,
        status: workspace.status,
        hostId: workspace.ownerUserId,
        protected: protectedTenant,
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
        entitlement,
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
    throw fail('This email is already assigned to another LMSGEN tenant.', 'SCORM_TENANT_EMAIL_ALREADY_ASSIGNED', 409);
}

// A Tenant Admin who already has a real user account may already own SCORM
// data (packages, courses, campaigns, roster) recorded under their own user
// id from before tenants existed. The tenant's data host is a new synthetic
// user (see createTenant), so that existing data must be re-pointed at the
// new host or it silently disappears from every hostId-scoped query - the
// admin keeps their login and sees an empty, "untracked" workspace.
async function migrateExistingHostData(fromUserId, toUserId) {
    if (!fromUserId || !toUserId || fromUserId === toUserId) return;
    await Promise.all([
        ScormPackage.update({ hostId: toUserId }, { where: { hostId: fromUserId } }),
        ScormCourse.update({ hostId: toUserId }, { where: { hostId: fromUserId } }),
        ScormCampaign.update({ hostId: toUserId }, { where: { hostId: fromUserId } }),
        ScormLearnerRoster.update({ hostId: toUserId }, { where: { hostId: fromUserId } })
    ]);
}

async function createTenant({
    name,
    adminEmail,
    adminName = null,
    entitlement = {},
    actorUserId = null,
    actorEmail = null
}) {
    const tenantName = cleanTenantName(name);
    const email = normalizeEmail(adminEmail);
    if (!isValidEmail(email)) throw fail('Enter a valid Tenant Admin email address.', 'SCORM_TENANT_ADMIN_EMAIL_INVALID', 400);
    if (isSuperAdminEmail(email)) {
        throw fail('The platform Super Admin cannot be assigned as a Tenant Admin.', 'SCORM_TENANT_SUPER_ADMIN_RESERVED', 400);
    }
    await assertEmailAvailableForTenant(email);
    const entitlementPatch = validateEntitlementPatch(entitlement || {}, { creating: true });

    const tenantId = crypto.randomUUID();
    const internalEmail = `tenant-${tenantId}@lmsgen.internal`;
    const internalUsername = `tenant-${tenantId.slice(0, 12)}`;
    const linkedUser = await User.findOne({ where: { email } });

    const hostUser = await User.create({ username: internalUsername, email: internalEmail });

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

        if (linkedUser) {
            await migrateExistingHostData(linkedUser.id, hostUser.id);
        }

        // Entitlements belong to the tenant's internal data host, never to the
        // human Tenant Admin. Changing Admin therefore cannot reset allowances.
        await updateEntitlement(hostUser.email, entitlementPatch, {
            userId: actorUserId || null,
            email: actorEmail || null
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

async function updateTenantEntitlement({ workspaceId, patch = {}, actorUserId = null, actorEmail = null }) {
    const workspace = await ScormWorkspace.findByPk(workspaceId);
    if (!workspace) throw fail('Tenant not found.', 'SCORM_TENANT_NOT_FOUND', 404);
    const host = await hostForWorkspace(workspace);
    if (isSuperAdminEmail(host.email)) {
        throw fail('The platform Super Admin tenant always has unrestricted access.', 'SCORM_TENANT_ENTITLEMENT_PROTECTED', 400);
    }
    const normalized = validateEntitlementPatch(patch || {});
    await updateEntitlement(host.email, normalized, { userId: actorUserId, email: actorEmail });
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
    updateTenantEntitlement,
    changeTenantAdmin,
    setTenantStatus
};
