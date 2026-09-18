const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Readable } = require('stream');
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

    it('putObjectStream writes incrementally without requiring a complete buffer', async () => {
        const key = 'videos/streamed/source.mp4';
        const source = Readable.from([Buffer.from('video-'), Buffer.from('content')]);
        const result = await storage.putObjectStream({
            key,
            stream: source,
            contentType: 'video/mp4',
            contentLength: 13
        });

        expect(result.size).to.equal(13);
        expect((await storage.getObjectBuffer(key)).toString()).to.equal('video-content');
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

    it('getObjectStream returns an exact byte range for video seeking', async () => {
        const key = 'videos/example/source.mp4';
        await storage.putObject({ key, body: Buffer.from('0123456789'), contentType: 'video/mp4' });

        const obj = await storage.getObjectStream(key, { start: 2, end: 5 });
        const chunks = [];
        for await (const chunk of obj.stream) chunks.push(chunk);

        expect(Buffer.concat(chunks).toString()).to.equal('2345');
        expect(obj.contentLength).to.equal(4);
        expect(obj.contentRange).to.equal('bytes 2-5/10');
    });

    it('headObject reports metadata without downloading the body', async () => {
        const key = 'uploads/source.pdf';
        await storage.putObject({ key, body: Buffer.from('%PDF-'), contentType: 'application/pdf' });

        const head = await storage.headObject(key);

        expect(head.contentLength).to.equal(5);
        expect(head.contentType).to.equal('application/pdf');
    });

    it('copyObject duplicates content and preserves its media type', async () => {
        await storage.putObject({ key: 'uploads/video.mp4', body: Buffer.from('video'), contentType: 'video/mp4' });

        await storage.copyObject('uploads/video.mp4', 'courses/1/video.mp4');

        const copied = await storage.getObjectBuffer('courses/1/video.mp4');
        const head = await storage.headObject('courses/1/video.mp4');
        expect(copied.toString()).to.equal('video');
        expect(head.contentType).to.equal('video/mp4');
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
