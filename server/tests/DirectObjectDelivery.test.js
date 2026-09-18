const { expect } = require('chai');
const {
    browserOrigins,
    isDirectDeliveryEnabled,
    isDirectUploadEnabled,
    prepareDirectUpload,
    safeDownloadName,
    signedReadUrl
} = require('../storage/DirectObjectDelivery');

describe('DirectObjectDelivery', function () {
    const previous = {};

    beforeEach(() => {
        for (const key of ['NODE_ENV', 'FRONTEND_URL', 'CLIENT_URL', 'CORS_ORIGIN', 'DIRECT_OBJECT_DELIVERY', 'DIRECT_OBJECT_UPLOADS']) {
            previous[key] = process.env[key];
            delete process.env[key];
        }
    });

    afterEach(() => {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });

    it('enables signed delivery and upload only for a capable S3 driver', () => {
        const storage = { driver: 's3', createSignedGetUrl() {}, createSignedPutUrl() {}, headObject() {} };
        expect(isDirectDeliveryEnabled(storage)).to.equal(true);
        expect(isDirectUploadEnabled(storage)).to.equal(true);
        expect(isDirectDeliveryEnabled({ driver: 'local' })).to.equal(false);
    });

    it('prepares browser CORS once for repeated direct uploads', async () => {
        let calls = 0;
        const storage = {
            driver: 's3',
            createSignedPutUrl() {},
            headObject() {},
            async ensureBrowserCors(origins) {
                calls += 1;
                expect(origins).to.include('https://www.lmsgen.in');
            }
        };

        expect(await prepareDirectUpload(storage)).to.equal(true);
        expect(await prepareDirectUpload(storage)).to.equal(true);
        expect(calls).to.equal(1);
    });

    it('includes configured production origins and sanitizes download names', () => {
        process.env.NODE_ENV = 'production';
        process.env.FRONTEND_URL = 'https://app.example.com/';
        expect(browserOrigins()).to.include('https://app.example.com');
        expect(browserOrigins()).not.to.include('http://localhost:5173');
        expect(safeDownloadName('report\r\n"bad.zip')).to.equal('report_bad.zip');
    });

    it('creates a time-limited signed read URL with attachment metadata', async () => {
        let received;
        const storage = {
            driver: 's3',
            async createSignedGetUrl(key, options) {
                received = { key, options };
                return 'https://objects.example/signed';
            }
        };
        const url = await signedReadUrl(storage, 'packages/1.zip', { expiresIn: 120, downloadName: 'Course.zip' });
        expect(url).to.equal('https://objects.example/signed');
        expect(received).to.deep.equal({
            key: 'packages/1.zip',
            options: { expiresIn: 120, responseContentType: undefined, responseContentDisposition: 'attachment; filename="Course.zip"' }
        });
    });
});
