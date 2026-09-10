const { Op } = require('sequelize');
const User = require('../models/User');
const Flipbook = require('../models/Flipbook');
const FlipbookTenantLink = require('../models/FlipbookTenantLink');
const FlipbookTenantEntitlement = require('../models/FlipbookTenantEntitlement');
const { ScormWorkspace, ScormWorkspaceMember } = require('../models/scorm');

const DEFAULT_TENANT_FLIPBOOK_LIMIT = 3;
let schemaPromise = null;

function normaliseEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function normaliseLimit(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_TENANT_FLIPBOOK_LIMIT;
    return Math.max(0, Math.floor(parsed));
}

async function ensureFlipbookTenantSchema() {
    if (!schemaPromise) {
        schemaPromise = Promise.all([
            FlipbookTenantLink.sync(),
            FlipbookTenantEntitlement.sync()
        ]).catch((err) => {
            schemaPromise = null;
            throw err;
        });
    }
    await schemaPromise;
}

async function resolveFlipbookScope(user) {
    await ensureFlipbookTenantSchema();
    const email = normaliseEmail(user?.email);
    if (!user?.id || !email) {
        return { mode: 'personal', userId: user?.id || null, workspaceId: null, hostId: user?.id || null, member: null, workspace: null };
    }
    const member = await ScormWorkspaceMember.findOne({ where: { email } });
    if (!member || String(member.status || '').toLowerCase() === 'disabled') {
        return { mode: 'personal', userId: user.id, workspaceId: null, hostId: user.id, member: null, workspace: null };
    }
    const workspace = await ScormWorkspace.findByPk(member.workspaceId);
    if (!workspace || String(workspace.status || '').toLowerCase() !== 'active') {
        return { mode: 'personal', userId: user.id, workspaceId: null, hostId: user.id, member: null, workspace: null };
    }
    return {
        mode: 'tenant',
        userId: user.id,
        workspaceId: workspace.id,
        hostId: workspace.ownerUserId,
        member,
        workspace
    };
}

async function getTenantEntitlement(scope) {
    if (!scope?.workspaceId) return null;
    await ensureFlipbookTenantSchema();
    const [row] = await FlipbookTenantEntitlement.findOrCreate({
        where: { workspaceId: scope.workspaceId },
        defaults: {
            workspaceId: scope.workspaceId,
            hostId: scope.hostId,
            enabled: true,
            maxFlipbooks: DEFAULT_TENANT_FLIPBOOK_LIMIT
        }
    });
    if (row.hostId !== scope.hostId) {
        row.hostId = scope.hostId;
        await row.save();
    }
    return row;
}

async function linkFlipbookToTenant({ flipbook, user, scope = null }) {
    if (!flipbook || !user) return null;
    const resolved = scope || await resolveFlipbookScope(user);
    if (resolved.mode !== 'tenant') return null;
    const [link] = await FlipbookTenantLink.findOrCreate({
        where: { flipbookId: flipbook.id },
        defaults: {
            flipbookId: flipbook.id,
            workspaceId: resolved.workspaceId,
            hostId: resolved.hostId,
            createdByUserId: user.id,
            createdByEmail: normaliseEmail(user.email) || null
        }
    });
    let changed = false;
    if (String(link.workspaceId) !== String(resolved.workspaceId)) {
        link.workspaceId = resolved.workspaceId;
        changed = true;
    }
    if (link.hostId !== resolved.hostId) {
        link.hostId = resolved.hostId;
        changed = true;
    }
    if (!link.createdByUserId) {
        link.createdByUserId = user.id;
        changed = true;
    }
    if (!link.createdByEmail && user.email) {
        link.createdByEmail = normaliseEmail(user.email);
        changed = true;
    }
    if (changed) await link.save();
    return link;
}

async function adoptLegacyFlipbooks(user, scope = null) {
    const resolved = scope || await resolveFlipbookScope(user);
    if (resolved.mode !== 'tenant' || !user?.id) return { adopted: 0 };
    const books = await Flipbook.findAll({ where: { ownerUserId: user.id } });
    if (!books.length) return { adopted: 0 };
    const existing = await FlipbookTenantLink.findAll({
        where: { flipbookId: { [Op.in]: books.map((book) => book.id) } },
        attributes: ['flipbookId'],
        raw: true
    });
    const linked = new Set(existing.map((row) => String(row.flipbookId)));
    let adopted = 0;
    for (const book of books) {
        if (linked.has(String(book.id))) continue;
        await linkFlipbookToTenant({ flipbook: book, user, scope: resolved });
        adopted += 1;
    }
    return { adopted };
}

