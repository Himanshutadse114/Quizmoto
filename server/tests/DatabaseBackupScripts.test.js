const { expect } = require('chai');
const {
    backupKey,
    backupName,
    retentionKeys,
    safePrefix
} = require('../scripts/databaseBackupToR2');
const { parseDatabaseUrl, postgresProcessEnv } = require('../scripts/databaseUtils');

describe('database backup and rotation utilities', () => {
    it('parses encoded PostgreSQL credentials without exposing the URL to child arguments', () => {
        const config = parseDatabaseUrl('postgresql://backup%40user:p%40ss%3Aword@db.example.com:5432/app?sslmode=require');
        expect(config).to.deep.include({
            host: 'db.example.com',
            port: '5432',
            database: 'app',
            user: 'backup@user',
            password: 'p@ss:word',
            sslMode: 'require'
        });
        const childEnv = postgresProcessEnv(config, { PATH: 'test-path' });
        expect(childEnv.PGPASSWORD).to.equal('p@ss:word');
        expect(childEnv.PGSSLMODE).to.equal('require');
    });

    it('creates deterministic UTC archive names and partitioned keys', () => {
        const now = new Date('2026-09-19T10:20:30.000Z');
        const filename = backupName(now);
        expect(filename).to.equal('lmsgen-public-20260919T102030Z.dump');
        expect(backupKey('database-backups/lmsgen/daily', filename, now))
            .to.equal(`database-backups/lmsgen/daily/2026/09/${filename}`);
    });

    it('rejects unsafe object prefixes', () => {
        expect(() => safePrefix('../other-bucket')).to.throw(/unsupported/);
        expect(() => safePrefix('database backups')).to.throw(/unsupported/);
    });

    it('keeps the minimum number of newest backups even when all are old', () => {
        const now = new Date('2026-09-19T00:00:00Z');
        const objects = Array.from({ length: 10 }, (_, index) => {
            const day = String(index + 1).padStart(2, '0');
            const key = `database-backups/lmsgen/daily/2026/08/backup-${day}.dump`;
            return [
                { Key: key, LastModified: new Date(`2026-08-${day}T00:00:00Z`) },
                { Key: key.replace(/\.dump$/, '.manifest.json'), LastModified: new Date(`2026-08-${day}T00:00:00Z`) }
            ];
        }).flat();
        const deleted = retentionKeys(objects, {
            nowMs: now.getTime(),
            retentionDays: 7,
            minimumBackups: 7
        });
        expect(deleted).to.have.length(6);
        expect(deleted.every((key) => /backup-0[1-3]\.(dump|manifest\.json)$/.test(key))).to.equal(true);
    });
});
