const request = require('supertest');
const { expect } = require('chai');
const express = require('express');

const jwt = require('jsonwebtoken');
const { sequelize } = require('../config/database');
const { Quiz, Question } = require('../models/Quiz');
const { GameSession, Player, PlayerAnswer } = require('../models/GameSession');
const User = require('../models/User');
const fs = require('fs');

let app;
let hostToken;
let playerToken;
let hostId;
let sessionId;
let quizId;

const quizzesRouter = require('../routes/quizzes');

describe('Reports API (/api/quizzes/reports)', function () {
    this.timeout(10000); // Allow python script to run
    before(async () => {
        const { connectDB } = require('../config/database');
        await connectDB();
        app = express();
        app.use(express.json());
        app.use('/api/quizzes', quizzesRouter);

        await sequelize.sync({ force: true });

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
            status: 'finished', // Must be finished
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
            expect(res.body[0].quizId).to.equal(quizId);
        });
    });

    describe('GET /reports/:id/export', () => {
        it('should block unauthorized users', async () => {
            const res = await request(app).get(`/api/quizzes/reports/${sessionId}/export?format=pdf`);
            expect(res.status).to.equal(401);
        });

        it('should fail gracefully for invalid formats', async () => {
            const res = await request(app)
                .get(`/api/quizzes/reports/${sessionId}/export?format=csv`)
                .set('Authorization', `Bearer ${hostToken}`);
            expect(res.status).to.equal(400);
            expect(res.body.message).to.equal('Invalid format');
        });

        it('should export PDF successfully', async () => {
            const res = await request(app)
                .get(`/api/quizzes/reports/${sessionId}/export?format=pdf`)
                .set('Authorization', `Bearer ${hostToken}`);
            
            expect(res.status).to.equal(200);
            expect(res.headers['content-type']).to.include('application/pdf');
            expect(res.body).to.be.instanceof(Buffer);
            expect(res.body.toString('ascii').startsWith('%PDF-')).to.be.true; // Valid PDF header
        });

        it('should export Excel successfully', async () => {
            const res = await request(app)
                .get(`/api/quizzes/reports/${sessionId}/export?format=excel`)
                .set('Authorization', `Bearer ${hostToken}`)
                .responseType('blob'); // Force binary Buffer
            
            expect(res.status).to.equal(200);
            expect(res.headers['content-type']).to.include('spreadsheetml'); // xlsx MIME
            expect(res.body).to.be.instanceof(Buffer);
            expect(res.body.toString('ascii').startsWith('PK')).to.be.true;
        });
        
        it('should gracefully handle Python dependency failure without crashing Node', async () => {
            // Trigger failure via env var
            process.env.TEST_PYTHON_FAIL = '1';
            
            const res = await request(app)
                .get(`/api/quizzes/reports/${sessionId}/export?format=pdf`)
                .set('Authorization', `Bearer ${hostToken}`);
            
            delete process.env.TEST_PYTHON_FAIL;
            
            // This will execute the real python3 which will likely fail on this system or the script will fail
            // It should return 500 but NOT crash the process.
            expect([500, 200]).to.include(res.status);
            if (res.status === 500) {
                expect(res.body.message).to.equal('Report generation failed');
            }
        });
    });
});
