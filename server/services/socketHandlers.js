const crypto = require('crypto');
const { Op } = require('sequelize');
const { GameSession, Player } = require('../models/GameSession');
const { Quiz, Question } = require('../models/Quiz');
const { sequelize } = require('../config/database');
const AnswerSubmissionService = require('./AnswerSubmissionService');
const SessionTokenService = require('./SessionTokenService');
const SessionRecoveryService = require('./SessionRecoveryService');
const HostLeaseService = require('./HostLeaseService');
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

function hostPlayerView(player) {
  const raw = typeof player.toJSON === 'function' ? player.toJSON() : player;
  return {
    id: raw.id,
    nickname: raw.nickname,
    teamName: raw.teamName || null,
    score: Number(raw.score || 0),
    streak: Number(raw.streak || 0),
    avatar: raw.avatar || null,
    socketId: raw.socketId || null,
    connected: !!raw.socketId
  };
}

function publicPlayerView(player) {
  const raw = typeof player.toJSON === 'function' ? player.toJSON() : player;
  return {
    id: raw.id,
    nickname: raw.nickname,
    teamName: raw.teamName || null,
    score: Number(raw.score || 0),
    avatar: raw.avatar || null,
    connected: !!raw.socketId
  };
}

const questionEndTimers = new Map();
function clearQuestionEndTimer(pin) {
  const handle = questionEndTimers.get(pin);
  if (handle) {
    clearTimeout(handle);
    questionEndTimers.delete(pin);
  }
}

const COUNTDOWN_MS = 3000;
const countdownTickTimers = new Map();
function clearCountdownTicks(pin) {
  const handles = countdownTickTimers.get(pin);
  if (handles) {
    for (const handle of handles) clearTimeout(handle);
    countdownTickTimers.delete(pin);
  }
}

function scheduleCountdownTicks(io, pin, startMs, questionIndex) {
  clearCountdownTicks(pin);
  const handles = [];
  const base = { startTime: startMs, index: questionIndex, serverTime: Date.now() };
  try { io.to(pin).emit('countdown_tick', { ...base, value: 3 }); } catch (_) {}

  for (const value of [2, 1, 0]) {
    const fireAt = startMs - (value * 1000);
    const delay = Math.max(0, fireAt - Date.now());
    const handle = setTimeout(() => {
      try {
        io.to(pin).emit('countdown_tick', {
          value,
          startTime: startMs,
          index: questionIndex,
          serverTime: Date.now()
        });
      } catch (_) {}
    }, delay);
    handles.push(handle);
  }
  countdownTickTimers.set(pin, handles);
}

const hostDisconnectTimers = new Map();
const HOST_DISCONNECT_GRACE_MS = Number(process.env.HOST_DISCONNECT_GRACE_MS) || 45000;
function clearHostDisconnectTimer(pin) {
  const handle = hostDisconnectTimers.get(pin);
  if (handle) {
    clearTimeout(handle);
    hostDisconnectTimers.delete(pin);
  }
}

// Small in-memory abuse guard. Identity-sensitive events are still authorized
// independently; this only limits accidental/spam bursts on a single socket.
const rateBuckets = new Map();
function allowSocketAction(socket, action, limit, windowMs) {
  const key = `${socket.id}:${action}`;
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= windowMs) {
    bucket = { startedAt: now, count: 0, lastSeen: now };
  }
  bucket.count += 1;
  bucket.lastSeen = now;
  rateBuckets.set(key, bucket);

  if (rateBuckets.size > 5000) {
    for (const [bucketKey, value] of rateBuckets.entries()) {
      if (now - value.lastSeen > 5 * 60 * 1000) rateBuckets.delete(bucketKey);
    }
  }
  return bucket.count <= limit;
}

