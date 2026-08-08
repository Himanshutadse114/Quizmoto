const { GameSession, Player, PlayerAnswer } = require('../models/GameSession');
const { Quiz, Question } = require('../models/Quiz');
const { sequelize } = require('../config/database');
const { Sequelize } = require('sequelize');
const { PlayerProfile } = require('../models/PlayerProfile');
const ScoringService = require('./ScoringService');
const AnswerSubmissionService = require('./AnswerSubmissionService');
const SessionTokenService = require('./SessionTokenService');
const SessionRecoveryService = require('./SessionRecoveryService');
const SessionCommandService = require('./SessionCommandService');
const { validateSocketPayload } = require('../validators/socketSchemas');

const logDiag = (event, pin, state, details = {}) => {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), module: 'socketHandlers', event, pin, state, ...details }));
};

const emitCommandAck = (socket, result) => {
  if (!result) return;
  socket.emit('command_ack', {
    ok: !!result.ok, code: result.code, commandId: result.commandId || undefined,
    stateVersion: result.stateVersion, toState: result.toState, fromState: result.fromState,
    replay: result.replay || false, message: result.message,
    currentStateVersion: result.currentStateVersion, currentState: result.currentState
  });
};

function parseOptions(raw) {
  try {
    if (raw == null) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }
    return [];
  } catch (_) { return []; }
}

const questionEndTimers = new Map();
function clearQuestionEndTimer(pin) {
  const h = questionEndTimers.get(pin);
  if (h) { clearTimeout(h); questionEndTimers.delete(pin); }
}

/** Server-authoritative 3-2-1 ticks so host + all players show the same number. */
const COUNTDOWN_MS = 3000;
const countdownTickTimers = new Map();
function clearCountdownTicks(pin) {
  const arr = countdownTickTimers.get(pin);
  if (arr) {
    for (const h of arr) clearTimeout(h);
    countdownTickTimers.delete(pin);
  }
}
function scheduleCountdownTicks(io, pin, startMs, questionIndex) {
  clearCountdownTicks(pin);
  const handles = [];
  const base = { startTime: startMs, index: questionIndex, serverTime: Date.now() };
  try { io.to(pin).emit('countdown_tick', { ...base, value: 3 }); } catch (_) {}
  for (const value of [2, 1, 0]) {
    const fireAt = startMs - value * 1000;
    const delay = Math.max(0, fireAt - Date.now());
    const h = setTimeout(() => {
      try {
        io.to(pin).emit('countdown_tick', {
          value,
          startTime: startMs,
          index: questionIndex,
          serverTime: Date.now()
        });
      } catch (_) {}
    }, delay);
    handles.push(h);
  }
  countdownTickTimers.set(pin, handles);
}

const hostDisconnectTimers = new Map();
const HOST_DISCONNECT_GRACE_MS = Number(process.env.HOST_DISCONNECT_GRACE_MS) || 45000;
function clearHostDisconnectTimer(pin) {
  const h = hostDisconnectTimers.get(pin);
  if (h) { clearTimeout(h); hostDisconnectTimers.delete(pin); }
}

