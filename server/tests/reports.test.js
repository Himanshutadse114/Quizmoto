const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const { sequelize } = require('../config/database');
const { Quiz } = require('../models/Quiz');
const { GameSession, Player } = require('../models/GameSession');
const User = require('../models/User');

let app;
let hostToken;
let playerToken;
let hostId;
let sessionId;
let quizId;
let testRunId;
let tempDir;

const quizzesRouter = require('../routes/quizzes');

describe('Reports API (/api/quizzes/reports)', function () {
    this.timeout(20000);

    before(async () => {
        const { connectDB } = require('../config/database');
        await connectDB();
        app = express();
        app.use(express.json());
        app.use('/api/quizzes', quizzesRouter);
        app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

        await sequelize.sync({ force: true });

        testRunId = `reporttest-${Date.now()}`;
        const tmpRoot = path.join(__dirname, '../data/tmp');
        tempDir = path.join(tmpRoot, `test_${testRunId}`);
        process.env.TEST_TEMP_DIR_ROOT = tmpRoot;

        const host = await User.create({ username: 'reporthost', email: 'report@test.com', password: 'pass' });
        hostId = host.id;
        hostToken = jwt.sign({ userId: hostId }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1h' });
        playerToken = jwt.sign({ userId: 9999 }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1h' });

        const quiz = await Quiz.create({ title: 'Report Quiz', hostId });
        quizId = quiz.id;

        const session = await GameSession.create({
            pin: '777777',
            quizId,
            hostId,
            status: 'finished',
            analytics: JSON.stringify({ avgScore: 100 })
        });
        sessionId = session.id;

        await Player.create({
            sessionId,
            nickname: 'ReportPlayer',
            score: 1000,
            status: 'active',
            socketId: 'sock123'
        });
    });

    describe('GET /reports/all', () => {
        it('should require authorization', async () => {
            const res = await request(app).get('/api/quizzes/reports/all');
            expect(res.status).to.equal(401);
        });

        it('should successfully lookup finished sessions', async () => {
            const res = await request(app)
                .get('/api/quizzes/reports/all')
                .set('Authorization', `Bearer ${hostToken}`);
            expect(res.status).to.equal(200);
            expect(res.body).to.be.an('array').with.lengthOf(1);
            expect(res.body[0].status).to.equal('finished');
        });
    });

    describe('GET /reports/:id/export', () => {
        it('should export PDF successfully and clean up temp files', async () => {
            const res = await request(app)
                .get(`/api/quizzes/reports/${sessionId}/export?format=pdf`)
                .set('Authorization', `Bearer ${hostToken}`)
                .set('x-test-run-id', testRunId);

            expect(res.status).to.equal(200);
            expect(res.headers['content-type']).to.include('application/pdf');
            expect(res.body.toString('ascii').startsWith('%PDF-')).to.be.true;

            await new Promise(r => setTimeout(r, 500));
            expect(fs.readdirSync(tempDir)).to.be.empty;
        });

        it('should export Excel successfully, validate structure, and clean up', async () => {
            const res = await request(app)
                .get(`/api/quizzes/reports/${sessionId}/export?format=excel`)
                .set('Authorization', `Bearer ${hostToken}`)
                .set('x-test-run-id', testRunId)
                .responseType('blob');

            expect(res.status).to.equal(200);
            expect(res.headers['content-type']).to.include('spreadsheetml');
            expect(res.body.toString('ascii').startsWith('PK')).to.be.true;

            const workbook = xlsx.read(res.body, { type: 'buffer' });
            expect(workbook.SheetNames).to.be.an('array').that.is.not.empty;

            const hasPlayers = workbook.SheetNames.includes('Players');
            if (hasPlayers) {
                const sheet = workbook.Sheets['Players'];
                const json = xlsx.utils.sheet_to_json(sheet);
                expect(json.length).to.be.greaterThan(0);
                expect(JSON.stringify(json)).to.include('ReportPlayer');
            } else {
                const firstSheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[firstSheetName];
                const json = xlsx.utils.sheet_to_json(sheet);
                expect(json).to.be.an('array');
            }

            await new Promise(r => setTimeout(r, 500));
            expect(fs.readdirSync(tempDir)).to.be.empty;
        });

        it('falls back to Node when Python is unavailable without crashing the API', async () => {
            process.env.TEST_PYTHON_FAIL = '1';

            const res = await request(app)
                .get(`/api/quizzes/reports/${sessionId}/export?format=pdf`)
                .set('Authorization', `Bearer ${hostToken}`)
                .set('x-test-run-id', testRunId);

            delete process.env.TEST_PYTHON_FAIL;

            expect(res.status).to.equal(200);
            expect(res.headers['content-type']).to.include('application/pdf');
            expect(res.body.toString('ascii').startsWith('%PDF-')).to.be.true;

            const healthRes = await request(app).get('/health');
            expect(healthRes.status).to.equal(200);

            const nextRes = await request(app)
                .get('/api/quizzes/reports/all')
                .set('Authorization', `Bearer ${hostToken}`);
            expect(nextRes.status).to.equal(200);

            await new Promise(r => setTimeout(r, 500));
            expect(fs.readdirSync(tempDir)).to.be.empty;
        });
    });

    after(() => {
        delete process.env.TEST_PYTHON_FAIL;
        delete process.env.TEST_TEMP_DIR_ROOT;
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    });
});
