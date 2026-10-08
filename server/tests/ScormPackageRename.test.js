const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const express = require('express');
const request = require('supertest');

function fixture({ source = 'upload', status = 'ready', missing = false } = {}) {
    const pkg = { id: 'package-1', hostId: 7, title: 'Original', source, status, storageKeyZip: 'courses/original.zip', analysisJson: null };
    pkg.update = sinon.stub().callsFake(async values => Object.assign(pkg, values));
    const findOne = sinon.stub().resolves(missing ? null : pkg);
    const courseUpdate = sinon.stub();
    const getObjectStorage = sinon.stub();
    const router = proxyquire('../routes/scorm/packages', {
        '../middleware': (req, res, next) => { req.userId = 7; next(); },
        '../../models/scorm': { ScormPackage: { findOne }, ScormCourse: { update: courseUpdate } },
        '../../storage/ObjectStorage': { getObjectStorage },
        '../../storage/DirectObjectDelivery': {},
        '../../services/scorm/storageKeys': {},
        '../../config/featureFlags': { scormMaxUploadMb: () => 100 },
        '../../jobs/JobQueueService': {},
        '../../jobs/jobTypes': { JOB_TYPES: {} },
        '../../services/scorm/ScormUnpackService': {},
        '../../services/scorm/ScormPackageCleanup': {},
        '../../services/scorm/ScormCourseCatalogService': {},
        '../../utils/logger': { error: sinon.stub(), warn: sinon.stub() }
    });
    const app = express();
    app.use(express.json());
    app.use('/api/scorm/packages', router);
    return { app, pkg, findOne, courseUpdate, getObjectStorage };
}

describe('SCORM package metadata rename', () => {
    it('trims and saves only the package title with tenant ownership enforced', async () => {
        const { app, pkg, findOne, courseUpdate, getObjectStorage } = fixture();
        const res = await request(app).patch('/api/scorm/packages/package-1').send({ title: '  Updated name  ', status: 'deleted' }).expect(200);
        expect(res.body).to.deep.equal({ id: 'package-1', title: 'Updated name' });
        expect(findOne.firstCall.args[0]).to.deep.equal({ where: { id: 'package-1', hostId: 7 } });
        expect(pkg.update.firstCall.args[0]).to.deep.equal({ title: 'Updated name' });
        expect(pkg.status).to.equal('ready');
        expect(pkg.storageKeyZip).to.equal('courses/original.zip');
        expect(pkg.analysisJson).to.equal(null);
        expect(courseUpdate.called).to.equal(false);
        expect(getObjectStorage.called).to.equal(false);
        expect(res.headers['cache-control']).to.equal('private, no-store');
    });

    for (const title of ['', '   ', null, 123, {}, 'x'.repeat(201)]) {
        it(`rejects invalid title ${JSON.stringify(title).slice(0, 40)}`, async () => {
            const { app, findOne } = fixture();
            await request(app).patch('/api/scorm/packages/package-1').send({ title }).expect(400);
            expect(findOne.called).to.equal(false);
        });
    }
    it('accepts the maximum length and non-English names', async () => {
        const { app } = fixture();
        await request(app).patch('/api/scorm/packages/package-1').send({ title: 'अ'.repeat(200) }).expect(200);
    });
    for (const options of [{ missing: true }, { status: 'deleted' }]) {
        it(`does not rename unavailable packages: ${JSON.stringify(options)}`, async () => {
            const { app, pkg } = fixture(options);
            await request(app).patch('/api/scorm/packages/package-1').send({ title: 'Updated' }).expect(404);
            expect(pkg.update.called).to.equal(false);
        });
    }
    it('keeps shared catalogue packages read-only', async () => {
        const { app, pkg } = fixture({ source: 'catalog' });
        const res = await request(app).patch('/api/scorm/packages/package-1').send({ title: 'Updated' }).expect(403);
        expect(res.body.code).to.equal('SCORM_CATALOG_PACKAGE_READ_ONLY');
        expect(pkg.update.called).to.equal(false);
    });
    it('returns a safe error without leaking database details when saving fails', async () => {
        const { app, pkg } = fixture();
        pkg.update.rejects(new Error('database connection secret'));
        const res = await request(app).patch('/api/scorm/packages/package-1').send({ title: 'Updated' }).expect(500);
        expect(res.body.message).to.not.include('secret');
    });
});
