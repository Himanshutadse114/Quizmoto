/**
 * Single source of truth for the platform JWT signing secret.
 *
 * - Test (NODE_ENV=test): returns an ephemeral random secret. The committed
 *   test secret was scrubbed from the repo, so mocha runs must not depend on
 *   a static value. Every test file signs/verifies through this module, so
 *   tokens stay consistent within a single test process.
 * - Everywhere else: JWT_SECRET is mandatory and must be at least 32
 *   characters (mirrors server/config/productionGuards.js). The server fails
 *   fast at require time instead of silently signing with a weak default.
 */
const crypto = require('crypto');

const UNSAFE_SECRETS = new Set(['fallback_secret', 'secret', 'changeme', 'change-me', 'development']);

function loadJwtSecret() {
    const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase();
    const isTest = nodeEnv === 'test';
    const configured = String(process.env.JWT_SECRET || '').trim();

    if (configured) {
        if (!isTest && (configured.length < 32 || UNSAFE_SECRETS.has(configured.toLowerCase()))) {
            const err = new Error(
                'JWT_SECRET must be a unique secret of at least 32 characters. ' +
                'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
            );
            err.code = 'JWT_SECRET_UNSAFE';
            throw err;
        }
        return configured;
    }

    if (isTest) {
        // Ephemeral per-process secret for the mocha suite. Never reuse the
        // old committed test value: it is scrubbed and must stay dead.
        return crypto.randomBytes(32).toString('hex');
    }

    const err = new Error(
        'JWT_SECRET environment variable is required (minimum 32 characters). ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
    err.code = 'JWT_SECRET_MISSING';
    throw err;
}

module.exports = loadJwtSecret();
