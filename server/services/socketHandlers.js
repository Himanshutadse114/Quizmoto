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
function scheduleCountdownTicks(io, pin, startMs) {
  clearCountdownTicks(pin);
  const handles = [];
  // Emit 3 immediately, then 2 @ T-2s, 1 @ T-1s, 0 @ T (question opens)
  try {
    io.to(pin).emit('countdown_tick', { value: 3, startTime: startMs, serverTime: Date.now() });
  } catch (_) {}
  for (const value of [2, 1, 0]) {
    const fireAt = startMs - value * 1000;
    const delay = Math.max(0, fireAt - Date.now());
    const h = setTimeout(() => {
      try {
        io.to(pin).emit('countdown_tick', { value, startTime: startMs, serverTime: Date.now() });
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

/** Brief network blips must NOT mark the player offline mid-quiz. */
const playerDisconnectTimers = new Map(); // key: `${sessionId}:${playerId}`
const PLAYER_DISCONNECT_GRACE_MS = Number(process.env.PLAYER_DISCONNECT_GRACE_MS) || 45000;
function playerDiscKey(sessionId, playerId) {
  return String(sessionId) + ':' + String(playerId);
}
function clearPlayerDisconnectTimer(sessionId, playerId) {
  const key = playerDiscKey(sessionId, playerId);
  const h = playerDisconnectTimers.get(key);
  if (h) { clearTimeout(h); playerDisconnectTimers.delete(key); }
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

      session.status = 'result';
      await session.save();

      const answers = await PlayerAnswer.findAll({ where: { sessionId: session.id, questionId: session.currentQuestionId } });
      const players = await Player.findAll({ where: { sessionId: session.id } });

      io.to(pin).emit('question_ended', {
        questionId: session.currentQuestionId,
        answers: answers.map((a) => ({
          playerId: a.playerId,
          nickname: players.find((p) => p.id === a.playerId)?.nickname,
          isCorrect: a.isCorrect,
          points: a.points,
          responseTime: a.responseTime
        })),
        leaderboard: players
          .map((p) => ({ id: p.id, nickname: p.nickname, score: p.score, avatar: p.avatar }))
          .sort((a, b) => b.score - a.score)
      });
      logDiag('question_ended', pin, 'result', { questionId: session.currentQuestionId });
    } catch (err) {
      console.error('[handleEndQuestion] failed', pin, err.message);
    }
  };

  const scheduleQuestionEnd = (pin, timeLimitSec) => {
    clearQuestionEndTimer(pin);
    const delay = Math.max(500, (Number(timeLimitSec) || 20) * 1000 + 200);
    const handle = setTimeout(() => {
      handleEndQuestion(pin).catch((err) => {
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
          if (!player) {
            player = session.players.find((p) => p.nickname.toLowerCase() === cleanNickname.toLowerCase());
          }
          if (player) {
            clearPlayerDisconnectTimer(session.id, player.id);
            player.socketId = socket.id;
            if (avatar) player.avatar = avatar;
            await player.save();
          } else {
            if (session.status !== 'lobby') return socket.emit('error', 'Game already started');
            player = await Player.create({
              sessionId: session.id,
              nickname: cleanNickname,
              avatar: avatar || 'default',
              socketId: socket.id,
              score: 0,
              teamName: teamName || null
            });
          }
          socket.join(pin);
          socket.data.pin = pin;
          socket.data.role = 'player';
          socket.data.playerId = player.id;
          socket.data.nickname = player.nickname;

          const playerToken = SessionTokenService.signPlayerToken({
            sessionId: session.id,
            playerId: player.id,
            nickname: player.nickname,
            pin
          });

          const refreshed = await GameSession.findOne({ where: { pin }, include: [{ model: Player, as: 'players' }] });
          socket.emit('joined_room', {
            role: 'player',
            pin,
            player: { id: player.id, nickname: player.nickname, avatar: player.avatar, score: player.score },
            token: playerToken,
            session: {
              status: refreshed.status,
              currentQuestionIndex: refreshed.currentQuestionIndex,
              hostSocketId: refreshed.hostSocketId
            },
            players: refreshed.players
          });
          io.to(pin).emit('player_joined', refreshed.players);
          clearHostDisconnectTimer(pin);
        } else if (role === 'host') {
          socket.join(pin);
          socket.data.pin = pin;
          socket.data.role = 'host';
          session.hostSocketId = socket.id;
          await session.save();
          clearHostDisconnectTimer(pin);

          const hostToken = SessionTokenService.signHostToken({ sessionId: session.id, pin });
          socket.emit('joined_room', {
            role: 'host',
            pin,
            token: hostToken,
            session: {
              id: session.id,
              status: session.status,
              currentQuestionIndex: session.currentQuestionIndex,
              quizId: session.quizId
            },
            players: session.players
          });
          io.to(pin).emit('host_reconnected');
        }
      } catch (err) {
        console.error('join_room error:', err);
        socket.emit('error', 'Failed to join room');
      }
    });

    socket.on('start_game', async (payload) => {
      const { error, value } = validateSocketPayload('start_game', payload || {});
      if (error) return socket.emit('error', 'Validation Error: ' + error.details[0].message);
      const pin = String(value.pin || socket.data.pin || '').trim();
      if (!pin || socket.data.role !== 'host') return socket.emit('error', 'Unauthorized');

      try {
        const session = await GameSession.findOne({ where: { pin } });
        if (!session) return socket.emit('error', 'Session not found');
        if (session.status !== 'lobby') return socket.emit('error', 'Game already started');

        const quiz = await Quiz.findByPk(session.quizId, { include: [{ model: Question, as: 'questions' }] });
        if (!quiz || !quiz.questions?.length) return socket.emit('error', 'Quiz has no questions');

        const ordered = [...quiz.questions].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
        const first = ordered[0];
        const startMs = Date.now() + COUNTDOWN_MS;

        session.status = 'question';
        session.currentQuestionIndex = 0;
        session.currentQuestionId = first.id;
        session.questionStartedAt = new Date(startMs);
        await session.save();

        const qPayload = {
          questionId: first.id,
          index: 0,
          total: ordered.length,
          text: first.text,
          options: parseOptions(first.options),
          timeLimit: first.timeLimit || 20,
          startTime: startMs,
          serverTime: Date.now()
        };
        io.to(pin).emit('game_started', { startTime: startMs, serverTime: Date.now() });
        io.to(pin).emit('new_question', qPayload);
        scheduleCountdownTicks(io, pin, startMs);
        scheduleQuestionEnd(pin, first.timeLimit || 20);
        logDiag('start_game', pin, 'question', { questionId: first.id });
      } catch (err) {
        console.error('start_game error:', err);
        socket.emit('error', 'Failed to start game');
      }
    });

    socket.on('next_question', async (payload) => {
      const { error, value } = validateSocketPayload('next_question', payload || {});
      if (error) return socket.emit('error', 'Validation Error: ' + error.details[0].message);
      const pin = String(value.pin || socket.data.pin || '').trim();
      if (!pin || socket.data.role !== 'host') return socket.emit('error', 'Unauthorized');

      try {
        const session = await GameSession.findOne({ where: { pin } });
        if (!session) return socket.emit('error', 'Session not found');

        const quiz = await Quiz.findByPk(session.quizId, { include: [{ model: Question, as: 'questions' }] });
        const ordered = [...(quiz?.questions || [])].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
        const nextIndex = (session.currentQuestionIndex || 0) + 1;

        if (nextIndex >= ordered.length) {
          session.status = 'finished';
          await session.save();
          clearQuestionEndTimer(pin);
          clearCountdownTicks(pin);
          const players = await Player.findAll({ where: { sessionId: session.id } });
          const podium = players
            .map((p) => ({ id: p.id, nickname: p.nickname, score: p.score, avatar: p.avatar }))
            .sort((a, b) => b.score - a.score);
          io.to(pin).emit('game_finished', { podium });
          return;
        }

        const q = ordered[nextIndex];
        const startMs = Date.now() + COUNTDOWN_MS;
        session.status = 'question';
        session.currentQuestionIndex = nextIndex;
        session.currentQuestionId = q.id;
        session.questionStartedAt = new Date(startMs);
        await session.save();

        const qPayload = {
          questionId: q.id,
          index: nextIndex,
          total: ordered.length,
          text: q.text,
          options: parseOptions(q.options),
          timeLimit: q.timeLimit || 20,
          startTime: startMs,
          serverTime: Date.now()
        };
        io.to(pin).emit('new_question', qPayload);
        scheduleCountdownTicks(io, pin, startMs);
        scheduleQuestionEnd(pin, q.timeLimit || 20);
      } catch (err) {
        console.error('next_question error:', err);
        socket.emit('error', 'Failed to advance question');
      }
    });

    socket.on('submit_answer', async (payload) => {
      const { error, value } = validateSocketPayload('submit_answer', payload || {});
      if (error) return socket.emit('error', 'Validation Error: ' + error.details[0].message);
      const pin = String(value.pin || socket.data.pin || '').trim();
      if (!pin || socket.data.role !== 'player') return;

      try {
        const result = await AnswerSubmissionService.submit({
          pin,
          playerId: socket.data.playerId,
          questionId: value.questionId,
          selectedOption: value.selectedOption,
          responseTime: value.responseTime
        });
        if (result.ok) {
          socket.emit('answer_result', result);
          const session = await GameSession.findOne({ where: { pin }, include: [{ model: Player, as: 'players' }] });
          if (session) io.to(pin).emit('player_answered', { playerId: socket.data.playerId, nickname: socket.data.nickname, players: session.players });
        } else {
          socket.emit('error', result.message || 'Answer rejected');
        }
      } catch (err) {
        console.error('submit_answer error:', err);
        socket.emit('error', 'Failed to submit answer');
      }
    });

    socket.on('end_question', async (payload) => {
      const pin = String((payload && payload.pin) || socket.data.pin || '').trim();
      if (!pin || socket.data.role !== 'host') return;
      await handleEndQuestion(pin);
    });

    socket.on('leave_session', async (payload) => {
      const { error, value } = validateSocketPayload('leave_session', payload || {});
      if (error) return;
      const pin = String(value.pin || socket.data.pin || '').trim();
      if (!pin) return;

      try {
        const session = await GameSession.findOne({ where: { pin }, include: [{ model: Player, as: 'players' }] });
        if (!session) return;

        if (socket.data.role === 'player' && socket.data.playerId) {
          clearPlayerDisconnectTimer(session.id, socket.data.playerId);
          let leftPlayer = session.players.find((p) => p.id === socket.data.playerId);
          if (!leftPlayer && socket.data.nickname) {
            const nickname = socket.data.nickname;
            leftPlayer = await Player.findOne({ where: { sessionId: session.id, nickname } });
          }
          if (leftPlayer) {
            await leftPlayer.destroy();
          }
          const refreshed = await GameSession.findOne({ where: { pin }, include: [{ model: Player, as: 'players' }] });
          const payloadOut = {
            nickname: socket.data.nickname,
            reason: 'left',
            players: refreshed ? refreshed.players : []
          };
          io.to(pin).emit('player_left', payloadOut);
          socket.leave(pin);
        } else if (socket.data.role === 'host') {
          clearHostDisconnectTimer(pin);
          clearQuestionEndTimer(pin);
          clearCountdownTicks(pin);
          session.status = 'finished';
          await session.save();
          io.to(pin).emit('host_left', { reason: 'aborted', message: 'Host aborted the session' });
          socket.leave(pin);
        }
      } catch (err) {
        console.error('leave_session error:', err);
      }
    });

    socket.on('disconnect', async () => {
      const pin = socket.data.pin;
      const role = socket.data.role;
      if (!pin) return;

      if (role === 'player' && socket.data.playerId) {
        try {
          const session = await GameSession.findOne({ where: { pin }, include: [{ model: Player, as: 'players' }] });
          if (!session) return;
          const player = session.players.find((p) => p.id === socket.data.playerId);
          if (!player) return;

          // Keep socketId until grace expires so host still sees them as active briefly
          clearPlayerDisconnectTimer(session.id, player.id);
          console.log(JSON.stringify({
            module: 'socketHandlers',
            event: 'player_disconnect_grace_start',
            pin,
            playerId: player.id,
            graceMs: PLAYER_DISCONNECT_GRACE_MS
          }));

          const handle = setTimeout(async () => {
            try {
              playerDisconnectTimers.delete(playerDiscKey(session.id, player.id));
              const still = await Player.findByPk(player.id);
              if (!still) return;
              // Only mark offline if they have not reconnected (socketId still this one or null)
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
          }, PLAYER_DISCONNECT_GRACE_MS);
          playerDisconnectTimers.set(playerDiscKey(session.id, player.id), handle);
        } catch (err) {
          console.error('Error in disconnect cleanup:', err);
        }
      } else if (role === 'host' && pin) {
        io.to(pin).emit('host_disconnected');
        clearHostDisconnectTimer(pin);
        const handle = setTimeout(() => {
          hostDisconnectTimers.delete(pin);
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
