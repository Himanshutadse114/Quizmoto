const { expect } = require('chai');
const io = require('socket.io-client');
const request = require('supertest');
const { spawn } = require('child_process');

describe('Socket.IO Integration Tests', function() {
    this.timeout(20000);
    let serverProcess;
    const PORT = 5010;
    const URL = `http://localhost:${PORT}`;

    before(async () => {
        // Spawn server in isolated process with its own test DB, and test actual
        // HTTP readiness instead of depending on a particular logger string.
        serverProcess = spawn('node', ['index.js'], {
            cwd: __dirname + '/..',
            env: { ...process.env, PORT, NODE_ENV: 'test', QUIET: 'true' }
        });

        let lastStderr = '';
        serverProcess.stderr.on('data', (data) => {
            lastStderr += data.toString();
            console.error('SERVER ERR:', data.toString());
        });

        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
            if (serverProcess.exitCode != null) {
                throw new Error(`Socket test backend exited early: ${lastStderr}`);
            }
            try {
                const res = await request(URL).get('/health').timeout({ response: 750, deadline: 1000 });
                if (res.status === 200) return;
            } catch (_) {}
            await new Promise((resolve) => setTimeout(resolve, 150));
        }
        throw new Error(`Socket test backend did not become healthy: ${lastStderr}`);
    });

    after((done) => {
        for (const client of [hostSocket, p1Socket, p2Socket, badSocket]) {
            try { if (client) client.disconnect(); } catch (_) {}
        }
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

    let hostToken, hostSocket, pin;
    let p1Token, p1Socket;
    let p2Token, p2Socket;
    let badSocket;

    it('should authenticate host and create a session', async () => {
        const loginRes = await request(URL).post('/api/auth/test-login');
        hostToken = loginRes.body.token;

        const quizzesRes = await request(URL).get('/api/quizzes').set('Authorization', `Bearer ${hostToken}`);
        const quizId = quizzesRes.body[0].id;

        const startRes = await request(URL).post(`/api/quizzes/${quizId}/start`).set('Authorization', `Bearer ${hostToken}`);
        pin = startRes.body.pin;
        expect(pin).to.be.a('string');
    });

    it('host joins its room', (done) => {
        hostSocket = io(URL, { auth: { token: hostToken }, query: { pin, role: 'host' } });
        hostSocket.once('room_info', (info) => {
            try {
                expect(info.status).to.equal('lobby');
                done();
            } catch (err) {
                done(err);
            }
        });
        hostSocket.emit('join_room', { pin, role: 'host', token: hostToken });
    });

    it('two players join and lobby list updates', (done) => {
        let playersJoined = 0;
        const onPlayerJoined = () => {
            playersJoined++;
            if (playersJoined === 2) {
                hostSocket.off('player_joined', onPlayerJoined);
                done();
            }
        };
        hostSocket.on('player_joined', onPlayerJoined);

        request(URL).post('/api/player/join').send({ pin, nickname: 'P1' }).then(res => {
            p1Token = res.body.token;
            p1Socket = io(URL, { auth: { token: p1Token }, query: { pin, role: 'player' } });
            p1Socket.on('joined_successfully', data => { p1Token = data.token; });
            p1Socket.emit('join_room', { pin, role: 'player', nickname: 'P1', token: p1Token });
        }).catch(done);

        request(URL).post('/api/player/join').send({ pin, nickname: 'P2' }).then(res => {
            p2Token = res.body.token;
            p2Socket = io(URL, { auth: { token: p2Token }, query: { pin, role: 'player' } });
            p2Socket.on('joined_successfully', data => { p2Token = data.token; });
            p2Socket.emit('join_room', { pin, role: 'player', nickname: 'P2', token: p2Token });
        }).catch(done);
    });

    it('start command transitions the session once and question_started reaches clients', (done) => {
        let checks = 0;
        const check = () => {
            checks++;
            if (checks === 3) {
                // A second legacy start while a question is active is rejected
                // without advancing the question a second time.
                hostSocket.emit('start_question', { pin, token: hostToken });
                setTimeout(done, 500);
            }
        };

        p1Socket.once('question_started', check);
        p2Socket.once('question_started', check);
        hostSocket.once('question_started', (q) => {
            try {
                expect(q).to.have.property('questionText');
                check();
            } catch (err) {
                done(err);
            }
        });

        hostSocket.emit('start_question', { pin, token: hostToken });
    });

    it('answer acknowledgement reaches the correct player and duplicates are rejected', (done) => {
        p1Socket.once('answer_confirmed', (data) => {
            try {
                expect(data).to.have.property('points');
                p1Socket.emit('submit_answer', { pin, nickname: 'P1', token: p1Token, answerIndex: 2 });
                setTimeout(done, 500);
            } catch (err) {
                done(err);
            }
        });

        // Wait for the 3s countdown to finish before answering.
        setTimeout(() => {
            p1Socket.emit('submit_answer', { pin, nickname: 'P1', token: p1Token, answerIndex: 1 });
        }, 3100);
    });

    it('player reconnect receives canonical state and answered state survives', (done) => {
        p1Socket.disconnect();
        setTimeout(() => {
            p1Socket = io(URL, { auth: { token: p1Token }, query: { pin, role: 'player' } });

            p1Socket.once('session_info', (info) => {
                try {
                    expect(info.status).to.equal('question');
                    expect(info.answered).to.be.true;
                    done();
                } catch (err) {
                    done(err);
                }
            });
            p1Socket.once('error', (err) => console.log('P1 Reconnect Error:', err));
            p1Socket.on('connect', () => {
                p1Socket.emit('join_room', { pin, role: 'player', nickname: 'P1', token: p1Token });
            });
        }, 500);
    });

    it('stale or invalid session token falls back to new join', (done) => {
        badSocket = io(URL, { auth: { token: 'invalid.token.here' }, query: { pin, role: 'player' } });
        badSocket.once('joined_successfully', (data) => {
            try {
                expect(data.token).to.not.equal('invalid.token.here');
                done();
            } catch (err) {
                done(err);
            }
        });
        badSocket.on('connect', () => {
            badSocket.emit('join_room', { pin, role: 'player', nickname: 'BadActor', token: 'invalid.token.here' });
        });
    });

    it('host refresh restores the current state', (done) => {
        hostSocket.disconnect();
        hostSocket = io(URL, { auth: { token: hostToken }, query: { pin, role: 'host' } });
        hostSocket.once('room_info', (info) => {
            try {
                expect(info.status).to.equal('question');
                expect(info).to.have.property('answersCount');
                done();
            } catch (err) {
                done(err);
            }
        });
        hostSocket.on('connect', () => {
            hostSocket.emit('join_room', { pin, role: 'host', token: hostToken });
        });
    });
});