module.exports = (io) => {
  const handleEndQuestion = async (pin, opts = {}) => {
    let session;
    try {
      session = await GameSession.findOne({ where: { pin } });
      if (!session) return;
      if (session.status !== 'question') return;
      clearQuestionEndTimer(pin);
      clearCountdownTicks(pin);

      const quiz = await Quiz.findByPk(session.quizId, {
        include: [{ model: Question, as: 'questions' }],
        order: [[{ model: Question, as: 'questions' }, 'id', 'ASC']]
      });

      session.status = 'result';
      await session.save({ fields: ['status'] });

      const allPlayers = await Player.findAll({ where: { sessionId: session.id } });
      // Room-broadcast personal results (do not rely only on socketId — avoids stuck players)
      for (const player of allPlayers) {
        const payload = {
          correct: !!player.lastAnswerCorrect,
          score: player.score,
          answered: player.lastAnswerIndex !== -1,
          nickname: player.nickname,
          lastAnswerIndex: player.lastAnswerIndex,
          index: session.currentQuestionIndex
        };
        try {
          io.to(pin).emit('question_result', payload);
        } catch (_) {}
        try {
          if (player.socketId) io.to(player.socketId).emit('question_result', payload);
        } catch (_) {}
      }

      let leaderboard = [];
      try {
        leaderboard = await Player.findAll({
          where: { sessionId: session.id }, order: [['score', 'DESC']], limit: 5,
          attributes: ['nickname', 'score', 'avatar']
        });
      } catch (_) {}

      const qIndex = session.currentQuestionIndex;
      const currentQuestion = quiz && Array.isArray(quiz.questions) && quiz.questions[qIndex] ? quiz.questions[qIndex] : null;
      const optionsList = parseOptions(currentQuestion ? currentQuestion.options : null);
      const distribution = optionsList.map((_, i) => allPlayers.filter((p) => p.lastAnswerIndex === i).length);

      let teamStandings = [];
      if (session.gameMode === 'team') {
        try {
          const teamScores = await Player.findAll({
            where: { sessionId: session.id },
            attributes: ['teamName', [sequelize.fn('SUM', sequelize.col('score')), 'totalScore']],
            group: ['teamName'], order: [[sequelize.literal('"totalScore"'), 'DESC']]
          });
          teamStandings = teamScores.map((t) => ({ teamName: t.teamName, score: parseInt(t.get('totalScore'), 10) || 0 }));
        } catch (_) {}
      }

      io.to(pin).emit('question_ended', {
        leaderboard, teamStandings,
        correctIndex: currentQuestion != null ? currentQuestion.correctIndex : null,
        distribution,
        index: qIndex,
        status: 'result'
      });
      logDiag('end_question_emitted', pin, 'result', { source: opts.source || 'client', index: qIndex });
    } catch (err) {
      console.error('Error in handleEndQuestion:', err);
      try {
        if (session && session.status === 'question') {
          session.status = 'result';
          await session.save({ fields: ['status'] });
        }
        io.to(pin).emit('question_ended', { leaderboard: [], teamStandings: [], correctIndex: null, distribution: [] });
      } catch (_) {}
    }
  };

  const scheduleQuestionEnd = (pin, startMs, timerSeconds) => {
    clearQuestionEndTimer(pin);
    const timerMs = (Number(timerSeconds) || 20) * 1000;
    const endsAt = startMs + timerMs + 500;
    const delay = Math.max(300, endsAt - Date.now());
    const handle = setTimeout(() => {
      questionEndTimers.delete(pin);
      handleEndQuestion(pin, { source: 'server_timer' }).catch((err) => {
        console.error('[server_auto_end_question] failed', pin, err.message);
      });
    }, delay);
    questionEndTimers.set(pin, handle);
  };

  io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    socket.on('join_room', async (payload) => {
      const { error, value } = validateSocketPayload('join_room', payload);
      if (error) return socket.emit('error', 'Validation Error: ' + error.details[0].message);
      const { pin: rawPin, nickname, role, avatar, token, teamName, playerProfileToken } = value;
      const pin = String(rawPin).trim();
      const cleanNickname = nickname ? String(nickname).replace(/<[^>]*>?/gm, '').trim() : '';

      try {
        const session = await GameSession.findOne({ where: { pin }, include: [{ model: Player, as: 'players' }] });
        if (!session) return socket.emit('error', 'Game not found');
        if (session.status === 'finished' && role !== 'host') return socket.emit('error', 'Game is already finished');

        if (role === 'player') {
          if (!cleanNickname) return socket.emit('error', 'Nickname required');
          let player;
          if (token) {
            const decoded = SessionTokenService.verifyPlayerToken(token);
            if (decoded && decoded.sessionId === session.id && decoded.nickname === cleanNickname) {
              player = await Player.findOne({ where: { sessionId: session.id, nickname: cleanNickname } });
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
              player.socketId = socket.id;
              if (avatar) player.avatar = avatar;
              if (playerProfileId && !player.playerProfileId) player.playerProfileId = playerProfileId;
              await player.save();
            } else {
              player = await Player.create({
                nickname: cleanNickname, teamName: teamName || null, playerProfileId,
                socketId: socket.id, sessionId: session.id, score: 0, avatar: avatar || 'default'
              });
            }
          } catch (dbErr) {
            if (dbErr.name === 'SequelizeUniqueConstraintError') return socket.emit('error', 'That name is already taken');
            throw dbErr;
          }
          const playerToken = SessionTokenService.generatePlayerToken(session.id, player.id, cleanNickname);
          socket.join(pin);
          const updatedSession = await GameSession.findByPk(session.id, { include: [{ model: Player, as: 'players' }] });
          io.to(pin).emit('player_joined', updatedSession.players);
          socket.emit('joined_successfully', { pin, nickname: cleanNickname, sessionId: session.id, token: playerToken });
          socket.data = { pin, nickname: cleanNickname, role: 'player' };
          if (session.status === 'question' || session.status === 'result') {
            const quiz = await Quiz.findByPk(session.quizId, {
              include: [{ model: Question, as: 'questions' }],
              order: [[{ model: Question, as: 'questions' }, 'id', 'ASC']]
            });
            socket.emit('session_info', SessionRecoveryService.buildPlayerRecoveryState(session, player, quiz));
          }
        } else if (role === 'host') {
          const hostId = SessionTokenService.verifyHostToken(token);
          if (!hostId || session.hostId !== hostId) return socket.emit('error', 'Unauthorized: Invalid host token');
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
            socket.emit('room_info', SessionRecoveryService.buildHostRecoveryState(session, quiz));
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
      const { pin: rawPin, token } = value;
      const pin = String(rawPin).trim();
      try {
        const session = await GameSession.findOne({ where: { pin } });
        if (!session) return socket.emit('error', 'Game not found');
        const hostId = SessionTokenService.verifyHostToken(token);
        if (!hostId || session.hostId !== hostId) return socket.emit('error', 'Unauthorized: Only the host can start questions');

        // Only advance from lobby or result. Never silently no-op on question.
        if (session.status === 'question') {
          return socket.emit('error', 'Question already in progress');
        }
        if (session.status === 'finished') {
          return socket.emit('error', 'Game is already finished');
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
          return socket.emit('error', 'No more questions');
        }

        // Clear any leftover timers from previous question BEFORE advancing
        clearQuestionEndTimer(pin);
        clearCountdownTicks(pin);

        session.currentQuestionIndex = nextIndex;
        session.status = 'question';
        const startMs = Date.now() + COUNTDOWN_MS;
        session.questionStartTime = new Date(startMs);
        await session.save({ fields: ['currentQuestionIndex', 'status', 'questionStartTime'] });

        await Player.update(
          { lastAnswerCorrect: false, lastAnswerTime: 0, lastAnswerIndex: -1 },
          { where: { sessionId: session.id } }
        );

        const question = quiz.questions[session.currentQuestionIndex];
        const serverNow = Date.now();
        const questionData = {
          questionText: question.questionText, options: question.options, timer: question.timer,
          explanation: question.explanation, image: question.image,
          index: session.currentQuestionIndex, totalQuestions: quiz.questions.length,
          startTime: startMs, serverTime: serverNow,
          countdown: 3, countdownMs: COUNTDOWN_MS
        };
        io.to(pin).emit('question_started', questionData);
        scheduleCountdownTicks(io, pin, startMs, session.currentQuestionIndex);
        scheduleQuestionEnd(pin, startMs, question.timer);
        logDiag('start_question_emitted', pin, 'question', { index: session.currentQuestionIndex, startMs });
      } catch (err) {
        console.error('Error in start_question:', err);
        try { socket.emit('error', 'Failed to start question'); } catch (_) {}
      }
    });

    socket.on('end_question', async (payload) => {
      const { error, value } = validateSocketPayload('end_question', payload);
      if (error) return socket.emit('error', 'Validation Error: ' + error.details[0].message);
      const { pin: rawPin, token } = value;
      const pin = String(rawPin).trim();
      try {
        const session = await GameSession.findOne({ where: { pin } });
        if (!session) return;
        const hostId = SessionTokenService.verifyHostToken(token);
        if (!hostId || session.hostId !== hostId) return socket.emit('error', 'Unauthorized');
        await handleEndQuestion(pin, { source: 'host' });
      } catch (err) {
        console.error('end_question error:', err);
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
          return socket.emit('error', result.error);
        }
        socket.emit('answer_confirmed', { streak: result.streak, score: result.score, points: result.points });
        io.to(pin).emit('answer_received', { nickname });
        io.to('host_' + pin).emit('answer_received_host', { answerIndex, nickname });
      } catch (err) {
        console.error('Error in submit_answer:', err);
      }
    });

    socket.on('change_mode', async (payload) => {
      const { error, value } = validateSocketPayload('change_mode', payload);
      if (error) return;
      const { pin: rawPin, token, mode } = value;
      const pin = String(rawPin).trim();
      try {
        const session = await GameSession.findOne({ where: { pin } });
        if (!session) return;
        const hostId = SessionTokenService.verifyHostToken(token);
        if (!hostId || session.hostId !== hostId) return socket.emit('error', 'Unauthorized');
        session.gameMode = mode;
        await session.save({ fields: ['gameMode'] });
        io.to(pin).emit('room_info', session);
      } catch (err) {
        console.error('change_mode error:', err);
      }
    });

    socket.on('end_game', async (payload) => {
      const { error, value } = validateSocketPayload('end_game', payload);
      if (error) return;
      const { pin: rawPin, token } = value;
      const pin = String(rawPin).trim();
      try {
        const session = await GameSession.findOne({ where: { pin } });
        if (!session) return;
        const hostId = SessionTokenService.verifyHostToken(token);
        if (!hostId || session.hostId !== hostId) return socket.emit('error', 'Unauthorized');
        clearQuestionEndTimer(pin);
        clearCountdownTicks(pin);
        session.status = 'finished';
        await session.save({ fields: ['status'] });
        const players = await Player.findAll({ where: { sessionId: session.id }, order: [['score', 'DESC']] });
        const podium = players.map((p) => ({ id: p.id, nickname: p.nickname, score: p.score, avatar: p.avatar }));
        io.to(pin).emit('game_finished', { players: podium, podium });
        io.to(pin).emit('game_over', { podium, players: podium });
      } catch (err) {
        console.error('end_game error:', err);
      }
    });

    socket.on('leave_session', async (payload) => {
      const { error, value } = validateSocketPayload('leave_session', payload || {});
      if (error) return;
      const pin = String(value.pin || (socket.data && socket.data.pin) || '').trim();
      if (!pin) return;
      const role = value.role || (socket.data && socket.data.role);
      try {
        const session = await GameSession.findOne({ where: { pin }, include: [{ model: Player, as: 'players' }] });
        if (!session) return;
        if (role === 'player') {
          const nickname = value.nickname || (socket.data && socket.data.nickname);
          if (nickname) {
            const leftPlayer = await Player.findOne({ where: { sessionId: session.id, nickname } });
            if (leftPlayer) await leftPlayer.destroy();
          }
          const refreshed = await GameSession.findOne({ where: { pin }, include: [{ model: Player, as: 'players' }] });
          io.to(pin).emit('player_left', {
            nickname,
            reason: 'left',
            players: refreshed ? refreshed.players : []
          });
          socket.leave(pin);
          socket.data = {};
        } else if (role === 'host') {
          clearHostDisconnectTimer(pin);
          clearQuestionEndTimer(pin);
          clearCountdownTicks(pin);
          const hostId = SessionTokenService.verifyHostToken(value.token);
          if (hostId && session.hostId === hostId) {
            session.status = 'finished';
            await session.save({ fields: ['status'] });
            io.to(pin).emit('host_left', { reason: 'aborted', message: 'Host aborted the session' });
          }
          socket.leave(pin);
          socket.data = {};
        }
      } catch (err) {
        console.error('leave_session error:', err);
      }
    });

    socket.on('send_reaction', (payload) => {
      const { error, value } = validateSocketPayload('send_reaction', payload || {});
      if (error) return;
      const pin = String(value.pin).trim();
      io.to(pin).emit('reaction', { emoji: value.emoji, from: (socket.data && socket.data.nickname) || 'player' });
    });

    socket.on('disconnect', async () => {
      const { pin, nickname, role } = socket.data || {};
      if (!pin) return;

      if (role === 'player' && nickname) {
        try {
          const session = await GameSession.findOne({ where: { pin }, include: [{ model: Player, as: 'players' }] });
          if (!session) return;
          const player = session.players.find((p) => p.nickname === nickname);
          if (!player) return;

          const graceMs = Number(process.env.PLAYER_DISCONNECT_GRACE_MS) || 45000;
          setTimeout(async () => {
            try {
              const still = await Player.findByPk(player.id);
              if (!still) return;
              if (still.socketId && still.socketId !== socket.id) return;
              still.socketId = null;
              await still.save();
              const refreshed = await GameSession.findOne({ where: { pin }, include: [{ model: Player, as: 'players' }] });
              if (refreshed) {
                io.to(pin).emit('player_left', {
                  nickname: still.nickname,
                  reason: 'disconnect',
                  temporary: true,
                  players: refreshed.players
                });
              }
            } catch (e) {
              console.error('player disconnect grace error:', e);
            }
          }, graceMs);
        } catch (err) {
          console.error('Error in disconnect cleanup:', err);
        }
      } else if (role === 'host' && pin) {
        io.to(pin).emit('host_disconnected');
        clearHostDisconnectTimer(pin);
        const handle = setTimeout(() => {
          hostDisconnectTimers.delete(pin);
          io.to(pin).emit('host_left', { reason: 'timeout', message: 'Host did not reconnect — session ended for players' });
        }, HOST_DISCONNECT_GRACE_MS);
        hostDisconnectTimers.set(pin, handle);
      }
    });
  });
};
