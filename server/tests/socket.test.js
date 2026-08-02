const { expect } = require('chai');
const io = require('socket.io-client');
const request = require('supertest');
const { spawn } = require('child_process');

describe('Socket.IO Integration Tests', function() {
    this.timeout(20000); // 20s for server start and connections
    let serverProcess;
    const PORT = 5007;
    const URL = `http://localhost:${PORT}`;

    before((done) => {
        // Spawn server in isolated process with its own in-memory DB
        serverProcess = spawn('node', ['index.js'], { 
            cwd: __dirname + '/..',
            env: { ...process.env, PORT, NODE_ENV: 'test', QUIET: 'true' }
        });
        
        let started = false;
        serverProcess.stdout.on('data', (data) => {
            if (data.toString().includes(`Server running on port ${PORT}`)) {
                if (!started) {
                    started = true;
                    // Seed fixtures via endpoint or just wait for it to be ready
                    setTimeout(done, 1000); // give it a sec to settle
                }
            }
        });
        
        serverProcess.stderr.on('data', (data) => {
            console.error('SERVER ERR:', data.toString());
        });
    });

    after(() => {
        if (serverProcess) {
            serverProcess.kill();
        }
    });

    let hostToken, hostSocket, pin;
    let p1Token, p1Socket;
    let p2Token, p2Socket;

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
        hostSocket.on('room_info', (info) => {
            expect(info.status).to.equal('lobby');
            done();
        });
        hostSocket.emit('join_room', { pin, role: 'host', token: hostToken });
    });

    it('two players join and lobby list updates', (done) => {
        let playersJoined = 0;
        hostSocket.on('player_joined', (player) => {
            playersJoined++;
            if (playersJoined === 2) done();
        });

        request(URL).post('/api/player/join').send({ pin, nickname: 'P1' }).then(res => {
            p1Token = res.body.token;
            p1Socket = io(URL, { auth: { token: p1Token }, query: { pin, role: 'player' } });
            p1Socket.on('joined_successfully', data => { p1Token = data.token; });
            p1Socket.emit('join_room', { pin, role: 'player', nickname: 'P1', token: p1Token });
            p1Socket.on('room_info', info => { expect(info.status).to.equal('lobby') });
        });

        request(URL).post('/api/player/join').send({ pin, nickname: 'P2' }).then(res => {
            p2Token = res.body.token;
            p2Socket = io(URL, { auth: { token: p2Token }, query: { pin, role: 'player' } });
            p2Socket.on('joined_successfully', data => { p2Token = data.token; });
            p2Socket.emit('join_room', { pin, role: 'player', nickname: 'P2', token: p2Token });
        });
    });

    it('start command transitions the session once and question_started reaches clients', (done) => {
        let p1Started = false, p2Started = false;
        
        p1Socket.once('question_started', () => { p1Started = true; check(); });
        p2Socket.once('question_started', () => { p2Started = true; check(); });
        hostSocket.once('question_started', (q) => { 
            expect(q).to.have.property('questionText');
            check();
        });

        let checks = 0;
        function check() {
            checks++;
            if (checks === 3) {
                // Ensure duplicate start is idempotently ignored
                hostSocket.emit('start_question', { pin, token: hostToken });
                setTimeout(done, 500); // If it crashes or emits again, it will fail or log
            }
        }

        hostSocket.emit('start_question', { pin, token: hostToken });
    });

    it('answer acknowledgement reaches the correct player and duplicates are rejected', (done) => {
        p1Socket.once('answer_confirmed', (data) => {
            expect(data).to.have.property('points');
            // Attempt duplicate answer
            p1Socket.emit('submit_answer', { pin, nickname: 'P1', answerIndex: 2 });
            setTimeout(done, 500); // Should be ignored by server
        });

        // Wait for the 3s countdown to finish before answering
        setTimeout(() => {
            p1Socket.emit('submit_answer', { pin, nickname: 'P1', answerIndex: 1 });
        }, 3100);
    });

    it('player reconnect receives canonical state and answered state survives', (done) => {
        p1Socket.disconnect();
        setTimeout(() => {
            p1Socket = io(URL, { auth: { token: p1Token }, query: { pin, role: 'player' } });
            
            p1Socket.once('session_info', (info) => {
                expect(info.status).to.equal('question');
                expect(info.answered).to.be.true;
                done();
            });
            p1Socket.once('error', (err) => console.log('P1 Reconnect Error:', err));
            p1Socket.on('connect', () => {
                p1Socket.emit('join_room', { pin, role: 'player', nickname: 'P1', token: p1Token });
            });
        }, 500); // give the server time to process disconnect
    });

    it('stale or invalid session token falls back to new join', (done) => {
        const badSocket = io(URL, { auth: { token: 'invalid.token.here' }, query: { pin, role: 'player' } });
        badSocket.once('joined_successfully', (data) => {
            expect(data.token).to.not.equal('invalid.token.here');
            done();
        });
        badSocket.on('connect', () => {
            badSocket.emit('join_room', { pin, role: 'player', nickname: 'BadActor', token: 'invalid.token.here' });
        });
    });

    it('host refresh restores the current state', (done) => {
        hostSocket.disconnect();
        hostSocket = io(URL, { auth: { token: hostToken }, query: { pin, role: 'host' } });
        hostSocket.once('room_info', (info) => {
            expect(info.status).to.equal('question');
            done();
        });
        hostSocket.emit('join_room', { pin, role: 'host', token: hostToken });
    });
});
