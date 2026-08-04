const { GameSession, Player, PlayerAnswer } = require('../models/GameSession');
const { Quiz, Question } = require('../models/Quiz');
const { sequelize } = require('../config/database');
const { Sequelize } = require('sequelize');
const jwt = require('jsonwebtoken');
const { PlayerProfile } = require('../models/PlayerProfile');
const ScoringService = require('./ScoringService');
const AnswerSubmissionService = require('./AnswerSubmissionService');
const SessionTokenService = require('./SessionTokenService');
const SessionRecoveryService = require('./SessionRecoveryService');
const SessionCommandService = require('./SessionCommandService');
const { validateSocketPayload } = require('../validators/socketSchemas');

const logDiag = (event, pin, state, details = {}) => {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        module: 'socketHandlers',
        event,
        pin,
        state,
        ...details
    }));
};

const emitCommandAck = (socket, result) => {
    if (!result) return;
    socket.emit('command_ack', {
        ok: !!result.ok,
        code: result.code,
        commandId: result.commandId || undefined,
        stateVersion: result.stateVersion,
        toState: result.toState,
        fromState: result.fromState,
        replay: result.replay || false,
        message: result.message,
        currentStateVersion: result.currentStateVersion,
        currentState: result.currentState
    });
};

function parseOptions(raw) {
    try {
        if (raw == null) return [];
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string') {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        }
        return [];
    } catch (_) {
        return [];
    }
}

const questionEndTimers = new Map();

function clearQuestionEndTimer(pin) {
    const h = questionEndTimers.get(pin);
    if (h) {
        clearTimeout(h);
        questionEndTimers.delete(pin);
    }
}

const hostDisconnectTimers = new Map();
const HOST_DISCONNECT_GRACE_MS = Number(process.env.HOST_DISCONNECT_GRACE_MS) || 30000;

function clearHostDisconnectTimer(pin) {
    const h = hostDisconnectTimers.get(pin);
    if (h) {
        clearTimeout(h);
        hostDisconnectTimers.delete(pin);
    }
}