async function tenantFlipbookIds(workspaceId) {
    if (!workspaceId) return [];
    await ensureFlipbookTenantSchema();
    const links = await FlipbookTenantLink.findAll({
        where: { workspaceId },
        attributes: ['flipbookId'],
        raw: true
    });
    return links.map((row) => row.flipbookId);
}

async function getTenantQuota(scope) {
    if (!scope?.workspaceId) return null;
    const entitlement = await getTenantEntitlement(scope);
    const used = await FlipbookTenantLink.count({ where: { workspaceId: scope.workspaceId } });
    const max = normaliseLimit(entitlement.maxFlipbooks);
    return {
        mode: 'tenant',
        workspaceId: scope.workspaceId,
        enabled: entitlement.enabled !== false,
        used,
        max,
        remaining: max === null ? null : Math.max(0, max - used),
        unlimited: max === null
    };
}

async function assertTenantCanCreate(scope) {
    if (!scope?.workspaceId) return null;
    const quota = await getTenantQuota(scope);
    if (!quota.enabled) {
        const err = new Error('Flipbooks have been disabled for this tenant by the Super Admin.');
        err.status = 403;
        err.code = 'FLIPBOOK_TENANT_DISABLED';
        throw err;
    }
    if (quota.max !== null && quota.used >= quota.max) {
        const err = new Error(`Tenant Flipbook allowance reached (${quota.used}/${quota.max}). Ask the Super Admin to increase the tenant limit.`);
        err.status = 403;
        err.code = 'FLIPBOOK_TENANT_LIMIT_REACHED';
        err.quota = quota;
        throw err;
    }
    return quota;
}

async function setTenantEntitlement({ workspaceId, enabled, maxFlipbooks, actorUserId = null, actorEmail = null }) {
    await ensureFlipbookTenantSchema();
    const workspace = await ScormWorkspace.findByPk(workspaceId);
    if (!workspace) {
        const err = new Error('Tenant not found.');
        err.status = 404;
        err.code = 'FLIPBOOK_TENANT_NOT_FOUND';
        throw err;
    }
    const [row] = await FlipbookTenantEntitlement.findOrCreate({
        where: { workspaceId },
        defaults: {
            workspaceId,
            hostId: workspace.ownerUserId,
            enabled: true,
            maxFlipbooks: DEFAULT_TENANT_FLIPBOOK_LIMIT
        }
    });
    if (enabled !== undefined) row.enabled = Boolean(enabled);
    if (Object.prototype.hasOwnProperty.call(arguments[0] || {}, 'maxFlipbooks')) row.maxFlipbooks = normaliseLimit(maxFlipbooks);
    row.hostId = workspace.ownerUserId;
    row.updatedByUserId = actorUserId || null;
    row.updatedByEmail = normaliseEmail(actorEmail) || null;
    await row.save();
    const scope = { workspaceId: workspace.id, hostId: workspace.ownerUserId };
    return { workspace, quota: await getTenantQuota(scope) };
}

async function listTenantFlipbookManagement() {
    await ensureFlipbookTenantSchema();
    const workspaces = await ScormWorkspace.findAll({ order: [['createdAt', 'DESC']] });
    const rows = [];
    for (const workspace of workspaces) {
        const host = await User.findByPk(workspace.ownerUserId);
        if (!host || String(host.email || '').endsWith('@lmsgen.internal') === false && workspace.name?.toLowerCase().includes('tenant') === false) {
            // Keep all real customer workspaces; the host check only protects against orphaned rows.
        }
        const scope = { workspaceId: workspace.id, hostId: workspace.ownerUserId };
        const quota = await getTenantQuota(scope);
        const ids = await tenantFlipbookIds(workspace.id);
        const books = ids.length ? await Flipbook.findAll({ where: { id: { [Op.in]: ids } }, order: [['updatedAt', 'DESC']] }) : [];
        rows.push({
            id: workspace.id,
            name: workspace.name,
            status: workspace.status,
            quota,
            flipbooks: books.map((book) => ({
                id: book.id,
                title: book.title,
                status: book.status,
                pageCount: Number(book.pageCount || 0),
                viewCount: Number(book.viewCount || 0),
                updatedAt: book.updatedAt
            }))
        });
    }
    return rows;
}

module.exports = {
    DEFAULT_TENANT_FLIPBOOK_LIMIT,
    ensureFlipbookTenantSchema,
    resolveFlipbookScope,
    getTenantEntitlement,
    linkFlipbookToTenant,
    adoptLegacyFlipbooks,
    tenantFlipbookIds,
    getTenantQuota,
    assertTenantCanCreate,
    setTenantEntitlement,
    listTenantFlipbookManagement
};
