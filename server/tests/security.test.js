const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const sinon = require('sinon');

const quizzesRouter = require('../routes/quizzes');
const { connectDB, sequelize } = require('../config/database');

describe('Security and Error Leakage', () => {
    let app;
    let consoleErrorStub;

    before(async () => {
        await connectDB();
        await sequelize.sync({ force: true });
        
        app = express();
        app.use(express.json());
        
        // Custom error handler to simulate if anything bypasses standard handlers
        app.use('/api/quizzes', quizzesRouter);
        app.use((err, req, res, next) => {
            console.error('Unhandled Middleware Error:', err);
            res.status(500).json({ message: err.message, stack: err.stack });
        });
    });

    beforeEach(() => {
        // Stub console.error to check for secret leakage
        consoleErrorStub = sinon.stub(console, 'error');
    });

    afterEach(() => {
        consoleErrorStub.restore();
    });

    it('should not leak stack traces or SQL on invalid input to quizzes', async () => {
        // Provide invalid ID that might break Postgres cast if not handled
        const res = await request(app).get('/api/quizzes/invalid-uuid-abc');
        
        // Usually returns 401 Unauthorized or 400 Bad Request, or 500 if unhandled
        expect(res.status).to.be.oneOf([401, 500]);
        
        if (res.body) {
            const bodyStr = JSON.stringify(res.body);
            expect(bodyStr).to.not.include('SequelizeDatabaseError');
            expect(bodyStr).to.not.include('SELECT');
            expect(bodyStr).to.not.include('node_modules');
        }
    });

    it('should not log sensitive tokens in console.error on failed auth', async () => {
        const fakeJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI.abcde12345.secret_sig_xyz';
        
        const res = await request(app)
            .get('/api/quizzes/1')
            .set('Authorization', `Bearer ${fakeJwt}`);
            
        expect(res.status).to.equal(401);
        
        // Assert that if console.error was called, it didn't log the token
        const calls = consoleErrorStub.getCalls();
        for (const call of calls) {
            const args = call.args.map(a => (typeof a === 'string' ? a : JSON.stringify(a) || '')).join(' ');
            expect(args).to.not.include(fakeJwt);
            expect(args).to.not.include(process.env.JWT_SECRET || 'fallback_secret');
        }
    });
});
