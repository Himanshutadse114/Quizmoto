import { apiUrl } from '../../../config';

/**
 * Canonical Phase 2 recovery fetch.
 * @param {Object} params
 * @param {number|string} params.sessionId
 * @param {'host'|'player'} params.role
 * @param {string} params.token - host JWT or player session JWT
 * @returns {Promise<Object>} recovery envelope
 */
export async function fetchSessionRecovery({ sessionId, role, token }) {
    if (!sessionId || !role || !token) {
        throw new Error('sessionId, role, and token are required');
    }

    const url = apiUrl(`/api/sessions/${sessionId}/recovery?role=${encodeURIComponent(role)}`);
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
        }
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(body.message || `Recovery failed (${res.status})`);
        err.code = body.code || 'RECOVERY_FAILED';
        err.status = res.status;
        throw err;
    }
    return body;
}
