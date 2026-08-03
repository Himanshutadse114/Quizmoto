const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');

const { sequelize } = require('../config/database');
const { Quiz } = require('../models/Quiz');
const { GameSession, Player } = require('../models/GameSession');
const User = require('../models/User');
const JobQueueService = require('../jobs/JobQueueService');

describe('Reports async path (REPORTS_ASYNC)', function () {
    // Must stay low — these tests never call real Python
    this.timeout(10000);

    let app;
    let hostToken;
    let hostId;
    let sessionId;
    let testRunId;
    let prevAsync;
    let prevInline;
    let prevStub;

    before(async () => {
        prevAsync = process.env.REPORTS_ASYNC;
        prevInline = process.env.REPORTS_PROCESS_INLINE;
        prevStub = process.env.REPORT_GEN_STUB;

        process.env.REPORTS_ASYNC = 'true';
        process.env.REPORTS_PROCESS_INLINE = '1';
        // Critical: never invoke Python in this suite (was hanging on Windows)
        process.env.REPORT_GEN_STUB = '1';

        delete require.cache[require.resolve('../config/featureFlags')];
        delete require.cache[require.resolve('../services/ReportGenerationService')];
        delete require.cache[require.resolve('../jobs/handlers/reportHandlers')];
        delete require.cache[require.resolve('../routes/quizzes')];
        delete require.cache[require.resolve('../routes/jobs')];

        const { connectDB } = require('../config/database');
        await connectDB();
        await sequelize.sync({ force: true });

        const quizzesRouter = require('../routes/quizzes');
        const jobsRouter = require('../routes/jobs');

        app = express();
        app.use(express.json());
        app.use('/api/quizzes', quizzesRouter);
        app.use('/api/jobs', jobsRouter);

        testRunId = `asyncreport-${Date.now()}`;
        process.env.TEST_TEMP_DIR_ROOT = path.join(__dirname, '../data/tmp');

        const host = await User.create({
            username: 'asynchost',
            email: 'async@test.com',
            password: 'pass'
        });
        hostId = host.id;
        hostToken = jwt.sign(
            { userId: hostId },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '1h' }
        );

        const quiz = await Quiz.create({ title: 'Async Report Quiz', hostId });
        const session = await GameSession.create({
            pin: '888888',
            quizId: quiz.id,
            hostId,
            status: 'finished'
        });
        sessionId = session.id;
        await Player.create({
            sessionId,
            nickname: 'AsyncPlayer',
            score: 500,
            socketId: 'async-sock'
        });
    });

    after(() => {
        if (prevAsync === undefined) delete process.env.REPORTS_ASYNC;
        else process.env.REPORTS_ASYNC = prevAsync;
        if (prevInline === undefined) delete process.env.REPORTS_PROCESS_INLINE;
        else process.env.REPORTS_PROCESS_INLINE = prevInline;
        if (prevStub === undefined) delete process.env.REPORT_GEN_STUB;
        else process.env.REPORT_GEN_STUB = prevStub;

        delete require.cache[require.resolve('../config/featureFlags')];
        JobQueueService._resetForTests();
    });

    it('returns 202 with jobId instead of blocking download', async () => {
        const res = await request(app)
            .get(`/api/quizzes/reports/${sessionId}/export?format=pdf`)
            .set('Authorization', `Bearer ${hostToken}`)
            .set('x-test-run-id', testRunId);

        expect(res.status).to.equal(202);
        expect(res.body.jobId).to.be.a('string');
        expect(res.body.status).to.equal('completed');
        expect(res.body.downloadPath).to.match(/\/api\/jobs\/.+\/download/);
    });

    it('job status endpoint returns completed for owner', async () => {
        const exportRes = await request(app)
            .get(`/api/quizzes/reports/${sessionId}/export?format=excel`)
            .set('Authorization', `Bearer ${hostToken}`)
            .set('x-test-run-id', testRunId);

        expect(exportRes.status).to.equal(202);
        const jobId = exportRes.body.jobId;

        const statusRes = await request(app)
            .get(`/api/jobs/${jobId}`)
            .set('Authorization', `Bearer ${hostToken}`);

        expect(statusRes.status).to.equal(200);
        expect(statusRes.body.status).to.equal('completed');
        expect(statusRes.body.result.format).to.equal('excel');
    });

    it('forbids other users from reading job status', async () => {
        const exportRes = await request(app)
            .get(`/api/quizzes/reports/${sessionId}/export?format=pdf`)
            .set('Authorization', `Bearer ${hostToken}`)
            .set('x-test-run-id', testRunId);

        const otherToken = jwt.sign(
            { userId: 99999 },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '1h' }
        );

        const statusRes = await request(app)
            .get(`/api/jobs/${exportRes.body.jobId}`)
            .set('Authorization', `Bearer ${otherToken}`);

        expect(statusRes.status).to.equal(403);
    });

    it('enqueue-only path returns pending without inline process', async () => {
        process.env.REPORTS_PROCESS_INLINE = '0';

        const res = await request(app)
            .get(`/api/quizzes/reports/${sessionId}/export?format=pdf`)
            .set('Authorization', `Bearer ${hostToken}`)
            .set('x-test-run-id', testRunId);

        expect(res.status).to.equal(202);
        expect(res.body.jobId).to.be.a('string');
        // Without inline, status is pending (or completed if idempotent replay of prior completed job)
        expect(res.body.status).to.be.oneOf(['pending', 'completed']);
        if (res.body.status === 'pending') {
            expect(res.body.statusPath).to.match(/\/api\/jobs\//);
        }

        process.env.REPORTS_PROCESS_INLINE = '1';
    });
});
