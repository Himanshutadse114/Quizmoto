const { Op } = require('sequelize');
const User = require('../models/User');
const { GameSession, Player } = require('../models/GameSession');
const { ScormWorkspace, ScormWorkspaceMember } = require('../models/scorm');
const { getEntitlement, normalizeLimit } = require('./scorm/ScormEntitlementService');
const { isSuperAdminEmail } = require('./scorm/ScormAccessService');

const capacityLocks = new Map();

async function resolveCapacityScope(hostId) {
    const host = await User.findByPk(hostId);
    if (!host) return { key: `user:${hostId}`, hostIds: [hostId], entitlement: { maxQuizPlayers: null } };
    const email = String(host.email || '').trim().toLowerCase();
    const member = await ScormWorkspaceMember.findOne({
        where: { [Op.or]: [{ userId: host.id }, { email }] }
    });
    if (member && member.status !== 'disabled') {
        const workspace = await ScormWorkspace.findByPk(member.workspaceId);
        if (workspace?.status === 'active') {
            const members = await ScormWorkspaceMember.findAll({
                where: { workspaceId: workspace.id, status: { [Op.ne]: 'disabled' }, userId: { [Op.ne]: null } },
                attributes: ['userId'],
                raw: true
            });
            const entitlementOwner = await User.findByPk(workspace.ownerUserId);
            const entitlement = await getEntitlement(
                entitlementOwner?.email || email,
                isSuperAdminEmail(entitlementOwner?.email || email) ? 'super_admin' : 'admin'
            );
            return {
                key: `tenant:${workspace.id}`,
                hostIds: [...new Set([host.id, ...members.map((row) => row.userId)].filter(Boolean))],
                entitlement
            };
        }
    }
    return {
        key: `user:${host.id}`,
        hostIds: [host.id],
        entitlement: await getEntitlement(email, isSuperAdminEmail(email) ? 'super_admin' : 'admin')
    };
}

async function activePlayerCount(hostIds) {
    const sessions = await GameSession.findAll({
        where: { hostId: { [Op.in]: hostIds }, status: { [Op.ne]: 'finished' } },
        attributes: ['id'],
        raw: true
    });
    const sessionIds = sessions.map((session) => session.id);
    if (!sessionIds.length) return 0;
    return Player.count({ where: { sessionId: { [Op.in]: sessionIds }, socketId: { [Op.ne]: null } } });
}

async function quizPlayerUsageForEntitlementHost(hostId) {
    const workspace = await ScormWorkspace.findOne({ where: { ownerUserId: hostId }, attributes: ['id'] });
    if (!workspace) return activePlayerCount([hostId]);
    const members = await ScormWorkspaceMember.findAll({
        where: { workspaceId: workspace.id, status: { [Op.ne]: 'disabled' }, userId: { [Op.ne]: null } },
        attributes: ['userId'],
        raw: true
    });
    return activePlayerCount([...new Set([hostId, ...members.map((row) => row.userId)].filter(Boolean))]);
}

async function withQuizPlayerCapacity(hostId, createPlayer) {
    const scope = await resolveCapacityScope(hostId);
    const previous = capacityLocks.get(scope.key) || Promise.resolve();
    const current = previous.catch(() => {}).then(async () => {
        const maximum = normalizeLimit(scope.entitlement?.maxQuizPlayers);
        const currentPlayers = await activePlayerCount(scope.hostIds);
        if (maximum !== null && currentPlayers >= maximum) {
            const error = new Error(`This Quizmoto account has reached its live player capacity (${currentPlayers}/${maximum}).`);
            error.code = 'QUIZMOTO_PLAYER_CAPACITY_REACHED';
            error.status = 403;
            error.capacity = { current: currentPlayers, max: maximum };
            throw error;
        }
        return createPlayer();
    });
    capacityLocks.set(scope.key, current);
    try {
        return await current;
    } finally {
        if (capacityLocks.get(scope.key) === current) capacityLocks.delete(scope.key);
    }
}

module.exports = {
    resolveCapacityScope,
    activePlayerCount,
    quizPlayerUsageForEntitlementHost,
    withQuizPlayerCapacity
};
