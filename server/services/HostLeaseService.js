const { sequelize } = require('../config/database');
const { GameSession } = require('../models/GameSession');
const { featureFlags } = require('../config/featureFlags');

/** Default host lease duration (ms). */
const DEFAULT_LEASE_TTL_MS = 30 * 1000;

// SQLite uses a single connection in the test/dev profile and cannot safely run
// overlapping transactions (for example host lease renewal while a player answer
// is being persisted). Serialize lease mutations per session and avoid opening a
// SQLite transaction; PostgreSQL keeps the row-locked transactional path below.
const sqliteLeaseQueues = new Map();

async function withSqliteLeaseLock(sessionId, work) {
    const key = String(sessionId);
    const previous = sqliteLeaseQueues.get(key) || Promise.resolve();
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const tail = previous.catch(() => {}).then(() => gate);
    sqliteLeaseQueues.set(key, tail);

    await previous.catch(() => {});
    try {
        return await work();
    } finally {
        release();
        if (sqliteLeaseQueues.get(key) === tail) sqliteLeaseQueues.delete(key);
    }
}

function isSqlite() {
    return typeof sequelize.getDialect === 'function' && sequelize.getDialect() === 'sqlite';
}

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

    static isLeaseActive(session, now = Date.now()) {
        if (!session || !session.hostLeaseExpiresAt) return false;
        const expires = new Date(session.hostLeaseExpiresAt).getTime();
        return expires > now;
    }

    static async applyAcquire(session, owner, ttl, saveOptions = {}) {
        if (!session) return { ok: false, code: 'SESSION_NOT_FOUND' };

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
        await session.save(saveOptions);

        return {
            ok: true,
            code: active && currentOwner === owner ? 'RENEWED' : 'ACQUIRED',
            hostLeaseOwner: owner,
            hostLeaseExpiresAt: expiresAt.getTime()
        };
    }

    static async applyRelease(session, owner, saveOptions = {}) {
        if (!session) return { ok: false, code: 'SESSION_NOT_FOUND' };

        if (session.hostLeaseOwner && String(session.hostLeaseOwner) !== owner) {
            return { ok: false, code: 'NOT_LEASE_OWNER' };
        }

        session.hostLeaseOwner = null;
        session.hostLeaseExpiresAt = null;
        await session.save(saveOptions);
        return { ok: true, code: 'RELEASED' };
    }

    /**
     * Acquire or renew lease for the authorized host.
     * Takeover of another owner's lease is allowed only if expired.
     */
    static async acquireOrRenew({ sessionId, ownerId, ttlMs, force = false }) {
        if (!force && !this.isEnabled()) {
            return { ok: true, code: 'FEATURE_DISABLED', skipped: true };
        }

        const owner = String(ownerId);
        const ttl = ttlMs != null ? ttlMs : this.defaultTtlMs();

        if (isSqlite()) {
            return withSqliteLeaseLock(sessionId, async () => {
                const session = await GameSession.findByPk(sessionId);
                return this.applyAcquire(session, owner, ttl);
            });
        }

        return sequelize.transaction(async (t) => {
            const session = await GameSession.findByPk(sessionId, {
                transaction: t,
                lock: t.LOCK.UPDATE
            });
            return this.applyAcquire(session, owner, ttl, { transaction: t });
        });
    }

    /** Release lease if the caller owns it. */
    static async release({ sessionId, ownerId, force = false }) {
        if (!force && !this.isEnabled()) {
            return { ok: true, code: 'FEATURE_DISABLED', skipped: true };
        }

        const owner = String(ownerId);

        if (isSqlite()) {
            return withSqliteLeaseLock(sessionId, async () => {
                const session = await GameSession.findByPk(sessionId);
                return this.applyRelease(session, owner);
            });
        }

        return sequelize.transaction(async (t) => {
            const session = await GameSession.findByPk(sessionId, {
                transaction: t,
                lock: t.LOCK.UPDATE
            });
            return this.applyRelease(session, owner, { transaction: t });
        });
    }
}

module.exports = HostLeaseService;
