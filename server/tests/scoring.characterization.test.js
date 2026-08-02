const { expect } = require('chai');
const io = require('socket.io-client');
const request = require('supertest');
const { spawn } = require('child_process');

describe('Scoring & Duplicate Characterization Tests', function() {
    this.timeout(20000);
    let serverProcess;
    const PORT = 5009;
    const URL = `http://localhost:${PORT}`;

    before((done) => {
        serverProcess = spawn('node', ['index.js'], { 
            cwd: __dirname + '/..',
            env: { ...process.env, PORT, NODE_ENV: 'test', QUIET: 'true' }
        });
        
        let started = false;
        serverProcess.stdout.on('data', (data) => {
            if (data.toString().includes(`Server running on port ${PORT}`)) {
                if (!started) {
                    started = true;
                    setTimeout(done, 1000);
                }
            }
        });
    });

    after((done) => {
        if (serverProcess) {
            serverProcess.on('exit', () => done());
            serverProcess.kill();
        } else {
            done();
        }
    });

    let hostToken, hostSocket, pin, quizId;
    let p1Socket;

    it('setup session and player', async () => {
        const loginRes = await request(URL).post('/api/auth/test-login');
        hostToken = loginRes.body.token;

        const quizzesRes = await request(URL).get('/api/quizzes').set('Authorization', `Bearer ${hostToken}`);
        quizId = quizzesRes.body[0].id;

        const startRes = await request(URL).post(`/api/quizzes/${quizId}/start`).set('Authorization', `Bearer ${hostToken}`);
        pin = startRes.body.pin;

        hostSocket = io(URL, { auth: { token: hostToken }, query: { pin, role: 'host' } });
        hostSocket.emit('join_room', { pin, role: 'host', token: hostToken });

        await new Promise(resolve => setTimeout(resolve, 200));

        const joinRes = await request(URL).post('/api/player/join').send({ pin, nickname: 'ScoreTest' });
        const p1Token = joinRes.body.token;
        p1Socket = io(URL, { auth: { token: p1Token }, query: { pin, role: 'player' } });
        p1Socket.emit('join_room', { pin, role: 'player', nickname: 'ScoreTest', token: p1Token });

        await new Promise(resolve => setTimeout(resolve, 200));
    });

    it('characterize correct answer points (no streak)', (done) => {
        p1Socket.once('answer_confirmed', (data) => {
            expect(data.streak).to.equal(1);
            // Question timer is 5s in fixtures.
            // Base = 1000 + (~5 * 10) = 1050.
            expect(data.points).to.be.closeTo(1050, 30); // Allow 3 seconds of network variance
            done();
        });

        hostSocket.emit('start_question', { pin, token: hostToken });
        
        // Wait 3s for countdown, then submit answer immediately
        setTimeout(() => {
            // Option 1 is typically correct in fixtures
            p1Socket.emit('submit_answer', { pin, nickname: 'ScoreTest', answerIndex: 1 });
        }, 3100);
    });

    it('characterize duplicate answer rejection', (done) => {
        // Assume question is still active
        p1Socket.once('error', (err) => {
            expect(err).to.equal('Answer already submitted');
            done();
        });

        p1Socket.emit('submit_answer', { pin, nickname: 'ScoreTest', answerIndex: 1 });
    });

});
