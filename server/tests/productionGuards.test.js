const { expect } = require('chai');
const { assertProductionDatabase, assertProductionSecurity } = require('../config/productionGuards');
const { featureFlags } = require('../config/featureFlags');

describe('Production guards (Phase 3)', () => {
    it('skips when not production', () => {
        const result = assertProductionDatabase({ NODE_ENV: 'test' });
        expect(result.ok).to.equal(true);
        expect(result.skipped).to.equal(true);
    });

    it('rejects production without DB_DIALECT', () => {
        expect(() => assertProductionDatabase({ NODE_ENV: 'production' })).to.throw(/DB_DIALECT/);
    });

    it('rejects production sqlite', () => {
        expect(() =>
            assertProductionDatabase({ NODE_ENV: 'production', DB_DIALECT: 'sqlite' })
        ).to.throw(/sqlite/i);
    });

    it('accepts production postgres', () => {
        const result = assertProductionDatabase({
            NODE_ENV: 'production',
            DB_DIALECT: 'postgres'
        });
        expect(result.ok).to.equal(true);
        expect(result.dialect).to.equal('postgres');
    });

    it('rejects an unsafe production JWT secret', () => {
        expect(() => assertProductionSecurity({
            NODE_ENV: 'production',
            JWT_SECRET: 'fallback_secret'
        })).to.throw(/JWT_SECRET/);
    });

    it('requires a server-side OpenAI key when AI authoring is enabled', () => {
        expect(() => assertProductionSecurity({
            NODE_ENV: 'production',
            JWT_SECRET: 'a-secure-production-secret-with-more-than-32-characters',
            SCORM_AI_AUTHOR: 'true'
        })).to.throw(/OPENAI_API_KEY/);
    });

    it('accepts a hardened production security configuration', () => {
        const result = assertProductionSecurity({
            NODE_ENV: 'production',
            JWT_SECRET: 'a-secure-production-secret-with-more-than-32-characters',
            SCORM_AI_AUTHOR: 'true',
            OPENAI_API_KEY: 'server-side-openai-key-value-for-production'
        });
        expect(result.ok).to.equal(true);
        expect(result.aiEnabled).to.equal(true);
    });

    it('REPORTS_ASYNC defaults to false', () => {
        expect(featureFlags.reportsAsync).to.equal(false);
    });
});
