const { expect } = require('chai');
const SessionRecoveryService = require('../services/SessionRecoveryService');

describe('SessionRecoveryService', () => {
    let mockSession;
    let mockQuiz;
    let mockPlayer;
    let serverTime;

    beforeEach(() => {
        serverTime = 100000;
        mockSession = {
            status: 'question',
            currentQuestionIndex: 0,
            questionStartTime: new Date(serverTime - 5000), // 5 seconds ago
            gameMode: 'classic',
            toJSON: () => ({ id: 1, pin: '123456', hostId: 42, status: 'question', gameMode: 'classic' })
        };

        mockQuiz = {
            questions: [
                {
                    questionText: 'What is 2+2?',
                    options: ['3', '4', '5'],
                    timer: 20, // seconds
                    explanation: 'Math',
                    image: null,
                    correctIndex: 1
                }
            ]
        };

        mockPlayer = {
            score: 1500,
            lastAnswerIndex: -1,
            lastAnswerCorrect: false
        };
    });

    it('should build a valid player recovery state during question', () => {
        const state = SessionRecoveryService.buildPlayerRecoveryState(mockSession, mockPlayer, mockQuiz, serverTime);
        expect(state.status).to.equal('question');
        expect(state.score).to.equal(1500);
        expect(state.answered).to.be.false;
        expect(state.timeLeft).to.equal(15); // 20 timer - 5 elapsed
        expect(state.question.questionText).to.equal('What is 2+2?');
        // The player state should NOT leak correctIndex!
        expect(state.question.correctIndex).to.be.undefined;
        expect(state.result).to.be.undefined;
    });

    it('should build a valid player recovery state during result', () => {
        mockSession.status = 'result';
        mockPlayer.lastAnswerIndex = 1;
        mockPlayer.lastAnswerCorrect = true;
        
        const state = SessionRecoveryService.buildPlayerRecoveryState(mockSession, mockPlayer, mockQuiz, serverTime);
        expect(state.status).to.equal('result');
        expect(state.answered).to.be.true;
        expect(state.result).to.not.be.undefined;
        expect(state.result.correct).to.be.true;
        expect(state.result.correctIndex).to.equal(1);
    });

    it('should build a valid host recovery state', () => {
        const state = SessionRecoveryService.buildHostRecoveryState(mockSession, mockQuiz, serverTime);
        expect(state.pin).to.equal('123456');
        expect(state.hostId).to.equal(42);
        // Host state SHOULD contain correctIndex
        expect(state.currentQuestion.correctIndex).to.equal(1);
    });

    it('should handle missing question gracefully', () => {
        mockSession.currentQuestionIndex = 99; // out of bounds
        const pState = SessionRecoveryService.buildPlayerRecoveryState(mockSession, mockPlayer, mockQuiz, serverTime);
        expect(pState.question).to.be.null;

        mockSession.status = 'result';
        const pStateResult = SessionRecoveryService.buildPlayerRecoveryState(mockSession, mockPlayer, mockQuiz, serverTime);
        expect(pStateResult.result.correctIndex).to.equal(-1);

        const hState = SessionRecoveryService.buildHostRecoveryState(mockSession, mockQuiz, serverTime);
        expect(hState.currentQuestion).to.be.null;
    });

    it('should handle missing questionStartTime', () => {
        mockSession.questionStartTime = null;
        const pState = SessionRecoveryService.buildPlayerRecoveryState(mockSession, mockPlayer, mockQuiz, serverTime);
        expect(pState.question.startTime).to.equal(serverTime);
        expect(pState.timeLeft).to.equal(0);

        const hState = SessionRecoveryService.buildHostRecoveryState(mockSession, mockQuiz, serverTime);
        expect(hState.currentQuestion.startTime).to.equal(serverTime);
    });
});
