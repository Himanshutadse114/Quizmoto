const { GameSession, Player, PlayerAnswer } = require('../models/GameSession');
const { Quiz, Question } = require('../models/Quiz');
const ScoringService = require('./ScoringService');
const { sequelize } = require('../config/database');

class AnswerSubmissionService {
    /**
     * Processes an answer submission atomically.
     * @param {string} pin - The game session pin.
     * @param {string} nickname - The player's nickname.
     * @param {number} answerIndex - The chosen answer index.
     * @param {number} serverTimeRemaining - The pre-calculated time remaining in seconds.
     * @returns {Promise<Object>} An object containing updated player stats or an error string.
     */
    static async submitAnswer(pin, nickname, answerIndex) {
        // Find session
        const session = await GameSession.findOne({ where: { pin } });
        if (!session || session.status !== 'question') {
            return { error: 'Invalid session state' };
        }

        // Calculate time remaining based on server time
        const startTime = new Date(session.questionStartTime).getTime();
        const now = Date.now();
        if (now < startTime) {
            return { error: 'Question has not started yet' };
        }

        // Find Quiz and Question
        const quiz = await Quiz.findByPk(session.quizId, {
            include: [{ model: Question, as: 'questions' }],
            order: [[{ model: Question, as: 'questions' }, 'id', 'ASC']]
        });
        const question = quiz.questions[session.currentQuestionIndex];
        const serverTimeRemaining = Math.max(0, question.timer - Math.floor((now - startTime) / 1000));

        // Validate answer index
        const optionsCount = (typeof question.options === 'string' ? JSON.parse(question.options) : question.options).length;
        if (answerIndex < 0 || answerIndex >= optionsCount) {
            return { error: 'Invalid answer index' };
        }

        const isCorrect = Number(answerIndex) === Number(question.correctIndex);
        const timeTaken = Math.max(0, question.timer - serverTimeRemaining);

        // Transaction to prevent duplicate submissions via race conditions
        const result = await sequelize.transaction(async (t) => {
            // Find player with an exclusive row lock
            const player = await Player.findOne({
                where: { sessionId: session.id, nickname },
                lock: t.LOCK.UPDATE,
                transaction: t
            });

            if (!player) {
                return { error: 'Player not found' };
            }

            if (player.lastAnswerIndex !== -1) {
                return { error: 'Answer already submitted' };
            }

            // Calculate business logic
            const reward = ScoringService.calculateReward(serverTimeRemaining, player.streak, isCorrect);

            // Update player
            player.streak = reward.streak;
            player.score = sequelize.literal(`score + ${reward.points}`);
            player.lastAnswerCorrect = isCorrect;
            player.lastAnswerTime = serverTimeRemaining;
            player.lastAnswerIndex = answerIndex;
            await player.save({ transaction: t });

            // Insert analytics record
            await PlayerAnswer.create({
                sessionId: session.id,
                playerId: player.id,
                questionIndex: session.currentQuestionIndex,
                answerIndex: answerIndex,
                isCorrect: isCorrect,
                timeTaken: timeTaken
            }, { transaction: t });

            // Fetch the freshly updated score (since literal was used, we need to reload it)
            // Wait, save() with literal might not update the instance. We can just return the reward points, 
            // and the caller can reload the player if needed, or we just reload it here.
            await player.reload({ transaction: t });

            return {
                success: true,
                points: reward.points,
                streak: player.streak,
                score: player.score
            };
        });

        return result;
    }
}

module.exports = AnswerSubmissionService;