module.exports = (io) => {
  const getHostPlayers = async (sessionId) => {
    const players = await Player.findAll({ where: { sessionId }, order: [['id', 'ASC']] });
    return players.map(hostPlayerView);
  };

  const getPublicPlayers = async (sessionId) => {
    const players = await Player.findAll({ where: { sessionId }, order: [['id', 'ASC']] });
    return players.map(publicPlayerView);
  };

  const emitPresence = async (pin, sessionId, eventName = 'player_joined', extra = {}) => {
    const hostPlayers = await getHostPlayers(sessionId);
    const publicPlayers = hostPlayers.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      teamName: p.teamName,
      score: p.score,
      avatar: p.avatar,
      connected: p.connected
    }));

    io.to(`host_${pin}`).emit(eventName, eventName === 'player_left'
      ? { ...extra, players: hostPlayers }
      : hostPlayers);

    // Players never need socket ids or per-question answer metadata.
    try {
      io.to(pin).except(`host_${pin}`).emit(eventName, eventName === 'player_left'
        ? { ...extra, players: publicPlayers }
        : publicPlayers);
    } catch (_) {}
  };

  const acquireHostControl = async (socket, session, hostId) => {
    let lease = await HostLeaseService.acquireOrRenew({
      sessionId: session.id,
      ownerId: socket.id,
      force: true
    });

    if (!lease.ok && lease.code === 'LEASE_HELD' && lease.hostLeaseOwner) {
      // If the former socket is gone (normal reconnect / process-local stale
      // lease), reclaim immediately rather than blocking the host for the TTL.
      const formerSocket = io.sockets.sockets.get(String(lease.hostLeaseOwner));
      if (!formerSocket || !formerSocket.connected) {
        await HostLeaseService.release({
          sessionId: session.id,
          ownerId: lease.hostLeaseOwner,
          force: true
        });
        lease = await HostLeaseService.acquireOrRenew({
          sessionId: session.id,
          ownerId: socket.id,
          force: true
        });
      }
    }

    if (!lease.ok) return lease;
    socket.data = {
      ...(socket.data || {}),
      pin: session.pin,
      role: 'host',
      hostId,
      sessionId: session.id,
      hostLeaseOwner: socket.id
    };
    return lease;
  };

  const authorizeHostControl = async (socket, session, token) => {
    const hostId = SessionTokenService.verifyHostToken(token);
    if (!hostId || Number(session.hostId) !== Number(hostId)) {
      return { ok: false, code: 'UNAUTHORIZED' };
    }
    if (socket.data && socket.data.role && socket.data.role !== 'host') {
      return { ok: false, code: 'UNAUTHORIZED' };
    }
    if (socket.data && socket.data.pin && String(socket.data.pin) !== String(session.pin)) {
      return { ok: false, code: 'UNAUTHORIZED' };
    }
    const lease = await acquireHostControl(socket, session, hostId);
    if (!lease.ok) return lease;
    return { ok: true, hostId, lease };
  };

  const handleEndQuestion = async (pin, opts = {}) => {
    clearQuestionEndTimer(pin);
    clearCountdownTicks(pin);

    let transition;
    try {
      transition = await sequelize.transaction(async (t) => {
        const session = await GameSession.findOne({
          where: { pin },
          transaction: t,
          lock: t.LOCK.UPDATE
        });
        if (!session || session.status !== 'question') {
          return { applied: false, session };
        }

        session.status = 'result';
        session.state = 'ANSWER_REVEAL';
        session.stateVersion = Number(session.stateVersion || 0) + 1;
        session.stateEnteredAt = new Date();
        await session.save({
          transaction: t,
          fields: ['status', 'state', 'stateVersion', 'stateEnteredAt']
        });
        return { applied: true, session };
      });

      if (!transition || !transition.applied || !transition.session) return false;
      const session = transition.session;

      const quiz = await Quiz.findByPk(session.quizId, {
        include: [{ model: Question, as: 'questions' }],
        order: [[{ model: Question, as: 'questions' }, 'id', 'ASC']]
      });
      const allPlayers = await Player.findAll({ where: { sessionId: session.id } });

      // Personal results go only to that player's current socket. A disconnected
      // player receives the same result through session recovery on reconnect.
      for (const player of allPlayers) {
        const payload = {
          correct: !!player.lastAnswerCorrect,
          score: Number(player.score || 0),
          answered: player.lastAnswerIndex !== -1,
          nickname: player.nickname,
          lastAnswerIndex: player.lastAnswerIndex,
          index: session.currentQuestionIndex
        };
        try {
          if (player.socketId) io.to(player.socketId).emit('question_result', payload);
        } catch (_) {}
      }

      let leaderboard = [];
      try {
        const rows = await Player.findAll({
          where: { sessionId: session.id },
          order: [['score', 'DESC'], ['id', 'ASC']],
          limit: 5,
          attributes: ['id', 'nickname', 'score', 'avatar']
        });
        leaderboard = rows.map((p) => ({
          id: p.id,
          nickname: p.nickname,
          score: Number(p.score || 0),
          avatar: p.avatar || null
        }));
      } catch (_) {}

      const qIndex = session.currentQuestionIndex;
      const currentQuestion = quiz && Array.isArray(quiz.questions)
        ? quiz.questions[qIndex]
        : null;
      const optionsList = parseOptions(currentQuestion ? currentQuestion.options : null);
      const distribution = optionsList.map(
        (_, index) => allPlayers.filter((p) => Number(p.lastAnswerIndex) === index).length
      );

      let teamStandings = [];
      if (session.gameMode === 'team') {
        try {
          const teamScores = await Player.findAll({
            where: {
              sessionId: session.id,
              teamName: { [Op.ne]: null }
            },
            attributes: ['teamName', [sequelize.fn('SUM', sequelize.col('score')), 'totalScore']],
            group: ['teamName'],
            order: [[sequelize.literal('"totalScore"'), 'DESC']]
          });
          teamStandings = teamScores.map((row) => ({
            teamName: row.teamName,
            score: parseInt(row.get('totalScore'), 10) || 0
          }));
        } catch (_) {}
      }

      io.to(pin).emit('question_ended', {
        leaderboard,
        teamStandings,
        correctIndex: currentQuestion != null ? currentQuestion.correctIndex : null,
        distribution,
        answersCount: allPlayers.filter((p) => p.lastAnswerIndex !== -1).length,
        index: qIndex,
        status: 'result',
        state: 'ANSWER_REVEAL',
        stateVersion: Number(session.stateVersion || 0)
      });
      logDiag('end_question_emitted', pin, 'ANSWER_REVEAL', {
        source: opts.source || 'client',
        index: qIndex,
        stateVersion: Number(session.stateVersion || 0)
      });
      return true;
    } catch (err) {
      console.error('Error in handleEndQuestion:', err);
      return false;
    }
  };

  const scheduleQuestionEnd = (pin, closeMs) => {
    clearQuestionEndTimer(pin);
    const delay = Math.max(50, Number(closeMs) + 100 - Date.now());
    const handle = setTimeout(() => {
      questionEndTimers.delete(pin);
      handleEndQuestion(pin, { source: 'server_timer' }).catch((err) => {
        console.error('[server_auto_end_question] failed', pin, err.message);
      });
    }, delay);
    questionEndTimers.set(pin, handle);
  };

  const recoverActiveQuestionTimers = async () => {
    try {
      const sessions = await GameSession.findAll({ where: { status: 'question' } });
      for (const session of sessions) {
        const quiz = await Quiz.findByPk(session.quizId, {
          include: [{ model: Question, as: 'questions' }],
          order: [[{ model: Question, as: 'questions' }, 'id', 'ASC']]
        });
        const question = quiz && Array.isArray(quiz.questions)
          ? quiz.questions[session.currentQuestionIndex]
          : null;
        const startMs = session.questionStartTime
          ? new Date(session.questionStartTime).getTime()
          : NaN;
        if (!question || !Number.isFinite(startMs)) continue;

        const timerMs = Math.max(1, Number(question.timer) || 20) * 1000;
        const persistedClose = session.questionClosesAt
          ? new Date(session.questionClosesAt).getTime()
          : NaN;
        const closeMs = Number.isFinite(persistedClose) ? persistedClose : startMs + timerMs;

        // Repair legacy/V2 drift for sessions created before this hardening.
        const needsRepair = session.state !== 'QUESTION_OPEN'
          || !session.questionOpensAt
          || !session.questionClosesAt;
        if (needsRepair) {
          session.state = 'QUESTION_OPEN';
          session.questionOpensAt = new Date(startMs);
          session.questionClosesAt = new Date(closeMs);
          session.stateEnteredAt = session.stateEnteredAt || new Date();
          await session.save({
            fields: ['state', 'questionOpensAt', 'questionClosesAt', 'stateEnteredAt']
          });
        }

        if (Date.now() >= closeMs) {
          await handleEndQuestion(session.pin, { source: 'startup_recovery' });
        } else {
          if (Date.now() < startMs) {
            scheduleCountdownTicks(io, session.pin, startMs, session.currentQuestionIndex);
          }
          scheduleQuestionEnd(session.pin, closeMs);
        }
      }
    } catch (err) {
      console.error('[live_quiz_timer_recovery] failed:', err.message);
    }
  };

  const recoverHandle = setTimeout(() => {
    recoverActiveQuestionTimers().catch(() => {});
  }, 0);
  if (recoverHandle.unref) recoverHandle.unref();

  io.on('connection', (socket) => {
    console.log('New connection:', socket.id);
    let hostLeaseRenewTimer = null;

    const stopHostLeaseHeartbeat = () => {
      if (hostLeaseRenewTimer) {
        clearInterval(hostLeaseRenewTimer);
        hostLeaseRenewTimer = null;
      }
    };

    const startHostLeaseHeartbeat = (sessionId) => {
      stopHostLeaseHeartbeat();
      const ttl = HostLeaseService.defaultTtlMs();
      const intervalMs = Math.max(5000, Math.floor(ttl / 3));
      hostLeaseRenewTimer = setInterval(async () => {
        try {
          const result = await HostLeaseService.acquireOrRenew({
            sessionId,
            ownerId: socket.id,
            force: true
          });
          if (!result.ok) {
            stopHostLeaseHeartbeat();
            socket.emit('host_control_lost', { code: result.code || 'LEASE_LOST' });
          }
        } catch (_) {}
      }, intervalMs);
      if (hostLeaseRenewTimer.unref) hostLeaseRenewTimer.unref();
    };

    socket.on('join_room', async (payload) => {
      if (!allowSocketAction(socket, 'join_room', 20, 10000)) {
        return socket.emit('error', 'Too many join attempts. Please wait a moment.');
      }

      const { error, value } = validateSocketPayload('join_room', payload);
      if (error) return socket.emit('error', `Validation Error: ${error.details[0].message}`);
      const { pin: rawPin, nickname, role, avatar, token, teamName, playerProfileToken } = value;
      const pin = String(rawPin).trim();
      const cleanNickname = nickname ? String(nickname).replace(/<[^>]*>?/gm, '').trim() : '';

      try {
        const session = await GameSession.findOne({ where: { pin } });
        if (!session) return socket.emit('error', 'Game not found');
        if (session.status === 'finished' && role !== 'host') {
          return socket.emit('error', 'Game is already finished');
        }

        if (role === 'player') {
          if (!cleanNickname) return socket.emit('error', 'Nickname required');

          let player = null;
          let decodedToken = null;
          if (token) {
            decodedToken = SessionTokenService.verifyPlayerToken(token);
            if (
              decodedToken
              && Number(decodedToken.sessionId) === Number(session.id)
              && String(decodedToken.nickname) === cleanNickname
            ) {
              player = await Player.findOne({
                where: {
                  sessionId: session.id,
                  id: Number(decodedToken.playerId)
                }
              });
              if (!player) {
                player = await Player.findOne({
                  where: { sessionId: session.id, nickname: cleanNickname }
                });
              }
            }
          }

          try {
            let playerProfileId = null;
            if (playerProfileToken) {
              const profileClaims = SessionTokenService.verifyPlayerToken(playerProfileToken);
              if (profileClaims && profileClaims.playerId != null) {
                playerProfileId = profileClaims.playerId;
              }
            }

            if (player) {
              player.socketId = socket.id;
              if (avatar) player.avatar = avatar;
              if (teamName) player.teamName = teamName;
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
                avatar: avatar || 'default'
              });
            }
          } catch (dbErr) {
            if (dbErr.name === 'SequelizeUniqueConstraintError') {
              return socket.emit('error', 'That name is already taken');
            }
            throw dbErr;
          }

          const playerToken = SessionTokenService.generatePlayerToken(
            session.id,
            player.id,
            cleanNickname
          );
          socket.join(pin);
          socket.data = {
            ...(socket.data || {}),
            pin,
            nickname: cleanNickname,
            role: 'player',
            playerId: player.id,
            sessionId: session.id
          };

          await emitPresence(pin, session.id, 'player_joined');
          socket.emit('joined_successfully', {
            pin,
            nickname: cleanNickname,
            sessionId: session.id,
            token: playerToken
          });

          if (session.status === 'question' || session.status === 'result') {
            const liveSession = await GameSession.findByPk(session.id);
            const quiz = await Quiz.findByPk(session.quizId, {
              include: [{ model: Question, as: 'questions' }],
              order: [[{ model: Question, as: 'questions' }, 'id', 'ASC']]
            });
            socket.emit(
              'session_info',
              SessionRecoveryService.buildPlayerRecoveryState(liveSession, player, quiz)
            );
          }
          return;
        }

        if (role === 'host') {
          const hostId = SessionTokenService.verifyHostToken(token);
          if (!hostId || Number(session.hostId) !== Number(hostId)) {
            return socket.emit('error', 'Unauthorized: Invalid host token');
          }

          const lease = await acquireHostControl(socket, session, hostId);
          if (!lease.ok) {
            socket.emit('host_control_denied', {
              code: lease.code || 'LEASE_HELD',
              message: 'This session is already controlled in another host tab or device.'
            });
            return socket.emit('error', 'Host session is already controlled in another tab or device');
          }

          socket.join(pin);
          socket.join(`host_${pin}`);
          clearHostDisconnectTimer(pin);
          startHostLeaseHeartbeat(session.id);
          io.to(pin).emit('host_reconnected');

          const liveSession = await GameSession.findByPk(session.id, {
            include: [{ model: Player, as: 'players' }]
          });
          if (liveSession && Array.isArray(liveSession.players)) {
            liveSession.setDataValue('players', liveSession.players.map(hostPlayerView));
          }

          if (liveSession.status === 'question' || liveSession.status === 'result') {
            const quiz = await Quiz.findByPk(liveSession.quizId, {
              include: [{ model: Question, as: 'questions' }],
              order: [[{ model: Question, as: 'questions' }, 'id', 'ASC']]
            });
            socket.emit('room_info', SessionRecoveryService.buildHostRecoveryState(liveSession, quiz));
          } else {
            const roomInfo = liveSession.toJSON();
            roomInfo.players = await getHostPlayers(liveSession.id);
            socket.emit('room_info', roomInfo);
          }
          return;
        }

        if (role === 'player_check') {
          return socket.emit('room_info', {
            pin: session.pin,
            status: session.status,
            gameMode: session.gameMode,
            joinable: session.status === 'lobby'
          });
        }
      } catch (err) {
        console.error('Socket Join Error:', err);
        socket.emit('error', 'Server error');
      }
    });

    socket.on('start_question', async (payload) => {
      if (!allowSocketAction(socket, 'start_question', 8, 5000)) {
        return socket.emit('error', 'Too many start requests');
      }
      const { error, value } = validateSocketPayload('start_question', payload);
      if (error) return socket.emit('error', `Validation Error: ${error.details[0].message}`);
      const { pin: rawPin, token } = value;
      const pin = String(rawPin).trim();

      try {
        const initialSession = await GameSession.findOne({ where: { pin } });
        if (!initialSession) return socket.emit('error', 'Game not found');
        const authorization = await authorizeHostControl(socket, initialSession, token);
        if (!authorization.ok) {
          return socket.emit('error', 'Unauthorized: Host control is held by another connection');
        }

        const quiz = await Quiz.findByPk(initialSession.quizId, {
          include: [{ model: Question, as: 'questions' }],
          order: [[{ model: Question, as: 'questions' }, 'id', 'ASC']]
        });
        if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
          return socket.emit('error', 'Quiz has no questions');
        }

        const activePlayers = await Player.count({
          where: {
            sessionId: initialSession.id,
            socketId: { [Op.ne]: null }
          }
        });
        if (activePlayers < 1) {
          return socket.emit('error', 'At least one active player is required to start');
        }

        const transition = await sequelize.transaction(async (t) => {
          const session = await GameSession.findOne({
            where: { pin },
            transaction: t,
            lock: t.LOCK.UPDATE
          });
          if (!session) return { error: 'Game not found' };
          if (session.status === 'question') return { error: 'Question already in progress' };
          if (session.status === 'finished') return { error: 'Game is already finished' };

          const nextIndex = Number(session.currentQuestionIndex || -1) + 1;
          if (nextIndex >= quiz.questions.length) return { error: 'No more questions' };

          const question = quiz.questions[nextIndex];
          const timerSeconds = Math.max(1, Number(question.timer) || 20);
          const startMs = Date.now() + COUNTDOWN_MS;
          const closeMs = startMs + (timerSeconds * 1000);

          session.currentQuestionIndex = nextIndex;
          session.status = 'question';
          session.questionStartTime = new Date(startMs);
          session.state = 'QUESTION_OPEN';
          session.stateVersion = Number(session.stateVersion || 0) + 1;
          session.stateEnteredAt = new Date();
          session.questionOpensAt = new Date(startMs);
          session.questionClosesAt = new Date(closeMs);
          session.lastErrorCode = null;
          await session.save({
            transaction: t,
            fields: [
              'currentQuestionIndex',
              'status',
              'questionStartTime',
              'state',
              'stateVersion',
              'stateEnteredAt',
              'questionOpensAt',
              'questionClosesAt',
              'lastErrorCode'
            ]
          });

          await Player.update(
            { lastAnswerCorrect: false, lastAnswerTime: 0, lastAnswerIndex: -1 },
            { where: { sessionId: session.id }, transaction: t }
          );

          return {
            sessionId: session.id,
            stateVersion: Number(session.stateVersion || 0),
            nextIndex,
            startMs,
            closeMs,
            question,
            timerSeconds
          };
        });

        if (transition.error) return socket.emit('error', transition.error);
        clearQuestionEndTimer(pin);
        clearCountdownTicks(pin);

        const questionData = {
          questionText: transition.question.questionText,
          options: transition.question.options,
          timer: transition.timerSeconds,
          explanation: transition.question.explanation,
          image: transition.question.image,
          index: transition.nextIndex,
          totalQuestions: quiz.questions.length,
          startTime: transition.startMs,
          questionClosesAt: transition.closeMs,
          serverTime: Date.now(),
          countdown: 3,
          countdownMs: COUNTDOWN_MS,
          stateVersion: transition.stateVersion
        };
        io.to(pin).emit('question_started', questionData);
        scheduleCountdownTicks(io, pin, transition.startMs, transition.nextIndex);
        scheduleQuestionEnd(pin, transition.closeMs);
        logDiag('start_question_emitted', pin, 'QUESTION_OPEN', {
          index: transition.nextIndex,
          startMs: transition.startMs,
          closeMs: transition.closeMs,
          stateVersion: transition.stateVersion
        });
      } catch (err) {
        console.error('Error in start_question:', err);
        try { socket.emit('error', 'Failed to start question'); } catch (_) {}
      }
    });

    socket.on('end_question', async (payload) => {
      const { error, value } = validateSocketPayload('end_question', payload);
      if (error) return socket.emit('error', `Validation Error: ${error.details[0].message}`);
      const pin = String(value.pin).trim();
      try {
        const session = await GameSession.findOne({ where: { pin } });
        if (!session) return;
        const authorization = await authorizeHostControl(socket, session, value.token);
        if (!authorization.ok) return socket.emit('error', 'Unauthorized');
        await handleEndQuestion(pin, { source: 'host' });
      } catch (err) {
        console.error('end_question error:', err);
      }
    });

    socket.on('submit_answer', async (payload) => {
      if (!allowSocketAction(socket, 'submit_answer', 6, 3000)) {
        return socket.emit('error', 'Too many answer attempts');
      }
      const { error, value } = validateSocketPayload('submit_answer', payload);
      if (error) return socket.emit('error', `Validation Error: ${error.details[0].message}`);
      const pin = String(value.pin).trim();

      try {
        const bound = socket.data || {};
        if (
          bound.role !== 'player'
          || !bound.playerId
          || String(bound.pin || '') !== pin
        ) {
          return socket.emit('error', 'Unauthorized: Join the session before answering');
        }

        if (value.token) {
          const claims = SessionTokenService.verifyPlayerToken(value.token);
          if (
            !claims
            || Number(claims.playerId) !== Number(bound.playerId)
            || Number(claims.sessionId) !== Number(bound.sessionId)
          ) {
            return socket.emit('error', 'Unauthorized: Invalid player token');
          }
        }

        const result = await AnswerSubmissionService.submitAnswer(
          pin,
          { playerId: bound.playerId, nickname: bound.nickname },
          value.answerIndex
        );
        if (result.error) return socket.emit('error', result.error);

        socket.emit('answer_confirmed', {
          streak: result.streak,
          score: result.score,
          points: result.points,
          serverTimeRemaining: result.serverTimeRemaining
        });
        io.to(`host_${pin}`).emit('answer_received', { nickname: result.nickname });
        io.to(`host_${pin}`).emit('answer_received_host', {
          answerIndex: value.answerIndex,
          nickname: result.nickname,
          playerId: result.playerId
        });
      } catch (err) {
        console.error('Error in submit_answer:', err);
        socket.emit('error', 'Failed to submit answer');
      }
    });

    socket.on('change_mode', async (payload) => {
      const { error, value } = validateSocketPayload('change_mode', payload);
      if (error) return socket.emit('error', `Validation Error: ${error.details[0].message}`);
      const pin = String(value.pin).trim();
      try {
        const session = await GameSession.findOne({ where: { pin } });
        if (!session) return;
        const authorization = await authorizeHostControl(socket, session, value.token);
        if (!authorization.ok) return socket.emit('error', 'Unauthorized');
        if (session.status !== 'lobby') {
          return socket.emit('error', 'Game mode can only be changed in the lobby');
        }
        session.gameMode = value.mode;
        await session.save({ fields: ['gameMode'] });
        const roomInfo = session.toJSON();
        roomInfo.players = await getHostPlayers(session.id);
        io.to(`host_${pin}`).emit('room_info', roomInfo);
      } catch (err) {
        console.error('change_mode error:', err);
      }
    });

    socket.on('end_game', async (payload) => {
      const { error, value } = validateSocketPayload('end_game', payload);
      if (error) return socket.emit('error', `Validation Error: ${error.details[0].message}`);
      const pin = String(value.pin).trim();
      try {
        const initialSession = await GameSession.findOne({ where: { pin } });
        if (!initialSession) return;
        const authorization = await authorizeHostControl(socket, initialSession, value.token);
        if (!authorization.ok) return socket.emit('error', 'Unauthorized');

        clearQuestionEndTimer(pin);
        clearCountdownTicks(pin);

        const session = await sequelize.transaction(async (t) => {
          const locked = await GameSession.findOne({
            where: { pin },
            transaction: t,
            lock: t.LOCK.UPDATE
          });
          if (!locked) return null;
          if (locked.status !== 'finished') {
            locked.status = 'finished';
            locked.state = 'FINISHED';
            locked.stateVersion = Number(locked.stateVersion || 0) + 1;
            locked.stateEnteredAt = new Date();
            locked.lastErrorCode = null;
            await locked.save({
              transaction: t,
              fields: ['status', 'state', 'stateVersion', 'stateEnteredAt', 'lastErrorCode']
            });
          }
          return locked;
        });
        if (!session) return;

        const players = await Player.findAll({
          where: { sessionId: session.id },
          order: [['score', 'DESC'], ['id', 'ASC']]
        });
        const podium = players.map((p) => ({
          id: p.id,
          nickname: p.nickname,
          score: Number(p.score || 0),
          avatar: p.avatar || null
        }));
        io.to(pin).emit('game_finished', { players: podium, podium });
        io.to(pin).emit('game_over', { podium, players: podium });
      } catch (err) {
        console.error('end_game error:', err);
      }
    });

    socket.on('leave_session', async (payload) => {
      const { error, value } = validateSocketPayload('leave_session', payload || {});
      if (error) return socket.emit('error', `Validation Error: ${error.details[0].message}`);
      const pin = String(value.pin || (socket.data && socket.data.pin) || '').trim();
      if (!pin) return;
      const role = value.role || (socket.data && socket.data.role);

      try {
        const session = await GameSession.findOne({ where: { pin } });
        if (!session) return;

        if (role === 'player') {
          let playerId = socket.data && socket.data.role === 'player'
            ? socket.data.playerId
            : null;
          if (!playerId && value.token) {
            const claims = SessionTokenService.verifyPlayerToken(value.token);
            if (claims && Number(claims.sessionId) === Number(session.id)) {
              playerId = claims.playerId;
            }
          }
          if (!playerId) return socket.emit('error', 'Unauthorized: Player identity required');

          const player = await Player.findOne({
            where: { id: Number(playerId), sessionId: session.id }
          });
          if (!player) return;

          // Preserve the Player and PlayerAnswer rows for reports. Leaving only
          // clears presence; a valid player token can reconnect later.
          if (!player.socketId || player.socketId === socket.id) {
            player.socketId = null;
            await player.save({ fields: ['socketId'] });
          }
          socket.leave(pin);
          await emitPresence(pin, session.id, 'player_left', {
            nickname: player.nickname,
            reason: 'left',
            temporary: false
          });
          socket.data = {};
          return;
        }

        if (role === 'host') {
          const authorization = await authorizeHostControl(socket, session, value.token);
          if (!authorization.ok) return socket.emit('error', 'Unauthorized');

          clearHostDisconnectTimer(pin);
          clearQuestionEndTimer(pin);
          clearCountdownTicks(pin);
          stopHostLeaseHeartbeat();

          await sequelize.transaction(async (t) => {
            const locked = await GameSession.findByPk(session.id, {
              transaction: t,
              lock: t.LOCK.UPDATE
            });
            if (!locked || locked.status === 'finished') return;
            locked.status = 'finished';
            locked.state = 'CANCELLED';
            locked.stateVersion = Number(locked.stateVersion || 0) + 1;
            locked.stateEnteredAt = new Date();
            locked.lastErrorCode = 'HOST_ABORTED';
            await locked.save({
              transaction: t,
              fields: ['status', 'state', 'stateVersion', 'stateEnteredAt', 'lastErrorCode']
            });
          });

          await HostLeaseService.release({
            sessionId: session.id,
            ownerId: socket.id,
            force: true
          });
          io.to(pin).emit('host_left', {
            reason: 'aborted',
            message: 'Host aborted the session'
          });
          socket.leave(pin);
          socket.leave(`host_${pin}`);
          socket.data = {};
        }
      } catch (err) {
        console.error('leave_session error:', err);
      }
    });

    socket.on('send_reaction', (payload) => {
      if (!allowSocketAction(socket, 'send_reaction', 8, 5000)) return;
      const { error, value } = validateSocketPayload('send_reaction', payload || {});
      if (error) return;
      const pin = String(value.pin).trim();
      const bound = socket.data || {};
      if (!bound.pin || String(bound.pin) !== pin || !['player', 'host'].includes(bound.role)) return;

      const reaction = {
        id: crypto.randomUUID(),
        emoji: value.emoji,
        from: bound.nickname || 'host'
      };
      // `new_reaction` is the current client contract. Keep `reaction` briefly
      // for older clients during rolling deployments.
      io.to(pin).emit('new_reaction', reaction);
      io.to(pin).emit('reaction', reaction);
    });

    socket.on('disconnect', async () => {
      stopHostLeaseHeartbeat();
      const { pin, nickname, role, playerId, sessionId } = socket.data || {};
      if (!pin) return;

      if (role === 'player' && playerId) {
        try {
          const graceMs = Number(process.env.PLAYER_DISCONNECT_GRACE_MS) || 45000;
          const handle = setTimeout(async () => {
            try {
              const player = await Player.findOne({
                where: { id: Number(playerId), sessionId: Number(sessionId) }
              });
              if (!player) return;
              if (player.socketId && player.socketId !== socket.id) return;
              player.socketId = null;
              await player.save({ fields: ['socketId'] });
              await emitPresence(pin, Number(sessionId), 'player_left', {
                nickname: player.nickname || nickname,
                reason: 'disconnect',
                temporary: true
              });
            } catch (err) {
              console.error('player disconnect grace error:', err);
            }
          }, graceMs);
          if (handle.unref) handle.unref();
        } catch (err) {
          console.error('Error in disconnect cleanup:', err);
        }
        return;
      }

      if (role === 'host' && sessionId) {
        try {
          await HostLeaseService.release({
            sessionId: Number(sessionId),
            ownerId: socket.id,
            force: true
          });
        } catch (_) {}

        // If another authorized host socket is still in the room, do not tell
        // players the host vanished. In the normal lease path there is one host,
        // but this also protects rolling deployments / duplicate join events.
        const remainingHosts = io.sockets.adapter.rooms.get(`host_${pin}`);
        if (remainingHosts && remainingHosts.size > 0) return;

        io.to(pin).emit('host_disconnected');
        clearHostDisconnectTimer(pin);
        const handle = setTimeout(async () => {
          hostDisconnectTimers.delete(pin);
          try {
            const currentHosts = io.sockets.adapter.rooms.get(`host_${pin}`);
            if (currentHosts && currentHosts.size > 0) return;

            const session = await sequelize.transaction(async (t) => {
              const locked = await GameSession.findByPk(Number(sessionId), {
                transaction: t,
                lock: t.LOCK.UPDATE
              });
              if (!locked || locked.status === 'finished') return locked;
              locked.status = 'finished';
              locked.state = 'CANCELLED';
              locked.stateVersion = Number(locked.stateVersion || 0) + 1;
              locked.stateEnteredAt = new Date();
              locked.lastErrorCode = 'HOST_TIMEOUT';
              await locked.save({
                transaction: t,
                fields: ['status', 'state', 'stateVersion', 'stateEnteredAt', 'lastErrorCode']
              });
              return locked;
            });

            clearQuestionEndTimer(pin);
            clearCountdownTicks(pin);
            if (session && session.status === 'finished') {
              io.to(pin).emit('host_left', {
                reason: 'timeout',
                message: 'Host did not reconnect — session ended for players'
              });
            }
          } catch (err) {
            console.error('host disconnect timeout error:', err);
          }
        }, HOST_DISCONNECT_GRACE_MS);
        hostDisconnectTimers.set(pin, handle);
        if (handle.unref) handle.unref();
      }
    });
  });
};
