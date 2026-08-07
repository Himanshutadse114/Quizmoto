const { SessionStateMachine } = require('./SessionStateMachine');

/**
 * Pure service for generating session recovery payloads.
 * Strictly read-only state reconstruction, decoupled from Socket.IO emission.
 */
class SessionRecoveryService {
    /**
     * Builds the recovery payload for a player.
     * Extracts only the information the player is permitted to see.
     * @param {Object} session - The GameSession model instance
     * @param {Object} player - The Player model instance
     * @param {Object} quiz - The Quiz model instance with questions
     * @param {number} serverTime - The current server time (Date.now())
     * @returns {Object} State data payload
     */
    static buildPlayerRecoveryState(session, player, quiz, serverTime = Date.now()) {
        const currentQuestion = quiz.questions[session.currentQuestionIndex];

        let stateData = {
            status: session.status,
            question: currentQuestion ? {
                questionText: currentQuestion.questionText,
                options: currentQuestion.options,
                timer: currentQuestion.timer,
                explanation: currentQuestion.explanation,
                image: currentQuestion.image,
                index: session.currentQuestionIndex,
                totalQuestions: quiz.questions.length,
                startTime: session.questionStartTime ? session.questionStartTime.getTime() : serverTime
            } : null,
            serverTime,
            score: player.score,
            lastAnswerIndex: player.lastAnswerIndex,
            answered: player.lastAnswerIndex !== -1,
            timeLeft: session.status === 'question' && session.questionStartTime && currentQuestion
                ? Math.max(0, currentQuestion.timer - Math.floor((serverTime - session.questionStartTime.getTime()) / 1000))
                : 0,
            gameMode: session.gameMode
        };

        if (session.status === 'result') {
            stateData.result = {
                correct: player.lastAnswerCorrect,
                score: player.score,
                answered: player.lastAnswerIndex !== -1,
                correctIndex: currentQuestion ? currentQuestion.correctIndex : -1,
                leaderboard: []
            };
        }

        return stateData;
    }

    /**
     * Builds the recovery payload for a host.
     * Includes all information (e.g., correct answer indices).
     * @param {Object} session - The GameSession model instance
     * @param {Object} quiz - The Quiz model instance with questions
     * @param {number} serverTime - The current server time (Date.now())
     * @returns {Object} Room info payload
     */
    static buildHostRecoveryState(session, quiz, serverTime = Date.now()) {
        const currentQuestion = quiz.questions[session.currentQuestionIndex];

        return {
            ...session.toJSON(),
            currentQuestion: currentQuestion ? {
                questionText: currentQuestion.questionText,
                options: currentQuestion.options,
                timer: currentQuestion.timer,
                explanation: currentQuestion.explanation,
                image: currentQuestion.image,
                index: session.currentQuestionIndex,
                totalQuestions: quiz.questions.length,
                correctIndex: currentQuestion.correctIndex, // Host sees correct answer
                startTime: session.questionStartTime ? session.questionStartTime.getTime() : serverTime
            } : null,
            serverTime
        };
    }

    /**
     * Canonical Phase 2 recovery envelope (REST).
     * Role-specific; never leaks pre-reveal answers to players.
     *
     * @param {Object} params
     * @param {'host'|'player'} params.role
     * @param {Object} params.session - GameSession instance
     * @param {Object} params.quiz - Quiz with questions ordered
     * @param {Object} [params.player] - Required when role is player
     * @param {number} [params.serverTime]
     * @returns {Object}
     */
    static buildCanonicalRecovery({ role, session, quiz, player = null, serverTime = Date.now() }) {
        if (role !== 'host' && role !== 'player') {
            const err = new Error('Invalid recovery role');
            err.code = 'INVALID_ROLE';
            throw err;
        }

        if (role === 'player' && !player) {
            const err = new Error('Player required for player recovery');
            err.code = 'PLAYER_REQUIRED';
            throw err;
        }

        const state =
            session.state ||
            SessionStateMachine.fromLegacyStatus(session.status);

        const stateVersion = Number(session.stateVersion || 0);
        const recoverySchemaVersion = Number(session.recoverySchemaVersion || 1);

        const base = {
            schemaVersion: recoverySchemaVersion,
            sessionId: session.id,
            pin: session.pin,
            role,
            status: session.status,
            state,
            stateVersion,
            activeRoundId: session.activeRoundId || null,
            currentQuestionIndex: session.currentQuestionIndex,
            gameMode: session.gameMode || 'classic',
            serverTime,
            questionOpensAt: session.questionOpensAt
                ? new Date(session.questionOpensAt).getTime()
                : null,
            questionClosesAt: session.questionClosesAt
                ? new Date(session.questionClosesAt).getTime()
                : null,
            lastErrorCode: session.lastErrorCode || null
        };

        if (role === 'host') {
            const hostPayload = this.buildHostRecoveryState(session, quiz, serverTime);
            return {
                ...base,
                payload: {
                    hostId: session.hostId,
                    currentQuestion: hostPayload.currentQuestion,
                    // Host-only: full question list metadata without forcing client to re-fetch quiz
                    totalQuestions: quiz.questions ? quiz.questions.length : 0,
                    hostLeaseOwner: session.hostLeaseOwner || null,
                    hostLeaseExpiresAt: session.hostLeaseExpiresAt
                        ? new Date(session.hostLeaseExpiresAt).getTime()
                        : null
                }
            };
        }

        // Player path — reuse existing safe builder
        const playerPayload = this.buildPlayerRecoveryState(session, player, quiz, serverTime);

        // Defense in depth: never attach correctIndex on question object for players
        if (playerPayload.question && Object.prototype.hasOwnProperty.call(playerPayload.question, 'correctIndex')) {
            delete playerPayload.question.correctIndex;
        }

        return {
            ...base,
            payload: {
                playerId: player.id,
                nickname: player.nickname,
                score: playerPayload.score,
                streak: player.streak != null ? player.streak : undefined,
                lastAnswerIndex: playerPayload.lastAnswerIndex,
                answered: playerPayload.answered,
                timeLeft: playerPayload.timeLeft,
                question: playerPayload.question,
                result: playerPayload.result || null
            }
        };
    }
}

module.exports = SessionRecoveryService;
