const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('../models/User');
const { GameSession, Player } = require('../models/GameSession');
const { ScormWorkspace, ScormWorkspaceMember } = require('../models/scorm');
const { getEntitlement, normalizeLimit } = require('./scorm/ScormEntitlementService');
const { isSuperAdminEmail } = require('./scorm/ScormAccessService');

const capacityLocks = new Map();

async function resolveCapacityScope(hostId) {
    const host = await User.findByPk(hostId);
    if (!host) return { key: `user:${hostId}`, hostIds: [hostId], entitlement: { maxQuizPlayers: 10 } };
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

async function activePlayerCount(hostIds, sessionId = null, transaction = null) {
    if (sessionId) {
        const session = await GameSession.findOne({
            where: { id: sessionId, hostId: { [Op.in]: hostIds }, status: { [Op.ne]: 'finished' } },
            attributes: ['id'],
            raw: true,
            transaction
        });
        if (!session) return 0;
        return Player.count({ where: { sessionId, socketId: { [Op.ne]: null } }, transaction });
    }
    const sessions = await GameSession.findAll({
        where: { hostId: { [Op.in]: hostIds }, status: { [Op.ne]: 'finished' } },
        attributes: ['id'],
        raw: true,
        transaction
    });
    const sessionIds = sessions.map((session) => session.id);
    if (!sessionIds.length) return 0;
    return Player.count({ where: { sessionId: { [Op.in]: sessionIds }, socketId: { [Op.ne]: null } }, transaction });
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

async function withQuizPlayerCapacity(hostId, sessionId, createPlayer) {
    const scope = await resolveCapacityScope(hostId);
    const capacityKey = `${scope.key}:session:${sessionId}`;
    const previous = capacityLocks.get(capacityKey) || Promise.resolve();
    const current = previous.catch(() => {}).then(() => sequelize.transaction(async (transaction) => {
        if (typeof sequelize.getDialect === 'function' && sequelize.getDialect() === 'postgres') {
            await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:lockKey))', {
                replacements: { lockKey: `quizmoto-capacity:${capacityKey}` },
                transaction
            });
        }
        const configuredMaximum = normalizeLimit(scope.entitlement?.maxQuizPlayers);
        const maximum = scope.entitlement?.unlimited === true
            ? null
            : Math.max(10, configuredMaximum ?? 10);
        const currentPlayers = await activePlayerCount(scope.hostIds, sessionId, transaction);
        if (maximum !== null && currentPlayers >= maximum) {
            const error = new Error(`This Quizmoto session has reached its player capacity (${currentPlayers}/${maximum}).`);
            error.code = 'QUIZMOTO_PLAYER_CAPACITY_REACHED';
            error.status = 403;
            error.capacity = { current: currentPlayers, max: maximum };
            throw error;
        }
        return createPlayer(transaction);
    }));
    capacityLocks.set(capacityKey, current);
    try {
        return await current;
    } finally {
        if (capacityLocks.get(capacityKey) === current) capacityLocks.delete(capacityKey);
    }
}

module.exports = {
    resolveCapacityScope,
    activePlayerCount,
    quizPlayerUsageForEntitlementHost,
    withQuizPlayerCapacity
};
