const { SessionStateMachine } = require('./SessionStateMachine');

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

function resolveCanonicalState(session) {
    const legacyState = SessionStateMachine.fromLegacyStatus(session.status);
    if (!session.state || !SessionStateMachine.isValidState(session.state)) {
        return legacyState;
    }

    // During the legacy/V2 migration a non-null default `LOBBY` could coexist
    // with status=question/result. Prefer the value that agrees with the
    // persisted legacy status instead of returning a contradictory recovery.
    const stateLegacyStatus = SessionStateMachine.toLegacyStatus(session.state);
    if (stateLegacyStatus !== session.status) {
        return legacyState;
    }
    return session.state;
}

function publicFinalStandings(session) {
    const raw = typeof session.toJSON === 'function' ? session.toJSON() : { ...session };
    const players = Array.isArray(raw.players) ? raw.players : [];
    return [...players]
        .sort((a, b) => {
            const scoreDelta = Number(b.score || 0) - Number(a.score || 0);
            if (scoreDelta !== 0) return scoreDelta;
            return Number(a.id || 0) - Number(b.id || 0);
        })
        .map((player) => ({
            id: player.id,
            nickname: player.nickname,
            score: Number(player.score || 0),
            avatar: player.avatar || null,
            teamName: player.teamName || null
        }));
}

/**
 * Pure service for generating session recovery payloads.
 * Strictly read-only state reconstruction, decoupled from Socket.IO emission.
 */
class SessionRecoveryService {
    static buildQuestionPayload(session, quiz, serverTime = Date.now(), includeCorrect = false) {
        const questions = quiz && Array.isArray(quiz.questions) ? quiz.questions : [];
        const currentQuestion = questions[session.currentQuestionIndex];
        if (!currentQuestion) return null;

        const startTime = session.questionStartTime
            ? new Date(session.questionStartTime).getTime()
            : serverTime;
        const payload = {
            questionText: currentQuestion.questionText,
            options: currentQuestion.options,
            timer: currentQuestion.timer,
            explanation: currentQuestion.explanation,
            image: currentQuestion.image,
            index: session.currentQuestionIndex,
            totalQuestions: questions.length,
            startTime
        };
        if (includeCorrect) payload.correctIndex = currentQuestion.correctIndex;
        return payload;
    }

    /**
     * Builds the recovery payload for a player. Player-safe: the correct answer
     * is not exposed until the result state.
     */
    static buildPlayerRecoveryState(session, player, quiz, serverTime = Date.now()) {
        const question = this.buildQuestionPayload(session, quiz, serverTime, false);
        const timerSeconds = question ? Math.max(1, Number(question.timer) || 20) : 0;
        const startTime = question ? question.startTime : serverTime;
        const persistedClose = session.questionClosesAt
            ? new Date(session.questionClosesAt).getTime()
            : NaN;
        const closesAt = Number.isFinite(persistedClose)
            ? persistedClose
            : startTime + (timerSeconds * 1000);
        const timeLeft = session.status === 'question' && question
            ? Math.max(0, Math.ceil((closesAt - serverTime) / 1000))
            : 0;

        const stateData = {
            status: session.status,
            state: resolveCanonicalState(session),
            stateVersion: Number(session.stateVersion || 0),
            currentQuestionIndex: session.currentQuestionIndex,
            totalQuestions: quiz && Array.isArray(quiz.questions) ? quiz.questions.length : 0,
            // `question` is the historical socket contract. `currentQuestion` is
            // the client-friendly alias used by PlayerGame. Keep both until all
            // deployed clients have converged.
            question,
            currentQuestion: question,
            serverTime,
            questionClosesAt: question ? closesAt : null,
            score: Number(player.score || 0),
            streak: Number(player.streak || 0),
            lastAnswerIndex: player.lastAnswerIndex,
            answered: player.lastAnswerIndex !== -1,
            timeLeft,
            gameMode: session.gameMode
        };

        if (session.status === 'result') {
            const questions = quiz && Array.isArray(quiz.questions) ? quiz.questions : [];
            const currentQuestion = questions[session.currentQuestionIndex];
            stateData.result = {
                correct: !!player.lastAnswerCorrect,
                score: Number(player.score || 0),
                answered: player.lastAnswerIndex !== -1,
                nickname: player.nickname,
                lastAnswerIndex: player.lastAnswerIndex,
                correctIndex: currentQuestion ? currentQuestion.correctIndex : -1,
                leaderboard: []
            };
        }

        if (session.status === 'finished' && resolveCanonicalState(session) === 'FINISHED') {
            stateData.players = publicFinalStandings(session);
            stateData.podium = stateData.players.slice(0, 3);
        }

        return stateData;
    }

    /** Builds the recovery payload for a host. */
    static buildHostRecoveryState(session, quiz, serverTime = Date.now()) {
        const currentQuestion = this.buildQuestionPayload(session, quiz, serverTime, true);
        const raw = typeof session.toJSON === 'function' ? session.toJSON() : { ...session };
        const players = Array.isArray(raw.players) ? raw.players : [];
        const answeredPlayers = players.filter((p) => Number(p.lastAnswerIndex) >= 0);
        const options = currentQuestion ? parseOptions(currentQuestion.options) : [];
        const answerDistribution = options.map(
            (_, index) => answeredPlayers.filter((p) => Number(p.lastAnswerIndex) === index).length
        );

        return {
            ...raw,
            state: resolveCanonicalState(session),
            currentQuestion,
            serverTime,
            answersCount: answeredPlayers.length,
            answerDistribution,
            playersCount: players.length
        };
    }

    /**
     * Canonical Phase 2 recovery envelope (REST).
     * Role-specific; never leaks pre-reveal answers to players.
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

        const state = resolveCanonicalState(session);
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
                    totalQuestions: quiz.questions ? quiz.questions.length : 0,
                    answersCount: hostPayload.answersCount,
                    answerDistribution: hostPayload.answerDistribution,
                    playersCount: hostPayload.playersCount,
                    hostLeaseOwner: session.hostLeaseOwner || null,
                    hostLeaseExpiresAt: session.hostLeaseExpiresAt
                        ? new Date(session.hostLeaseExpiresAt).getTime()
                        : null
                }
            };
        }

        const playerPayload = this.buildPlayerRecoveryState(session, player, quiz, serverTime);
        if (playerPayload.question && Object.prototype.hasOwnProperty.call(playerPayload.question, 'correctIndex')) {
            delete playerPayload.question.correctIndex;
        }
        if (playerPayload.currentQuestion && Object.prototype.hasOwnProperty.call(playerPayload.currentQuestion, 'correctIndex')) {
            delete playerPayload.currentQuestion.correctIndex;
        }

        return {
            ...base,
            payload: {
                playerId: player.id,
                nickname: player.nickname,
                score: playerPayload.score,
                streak: playerPayload.streak,
                lastAnswerIndex: playerPayload.lastAnswerIndex,
                answered: playerPayload.answered,
                timeLeft: playerPayload.timeLeft,
                question: playerPayload.question,
                currentQuestion: playerPayload.currentQuestion,
                result: playerPayload.result || null,
                // A normally FINISHED session may expose only public podium data.
                // CANCELLED sessions intentionally omit standings and are
                // distinguished by state/lastErrorCode in the envelope.
                players: state === 'FINISHED' ? (playerPayload.players || []) : [],
                podium: state === 'FINISHED' ? (playerPayload.podium || []) : []
            }
        };
    }
}

module.exports = SessionRecoveryService;
