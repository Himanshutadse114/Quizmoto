const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
    createObjectStorage,
    _resetObjectStorageCache
} = require('../storage/ObjectStorage');

describe('ObjectStorage (Phase 3)', function () {
    let rootDir;
    let storage;

    beforeEach(() => {
        _resetObjectStorageCache();
        rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quizmoto-storage-'));
        storage = createObjectStorage({ driver: 'local', rootDir });
    });

    afterEach(() => {
        _resetObjectStorageCache();
        try {
            fs.rmSync(rootDir, { recursive: true, force: true });
        } catch (_) {
            /* ignore */
        }
    });

    it('defaults to local driver', () => {
        expect(storage.driver).to.equal('local');
    });

    it('putObject + exists + getObjectBuffer round-trip', async () => {
        const key = 'reports/1/test.pdf';
        await storage.putObject({
            key,
            body: Buffer.from('%PDF-1.4 test'),
            contentType: 'application/pdf'
        });

        expect(await storage.exists(key)).to.equal(true);
        const buf = await storage.getObjectBuffer(key);
        expect(buf.toString()).to.include('%PDF-1.4');
    });

    it('getObjectStream returns readable stream', async () => {
        const key = 'reports/2/out.xlsx';
        await storage.putObject({
            key,
            body: Buffer.from([0x50, 0x4b]),
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const obj = await storage.getObjectStream(key);
        expect(obj.contentType).to.include('spreadsheet');
        const chunks = [];
        for await (const c of obj.stream) chunks.push(c);
        expect(Buffer.concat(chunks)[0]).to.equal(0x50);
    });

    it('deleteObject removes the key', async () => {
        const key = 'reports/3/gone.pdf';
        await storage.putObject({ key, body: Buffer.from('x') });
        await storage.deleteObject(key);
        expect(await storage.exists(key)).to.equal(false);
    });

    it('rejects path traversal keys', async () => {
        try {
            await storage.putObject({ key: '../outside.txt', body: Buffer.from('nope') });
            expect.fail('should throw');
        } catch (err) {
            expect(err.message).to.match(/invalid storage key|storage key/i);
        }
    });

    it('S3 driver without bucket throws', () => {
        const prev = process.env.S3_BUCKET;
        delete process.env.S3_BUCKET;
        try {
            expect(() => createObjectStorage({ driver: 's3' })).to.throw(/S3_BUCKET/);
        } finally {
            if (prev !== undefined) process.env.S3_BUCKET = prev;
        }
    });
});
