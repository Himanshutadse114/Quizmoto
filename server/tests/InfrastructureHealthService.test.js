const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const {
    getInfrastructureHealth,
    runInfrastructureHealthCheck,
    resetInfrastructureHealthCache
} = require('../services/scorm/InfrastructureHealthService');

describe('InfrastructureHealthService', () => {
    beforeEach(() => resetInfrastructureHealthCache());

    it('verifies the database and R2 without returning connection details', async () => {
        const result = await runInfrastructureHealthCheck({
            sequelize: { query: async () => [{ ok: 1 }] },
            getObjectStorage: () => ({
                driver: 's3',
                listKeys: async () => []
            })
        });

        expect(result.overall).to.equal('connected');
        expect(result.database.status).to.equal('connected');
        expect(result.objectStorage.status).to.equal('connected');
        expect(JSON.stringify(result)).not.to.match(/bucket|host|password|secret|endpoint/i);
    });

    it('reports local storage as R2 not configured', async () => {
        const result = await runInfrastructureHealthCheck({
            sequelize: { query: async () => [{ ok: 1 }] },
            getObjectStorage: () => ({ driver: 'local' })
        });

        expect(result.overall).to.equal('attention');
        expect(result.objectStorage).to.deep.include({
            status: 'not_configured',
            message: 'R2 is not configured'
        });
    });

    it('returns a safe error when a dependency cannot connect', async () => {
        const result = await runInfrastructureHealthCheck({
            sequelize: {
                query: async () => {
                    throw new Error('password=hunter2 host=private-db.internal');
                }
            },
            getObjectStorage: () => ({
                driver: 's3',
                listKeys: async () => {
                    throw new Error('secret R2 credential');
                }
            })
        });

        expect(result.database.message).to.equal('Connection unavailable');
        expect(result.objectStorage.message).to.equal('Connection unavailable');
        expect(JSON.stringify(result)).not.to.match(/hunter2|private-db|credential/i);
    });

    it('briefly caches repeated checks', async () => {
        let databaseChecks = 0;
        const options = {
            cacheMs: 10000,
            sequelize: { query: async () => { databaseChecks += 1; } },
            getObjectStorage: () => ({ driver: 's3', listKeys: async () => [] })
        };

        await getInfrastructureHealth(options);
        await getInfrastructureHealth(options);

        expect(databaseChecks).to.equal(1);
    });

    it('exposes the health endpoint only behind Super Admin authorization', () => {
        const routes = fs.readFileSync(path.join(__dirname, '../routes/scorm/access.js'), 'utf8');
        expect(routes).to.include("router.get('/infrastructure-health', auth, requireSuperAdmin");
        expect(routes).to.include("res.set('Cache-Control', 'private, no-store')");
    });
});
