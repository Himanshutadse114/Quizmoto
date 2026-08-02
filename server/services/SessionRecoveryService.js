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
            } : null
        };
    }
}

module.exports = SessionRecoveryService;
