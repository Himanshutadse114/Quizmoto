const { GameSession, Player, PlayerAnswer } = require('../models/GameSession');
const { Quiz, Question } = require('../models/Quiz');
const ScoringService = require('./ScoringService');
const { sequelize } = require('../config/database');

function parseOptions(raw) {
    try {
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

class AnswerSubmissionService {
    /**
     * Processes an answer submission atomically.
     *
     * `playerIdentity` may be a legacy nickname string for internal/tests, or an
     * object containing `{ playerId, nickname }`. Live socket traffic MUST pass
     * the id derived from the joined socket/player token instead of trusting a
     * nickname supplied by the browser.
     *
     * @param {string} pin
     * @param {string|Object} playerIdentity
     * @param {number} answerIndex
     * @returns {Promise<Object>}
     */
    static async submitAnswer(pin, playerIdentity, answerIndex) {
        return sequelize.transaction(async (t) => {
            const session = await GameSession.findOne({
                where: { pin },
                transaction: t,
                lock: t.LOCK.UPDATE
            });

            if (!session || session.status !== 'question') {
                return { error: 'Invalid session state' };
            }

            const startTime = session.questionStartTime
                ? new Date(session.questionStartTime).getTime()
                : NaN;
            const now = Date.now();

            if (!Number.isFinite(startTime)) {
                return { error: 'Question timing is unavailable' };
            }
            if (now < startTime) {
                return { error: 'Question has not started yet' };
            }

            const quiz = await Quiz.findByPk(session.quizId, {
                include: [{ model: Question, as: 'questions' }],
                order: [[{ model: Question, as: 'questions' }, 'id', 'ASC']],
                transaction: t
            });

            const question = quiz && Array.isArray(quiz.questions)
                ? quiz.questions[session.currentQuestionIndex]
                : null;
            if (!question) {
                return { error: 'Question not found' };
            }

            const timerSeconds = Math.max(1, Number(question.timer) || 20);
            const persistedClose = session.questionClosesAt
                ? new Date(session.questionClosesAt).getTime()
                : NaN;
            const closesAt = Number.isFinite(persistedClose)
                ? persistedClose
                : startTime + (timerSeconds * 1000);

            // The score timer reaching zero is a hard server-side deadline. The
            // delayed UI/end-question broadcast must never extend answerability.
            if (now > closesAt) {
                return { error: 'Answer window has closed' };
            }

            const options = parseOptions(question.options);
            if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
                return { error: 'Invalid answer index' };
            }

            const identity = typeof playerIdentity === 'object' && playerIdentity !== null
                ? playerIdentity
                : { nickname: playerIdentity };
            const where = { sessionId: session.id };
            if (identity.playerId != null) {
                where.id = Number(identity.playerId);
            } else if (identity.nickname) {
                // Legacy/internal fallback. Socket handlers do not use this path.
                where.nickname = String(identity.nickname);
            } else {
                return { error: 'Player identity required' };
            }

            const player = await Player.findOne({
                where,
                transaction: t,
                lock: t.LOCK.UPDATE
            });
            if (!player) {
                return { error: 'Player not found' };
            }

            if (identity.nickname && String(player.nickname) !== String(identity.nickname)) {
                return { error: 'Player identity mismatch' };
            }

            if (player.lastAnswerIndex !== -1) {
                return { error: 'Answer already submitted' };
            }

            // Defense in depth: the DB unique index remains authoritative even if
            // a stale Player row somehow reports lastAnswerIndex=-1.
            const existingAnswer = await PlayerAnswer.findOne({
                where: {
                    sessionId: session.id,
                    playerId: player.id,
                    questionIndex: session.currentQuestionIndex
                },
                transaction: t,
                lock: t.LOCK.UPDATE
            });
            if (existingAnswer) {
                return { error: 'Answer already submitted' };
            }

            const elapsedMs = Math.max(0, now - startTime);
            const serverTimeRemaining = Math.max(
                0,
                timerSeconds - Math.floor(elapsedMs / 1000)
            );
            const isCorrect = Number(answerIndex) === Number(question.correctIndex);
            const timeTaken = Math.max(0, timerSeconds - serverTimeRemaining);
            const reward = ScoringService.calculateReward(
                serverTimeRemaining,
                Number(player.streak || 0),
                isCorrect
            );

            player.streak = reward.streak;
            player.score = Number(player.score || 0) + Number(reward.points || 0);
            player.lastAnswerCorrect = isCorrect;
            player.lastAnswerTime = serverTimeRemaining;
            player.lastAnswerIndex = answerIndex;
            await player.save({ transaction: t });

            await PlayerAnswer.create({
                sessionId: session.id,
                playerId: player.id,
                questionIndex: session.currentQuestionIndex,
                answerIndex,
                isCorrect,
                timeTaken,
                roundId: session.activeRoundId || null
            }, { transaction: t });

            return {
                success: true,
                playerId: player.id,
                nickname: player.nickname,
                points: Number(reward.points || 0),
                streak: Number(player.streak || 0),
                score: Number(player.score || 0),
                serverTimeRemaining,
                closesAt
            };
        });
    }
}

module.exports = AnswerSubmissionService;
