const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const { expect } = require('chai');
const express = require('express');
const { sequelize } = require('../config/database');
const setupSocketHandlers = require('../services/socketHandlers');
const { Quiz } = require('../models/Quiz');
const { GameSession, Player } = require('../models/GameSession');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

describe('Socket Contracts API', () => {
    let io, server, hostSocket, playerSocket, player2Socket, port;
    let hostId, hostToken, sessionPin, sessionId, quizId, playerToken;

    before(async () => {
        const { connectDB } = require('../config/database');
        await connectDB();
        await sequelize.sync({ force: true });
        const app = express();
        server = createServer(app);
        io = new Server(server);
        setupSocketHandlers(io);

        await new Promise((resolve) => {
            server.listen(() => {
                port = server.address().port;
                resolve();
            });
        });

        const host = await User.create({ username: 'contracthost', email: 'c@c.com', password: '123' });
        hostId = host.id;
        hostToken = jwt.sign({ userId: hostId }, process.env.JWT_SECRET || 'fallback_secret');
        
        const quiz = await Quiz.create({ title: 'Contract Quiz', hostId });
        quizId = quiz.id;
        
        const { Question } = require('../models/Quiz');
        await Question.create({
            quizId,
            questionText: 'Test Question?',
            timer: 30,
            options: JSON.stringify(['A', 'B', 'C', 'D']),
            correctIndex: 0
        });

        sessionPin = '123456';
        const session = await GameSession.create({
            pin: sessionPin, quizId, hostId, status: 'lobby'
        });
        sessionId = session.id;

        const p = await Player.create({
            sessionId, nickname: 'ContractPlayer1', score: 0, streak: 0, status: 'active', socketId: 'tmp'
        });
        // We MUST use generatePlayerToken from SessionTokenService to ensure all fields are present!
        const SessionTokenService = require('../services/SessionTokenService');
        playerToken = SessionTokenService.generatePlayerToken(sessionId, p.id, 'ContractPlayer1');
    });

    after(async () => {
        io.close();
        server.close();
    });

    beforeEach(async () => {
        return new Promise((resolve) => {
            hostSocket = new Client(`http://localhost:${port}`);
            playerSocket = new Client(`http://localhost:${port}`);
            player2Socket = new Client(`http://localhost:${port}`);
            
            let connected = 0;
            const checkDone = () => { if (++connected === 3) resolve(); };
            hostSocket.on('connect', checkDone);
            playerSocket.on('connect', checkDone);
            player2Socket.on('connect', checkDone);
            
            hostSocket.onAny((evt, ...args) => console.log('HOST_EVT:', evt, JSON.stringify(args)));
            playerSocket.onAny((evt, ...args) => console.log('PLAYER_EVT:', evt, JSON.stringify(args)));
            hostSocket.on('error', err => console.error('Host Socket Error:', err));
        });
    });

    afterEach(() => {
        if (hostSocket.connected) hostSocket.disconnect();
        if (playerSocket.connected) playerSocket.disconnect();
        if (player2Socket.connected) player2Socket.disconnect();
    });

    it('join_room / joined_successfully / player_joined (Host)', (done) => {
        hostSocket.emit('join_room', { pin: sessionPin, role: 'host', token: hostToken });
        
        hostSocket.on('room_info', (data) => {
            try {
                expect(data.pin).to.equal(sessionPin);
                done();
            } catch (err) {
                done(err);
            }
        });
    });

    it('join_room / joined_successfully / player_joined (Player)', (done) => {
        playerSocket.on('joined_successfully', (data) => {
            expect(data.nickname).to.equal('NewPlayer');
            expect(data.token).to.not.be.undefined;
            done();
        });

        hostSocket.on('room_info', () => {
            playerSocket.emit('join_room', { pin: sessionPin, nickname: 'NewPlayer', role: 'player' });
        });
        
        hostSocket.on('player_joined', (players) => {
            expect(players).to.be.an('array');
            expect(players[players.length-1].nickname).to.equal('NewPlayer');
            expect(players[players.length-1].token).to.be.undefined;
        });

        hostSocket.emit('join_room', { pin: sessionPin, role: 'host', token: hostToken });
    });

    it('start_question / question_started (Host only)', (done) => {
        let joined = 0;
        const check = () => {
            if (++joined === 2) {
                hostSocket.emit('start_question', { pin: sessionPin, token: hostToken });
            }
        };
        hostSocket.on('room_info', check);
        playerSocket.on('joined_successfully', check);

        hostSocket.emit('join_room', { pin: sessionPin, role: 'host', token: hostToken });
        playerSocket.emit('join_room', { pin: sessionPin, token: playerToken, nickname: 'ContractPlayer1', role: 'player' });
            
        playerSocket.on('question_started', (data) => {
            try {
                expect(data.index).to.equal(0);
                expect(data.questionText).to.be.a('string');
                expect(data.options).to.be.an('array');
                expect(data.correctIndex).to.be.undefined; // Security check
                done();
            } catch(e) { done(e); }
        });
    });

    it('session_info (Player Reconnect)', (done) => {
        // Now the game is in 'question' state, so session_info will be emitted!
        playerSocket.emit('join_room', { pin: sessionPin, token: playerToken, nickname: 'ContractPlayer1', role: 'player' });
        
        playerSocket.on('session_info', (data) => {
            try {
                expect(data.status).to.equal('question');
                expect(data.score).to.equal(0);
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it('submit_answer / answer_received / answer_confirmed', async () => {
        // Move questionStartTime to the past to bypass "Question has not started yet" check
        await GameSession.update({ questionStartTime: new Date(Date.now() - 5000) }, { where: { id: sessionId } });
        
        return new Promise((resolve, reject) => {
            const done = (err) => err ? reject(err) : resolve();
            let joined = 0;
            const check = () => {
                if (++joined === 2) {
                    playerSocket.emit('submit_answer', { pin: sessionPin, nickname: 'ContractPlayer1', answerIndex: 0 });
                }
            };
            hostSocket.on('room_info', check);
            playerSocket.on('joined_successfully', check);

            hostSocket.emit('join_room', { pin: sessionPin, role: 'host', token: hostToken });
            playerSocket.emit('join_room', { pin: sessionPin, token: playerToken, nickname: 'ContractPlayer1', role: 'player' });
            
            let confirmed = false, received = false;
            playerSocket.on('answer_confirmed', (data) => {
                try {
                    expect(data.points).to.be.a('number');
                    expect(data.streak).to.be.a('number');
                    confirmed = true;
                    if (confirmed && received) done();
                } catch(e) { done(e); }
            });

            hostSocket.on('answer_received', (data) => {
                try {
                    expect(data.nickname).to.equal('ContractPlayer1');
                    received = true;
                    if (confirmed && received) done();
                } catch(e) { done(e); }
            });
        });
    });

    it('end_question / question_ended / question_result (Host only)', (done) => {
        hostSocket.on('room_info', () => {
            hostSocket.emit('end_question', { pin: sessionPin, token: hostToken });
        });
        hostSocket.emit('join_room', { pin: sessionPin, role: 'host', token: hostToken });
            
            playerSocket.on('question_result', (data) => {
                expect(data).to.have.property('correct');
                expect(data).to.have.property('score');
                // The correct answer is now revealed
            });

            hostSocket.on('question_ended', (data) => {
                expect(data).to.have.property('leaderboard');
                done();
            });
    });

    it('set_game_mode (Host only)', async () => {
        await GameSession.update({ status: 'lobby' }, { where: { id: sessionId } });
        
        return new Promise((resolve, reject) => {
            const done = (err) => err ? reject(err) : resolve();
            hostSocket.on('room_info', (data) => {
                try {
                    if (data.gameMode === 'classic') {
                        hostSocket.emit('change_mode', { pin: sessionPin, mode: 'team', token: hostToken });
                    } else if (data.gameMode === 'team') {
                        done();
                    }
                } catch(e) { done(e); }
            });
            hostSocket.emit('join_room', { pin: sessionPin, role: 'host', token: hostToken });
        });
    });

    it('send_reaction / new_reaction (Broadcast)', (done) => {
        playerSocket.on('new_reaction', (data) => {
            try {
                expect(data.emoji).to.equal('🔥');
                done();
            } catch(e) { done(e); }
        });
        
        hostSocket.emit('join_room', { pin: sessionPin, role: 'host', token: hostToken });
        playerSocket.emit('join_room', { pin: sessionPin, token: playerToken, nickname: 'ContractPlayer1', role: 'player' });
        
        playerSocket.on('joined_successfully', () => {
            playerSocket.emit('send_reaction', { pin: sessionPin, emoji: '🔥' });
        });
    });

    it('end_game / game_finished (Host only)', (done) => {
        let joined = 0;
        const check = () => {
            if (++joined === 2) {
                hostSocket.emit('end_game', { pin: sessionPin, token: hostToken });
            }
        };
        hostSocket.on('room_info', check);
        playerSocket.on('joined_successfully', check);

        hostSocket.emit('join_room', { pin: sessionPin, role: 'host', token: hostToken });
        playerSocket.emit('join_room', { pin: sessionPin, token: playerToken, nickname: 'ContractPlayer1', role: 'player' });
            
            playerSocket.on('game_finished', (data) => {
                expect(data).to.have.property('players');
                done();
            });
    });

    it('should reject unauthorized payloads', (done) => {
        playerSocket.emit('start_question', { pin: sessionPin, token: 'fake' });
        playerSocket.on('error', (err) => {
            expect(err).to.include('Unauthorized');
            done();
        });
    });

    it('should strip unknown payload fields without crashing', async () => {
        await GameSession.update({ status: 'lobby' }, { where: { id: sessionId } });
        return new Promise((resolve, reject) => {
            const done = (err) => err ? reject(err) : resolve();
            playerSocket.emit('join_room', { pin: sessionPin, role: 'player', nickname: 'ContractPlayer1', token: playerToken, fakeAdmin: true });
        
            playerSocket.on('joined_successfully', () => {
                done();
            });
        });
    });
});
