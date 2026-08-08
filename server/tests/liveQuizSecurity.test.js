const { createServer } = require('http');
const express = require('express');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const jwt = require('jsonwebtoken');
const { expect } = require('chai');

const { sequelize } = require('../config/database');
const setupSocketHandlers = require('../services/socketHandlers');
const SessionTokenService = require('../services/SessionTokenService');
const AnswerSubmissionService = require('../services/AnswerSubmissionService');
const { Quiz, Question } = require('../models/Quiz');
const { GameSession, Player, PlayerAnswer } = require('../models/GameSession');
const User = require('../models/User');

describe('Live Quiz session security hardening', function () {
    this.timeout(10000);

    let httpServer;
    let io;
    let port;
    let host;
    let quiz;
    let session;
    let player;
    let playerToken;
    let hostToken;
    let playerSocket;
    let attackerSocket;
    let hostSocket;
    let secondHostSocket;

    const connectClient = () => new Promise((resolve, reject) => {
        const client = new Client(`http://127.0.0.1:${port}`, {
            transports: ['websocket'],
            reconnection: false
        });
        client.once('connect', () => resolve(client));
        client.once('connect_error', reject);
    });

    before(async () => {
        const { connectDB } = require('../config/database');
        await connectDB();
        await sequelize.sync({ force: true });

        host = await User.create({
            username: 'livequiz-security-host',
            email: 'livequiz-security@example.com',
            password: 'password123'
        });
        hostToken = jwt.sign(
            { userId: host.id },
            process.env.JWT_SECRET || 'fallback_secret'
        );

        quiz = await Quiz.create({ title: 'Security Quiz', hostId: host.id });
        await Question.create({
            quizId: quiz.id,
            questionText: 'Choose A',
            options: ['A', 'B', 'C', 'D'],
            correctIndex: 0,
            timer: 30
        });

        session = await GameSession.create({
            pin: 'SEC123',
            quizId: quiz.id,
            hostId: host.id,
            status: 'question',
            state: 'QUESTION_OPEN',
            currentQuestionIndex: 0,
            questionStartTime: new Date(Date.now() - 1000),
            questionOpensAt: new Date(Date.now() - 1000),
            questionClosesAt: new Date(Date.now() + 29000)
        });

        player = await Player.create({
            sessionId: session.id,
            nickname: 'VictimPlayer',
            socketId: null,
            score: 0,
            streak: 0,
            lastAnswerIndex: -1
        });
        playerToken = SessionTokenService.generatePlayerToken(
            session.id,
            player.id,
            player.nickname
        );

        httpServer = createServer(express());
        io = new Server(httpServer);
        setupSocketHandlers(io);
        await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
        port = httpServer.address().port;

        playerSocket = await connectClient();
        attackerSocket = await connectClient();
        hostSocket = await connectClient();
        secondHostSocket = await connectClient();
    });

    after(async () => {
        try { playerSocket && playerSocket.disconnect(); } catch (_) {}
        try { attackerSocket && attackerSocket.disconnect(); } catch (_) {}
        try { hostSocket && hostSocket.disconnect(); } catch (_) {}
        try { secondHostSocket && secondHostSocket.disconnect(); } catch (_) {}
        await new Promise((resolve) => io.close(resolve));
        await new Promise((resolve) => httpServer.close(() => resolve()));
    });

    it('allows only one live host controller for the session', async () => {
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('host join timed out')), 3000);
            hostSocket.once('room_info', () => {
                clearTimeout(timer);
                resolve();
            });
            hostSocket.emit('join_room', {
                pin: session.pin,
                role: 'host',
                token: hostToken
            });
        });

        const denied = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('second host was not denied')), 3000);
            secondHostSocket.once('host_control_denied', (payload) => {
                clearTimeout(timer);
                resolve(payload);
            });
            secondHostSocket.emit('join_room', {
                pin: session.pin,
                role: 'host',
                token: hostToken
            });
        });

        expect(denied.code).to.equal('LEASE_HELD');
    });

    it('rejects an unjoined socket trying to answer as another nickname', async () => {
        const errorMessage = await new Promise((resolve) => {
            attackerSocket.once('error', resolve);
            attackerSocket.emit('submit_answer', {
                pin: session.pin,
                nickname: player.nickname,
                answerIndex: 0
            });
        });

        expect(errorMessage).to.include('Unauthorized');
        await player.reload();
        expect(player.lastAnswerIndex).to.equal(-1);
        expect(player.score).to.equal(0);
        expect(await PlayerAnswer.count({ where: { playerId: player.id } })).to.equal(0);
    });

    it('preserves the player and answer history when the player explicitly leaves', async () => {
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('player join timed out')), 3000);
            playerSocket.once('joined_successfully', () => {
                clearTimeout(timer);
                resolve();
            });
            playerSocket.emit('join_room', {
                pin: session.pin,
                nickname: player.nickname,
                role: 'player',
                token: playerToken
            });
        });

        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('answer confirmation timed out')), 3000);
            playerSocket.once('answer_confirmed', () => {
                clearTimeout(timer);
                resolve();
            });
            playerSocket.emit('submit_answer', {
                pin: session.pin,
                nickname: 'SomeoneElseCannotOverrideIdentity',
                answerIndex: 0
            });
        });

        let persisted = await Player.findByPk(player.id);
        expect(persisted.lastAnswerIndex).to.equal(0);
        expect(persisted.score).to.be.greaterThan(0);
        expect(await PlayerAnswer.count({ where: { playerId: player.id } })).to.equal(1);

        playerSocket.emit('leave_session', {
            pin: session.pin,
            role: 'player',
            nickname: 'SomeoneElse',
            token: playerToken
        });
        await new Promise((resolve) => setTimeout(resolve, 100));

        persisted = await Player.findByPk(player.id);
        expect(persisted).to.not.equal(null);
        expect(persisted.socketId).to.equal(null);
        expect(persisted.lastAnswerIndex).to.equal(0);
        expect(await PlayerAnswer.count({ where: { playerId: player.id } })).to.equal(1);
    });

    it('rejects an answer after the persisted server deadline', async () => {
        const latePlayer = await Player.create({
            sessionId: session.id,
            nickname: 'LatePlayer',
            socketId: 'internal-test',
            score: 0,
            streak: 0,
            lastAnswerIndex: -1
        });

        await session.update({
            status: 'question',
            state: 'QUESTION_OPEN',
            questionStartTime: new Date(Date.now() - 31000),
            questionClosesAt: new Date(Date.now() - 1000)
        });

        const result = await AnswerSubmissionService.submitAnswer(
            session.pin,
            { playerId: latePlayer.id, nickname: latePlayer.nickname },
            0
        );
        expect(result.error).to.equal('Answer window has closed');

        await latePlayer.reload();
        expect(latePlayer.lastAnswerIndex).to.equal(-1);
        expect(latePlayer.score).to.equal(0);
        expect(await PlayerAnswer.count({ where: { playerId: latePlayer.id } })).to.equal(0);
    });
});
