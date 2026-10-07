const { expect } = require('chai');
const express = require('express');
const path = require('path');

process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-video-studio-123456';

function stubModule(resolvedPath, stub) {
    const resolved = require.resolve(resolvedPath);
    delete require.cache[resolved];
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: stub };
}

describe('Video Studio', function () {
    this.timeout(10000);

    let app;
    let VideoStudioService;

    const fakeAuth = (req, _res, next) => {
        const header = req.headers.authorization || '';
        if (!header.startsWith('Bearer ')) return _res.status(401).json({ message: 'Unauthorized' });
        req.userId = 'user-vs-1';
        req.authenticatedUserId = 'user-vs-1';
        req.scormWorkspaceId = 'ws-vs-1';
        next();
    };

    before(() => {
        const RealVideoStudioManager = require('../jobs/VideoStudioManager');
        stubModule(path.join(__dirname, '../routes/middleware'), fakeAuth);
        stubModule(path.join(__dirname, '../services/scorm/AiOperationGuard'), {
            runMeteredAiOperation: async (_req, _opts, operation) => operation()
        });
        stubModule(path.join(__dirname, '../jobs/VideoStudioManager'), {
            enqueue: async ({ progressId, userId, payload }) => ({
                accepted: true, progressId, duplicate: false, status: 'queued', userId, kind: payload.kind
            }),
            getProgress: async (progressId, userId) => ({
                progressId, status: 'complete', percent: 100, stage: 'Done', detail: 'Finished.',
                result: { blueprint: { title: 'T', layout: 'linkedin', scenes: [] } }
            }),
            cancel: async () => true,
            stats: () => ({ active: 0, queued: 0 }),
            isVideoStudioKind: RealVideoStudioManager.isVideoStudioKind
        });
        delete require.cache[require.resolve('../routes/scorm/videoStudio')];
        const videoStudioRouter = require('../routes/scorm/videoStudio');
        app = express();
        app.use(express.json({ limit: '1mb' }));
        app.use('/api/scorm/video-studio', videoStudioRouter);
        VideoStudioService = require('../services/videoStudio/VideoStudioService');
    });

    describe('routes', () => {
        it('rejects unauthenticated requests', async () => {
            const request = require('supertest');
            const res = await request(app).get('/api/scorm/video-studio/layouts');
            expect(res.status).to.equal(401);
        });

        it('lists the five layouts', async () => {
            const request = require('supertest');
            const res = await request(app).get('/api/scorm/video-studio/layouts')
                .set('Authorization', 'Bearer test-token');
            expect(res.status).to.equal(200);
            expect(res.body.layouts).to.deep.equal(['linkedin', 'innvikta', 'course', 'kinetic', 'cinematic']);
        });

        it('422s script generation without a topic', async () => {
            const request = require('supertest');
            const res = await request(app).post('/api/scorm/video-studio/script')
                .set('Authorization', 'Bearer test-token')
                .send({ description: 'x', layout: 'linkedin' });
            expect(res.status).to.equal(422);
            expect(res.body.code).to.equal('VIDEO_TOPIC_REQUIRED');
        });

        it('422s script generation with an unknown layout', async () => {
            const request = require('supertest');
            const res = await request(app).post('/api/scorm/video-studio/script')
                .set('Authorization', 'Bearer test-token')
                .send({ topic: 'Hello', layout: 'nope' });
            expect(res.status).to.equal(422);
            expect(res.body.code).to.equal('VIDEO_LAYOUT_UNKNOWN');
        });

        it('queues script generation with 202', async () => {
            const request = require('supertest');
            const res = await request(app).post('/api/scorm/video-studio/script')
                .set('Authorization', 'Bearer test-token')
                .send({ topic: 'DPDP Act', description: 'basics', layout: 'course', seconds: 60 });
            expect(res.status).to.equal(202);
            expect(res.body.progressId).to.be.a('string');
            expect(res.body.poll).to.include('/api/scorm/video-studio/jobs/');
        });

        it('reads job status', async () => {
            const request = require('supertest');
            const res = await request(app).get('/api/scorm/video-studio/jobs/abc12345')
                .set('Authorization', 'Bearer test-token');
            expect(res.status).to.equal(200);
            expect(res.body.job.status).to.equal('complete');
        });

        it('422s build with an invalid blueprint', async () => {
            const request = require('supertest');
            const res = await request(app).post('/api/scorm/video-studio/build')
                .set('Authorization', 'Bearer test-token')
                .send({ blueprint: { title: 'x', scenes: [] }, imageKeys: {} });
            expect(res.status).to.equal(422);
            expect(res.body.code).to.equal('VIDEO_BLUEPRINT_INVALID');
        });

        it('402s a build over the per-video budget', async () => {
            const request = require('supertest');
            const bp = {
                title: 'T', layout: 'linkedin',
                scenes: Array.from({ length: 8 }, (_, i) => ({
                    kind: 'title', headline: `H${i}`, highlight: '', sub: '', bullets: [],
                    narration: 'word '.repeat(4000), image_prompt: 'art'
                }))
            };
            const res = await request(app).post('/api/scorm/video-studio/build')
                .set('Authorization', 'Bearer test-token')
                .send({ blueprint: bp, imageKeys: {}, voice: 'onyx' });
            expect(res.status).to.equal(402);
            expect(res.body.code).to.equal('VIDEO_OVER_BUDGET');
        });

        it('422s build with a forged image key', async () => {
            const request = require('supertest');
            const bp = {
                title: 'T', layout: 'linkedin',
                scenes: [{ kind: 'title', headline: 'H', highlight: '', sub: '', bullets: [], narration: 'Hello world', image_prompt: 'art' }]
            };
            const res = await request(app).post('/api/scorm/video-studio/build')
                .set('Authorization', 'Bearer test-token')
                .send({ blueprint: bp, imageKeys: { 0: 'videos/someone-elses-key.png' } });
            expect(res.status).to.equal(422);
        });

        it('queues a valid build with 202 (approval gate: nothing runs before this call)', async () => {
            const request = require('supertest');
            const bp = {
                title: 'T', layout: 'linkedin',
                scenes: [{ kind: 'title', headline: 'H', highlight: '', sub: '', bullets: [], narration: 'Hello world', image_prompt: 'art' }]
            };
            const res = await request(app).post('/api/scorm/video-studio/build')
                .set('Authorization', 'Bearer test-token')
                .send({ blueprint: bp, imageKeys: { 0: 'video-studio/uploads/user-vs-1/123-0.png' }, voice: 'onyx' });
            expect(res.status).to.equal(202);
            expect(res.body.progressId).to.be.a('string');
            expect(res.body.estimatedCostUsd).to.be.a('number');
            expect(res.body.budgetInr).to.equal(10);
        });

        it('415s an image ticket for a non-image mime type', async () => {
            const request = require('supertest');
            const res = await request(app).post('/api/scorm/video-studio/upload-ticket')
                .set('Authorization', 'Bearer test-token')
                .send({ sceneIndex: 0, mimeType: 'video/mp4', byteSize: 1000 });
            expect(res.status).to.equal(415);
        });
    });

    describe('VideoStudioService', () => {
        it('isVideoStudioKind keeps video jobs out of the course manager recovery', () => {
            const { JOB_TYPES } = require('../jobs/jobTypes');
            const Manager = require('../jobs/VideoStudioManager');
            expect(Manager.isVideoStudioKind(JOB_TYPES.VIDEO_SCRIPT)).to.equal(true);
            expect(Manager.isVideoStudioKind(JOB_TYPES.VIDEO_BUILD)).to.equal(true);
            expect(Manager.isVideoStudioKind('course_generation')).to.equal(false);
            expect(Manager.isVideoStudioKind(undefined)).to.equal(false);
            expect(Manager.isVideoStudioKind(null)).to.equal(false);
        });

        it('sceneCountFor scales with duration', () => {
            expect(VideoStudioService.sceneCountFor(20)).to.equal(3);
            expect(VideoStudioService.sceneCountFor(60)).to.equal(5);
            expect(VideoStudioService.sceneCountFor(180)).to.be.at.least(5);
        });

        it('validateBlueprint accepts a good blueprint', () => {
            const bp = {
                title: 'T', layout: 'linkedin',
                scenes: [{ kind: 'title', headline: 'H', highlight: '', sub: '', bullets: ['a'], narration: 'Hi', image_prompt: 'art' }]
            };
            expect(VideoStudioService.validateBlueprint(bp, 1, 'linkedin')).to.equal(true);
        });

        it('validateBlueprint rejects scenes missing narration', () => {
            const bp = { title: 'T', scenes: [{ kind: 'title', headline: 'H', narration: '' }] };
            expect(() => VideoStudioService.validateBlueprint(bp, 1, 'linkedin'))
                .to.throw(/narration/);
        });

        it('validateBlueprint rejects kinetic non-statement scenes', () => {
            const bp = {
                title: 'T', layout: 'kinetic',
                scenes: [{ kind: 'bullets', headline: 'H', narration: 'Hi', image_prompt: 'x' }]
            };
            expect(() => VideoStudioService.validateBlueprint(bp, 1, 'kinetic')).to.throw();
        });

        it('generateScript parses the model response', async () => {
            const OpenAiClient = require('../services/openai/OpenAiClient');
            const original = OpenAiClient.createStructuredResponse;
            const bp = {
                title: 'Demo', layout: 'linkedin',
                scenes: Array.from({ length: 5 }, (_, i) => ({
                    kind: 'title', headline: `H${i}`, highlight: '', sub: '', bullets: [],
                    narration: `Narration for scene ${i} goes here.`, image_prompt: 'abstract art'
                }))
            };
            OpenAiClient.createStructuredResponse = async () => ({ text: JSON.stringify(bp), usage: {}, estimatedCostUsd: 0.001 });
            try {
                const result = await VideoStudioService.generateScript({ topic: 'T', description: 'D', layout: 'linkedin', seconds: 60 });
                expect(result.blueprint.scenes).to.have.length(5);
            } finally {
                OpenAiClient.createStructuredResponse = original;
            }
        });

        it('generateScript surfaces unreadable model output cleanly', async () => {
            const OpenAiClient = require('../services/openai/OpenAiClient');
            const original = OpenAiClient.createStructuredResponse;
            OpenAiClient.createStructuredResponse = async () => ({ text: 'not-json{{{', usage: {} });
            try {
                await VideoStudioService.generateScript({ topic: 'T', description: 'D', layout: 'linkedin' });
                expect.fail('should have thrown');
            } catch (error) {
                expect(error.code).to.equal('VIDEO_SCRIPT_PARSE');
            } finally {
                OpenAiClient.createStructuredResponse = original;
            }
        });
    });
});
