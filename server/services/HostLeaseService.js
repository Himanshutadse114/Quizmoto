const { sequelize } = require('../config/database');
const { GameSession } = require('../models/GameSession');
const { featureFlags } = require('../config/featureFlags');

/** Default host lease duration (ms). */
const DEFAULT_LEASE_TTL_MS = 30 * 1000;

/**
 * Host connection lease (Phase 2).
 * Prevents ambiguous dual-host control; allows takeover only after expiry.
 */
class HostLeaseService {
    static isEnabled() {
        return featureFlags.newSessionEngine;
    }

    static defaultTtlMs() {
        const env = process.env.HOST_LEASE_TTL_MS;
        if (env && Number.isFinite(Number(env))) return Number(env);
        return DEFAULT_LEASE_TTL_MS;
    }

    /**
     * @param {Object} session - GameSession instance (may be stale)
     * @param {Date|number} [now]
     * @returns {boolean}
     */
    static isLeaseActive(session, now = Date.now()) {
        if (!session || !session.hostLeaseExpiresAt) return false;
        const expires = new Date(session.hostLeaseExpiresAt).getTime();
        return expires > now;
    }

    /**
     * Acquire or renew lease for the authorized host.
     * Takeover of another owner's lease is allowed only if expired.
     *
     * @param {Object} params
     * @param {number} params.sessionId
     * @param {string|number} params.ownerId - host user id or connection key
     * @param {number} [params.ttlMs]
     * @param {boolean} [params.force=false] - bypass feature flag (tests)
     * @returns {Promise<Object>}
     */
    static async acquireOrRenew({ sessionId, ownerId, ttlMs, force = false }) {
        if (!force && !this.isEnabled()) {
            return { ok: true, code: 'FEATURE_DISABLED', skipped: true };
        }

        const owner = String(ownerId);
        const ttl = ttlMs != null ? ttlMs : this.defaultTtlMs();

        return sequelize.transaction(async (t) => {
            const session = await GameSession.findByPk(sessionId, {
                transaction: t,
                lock: t.LOCK.UPDATE
            });

            if (!session) {
                return { ok: false, code: 'SESSION_NOT_FOUND' };
            }

            const now = Date.now();
            const active = this.isLeaseActive(session, now);
            const currentOwner = session.hostLeaseOwner ? String(session.hostLeaseOwner) : null;

            if (active && currentOwner && currentOwner !== owner) {
                return {
                    ok: false,
                    code: 'LEASE_HELD',
                    hostLeaseOwner: currentOwner,
                    hostLeaseExpiresAt: new Date(session.hostLeaseExpiresAt).getTime()
                };
            }

            const expiresAt = new Date(now + ttl);
            session.hostLeaseOwner = owner;
            session.hostLeaseExpiresAt = expiresAt;
            await session.save({ transaction: t });

            return {
                ok: true,
                code: active && currentOwner === owner ? 'RENEWED' : 'ACQUIRED',
                hostLeaseOwner: owner,
                hostLeaseExpiresAt: expiresAt.getTime()
            };
        });
    }

    /**
     * Release lease if the caller owns it.
     */
    static async release({ sessionId, ownerId, force = false }) {
        if (!force && !this.isEnabled()) {
            return { ok: true, code: 'FEATURE_DISABLED', skipped: true };
        }

        const owner = String(ownerId);

        return sequelize.transaction(async (t) => {
            const session = await GameSession.findByPk(sessionId, {
                transaction: t,
                lock: t.LOCK.UPDATE
            });

            if (!session) {
                return { ok: false, code: 'SESSION_NOT_FOUND' };
            }

            if (session.hostLeaseOwner && String(session.hostLeaseOwner) !== owner) {
                return { ok: false, code: 'NOT_LEASE_OWNER' };
            }

            session.hostLeaseOwner = null;
            session.hostLeaseExpiresAt = null;
            await session.save({ transaction: t });

            return { ok: true, code: 'RELEASED' };
        });
    }
}

module.exports = HostLeaseService;