module.exports = (io) => {
    const handleEndQuestion = async (pin, opts = {}) => {
        let session;
        try {
            session = await GameSession.findOne({ where: { pin } });
            if (!session) {
                logDiag('end_question_skip', pin, null, { reason: 'SESSION_NOT_FOUND' });
                return;
            }
            if (session.status !== 'question') {
                logDiag('end_question_skip', pin, session.status, {
                    reason: 'NOT_IN_QUESTION',
                    status: session.status,
                    source: opts.source || 'client'
                });
                return;
            }

            clearQuestionEndTimer(pin);

            const quiz = await Quiz.findByPk(session.quizId, {
                include: [{ model: Question, as: 'questions' }],
                order: [[{ model: Question, as: 'questions' }, 'id', 'ASC']]
            });

            const useV2 = SessionCommandService.isEnabled() && !!opts.commandId && !!opts.hostId;

            if (useV2) {
                const cmdResult = await SessionCommandService.executeEndQuestion({
                    commandId: opts.commandId,
                    sessionId: session.id,
                    actorId: String(opts.hostId),
                    expectedStateVersion: opts.expectedStateVersion
                });
                if (opts.ackSocket) {
                    emitCommandAck(opts.ackSocket, { ...cmdResult, commandId: opts.commandId });
                }
                if (!cmdResult.ok && !cmdResult.replay) {
                    console.warn('[handleEndQuestion] V2 end failed, falling back to legacy', cmdResult.code);
                    session.status = 'result';
                    await session.save({ fields: ['status'] });
                } else {
                    await session.reload();
                    if (session.status !== 'result') {
                        session.status = 'result';
                        await session.save({ fields: ['status'] });
                    }
                }
            } else {
                session.status = 'result';
                await session.save({ fields: ['status'] });
            }

            logDiag('end_question_transition', pin, 'result', {
                questionIndex: session.currentQuestionIndex,
                v2: !!useV2,
                source: opts.source || 'client'
            });

            const allPlayers = await Player.findAll({ where: { sessionId: session.id } });

            for (const player of allPlayers) {
                const resultPayload = {
                    correct: !!player.lastAnswerCorrect,
                    score: player.score,
                    answered: player.lastAnswerIndex !== -1,
                    nickname: player.nickname
                };
                try {
                    if (player.socketId) {
                        io.to(player.socketId).emit('question_result', resultPayload);
                    }
                } catch (emitErr) {
                    console.error('[handleEndQuestion] question_result emit failed', player.nickname, emitErr.message);
                }
            }
            try {
                io.to(pin).emit('question_result_broadcast', {
                    results: allPlayers.map((p) => ({
                        nickname: p.nickname,
                        correct: !!p.lastAnswerCorrect,
                        score: p.score,
                        answered: p.lastAnswerIndex !== -1
                    }))
                });
            } catch (_) {}

            let leaderboard = [];
            try {
                leaderboard = await Player.findAll({
                    where: { sessionId: session.id },
                    order: [['score', 'DESC']],
                    limit: 5,
                    attributes: ['nickname', 'score', 'avatar']
                });
            } catch (lbErr) {
                console.error('[handleEndQuestion] leaderboard query failed', lbErr.message);
            }

            const qIndex = session.currentQuestionIndex;
            const currentQuestion =
                quiz && Array.isArray(quiz.questions) && quiz.questions[qIndex]
                    ? quiz.questions[qIndex]
                    : null;
            const optionsList = parseOptions(currentQuestion ? currentQuestion.options : null);
            const distribution = optionsList.map((_, i) =>
                allPlayers.filter((p) => p.lastAnswerIndex === i).length
            );

            let teamStandings = [];
            if (session.gameMode === 'team') {
                try {
                    const teamScores = await Player.findAll({
                        where: { sessionId: session.id },
                        attributes: [
                            'teamName',
                            [sequelize.fn('SUM', sequelize.col('score')), 'totalScore']
                        ],
                        group: ['teamName'],
                        order: [[sequelize.literal('"totalScore"'), 'DESC']]
                    });
                    teamStandings = teamScores.map((t) => ({
                        teamName: t.teamName,
                        score: parseInt(t.get('totalScore'), 10) || 0
                    }));
                } catch (teamErr) {
                    console.error('[handleEndQuestion] team standings failed', teamErr.message);
                }
            }

            io.to(pin).emit('question_ended', {
                leaderboard,
                teamStandings,
                correctIndex: currentQuestion != null ? currentQuestion.correctIndex : null,
                distribution
            });

            logDiag('end_question_emitted', pin, 'result', {
                playerCount: allPlayers.length,
                hasCurrentQuestion: !!currentQuestion,
                source: opts.source || 'client'
            });
        } catch (err) {
            console.error('Error in handleEndQuestion:', err);
            try {
                if (session && session.status === 'question') {
                    session.status = 'result';
                    await session.save({ fields: ['status'] });
                }
                io.to(pin).emit('question_ended', {
                    leaderboard: [],
                    teamStandings: [],
                    correctIndex: null,
                    distribution: []
                });
            } catch (fallbackErr) {
                console.error('handleEndQuestion fallback emit failed:', fallbackErr.message);
            }
        }
    };

    const scheduleQuestionEnd = (pin, startMs, timerSeconds) => {
        clearQuestionEndTimer(pin);
        const timerMs = (Number(timerSeconds) || 20) * 1000;
        const endsAt = startMs + timerMs + 500;
        const delay = Math.max(300, endsAt - Date.now());
        const handle = setTimeout(() => {
            questionEndTimers.delete(pin);
            logDiag('server_auto_end_question', pin, 'question', {
                reason: 'TIMER_EXPIRED',
                delayMs: delay
            });
            handleEndQuestion(pin, { source: 'server_timer' }).catch((err) => {
                console.error('[server_auto_end_question] failed', pin, err.message);
            });
        }, delay);
        questionEndTimers.set(pin, handle);
    };

    io.on('connection', (socket) => {
        console.log('New connection:', socket.id);

        socket.on('join_room', async (payload) => {
            console.log('RECEIVED join_room', payload);
            const { error, value } = validateSocketPayload('join_room', payload);
            if (error) {
                console.error('Validation Error', error);
                return socket.emit('error', 'Validation Error: ' + error.details[0].message);
            }
            const { pin: rawPin, nickname, role, avatar, token, teamName, playerProfileToken } = value;

            const pin = String(rawPin).trim();
            const cleanNickname = nickname ? String(nickname).replace(/<[^>]*>?/gm, '').trim() : '';

            try {
                const session = await GameSession.findOne({
                    where: { pin },
                    include: [{ model: Player, as: 'players' }]
                });

                if (!session) {
                    return socket.emit('error', 'Game not found');
                }

                if (session.status === 'finished' && role !== 'host') {
                    return socket.emit('error', 'Game is already finished');
                }

                if (role === 'player') {
                    if (!cleanNickname) return socket.emit('error', 'Nickname required');

                    let player;
                    let isReentry = false;

                    if (token) {
                        const decoded = SessionTokenService.verifyPlayerToken(token);
                        if (decoded && decoded.sessionId === session.id && decoded.nickname === cleanNickname) {
                            player = await Player.findOne({
                                where: { sessionId: session.id, nickname: cleanNickname }
                            });
                            if (player) isReentry = true;
                        }
                    }

                    try {
                        let playerProfileId = null;
                        if (playerProfileToken) {
                            try {
                                const decoded = SessionTokenService.verifyPlayerToken(playerProfileToken);
                                playerProfileId = decoded.playerId;
                            } catch (e) {}
                        }

                        if (player) {
                            if (!isReentry && player.socketId) {
                                return socket.emit('error', 'That name is already taken');
                            }
                            player.socketId = socket.id;
                            if (avatar) player.avatar = avatar;
                            if (playerProfileId && !player.playerProfileId) player.playerProfileId = playerProfileId;
                            await player.save();
                        } else {
                            player = await Player.create({
                                nickname: cleanNickname,
                                teamName: teamName || null,
                                playerProfileId,
                                socketId: socket.id,
                                sessionId: session.id,
                                score: 0,
                                avatar: avatar || '🛡️'
                            });
                        }
                    } catch (dbErr) {
                        if (dbErr.name === 'SequelizeUniqueConstraintError') {
                            return socket.emit('error', 'That name is already taken');
                        }
                        throw dbErr;
                    }

                    const playerToken = SessionTokenService.generatePlayerToken(session.id, player.id, cleanNickname);

                    socket.join(pin);

                    const updatedSession = await GameSession.findByPk(session.id, {
                        include: [{ model: Player, as: 'players' }]
                    });

                    io.to(pin).emit('player_joined', updatedSession.players);
                    socket.emit('joined_successfully', {
                        pin,
                        nickname: cleanNickname,
                        sessionId: session.id,
                        token: playerToken
                    });

                    socket.data = { pin, nickname: cleanNickname, role: 'player' };

                    if (session.status === 'question' || session.status === 'result') {
                        const quiz = await Quiz.findByPk(session.quizId, {
                            include: [{ model: Question, as: 'questions' }],
                            order: [[{ model: Question, as: 'questions' }, 'id', 'ASC']]
                        });

                        const stateData = SessionRecoveryService.buildPlayerRecoveryState(session, player, quiz);
                        socket.emit('session_info', stateData);
                    }
                } else if (role === 'host') {
                    const hostId = SessionTokenService.verifyHostToken(token);
                    if (!hostId || session.hostId !== hostId) {
                        return socket.emit('error', 'Unauthorized: Invalid host token');
                    }

                    socket.join(pin);
                    socket.join('host_' + pin);
                    socket.data = { pin, role: 'host', hostId };

                    clearHostDisconnectTimer(pin);
                    io.to(pin).emit('host_reconnected');

                    if (session.status === 'question' || session.status === 'result') {
                        const quiz = await Quiz.findByPk(session.quizId, {
                            include: [{ model: Question, as: 'questions' }],
                            order: [[{ model: Question, as: 'questions' }, 'id', 'ASC']]
                        });

                        const stateData = SessionRecoveryService.buildHostRecoveryState(session, quiz);
                        socket.emit('room_info', stateData);
                    } else {
                        socket.emit('room_info', session);
                    }
                } else if (role === 'player_check') {
                    socket.emit('room_info', session);
                }
            } catch (err) {
                console.error('Socket Join Error:', err);
                socket.emit('error', 'Server error');
            }
        });

        socket.on('start_question', async (payload) => {
            const { error, value } = validateSocketPayload('start_question', payload);
            if (error) return socket.emit('error', 'Validation Error: ' + error.details[0].message);
            const { pin: rawPin, token, commandId, expectedStateVersion } = value;

            const pin = String(rawPin).trim();
            try {
                const session = await GameSession.findOne({ where: { pin } });
                if (!session) return;
                const hostId = SessionTokenService.verifyHostToken(token);
                if (!hostId || session.hostId !== hostId) {
                    return socket.emit('error', 'Unauthorized: Only the host can start questions');
                }

                if (session.status === 'question') {
                    console.log('[Guard] start_question ignored for pin ' + pin + ': session already in question state.');
                    return;
                }

                const quiz = await Quiz.findByPk(session.quizId, {
                    include: [{ model: Question, as: 'questions' }],
                    order: [[{ model: Question, as: 'questions' }, 'id', 'ASC']]
                });

                if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
                    return socket.emit('error', 'Quiz has no questions');
                }

                const nextIndex = session.currentQuestionIndex + 1;
                if (nextIndex >= quiz.questions.length) {
                    console.log('[Guard] start_question ignored for pin ' + pin + ': no more questions.');
                    return;
                }

                const useV2 = SessionCommandService.isEnabled() && !!commandId;

                if (useV2) {
                    const cmdResult = await SessionCommandService.executeStartQuestion({
                        commandId,
                        sessionId: session.id,
                        actorId: String(hostId),
                        expectedStateVersion: expectedStateVersion != null ? expectedStateVersion : undefined,
                        questionIndex: nextIndex,
                        questionStartTime: Date.now() + 3000
                    });

                    emitCommandAck(socket, { ...cmdResult, commandId });

                    if (!cmdResult.ok && !cmdResult.replay) {
                        if (cmdResult.code === 'SESSION_STATE_CONFLICT') {
                            return socket.emit('error', 'Session state conflict; refresh and retry');
                        }
                        if (cmdResult.code === 'ALREADY_IN_PROGRESS') {
                            return;
                        }
                        return socket.emit('error', cmdResult.message || cmdResult.code || 'Start question failed');
                    }

                    await session.reload();
                } else {
                    session.currentQuestionIndex = nextIndex;
                    session.status = 'question';
                    session.questionStartTime = new Date(Date.now() + 3000);
                    await session.save({
                        fields: ['currentQuestionIndex', 'status', 'questionStartTime']
                    });
                }

                logDiag('start_question_transition', pin, 'question', {
                    questionIndex: session.currentQuestionIndex,
                    hostId,
                    startTime: session.questionStartTime,
                    v2: !!useV2
                });

                await Player.update(
                    { lastAnswerCorrect: false, lastAnswerTime: 0, lastAnswerIndex: -1 },
                    { where: { sessionId: session.id } }
                );

                const question = quiz.questions[session.currentQuestionIndex];
                if (!question) {
                    console.error('[start_question] missing question at index ' + session.currentQuestionIndex + ' pin=' + pin);
                    return socket.emit('error', 'Question not found');
                }

                const startMs = session.questionStartTime
                    ? new Date(session.questionStartTime).getTime()
                    : Date.now() + 3000;

                const questionData = {
                    questionText: question.questionText,
                    options: question.options,
                    timer: question.timer,
                    explanation: question.explanation,
                    image: question.image,
                    index: session.currentQuestionIndex,
                    totalQuestions: quiz.questions.length,
                    startTime: startMs,
                    serverTime: Date.now()
                };

                if (useV2 && session.stateVersion != null) {
                    questionData.stateVersion = Number(session.stateVersion);
                    questionData.schemaVersion = 1;
                }

                io.to(pin).emit('question_started', questionData);
                scheduleQuestionEnd(pin, startMs, question.timer);
            } catch (err) {
                console.error('Error in start_question:', err);
                try { socket.emit('error', 'Failed to start question'); } catch (_) {}
            }
        });

        socket.on('end_question', async (payload) => {
            const { error, value } = validateSocketPayload('end_question', payload);
            if (error) return socket.emit('error', 'Validation Error: ' + error.details[0].message);
            const { pin: rawPin, token, commandId, expectedStateVersion } = value;
            const pin = String(rawPin).trim();
            try {
                const session = await GameSession.findOne({ where: { pin } });
                if (!session) return;
                const hostId = SessionTokenService.verifyHostToken(token);
                if (!hostId || session.hostId !== hostId) {
                    return socket.emit('error', 'Unauthorized: Only the host can end questions');
                }
                await handleEndQuestion(pin, { commandId, expectedStateVersion, hostId, ackSocket: socket });
            } catch (err) {
                console.error('Error in end_question:', err);
            }
        });

        socket.on('submit_answer', async (payload) => {
            const { error, value } = validateSocketPayload('submit_answer', payload);
            if (error) return socket.emit('error', 'Validation Error: ' + error.details[0].message);
            const { pin: rawPin, nickname, answerIndex } = value;

            const pin = String(rawPin).trim();
            try {
                const result = await AnswerSubmissionService.submitAnswer(pin, nickname, answerIndex);

                if (result.error) {
                    if (result.error === 'Player not found') return;
                    return socket.emit('error', result.error);
                }

                socket.emit('answer_confirmed', {
                    streak: result.streak,
                    score: result.score,
                    points: result.points
                });

                io.to(pin).emit('answer_received', { nickname });
                io.to('host_' + pin).emit('answer_received_host', { answerIndex, nickname });
            } catch (err) {
                console.error('Error in submit_answer:', err);
            }
        });

        socket.on('next_question', async (payload) => {
            const { error, value } = validateSocketPayload('next_question', payload);
            if (error) return socket.emit('error', 'Validation Error: ' + error.details[0].message);
            const { pin: rawPin, token, commandId, expectedStateVersion } = value;

            const pin = String(rawPin).trim();

            const session = await GameSession.findOne({ where: { pin } });
            if (!session) return;

            const hostId = SessionTokenService.verifyHostToken(token);
            if (!hostId || session.hostId !== hostId) {
                return socket.emit('error', 'Unauthorized');
            }

            await handleEndQuestion(pin, { commandId, expectedStateVersion, hostId, ackSocket: socket });
        });

        const lastReaction = new Map();
        socket.on('send_reaction', (payload) => {
            const { error, value } = validateSocketPayload('send_reaction', payload);
            if (error) return;
            const { pin: rawPin, emoji } = value;

            const pin = String(rawPin).trim();
            const now = Date.now();
            const lastTime = lastReaction.get(socket.id) || 0;

            if (now - lastTime < 500) return;

            lastReaction.set(socket.id, now);

            io.to(pin).emit('new_reaction', { emoji, id: socket.id + '_' + now });
        });

        socket.on('change_mode', async (payload) => {
            const { error, value } = validateSocketPayload('change_mode', payload);
            if (error) return socket.emit('error', 'Validation Error: ' + error.details[0].message);
            const { pin: rawPin, token, mode } = value;

            const pin = String(rawPin).trim();
            try {
                const session = await GameSession.findOne({ where: { pin } });
                if (!session) return;

                const hostId = SessionTokenService.verifyHostToken(token);
                if (!hostId || session.hostId !== hostId) return;

                session.gameMode = mode;
                await session.save({ fields: ['gameMode'] });

                io.to(pin).emit('room_info', session);
            } catch (err) {
                console.error(err);
            }
        });

        socket.on('end_game', async (payload) => {
            const { error, value } = validateSocketPayload('end_game', payload);
            if (error) return socket.emit('error', 'Validation Error: ' + error.details[0].message);
            const { pin: rawPin, token, commandId, expectedStateVersion } = value;

            const pin = String(rawPin).trim();
            try {
                const session = await GameSession.findOne({ where: { pin } });
                if (!session) return;

                const hostId = SessionTokenService.verifyHostToken(token);
                if (!hostId || session.hostId !== hostId) {
                    return socket.emit('error', 'Unauthorized');
                }

                clearQuestionEndTimer(pin);

                const useV2 = SessionCommandService.isEnabled() && !!commandId;

                if (useV2) {
                    const cmdResult = await SessionCommandService.executeEndGame({
                        commandId,
                        sessionId: session.id,
                        actorId: String(hostId),
                        expectedStateVersion
                    });
                    emitCommandAck(socket, { ...cmdResult, commandId });
                    if (!cmdResult.ok && !cmdResult.replay) {
                        session.status = 'finished';
                        await session.save({ fields: ['status'] });
                    } else {
                        await session.reload();
                        if (session.status !== 'finished') {
                            session.status = 'finished';
                            await session.save({ fields: ['status'] });
                        }
                    }
                } else {
                    session.status = 'finished';
                    await session.save({ fields: ['status'] });
                }

                const players = await Player.findAll({
                    where: { sessionId: session.id },
                    order: [['score', 'DESC']]
                });

                let teamStandings = [];
                if (session.gameMode === 'team') {
                    const teamScores = await Player.findAll({
                        where: { sessionId: session.id },
                        attributes: [
                            'teamName',
                            [sequelize.fn('SUM', sequelize.col('score')), 'totalScore']
                        ],
                        group: ['teamName'],
                        order: [[sequelize.literal('"totalScore"'), 'DESC']]
                    });
                    teamStandings = teamScores.map((t) => ({
                        teamName: t.teamName,
                        score: parseInt(t.get('totalScore'), 10) || 0
                    }));
                }

                let classAnalytics = { totalStudents: 0, totalQuestions: 0, averageScore: 0, averageAccuracy: 0, participationRate: 0 };
                let questionAnalytics = [];
                let studentAnalytics = [];

                try {
                    const quiz = await Quiz.findByPk(session.quizId, {
                        include: [{ model: Question, as: 'questions' }],
                        order: [[{ model: Question, as: 'questions' }, 'id', 'ASC']]
                    });

                    const allAnswers = await PlayerAnswer.findAll({
                        where: { sessionId: session.id }
                    });

                    const totalQuestions = quiz.questions.length;
                    const totalStudents = players.length;

                    questionAnalytics = quiz.questions.map((q, index) => {
                        const answersForQ = allAnswers.filter((a) => a.questionIndex === index);
                        const totalResponses = answersForQ.length;
                        const correctCount = answersForQ.filter((a) => a.isCorrect).length;
                        const incorrectCount = totalResponses - correctCount;
                        const correctPercentage = totalResponses > 0 ? Math.round((correctCount / totalResponses) * 100) : 0;

                        return {
                            questionIndex: index,
                            title: q.questionText,
                            totalResponses,
                            correctCount,
                            incorrectCount,
                            correctPercentage,
                            difficulty: totalResponses > 0
                                ? (correctPercentage >= 80) ? 'easy'
                                    : (correctPercentage >= 60) ? 'medium' : 'hard'
                                : 'unknown',
                            needsReview: correctPercentage < 60
                        };
                    });

                    studentAnalytics = players.map((p) => {
                        const studentAnswers = allAnswers.filter((a) => a.playerId === p.id);
                        const totalAnswered = studentAnswers.length;
                        const correctAnswers = studentAnswers.filter((a) => a.isCorrect).length;
                        const incorrectAnswers = totalAnswered - correctAnswers;
                        const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;

                        return {
                            id: p.id,
                            name: p.nickname,
                            avatar: p.avatar,
                            totalPoints: p.score,
                            teamName: p.teamName,
                            correctAnswers,
                            incorrectAnswers,
                            totalAnswered,
                            accuracy,
                            needsAttention: accuracy < 60
                        };
                    });

                    const totalAnsweredQuestions = allAnswers.length;
                    classAnalytics = {
                        totalStudents,
                        totalQuestions,
                        averageScore: totalStudents > 0 ? Math.round(players.reduce((sum, p) => sum + p.score, 0) / totalStudents) : 0,
                        averageAccuracy: studentAnalytics.length > 0 ? Math.round(studentAnalytics.reduce((sum, s) => sum + s.accuracy, 0) / studentAnalytics.length) : 0,
                        questionsNeedingReview: questionAnalytics.filter((q) => q.needsReview).length,
                        studentsNeedingAttention: studentAnalytics.filter((s) => s.needsAttention).length,
                        participationRate: (totalStudents > 0 && totalQuestions > 0) ? Math.round((totalAnsweredQuestions / (totalStudents * totalQuestions)) * 100) : 0
                    };
                } catch (analyticsErr) {
                    console.error('Error generating analytics:', analyticsErr);
                }

                session.analytics = { classAnalytics, questionAnalytics, studentAnalytics };
                await session.save({ fields: ['analytics', 'status'] });

                for (const p of players) {
                    if (p.playerProfileId) {
                        try {
                            const profile = await PlayerProfile.findByPk(p.playerProfileId);
                            if (profile) {
                                profile.xp += p.score;
                                profile.gamesPlayed += 1;
                                profile.level = Math.floor(profile.xp / 1000) + 1;
                                await profile.save();
                            }
                        } catch (e) {
                            console.error('Failed to update XP:', e);
                        }
                    }
                }

                io.to(pin).emit('game_finished', {
                    players,
                    teamStandings,
                    analytics: { classAnalytics, questionAnalytics, studentAnalytics }
                });
            } catch (err) {
                console.error(err);
            }
        });

        socket.on('leave_session', async (payload) => {
            const { error, value } = validateSocketPayload('leave_session', payload || {});
            if (error) return;
            const pin = String(value.pin).trim();
            const role = value.role;
            try {
                if (role === 'player') {
                    const nickname = value.nickname || (socket.data && socket.data.nickname);
                    let session = await GameSession.findOne({
                        where: { pin },
                        include: [{ model: Player, as: 'players' }]
                    });
                    if (!session) return;

                    let leftPlayer = await Player.findOne({ where: { socketId: socket.id } });
                    if (!leftPlayer && nickname) {
                        leftPlayer = await Player.findOne({
                            where: { sessionId: session.id, nickname }
                        });
                    }
                    if (leftPlayer) {
                        leftPlayer.socketId = null;
                        await leftPlayer.save();
                    }
                    session = await GameSession.findByPk(session.id, {
                        include: [{ model: Player, as: 'players' }]
                    });
                    const payloadOut = {
                        nickname: leftPlayer ? leftPlayer.nickname : nickname,
                        reason: 'left',
                        temporary: false,
                        players: session.players
                    };
                    io.to(pin).emit('player_left', payloadOut);
                    io.to(pin).emit('player_joined', session.players);
                    logDiag('player_left', pin, session.status, {
                        nickname: payloadOut.nickname,
                        intentional: true
                    });
                    try { socket.leave(pin); } catch (_) {}
                    socket.data = {};
                } else if (role === 'host') {
                    const session = await GameSession.findOne({ where: { pin } });
                    if (!session) return;
                    const hostId = SessionTokenService.verifyHostToken(value.token);
                    if (!hostId || session.hostId !== hostId) {
                        return socket.emit('error', 'Unauthorized');
                    }
                    clearHostDisconnectTimer(pin);
                    clearQuestionEndTimer(pin);
                    io.to(pin).emit('host_left', {
                        reason: 'left',
                        message: 'Host left the session'
                    });
                    logDiag('host_left', pin, session.status, { intentional: true });
                    try {
                        socket.leave(pin);
                        socket.leave('host_' + pin);
                    } catch (_) {}
                    socket.data = {};
                }
            } catch (err) {
                console.error('leave_session error:', err);
            }
        });

        socket.on('disconnect', async () => {
            console.log('User disconnected:', socket.id);
            const { pin, nickname, role } = socket.data || {};

            if (role === 'player' && pin) {
                try {
                    const player = await Player.findOne({ where: { socketId: socket.id } });
                    if (player) {
                        player.socketId = null;
                        await player.save();
                        const session = await GameSession.findOne({
                            where: { pin },
                            include: [{ model: Player, as: 'players' }]
                        });
                        if (session) {
                            const leftPayload = {
                                nickname: player.nickname,
                                reason: 'disconnect',
                                temporary: true,
                                players: session.players
                            };
                            io.to(pin).emit('player_left', leftPayload);
                            io.to(pin).emit('player_joined', session.players);
                            logDiag('player_disconnect', pin, session.status, { nickname: player.nickname });
                        }
                    }
                } catch (err) {
                    console.error('Error in disconnect cleanup:', err);
                }
            } else if (role === 'host' && pin) {
                io.to(pin).emit('host_disconnected');
                logDiag('host_disconnected', pin, null, { socketId: socket.id });
                clearHostDisconnectTimer(pin);
                const handle = setTimeout(() => {
                    hostDisconnectTimers.delete(pin);
                    logDiag('host_left', pin, null, { reason: 'grace_timeout' });
                    io.to(pin).emit('host_left', {
                        reason: 'timeout',
                        message: 'Host did not reconnect — session ended for players'
                    });
                }, HOST_DISCONNECT_GRACE_MS);
                hostDisconnectTimers.set(pin, handle);
            }
        });
    });
};
