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
            id: 1,
            pin: '123456',
            hostId: 42,
            status: 'question',
            state: 'QUESTION_OPEN',
            stateVersion: 2,
            currentQuestionIndex: 0,
            questionStartTime: new Date(serverTime - 5000), // 5 seconds ago
            gameMode: 'classic',
            toJSON: () => ({
                id: 1,
                pin: '123456',
                hostId: 42,
                status: mockSession.status,
                state: mockSession.state,
                gameMode: 'classic',
                players: mockSession.players || []
            })
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
            id: 7,
            nickname: 'Player One',
            score: 1500,
            streak: 2,
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
        expect(state.currentQuestion.questionText).to.equal('What is 2+2?');
        // The player state should NOT leak correctIndex!
        expect(state.question.correctIndex).to.be.undefined;
        expect(state.result).to.be.undefined;
    });

    it('should build a valid player recovery state during result', () => {
        mockSession.status = 'result';
        mockSession.state = 'ANSWER_REVEAL';
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

    it('should recover only public final standings for a finished player session', () => {
        mockSession.status = 'finished';
        mockSession.state = 'FINISHED';
        mockSession.players = [
            { id: 2, nickname: 'Second', score: 1000, avatar: 'b', teamName: 'Blue', socketId: 'secret-b', lastAnswerIndex: 1 },
            { id: 1, nickname: 'Winner', score: 2500, avatar: 'a', teamName: 'Red', socketId: 'secret-a', lastAnswerIndex: 0 }
        ];

        const recovery = SessionRecoveryService.buildCanonicalRecovery({
            role: 'player',
            session: mockSession,
            quiz: mockQuiz,
            player: mockPlayer,
            serverTime
        });

        expect(recovery.status).to.equal('finished');
        expect(recovery.state).to.equal('FINISHED');
        expect(recovery.payload.players).to.have.length(2);
        expect(recovery.payload.players[0].nickname).to.equal('Winner');
        expect(recovery.payload.podium[0].nickname).to.equal('Winner');
        expect(recovery.payload.players[0]).to.not.have.property('socketId');
        expect(recovery.payload.players[0]).to.not.have.property('lastAnswerIndex');
    });

    it('should not expose final standings for a cancelled player session', () => {
        mockSession.status = 'finished';
        mockSession.state = 'CANCELLED';
        mockSession.lastErrorCode = 'HOST_TIMEOUT';
        mockSession.players = [{ id: 1, nickname: 'Player', score: 2500, socketId: 'secret' }];

        const recovery = SessionRecoveryService.buildCanonicalRecovery({
            role: 'player',
            session: mockSession,
            quiz: mockQuiz,
            player: mockPlayer,
            serverTime
        });

        expect(recovery.state).to.equal('CANCELLED');
        expect(recovery.payload.players).to.deep.equal([]);
        expect(recovery.payload.podium).to.deep.equal([]);
    });

    it('should handle missing question gracefully', () => {
        mockSession.currentQuestionIndex = 99; // out of bounds
        const pState = SessionRecoveryService.buildPlayerRecoveryState(mockSession, mockPlayer, mockQuiz, serverTime);
        expect(pState.question).to.be.null;

        mockSession.status = 'result';
        mockSession.state = 'ANSWER_REVEAL';
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
