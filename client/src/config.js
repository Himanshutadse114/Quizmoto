// Central config - reads the backend URL from Vite env vars.
// In production (Vercel), VITE_BACKEND_URL is set to the Koyeb server URL.
// In local development, it's empty so relative paths work via the nginx proxy.
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

// Helper to prefix API paths with the backend URL
export const apiUrl = (path) => `${BACKEND_URL}${path}`;
