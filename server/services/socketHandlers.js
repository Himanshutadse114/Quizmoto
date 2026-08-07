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
  try { io.to(pin).emit('countdown_tick', { value: 3, startTime: startMs, serverTime: Date.now() }); } catch (_) {}
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
      for (const player of allPlayers) {
        try {
          if (player.socketId) {
            io.to(player.socketId).emit('question_result', {
              correct: !!player.lastAnswerCorrect, score: player.score,
              answered: player.lastAnswerIndex !== -1, nickname: player.nickname
            });
          }
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
        distribution
      });
      logDiag('end_question_emitted', pin, 'result', { source: opts.source || 'client' });
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
              player = await Player.findOne({ where: { sessionId: session.id, nickname: cleanNickname });
            }
          }
