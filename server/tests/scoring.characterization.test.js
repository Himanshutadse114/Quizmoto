const { expect } = require('chai');
const io = require('socket.io-client');
const request = require('supertest');
const { spawn } = require('child_process');

describe('Scoring & Duplicate Characterization Tests', function() {
    this.timeout(20000);
    let serverProcess;
    const PORT = 5009;
    const URL = `http://localhost:${PORT}`;

    before(async () => {
        serverProcess = spawn('node', ['index.js'], {
            cwd: __dirname + '/..',
            env: { ...process.env, PORT, NODE_ENV: 'test', QUIET: 'true' }
        });

        let lastStderr = '';
        serverProcess.stderr.on('data', (data) => {
            lastStderr += data.toString();
        });

        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
            if (serverProcess.exitCode != null) {
                throw new Error(`Scoring test backend exited early: ${lastStderr}`);
            }
            try {
                const res = await request(URL).get('/health').timeout({ response: 750, deadline: 1000 });
                if (res.status === 200) return;
            } catch (_) {}
            await new Promise((resolve) => setTimeout(resolve, 150));
        }
        throw new Error(`Scoring test backend did not become healthy: ${lastStderr}`);
    });

    after((done) => {
        try { if (p1Socket) p1Socket.disconnect(); } catch (_) {}
        try { if (hostSocket) hostSocket.disconnect(); } catch (_) {}
        if (serverProcess && serverProcess.exitCode == null) {
            const timer = setTimeout(() => {
                try { serverProcess.kill('SIGKILL'); } catch (_) {}
                done();
            }, 3000);
            serverProcess.once('exit', () => {
                clearTimeout(timer);
                done();
            });
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
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('host socket join timed out')), 3000);
            hostSocket.once('room_info', () => {
                clearTimeout(timer);
                resolve();
            });
            hostSocket.on('connect', () => {
                hostSocket.emit('join_room', { pin, role: 'host', token: hostToken });
            });
        });

        const joinRes = await request(URL).post('/api/player/join').send({ pin, nickname: 'ScoreTest' });
        const p1Token = joinRes.body.token;
        p1Socket = io(URL, { auth: { token: p1Token }, query: { pin, role: 'player' } });
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('player socket join timed out')), 3000);
            p1Socket.once('joined_successfully', () => {
                clearTimeout(timer);
                resolve();
            });
            p1Socket.on('connect', () => {
                p1Socket.emit('join_room', { pin, role: 'player', nickname: 'ScoreTest', token: p1Token });
            });
        });
    });

    it('characterize correct answer points (no streak)', (done) => {
        p1Socket.once('answer_confirmed', (data) => {
            expect(data.streak).to.equal(1);
            // Question timer is 5s in fixtures.
            // Base = 1000 + (~5 * 10) = 1050.
            expect(data.points).to.be.closeTo(1050, 30);
            done();
        });

        hostSocket.emit('start_question', { pin, token: hostToken });

        // Wait 3s for countdown, then submit answer immediately.
        setTimeout(() => {
            p1Socket.emit('submit_answer', { pin, nickname: 'ScoreTest', answerIndex: 1 });
        }, 3100);
    });

    it('characterize duplicate answer rejection', (done) => {
        p1Socket.once('error', (err) => {
            expect(err).to.equal('Answer already submitted');
            done();
        });

        p1Socket.emit('submit_answer', { pin, nickname: 'ScoreTest', answerIndex: 1 });
    });
});
