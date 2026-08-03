// Central config - reads the backend URL from Vite env vars.
// In production (Vercel), VITE_BACKEND_URL is set to the Koyeb server URL.
// In local development, it's empty so relative paths work via the nginx proxy.
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

// Helper to prefix API paths with the backend URL
export const apiUrl = (path) => `${BACKEND_URL}${path}`;

/**
 * Phase 2 client session engine.
 * Default OFF — existing Host/Player pages keep their local useState flow.
 * Set VITE_NEW_SESSION_ENGINE=true only when opting into the versioned FSM helpers.
 */
export const NEW_SESSION_ENGINE =
    String(import.meta.env.VITE_NEW_SESSION_ENGINE || '').toLowerCase() === 'true' ||
    String(import.meta.env.VITE_NEW_SESSION_ENGINE || '') === '1';
