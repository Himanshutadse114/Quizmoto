const { Op } = require('sequelize');
const { GameSession } = require('../models/GameSession');
const { SessionStateMachine, TRANSIENT_STATES } = require('./SessionStateMachine');
const SessionCommandService = require('./SessionCommandService');
const { featureFlags } = require('../config/featureFlags');
const crypto = require('crypto');

/** Max time allowed in a transient state before remediation (ms). */
const DEFAULT_TRANSIENT_TIMEOUT_MS = 45 * 1000;

/**
 * Scans for sessions stuck in transient V2 states and remediates.
 * Only active when NEW_SESSION_ENGINE is enabled (or force in tests).
 */
class SessionWatchdogService {
    static isEnabled() {
        return featureFlags.newSessionEngine;
    }

    static timeoutMs() {
        const env = process.env.SESSION_TRANSIENT_TIMEOUT_MS;
        if (env && Number.isFinite(Number(env))) return Number(env);
        return DEFAULT_TRANSIENT_TIMEOUT_MS;
    }

    /**
     * One scan cycle.
     * @param {Object} [options]
     * @param {boolean} [options.force=false]
     * @param {number} [options.now]
     * @param {number} [options.timeoutMs]
     * @returns {Promise<{ scanned: number, remediated: Array }>}
     */
    static async scan(options = {}) {
        const force = options.force === true;
        if (!force && !this.isEnabled()) {
            return { scanned: 0, remediated: [], skipped: true, code: 'FEATURE_DISABLED' };
        }

        const now = options.now != null ? options.now : Date.now();
        const timeoutMs = options.timeoutMs != null ? options.timeoutMs : this.timeoutMs();
        const cutoff = new Date(now - timeoutMs);

        const stuck = await GameSession.findAll({
            where: {
                state: { [Op.in]: [...TRANSIENT_STATES] },
                stateEnteredAt: { [Op.lt]: cutoff }
            },
            limit: 50
        });

        const remediated = [];

        for (const session of stuck) {
            try {
                const result = await this.remediate(session, { force, now });
                if (result && result.remediated) {
                    remediated.push({
                        sessionId: session.id,
                        pin: session.pin,
                        fromState: result.fromState,
                        toState: result.toState,
                        code: result.code
                    });
                }
            } catch (err) {
                console.error('[SessionWatchdog] remediate failed', session.id, err.message);
            }
        }

        return { scanned: stuck.length, remediated };
    }

    /**
     * @param {Object} session
     * @param {Object} options
     */
    static async remediate(session, options = {}) {
        const force = options.force === true;
        const fromState = session.state || SessionStateMachine.fromLegacyStatus(session.status);

        if (!SessionStateMachine.isTransient(fromState)) {
            return { remediated: false, code: 'NOT_TRANSIENT', fromState };
        }

        const actorId = 'system:watchdog';
        const commandId = crypto.randomUUID();
        const expectedStateVersion = Number(session.stateVersion || 0);

        if (fromState === 'STARTING') {
            // Fail safe: pause so host/clients can recover instead of infinite Starting
            const result = await SessionCommandService.execute({
                commandId,
                commandType: 'WATCHDOG_PAUSE_STARTING',
                sessionId: session.id,
                expectedStateVersion,
                toState: 'PAUSED',
                actorId,
                actorType: 'system',
                payload: { reason: 'TRANSIENT_TIMEOUT', fromState },
                force
            });

            if (result.ok) {
                await GameSession.update(
                    { lastErrorCode: 'WATCHDOG_STARTING_TIMEOUT' },
                    { where: { id: session.id } }
                );
                return {
                    remediated: true,
                    code: 'PAUSED',
                    fromState,
                    toState: 'PAUSED',
                    result
                };
            }
            return { remediated: false, code: result.code || 'COMMAND_FAILED', fromState, result };
        }

        if (fromState === 'QUESTION_LOCKED') {
            const result = await SessionCommandService.execute({
                commandId,
                commandType: 'WATCHDOG_FORCE_REVEAL',
                sessionId: session.id,
                expectedStateVersion,
                toState: 'ANSWER_REVEAL',
                actorId,
                actorType: 'system',
                payload: { reason: 'TRANSIENT_TIMEOUT', fromState },
                force
            });

            if (result.ok) {
                await GameSession.update(
                    { lastErrorCode: 'WATCHDOG_LOCKED_TIMEOUT' },
                    { where: { id: session.id } }
                );
                return {
                    remediated: true,
                    code: 'ANSWER_REVEAL',
                    fromState,
                    toState: 'ANSWER_REVEAL',
                    result
                };
            }
            return { remediated: false, code: result.code || 'COMMAND_FAILED', fromState, result };
        }

        if (fromState === 'FINISHING') {
            const result = await SessionCommandService.execute({
                commandId,
                commandType: 'WATCHDOG_FORCE_FINISH',
                sessionId: session.id,
                expectedStateVersion,
                toState: 'FINISHED',
                actorId,
                actorType: 'system',
                payload: { reason: 'TRANSIENT_TIMEOUT', fromState },
                force
            });

            if (result.ok) {
                await GameSession.update(
                    { lastErrorCode: 'WATCHDOG_FINISHING_TIMEOUT' },
                    { where: { id: session.id } }
                );
                return {
                    remediated: true,
                    code: 'FINISHED',
                    fromState,
                    toState: 'FINISHED',
                    result
                };
            }
            return { remediated: false, code: result.code || 'COMMAND_FAILED', fromState, result };
        }

        return { remediated: false, code: 'NO_POLICY', fromState };
    }

    /**
     * Start a periodic scanner. Returns a stop function.
     * No-op when feature flag is off.
     */
    static startPeriodic(intervalMs = 15000) {
        if (!this.isEnabled()) {
            console.log('[SessionWatchdog] not started (NEW_SESSION_ENGINE off)');
            return () => {};
        }

        console.log(`[SessionWatchdog] started interval=${intervalMs}ms timeout=${this.timeoutMs()}ms`);
        const handle = setInterval(() => {
            this.scan().catch((err) => {
                console.error('[SessionWatchdog] scan error', err.message);
            });
        }, intervalMs);

        if (typeof handle.unref === 'function') {
            handle.unref();
        }

        return () => clearInterval(handle);
    }
}

module.exports = SessionWatchdogService;
