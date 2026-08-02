const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const express = require('express');
const { sequelize, connectDB } = require('./config/database');
const setupSocketHandlers = require('./services/socketHandlers');
const { Quiz, Question } = require('./models/Quiz');
const { GameSession, Player } = require('./models/GameSession');
const User = require('./models/User');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runBenchmark() {
    await connectDB();
    await sequelize.sync({ force: true });
    const app = express();
    const server = createServer(app);
    const io = new Server(server);
    setupSocketHandlers(io);

    await new Promise(r => server.listen(0, r));
    const port = server.address().port;

    const host = await User.create({ username: 'benchhost', email: 'b@b.com', password: '123' });
    const hostToken = jwt.sign({ id: host.id }, process.env.JWT_SECRET || 'secret');
    const quiz = await Quiz.create({ title: 'Bench', hostId: host.id });
    
    // Create a question for submit_answer testing
    await Question.create({
        quizId: quiz.id,
        questionText: 'Q1?',
        options: JSON.stringify(['A', 'B']),
        correctIndex: 0,
        timer: 30
    });

    const session = await GameSession.create({ pin: '999999', quizId: quiz.id, hostId: host.id, status: 'lobby' });

    const client = Client(`http://localhost:${port}`);
    client.on('error', (err) => console.error('Client Error:', err));
    await new Promise(r => client.on('connect', r));

    const measure = async (name, fn, iterations = 50) => {
        const times = [];
        let errors = 0;
        for (let i = 0; i < iterations; i++) {
            const start = process.hrtime.bigint();
            try {
                await fn(i);
                const end = process.hrtime.bigint();
                times.push(Number(end - start) / 1e6); // ms
            } catch (e) {
                errors++;
            }
        }
        times.sort((a, b) => a - b);
        const median = times[Math.floor(times.length / 2)];
        const p95 = times[Math.floor(times.length * 0.95)];
        return { name, median: median.toFixed(2), p95: p95.toFixed(2), errors, queries: 'N/A' };
    };

    // Warmup
    await measure('Warmup Join', (i) => new Promise((r, reject) => {
        const onErr = err => reject(new Error('Socket error: ' + err));
        client.once('error', onErr);
        client.once('session_info', () => { client.off('error', onErr); r(); });
        client.emit('join_room', { pin: '999999', nickname: `W${i}`, role: 'player' });
    }), 5);

    const stats = [];

    stats.push(await measure('Player Join', (i) => new Promise(r => {
        client.once('session_info', () => r());
        client.emit('join_room', { pin: '999999', nickname: `P${i}`, role: 'player' });
    }), 20));

    // Host setup
    const hostClient = Client(`http://localhost:${port}`);
    await new Promise(r => hostClient.on('connect', r));
    await new Promise(r => {
        hostClient.once('session_info', r);
        hostClient.emit('join_room', { pin: '999999', role: 'host', token: hostToken });
    });

    stats.push(await measure('Start Question', () => new Promise(r => {
        hostClient.emit('start_question', { pin: '999999', token: hostToken });
        client.once('question_started', () => {
            GameSession.update({ status: 'lobby' }, { where: { id: session.id } }).then(r);
        });
    }), 20));

    // Set state to question for answering
    await GameSession.update({ status: 'question', currentQuestionIndex: 0, questionStartTime: new Date() }, { where: { id: session.id } });

    stats.push(await measure('Answer Submission', (i) => new Promise(r => {
        client.emit('submit_answer', { pin: '999999', nickname: `P${i}`, answerIndex: 0 });
        client.once('answer_confirmed', () => r());
    }), 20));

    stats.push(await measure('Session Recovery', (i) => new Promise(async r => {
        const player = await Player.findOne({ where: { nickname: `P${i}` } });
        if (!player) return r();
        const pToken = jwt.sign({ id: player.id }, process.env.JWT_SECRET || 'secret');
        client.emit('join_room', { pin: '999999', role: 'player', playerProfileToken: pToken });
        client.once('session_info', () => r());
    }), 20));

    client.disconnect();
    hostClient.disconnect();
    server.close();
    
    fs.writeFileSync('benchmark_results.json', JSON.stringify(stats, null, 2));
    process.exit(0);
}

runBenchmark().catch(e => { console.error(e); process.exit(1); });
