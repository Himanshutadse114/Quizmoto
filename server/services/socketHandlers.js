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

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('New connection:', socket.id);

        // Join Room (Host or Player)
        socket.on('join_room', async (payload) => {
            console.log('RECEIVED join_room', payload);
            const { error, value } = validateSocketPayload('join_room', payload);
            if (error) {
                console.error('Validation Error', error);
                return socket.emit('error', `Validation Error: ${error.details[0].message}`);
            }
            const { pin: rawPin, nickname, role, avatar, token, teamName, playerProfileToken } = value;
            
            const pin = String(rawPin).trim();
            // Basic Sanitization
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

                    // Persistence Check: If token provided, try to find existing player
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
                            // If re-entry, check if someone else is using the socket
                            if (!isReentry && player.socketId) {
                                return socket.emit('error', 'That name is already taken');
                            }
                            player.socketId = socket.id;
                            if (avatar) player.avatar = avatar;
                            if (playerProfileId && !player.playerProfileId) player.playerProfileId = playerProfileId;
                            await player.save();
                        } else {
                            // ATOMIC: Attempt to create, catch unique constraint error if race condition occurs
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
                            // Race condition happened, name was taken between our find and create
                            return socket.emit('error', 'That name is already taken');
                        }
                        throw dbErr; // Let the outer catch handle unexpected server errors
                    }

                    // Generate persistence token for the player
                    const playerToken = SessionTokenService.generatePlayerToken(session.id, player.id, cleanNickname);

                    socket.join(pin);

                    // Refresh session to get updated players list
                    const updatedSession = await GameSession.findByPk(session.id, {
                        include: [{ model: Player, as: 'players' }]
                    });

                    // Notify host and players in lobby
                    io.to(pin).emit('player_joined', updatedSession.players);
                    socket.emit('joined_successfully', {
                        pin,
                        nickname: cleanNickname,
                        sessionId: session.id,
                        token: playerToken
                    });

                    // Store session/player info on the socket for cleanup
                    socket.data = { pin, nickname: cleanNickname, role: 'player' };

                    // State Recovery: If game is in progress, send current state to player
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
                    socket.join(`host_${pin}`);
                    socket.data = { pin, role: 'host' };

                    // Notify players that host has rejoined
                    io.to(pin).emit('host_reconnected');

                    // State Recovery: If game is in progress, restore full state
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
                    // Special role to just get room info before joining
                    socket.emit('room_info', session);
                }
            } catch (err) {
                console.error('Socket Join Error:', err);
                socket.emit('error', 'Server error');
            }
        });

        // Start Question
        socket.on('start_question', async (payload) => {
            const { error, value } = validateSocketPayload('start_question', payload);
            if (error) return socket.emit('error', `Validation Error: ${error.details[0].message}`);
            const { pin: rawPin, token } = value;

            const pin = String(rawPin).trim();
            try {
                const session = await GameSession.findOne({ where: { pin } });
                const hostId = SessionTokenService.verifyHostToken(token);
                if (!hostId || session.hostId !== hostId) {
                    return socket.emit('error', 'Unauthorized: Only the host can start questions');
                }

                // Guard: Ignore duplicate start_question calls while a question is already in progress
                if (session.status === 'question') {
                    console.log(`[Guard] start_question ignored for pin ${pin}: session already in question state.`);
                    return;
                }

                const quiz = await Quiz.findByPk(session.quizId, {
                    include: [{ model: Question, as: 'questions' }],
                    order: [[{ model: Question, as: 'questions' }, 'id', 'ASC']]
                });

                // Guard: Don't go past the last question
                const nextIndex = session.currentQuestionIndex + 1;
                if (nextIndex >= quiz.questions.length) {
                    console.log(`[Guard] start_question ignored for pin ${pin}: no more questions.`);
                    return;
                }

                session.currentQuestionIndex = nextIndex;
                session.status = 'question';
                session.questionStartTime = new Date(Date.now() + 3000); // 3 seconds in the future for countdown
                await session.save();

                logDiag('start_question_transition', pin, 'question', {
                    questionIndex: nextIndex,
                    hostId,
                    startTime: session.questionStartTime
                });

                // Reset player states for the new question
                await Player.update(
                    { lastAnswerCorrect: false, lastAnswerTime: 0, lastAnswerIndex: -1 },
                    { where: { sessionId: session.id } }
                );

                const question = quiz.questions[session.currentQuestionIndex];
                const questionData = {
                    questionText: question.questionText,
                    options: question.options,
                    timer: question.timer,
                    explanation: question.explanation,
                    image: question.image,
                    index: session.currentQuestionIndex,
                    totalQuestions: quiz.questions.length,
                    startTime: session.questionStartTime.getTime(),
                    serverTime: Date.now()
                };

                io.to(pin).emit('question_started', questionData);
            } catch (err) {
                console.error('Error in start_question:', err);
            }
        });

        const handleEndQuestion = async (pin) => {
            try {
                const session = await GameSession.findOne({ where: { pin } });
                if (!session || session.status !== 'question') return;

                const quiz = await Quiz.findByPk(session.quizId, {
                    include: [{ model: Question, as: 'questions' }],
                    order: [[{ model: Question, as: 'questions' }, 'id', 'ASC']]
                });

                session.status = 'result';
                await session.save();

                logDiag('end_question_transition', pin, 'result', {
                    questionIndex: session.currentQuestionIndex
                });

                const allPlayers = await Player.findAll({
                    where: { sessionId: session.id }
                });

                // Send individual results to each player
                allPlayers.forEach(player => {
                    io.to(player.socketId).emit('question_result', {
                        correct: player.lastAnswerCorrect,
                        score: player.score,
                        answered: player.lastAnswerIndex !== -1
                    });
                });

                const leaderboard = await Player.findAll({
                    where: { sessionId: session.id },
                    order: [['score', 'DESC']],
                    limit: 5,
                    attributes: ['nickname', 'score', 'avatar']
                });

                const currentQuestion = quiz.questions[session.currentQuestionIndex];
                const options = typeof currentQuestion.options === 'string' ? JSON.parse(currentQuestion.options) : currentQuestion.options;
                const distribution = options.map((_, i) => allPlayers.filter(p => p.lastAnswerIndex === i).length);

                let teamStandings = [];
                if (session.gameMode === 'team') {
                    // Aggregate scores by team
                    const teamScores = await Player.findAll({
                        where: { sessionId: session.id },
                        attributes: [
                            'teamName',
                            [sequelize.fn('SUM', sequelize.col('score')), 'totalScore']
                        ],
                        group: ['teamName'],
                        order: [[sequelize.literal('"totalScore"'), 'DESC']]
                    });
                    teamStandings = teamScores.map(t => ({
                        teamName: t.teamName,
                        score: parseInt(t.get('totalScore'))
                    }));
                }

                io.to(pin).emit('question_ended', {
                    leaderboard,
                    teamStandings,
                    correctIndex: currentQuestion ? currentQuestion.correctIndex : null,
                    distribution
                });
            } catch (err) {
                console.error('Error in handleEndQuestion:', err);
            }
        };

        socket.on('end_question', async (payload) => {
            const { error, value } = validateSocketPayload('end_question', payload);
            if (error) return socket.emit('error', `Validation Error: ${error.details[0].message}`);
            const { pin: rawPin, token } = value;
            const pin = String(rawPin).trim();
            try {
                const session = await GameSession.findOne({ where: { pin } });
                if (!session) return;
                const hostId = SessionTokenService.verifyHostToken(token);
                if (!hostId || session.hostId !== hostId) {
                    return socket.emit('error', 'Unauthorized: Only the host can end questions');
                }
                await handleEndQuestion(pin);
            } catch (err) {
                console.error('Error in end_question:', err);
            }
        });

        // Submit Answer
        socket.on('submit_answer', async (payload) => {
            const { error, value } = validateSocketPayload('submit_answer', payload);
            if (error) return socket.emit('error', `Validation Error: ${error.details[0].message}`);
            const { pin: rawPin, nickname, answerIndex, timeRemaining } = value;

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
                io.to(`host_${pin}`).emit('answer_received_host', { answerIndex, nickname });
            } catch (err) {
                console.error('Error in submit_answer:', err);
            }
        });

        // End Question / Show Result
        socket.on('next_question', async (payload) => {
            const { error, value } = validateSocketPayload('next_question', payload);
            if (error) return socket.emit('error', `Validation Error: ${error.details[0].message}`);
            const { pin: rawPin, token } = value;

            const pin = String(rawPin).trim();

            // Security Check
            const session = await GameSession.findOne({ where: { pin } });
            if (!session) return;

            const hostId = SessionTokenService.verifyHostToken(token);
            if (!hostId || session.hostId !== hostId) {
                return socket.emit('error', 'Unauthorized');
            }

            await handleEndQuestion(pin);
        });

        // Live Reactions
        const lastReaction = new Map();
        socket.on('send_reaction', (payload) => {
            const { error, value } = validateSocketPayload('send_reaction', payload);
            if (error) return; // silent fail for reactions to avoid spam
            const { pin: rawPin, emoji } = value;
            
            const pin = String(rawPin).trim();
            const now = Date.now();
            const lastTime = lastReaction.get(socket.id) || 0;

            // Rate limit: 2 reactions per second per socket
            if (now - lastTime < 500) return;

            lastReaction.set(socket.id, now);

            // Broadcast the reaction to everyone in the room
            io.to(pin).emit('new_reaction', { emoji, id: `${socket.id}_${now}` });
        });

        // Toggle Game Mode (Host Only)
        socket.on('change_mode', async (payload) => {
            const { error, value } = validateSocketPayload('change_mode', payload);
            if (error) return socket.emit('error', `Validation Error: ${error.details[0].message}`);
            const { pin: rawPin, token, mode } = value;

            const pin = String(rawPin).trim();
            try {
                const session = await GameSession.findOne({ where: { pin } });
                if (!session) return;

                const hostId = SessionTokenService.verifyHostToken(token);
                if (!hostId || session.hostId !== hostId) return;

                session.gameMode = mode; // 'classic' or 'team'
                await session.save();

                io.to(pin).emit('room_info', session); // Update everyone
            } catch (err) {
                console.error(err);
            }
        });

        // End Game
        socket.on('end_game', async (payload) => {
            const { error, value } = validateSocketPayload('end_game', payload);
            if (error) return socket.emit('error', `Validation Error: ${error.details[0].message}`);
            const { pin: rawPin, token } = value;

            const pin = String(rawPin).trim();
            try {
                const session = await GameSession.findOne({ where: { pin } });
                if (!session) return;

                // Security Check
                const hostId = SessionTokenService.verifyHostToken(token);
                if (!hostId || session.hostId !== hostId) {
                    return socket.emit('error', 'Unauthorized');
                }

                session.status = 'finished';
                await session.save();

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
                    teamStandings = teamScores.map(t => ({
                        teamName: t.teamName,
                        score: parseInt(t.get('totalScore'))
                    }));
                }

                // END OF TEAM STANDING LOGIC

                // === 🌟 NEW: ANALYTICS GENERATION 🌟 ===
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

                    // 1. Question Analytics
                    questionAnalytics = quiz.questions.map((q, index) => {
                        const answersForQ = allAnswers.filter(a => a.questionIndex === index);
                        const totalResponses = answersForQ.length;
                        const correctCount = answersForQ.filter(a => a.isCorrect).length;
                        const incorrectCount = totalResponses - correctCount;
                        const correctPercentage = totalResponses > 0 ? Math.round((correctCount / totalResponses) * 100) : 0;

                        return {
                            questionIndex: index,
                            title: q.questionText,
                            totalResponses,
                            correctCount,
                            incorrectCount,
                            correctPercentage,
                            difficulty: totalResponses > 0 ?
                                (correctPercentage >= 80) ? 'easy' :
                                    (correctPercentage >= 60) ? 'medium' : 'hard' : 'unknown',
                            needsReview: correctPercentage < 60
                        };
                    });

                    // 2. Student Analytics
                    studentAnalytics = players.map(p => {
                        const studentAnswers = allAnswers.filter(a => a.playerId === p.id);
                        const totalAnswered = studentAnswers.length;
                        const correctAnswers = studentAnswers.filter(a => a.isCorrect).length;
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

                    // 3. Class Analytics
                    const totalAnsweredQuestions = allAnswers.length;
                    classAnalytics = {
                        totalStudents,
                        totalQuestions,
                        averageScore: totalStudents > 0 ? Math.round(players.reduce((sum, p) => sum + p.score, 0) / totalStudents) : 0,
                        averageAccuracy: studentAnalytics.length > 0 ? Math.round(studentAnalytics.reduce((sum, s) => sum + s.accuracy, 0) / studentAnalytics.length) : 0,
                        questionsNeedingReview: questionAnalytics.filter(q => q.needsReview).length,
                        studentsNeedingAttention: studentAnalytics.filter(s => s.needsAttention).length,
                        participationRate: (totalStudents > 0 && totalQuestions > 0) ? Math.round((totalAnsweredQuestions / (totalStudents * totalQuestions)) * 100) : 0
                    };

                } catch (analyticsErr) {
                    console.error('Error generating analytics:', analyticsErr);
                }

                // === 💾 PERSIST ANALYTICS 💾 ===
                session.analytics = { classAnalytics, questionAnalytics, studentAnalytics };
                await session.save();

                // === 🏆 AWARD XP TO PERSISTENT PLAYERS 🏆 ===
                for (const p of players) {
                    if (p.playerProfileId) {
                        try {
                            const profile = await PlayerProfile.findByPk(p.playerProfileId);
                            if (profile) {
                                profile.xp += p.score;
                                profile.gamesPlayed += 1;
                                profile.level = Math.floor(profile.xp / 1000) + 1; // 1 level per 1000 XP
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

        socket.on('disconnect', async () => {
            console.log('User disconnected:', socket.id);
            const { pin, nickname, role } = socket.data || {};

            if (role === 'player' && pin && nickname) {
                try {
                    const player = await Player.findOne({
                        where: { socketId: socket.id }
                    });

                    if (player) {
                        // Mark socket as null, but keep player record for persistence/re-join
                        player.socketId = null;
                        await player.save();

                        // Notify host that player is gone (visually)
                        const session = await GameSession.findOne({
                            where: { pin },
                            include: [{ model: Player, as: 'players' }]
                        });
                        if (session) {
                            io.to(pin).emit('player_joined', session.players);
                        }
                    }
                } catch (err) {
                    console.error('Error in disconnect cleanup:', err);
                }
            } else if (role === 'host' && pin) {
                // Notify players that the host disconnected (so they can pause/wait)
                io.to(pin).emit('host_disconnected');
            }
        });
    });
};
