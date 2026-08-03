const { expect } = require('chai');
const { assertProductionDatabase } = require('../config/productionGuards');
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

    it('REPORTS_ASYNC defaults to false', () => {
        expect(featureFlags.reportsAsync).to.equal(false);
    });
});
