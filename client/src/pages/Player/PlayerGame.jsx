import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, MinusCircle, Flame, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import ReactionBar from '../../components/ReactionBar';
import FinalPodium from '../../components/FinalPodium';
import { audio } from '../../utils/audioEngine';

const PlayerGame = () => {
    const socket = useSocket();
    const navigate = useNavigate();
    const [question, setQuestion] = useState(null);
    const [gameState, setGameState] = useState('loading');
    const [playerInfo, setPlayerInfo] = useState(null);
    const [countdown, setCountdown] = useState(0);
    const [clockOffset, setClockOffset] = useState(0);
    const [result, setResult] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [lastAnswer, setLastAnswer] = useState(-1);
    const [streak, setStreak] = useState(0);
    const [pointsWon, setPointsWon] = useState(0);
    const [leaderboard, setLeaderboard] = useState([]);
    const [teamStandings, setTeamStandings] = useState([]);
    const [viewMode, setViewMode] = useState('players');
    const [isHostDisconnected, setIsHostDisconnected] = useState(false);

    const timerRef = useRef(null);
    const lastAnswerRef = useRef(-1);
    const resultRef = useRef(null);
    const skipLeaveRef = useRef(false);
    const offsetRef = useRef(0);
    const questionIndexRef = useRef(-1);
    const questionStartRef = useRef(0);

    const leaveSession = useCallback((opts = {}) => {
        const clearStorage = opts.clearStorage !== false;
        try {
            const info = JSON.parse(localStorage.getItem('player_info') || '{}');
            if (socket && info.pin) {
                socket.emit('leave_session', {
                    pin: info.pin,
                    role: 'player',
                    nickname: info.nickname,
                    token: info.token
                });
            }
            if (clearStorage) localStorage.removeItem('player_info');
        } catch (_) {}
    }, [socket]);

    const applyQuestion = useCallback((data) => {
        const offset = (data.serverTime != null) ? (data.serverTime - Date.now()) : 0;
        offsetRef.current = offset;
        setClockOffset(offset);
        const syncedNow = Date.now() + offset;
        const startTime = data.startTime || (syncedNow + 3000);
        questionIndexRef.current = data.index != null ? data.index : questionIndexRef.current;
        questionStartRef.current = startTime;
        setQuestion({ ...data, startTime });
        setLastAnswer(-1);
        lastAnswerRef.current = -1;
        setResult(null);
        resultRef.current = null;
        setPointsWon(0);
        setStreak(0);
        const delay = startTime - syncedNow;
        if (delay > 80) {
            setGameState('countdown');
            setCountdown(Math.min(3, Math.max(1, Math.ceil(delay / 1000))));
            setTimeLeft(data.timer || 20);
        } else {
            setGameState('question');
            const elapsed = Math.floor((syncedNow - startTime) / 1000);
            setTimeLeft(Math.max(0, (data.timer || 20) - elapsed));
        }
    }, []);

    useEffect(() => {
        const info = JSON.parse(localStorage.getItem('player_info'));
        if (!info) {
            navigate('/join');
            return;
        }
        setPlayerInfo(info);
        if (!socket) return;

        const recoverFromApi = async () => {
            if (!info.sessionId || !info.token) return false;
            const backendUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
            try {
                const response = await fetch(
                    `${backendUrl}/api/sessions/${encodeURIComponent(info.sessionId)}/recovery?role=player`,
                    { headers: { Authorization: `Bearer ${info.token}` } }
                );
                if (!response.ok) return false;
                const recovery = await response.json();
                const payload = recovery.payload || {};

                if (recovery.state === 'CANCELLED') {
                    skipLeaveRef.current = true;
                    try { localStorage.removeItem('player_info'); } catch (_) {}
                    const reason = recovery.lastErrorCode === 'HOST_TIMEOUT'
                        ? 'Host did not reconnect. The session has ended.'
                        : 'The host ended this session.';
                    alert(reason);
                    navigate('/');
                    return true;
                }

                if (recovery.status === 'finished' && recovery.state === 'FINISHED') {
                    const finalPlayers = payload.players || payload.podium || [];
                    setLeaderboard(finalPlayers);
                    setGameState('finished');
                    setIsHostDisconnected(false);
                    return true;
                }

                if (recovery.status === 'question' && payload.currentQuestion) {
                    const qPayload = {
                        ...payload.currentQuestion,
                        serverTime: recovery.serverTime,
                        startTime: payload.currentQuestion.startTime || recovery.questionOpensAt || Date.now(),
                        timer: payload.currentQuestion.timer || 20,
                        index: recovery.currentQuestionIndex ?? payload.currentQuestion.index,
                        totalQuestions: payload.currentQuestion.totalQuestions
                    };
                    applyQuestion(qPayload);
                    if (payload.answered || (payload.lastAnswerIndex != null && payload.lastAnswerIndex !== -1)) {
                        const idx = payload.lastAnswerIndex != null ? payload.lastAnswerIndex : -1;
                        lastAnswerRef.current = idx;
                        setLastAnswer(idx);
                        setGameState('submitted');
                        if (typeof payload.timeLeft === 'number') setTimeLeft(Math.max(0, payload.timeLeft));
                    }
                    return true;
                }

                if (recovery.status === 'result' && payload.result) {
                    setResult(payload.result);
                    resultRef.current = payload.result;
                    setGameState('result');
                    setTimeLeft(0);
                    return true;
                }

                return false;
            } catch (err) {
                console.error('session recovery failed', err);
                return false;
            }
        };

        socket.emit('join_room', {
            pin: info.pin,
            nickname: info.nickname,
            role: 'player',
            token: info.token,
            avatar: info.avatar
        });

        try {
            const pending = sessionStorage.getItem('pending_question_started');
            if (pending) {
                sessionStorage.removeItem('pending_question_started');
                applyQuestion(JSON.parse(pending));
            }
        } catch (e) {
            console.error('pending question handoff failed', e);
        }

        socket.on('question_started', (data) => {
            applyQuestion(data);
        });

        socket.on('countdown_tick', (data) => {
            if (!data) return;
            if (data.index != null && questionIndexRef.current >= 0 && data.index !== questionIndexRef.current) {
                return;
            }
            if (data.serverTime != null) {
                offsetRef.current = data.serverTime - Date.now();
                setClockOffset(offsetRef.current);
            }
            const v = data.value != null ? Number(data.value) : 0;
            const now = Date.now() + offsetRef.current;
            if (v <= 0) {
                if (data.startTime != null) questionStartRef.current = data.startTime;
                setGameState('question');
                if (data.startTime != null) {
                    setQuestion((prev) => (prev ? { ...prev, startTime: data.startTime } : prev));
                }
            } else {
                if (questionStartRef.current && now >= questionStartRef.current) return;
                setGameState('countdown');
                setCountdown(v);
            }
        });

        socket.on('question_ended', () => {
            if (!resultRef.current) {
                const fallback = {
                    correct: false,
                    answered: lastAnswerRef.current !== -1,
                    score: null,
                    nickname: null
                };
                setResult(fallback);
                resultRef.current = fallback;
            }
            setGameState('result');
            setTimeLeft(0);
        });

        socket.on('question_result', (data) => {
            try {
                const info2 = JSON.parse(localStorage.getItem('player_info') || '{}');
                if (data && data.nickname && info2.nickname && data.nickname !== info2.nickname) {
                    return;
                }
            } catch (_) {}
            setResult(data);
            resultRef.current = data;
            setGameState('result');
            setTimeLeft(0);
            if (data && data.correct) {
                try {
                    confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 } });
                } catch (_) {}
            }
        });

        socket.on('session_info', (data) => {
            try {
                if (data.status === 'question' && data.currentQuestion) {
                    const qPayload = {
                        ...data.currentQuestion,
                        serverTime: data.serverTime,
                        startTime: data.currentQuestion.startTime || Date.now(),
                        timer: data.currentQuestion.timer || 20,
                        index: data.currentQuestionIndex ?? data.currentQuestion.index,
                        totalQuestions: data.totalQuestions
                    };
                    applyQuestion(qPayload);
                    if (data.answered || (data.lastAnswerIndex != null && data.lastAnswerIndex !== -1)) {
                        const idx = data.lastAnswerIndex != null ? data.lastAnswerIndex : -1;
                        lastAnswerRef.current = idx;
                        setLastAnswer(idx);
                        setGameState('submitted');
                        if (typeof data.timeLeft === 'number') setTimeLeft(Math.max(0, data.timeLeft));
                    }
                } else if (data.status === 'result' && data.result) {
                    setResult(data.result);
                    resultRef.current = data.result;
                    setGameState('result');
                } else if (data.status === 'lobby') {
                    skipLeaveRef.current = true;
                    navigate('/player/lobby');
                } else if (data.status === 'finished') {
                    const finalPlayers = data.players || data.podium || [];
                    setLeaderboard(finalPlayers);
                    setGameState('finished');
                }
            } catch (err) {
                console.error('session_info error', err);
            }
        });

        const onGameFinished = (data) => {
            const finalPlayers = Array.isArray(data) ? data : (data.players || data.podium || []);
            setLeaderboard(finalPlayers);
            setTeamStandings((data && data.teamStandings) || []);
            setGameState('finished');
            try {
                confetti({ particleCount: 120, spread: 60, origin: { y: 0.6 } });
            } catch (_) {}
        };
        socket.on('game_finished', onGameFinished);
        socket.on('game_over', onGameFinished);

        socket.on('answer_confirmed', (data) => {
            setStreak(data.streak || 0);
            setPointsWon(data.points || 0);
        });

        socket.on('host_disconnected', () => setIsHostDisconnected(true));
        socket.on('host_reconnected', () => setIsHostDisconnected(false));
        socket.on('host_left', (data) => {
            setIsHostDisconnected(false);
            skipLeaveRef.current = true;
            try { localStorage.removeItem('player_info'); } catch (_) {}
            alert((data && data.message) || 'Host left the session.');
            navigate('/');
        });

        socket.on('error', (msg) => {
            if (msg === 'Game is already finished') {
                recoverFromApi().then((recovered) => {
                    if (!recovered) {
                        skipLeaveRef.current = true;
                        try { localStorage.removeItem('player_info'); } catch (_) {}
                        navigate('/');
                    }
                });
                return;
            }
            if (msg === 'Game not found' || msg === 'Unauthorized Host Entry') {
                skipLeaveRef.current = true;
                alert(msg);
                try { localStorage.removeItem('player_info'); } catch (_) {}
                navigate('/');
            }
        });

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && socket.connected) {
                const info2 = JSON.parse(localStorage.getItem('player_info') || 'null');
                if (info2) {
                    socket.emit('join_room', {
                        pin: info2.pin,
                        nickname: info2.nickname,
                        role: 'player',
                        token: info2.token,
                        avatar: info2.avatar
                    });
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const onPageHide = () => {};
        window.addEventListener('pagehide', onPageHide);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', onPageHide);
            socket.off('question_started');
            socket.off('countdown_tick');
            socket.off('question_ended');
            socket.off('question_result');
            socket.off('game_finished');
            socket.off('game_over');
            socket.off('session_info');
            socket.off('answer_confirmed');
            socket.off('host_disconnected');
            socket.off('host_reconnected');
            socket.off('host_left');
            socket.off('error');
            if (timerRef.current) clearInterval(timerRef.current);
            try { audio.stopAll(); } catch (_) {}
        };
    }, [socket, navigate, leaveSession, applyQuestion]);

    useEffect(() => {
        if (gameState !== 'countdown' || !question) return;
        const tick = () => {
            const now = Date.now() + offsetRef.current;
            const start = questionStartRef.current || question.startTime;
            const delay = start - now;
            if (delay <= 0) {
                setGameState('question');
                setTimeLeft(question.timer || 20);
            } else {
                setCountdown(Math.min(3, Math.max(1, Math.ceil(delay / 1000))));
            }
        };
        tick();
        const interval = setInterval(tick, 100);
        return () => clearInterval(interval);
    }, [gameState, question]);

    useEffect(() => {
        if ((gameState !== 'question' && gameState !== 'submitted') || !question) return;
        const tick = () => {
            const now = Date.now() + offsetRef.current;
            const elapsed = Math.floor((now - question.startTime) / 1000);
            setTimeLeft(Math.max(0, (question.timer || 20) - elapsed));
        };
        tick();
        const interval = setInterval(tick, 100);
        return () => clearInterval(interval);
    }, [gameState, question]);

    useEffect(() => {
        if (gameState === 'question' && timeLeft > 0 && timeLeft <= 5) {
            try { audio.play('tick'); } catch (_) {}
        }
    }, [timeLeft, gameState]);

    const submitAnswer = (idx) => {
        if (gameState !== 'question' || lastAnswerRef.current !== -1) return;
        lastAnswerRef.current = idx;
        setLastAnswer(idx);
        socket.emit('submit_answer', {
            pin: playerInfo.pin,
            nickname: playerInfo.nickname,
            token: playerInfo.token,
            answerIndex: idx
        });
        setGameState('submitted');
    };

    const handleLeave = () => {
        skipLeaveRef.current = true;
        leaveSession({ clearStorage: true });
        navigate('/');
    };

    const options = (() => {
        if (!question) return [];
        if (Array.isArray(question.options)) return question.options;
        try { return JSON.parse(question.options || '[]'); } catch { return []; }
    })();

    const colors = ['bg-quizmoto-red', 'bg-quizmoto-blue', 'bg-quizmoto-yellow', 'bg-quizmoto-green'];

    return (
        <div className="h-screen flex flex-col p-4 bg-quizmoto-purple overflow-hidden fixed inset-0 text-white">
            {isHostDisconnected && (
                <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
                    <div className="bg-white text-quizmoto-purple p-8 rounded-3xl text-center max-w-sm shadow-2xl">
                        <h2 className="text-2xl font-black mb-4 uppercase tracking-tight">Host Disconnected</h2>
                        <p className="font-bold opacity-80 mb-6">Waiting for the host to reconnect...</p>
                        <div className="w-8 h-8 border-4 border-quizmoto-purple/20 border-t-quizmoto-purple rounded-full animate-spin mx-auto mb-6" />
                        <button type="button" onClick={handleLeave} className="text-sm underline opacity-60 font-black tracking-widest">
                            LEAVE GAME
                        </button>
                    </div>
                </div>
            )}

            <AnimatePresence mode="wait">
                {gameState === 'loading' && (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex-1 flex flex-col items-center justify-center">
                        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
                        <p className="font-bold text-white/60 uppercase tracking-widest text-sm">Connecting...</p>
                    </motion.div>
                )}

                {gameState === 'countdown' && (
                    <motion.div key="countdown" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex-1 flex flex-col items-center justify-center">
                        <div className="text-[9rem] leading-none font-black tabular-nums">{countdown}</div>
                        <p className="text-white/70 text-xl font-medium tracking-widest uppercase mt-4">Get Ready!</p>
                    </motion.div>
                )}

                {gameState === 'question' && question && (
                    <motion.div key="question" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex-1 flex flex-col min-h-0">
                        <div className="flex justify-between items-center mb-3 shrink-0">
                            <span className="text-sm font-bold text-white/50">
                                Q{(question.index || 0) + 1}/{question.totalQuestions || '?'}
                            </span>
                            <span className={'text-lg font-black tabular-nums ' + (timeLeft <= 5 ? 'text-quizmoto-yellow' : '')}>
                                {timeLeft}s
                            </span>
                        </div>
                        <h1 className="text-xl md:text-2xl font-bold text-center mb-4 shrink-0 px-2">
                            {question.questionText}
                        </h1>
                        {question.image && (
                            <div className="flex justify-center mb-3 shrink-0">
                                <img src={question.image} alt="" className="max-h-28 rounded-xl object-contain" />
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 md:gap-4 flex-1 pb-4 min-h-0">
                            {options.map((opt, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => submitAnswer(idx)}
                                    disabled={lastAnswer !== -1}
                                    className={
                                        colors[idx % 4] +
                                        ' text-white p-4 md:p-6 rounded-2xl font-black text-xl md:text-3xl shadow-lg disabled:opacity-50 transition-transform active:scale-95 flex items-center justify-center text-center leading-snug'
                                    }
                                >
                                    <span className="w-full text-center">
                                        {typeof opt === 'string' ? opt : (opt && opt.text) || String(opt)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}

                {gameState === 'submitted' && (
                    <motion.div key="submitted" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="flex-1 flex flex-col items-center justify-center px-4">
                        <div className={'text-6xl sm:text-7xl font-black tabular-nums mb-3 ' + (timeLeft <= 5 ? 'text-quizmoto-yellow' : 'text-white')}>
                            {timeLeft}s
                        </div>
                        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
                        <p className="font-black text-white text-lg">Answer locked in</p>
                        <p className="font-bold text-white/50 text-sm mt-1 text-center">
                            Waiting for others — time left on this question
                        </p>
                        {question && (
                            <p className="text-white/30 text-xs font-bold uppercase tracking-widest mt-3">
                                Q{(question.index || 0) + 1}/{question.totalQuestions || '?'}
                            </p>
                        )}
                        <div className="mt-8">
                            <ReactionBar pin={playerInfo?.pin} />
                        </div>
                    </motion.div>
                )}

                {gameState === 'result' && result && (
                    <motion.div key="result" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        className="flex-1 flex flex-col items-center justify-center">
                        {result.correct ? (
                            <CheckCircle className="w-20 h-20 text-quizmoto-green mb-4" />
                        ) : (result.answered === false) ? (
                            <MinusCircle className="w-20 h-20 text-white/50 mb-4" />
                        ) : (
                            <XCircle className="w-20 h-20 text-quizmoto-red mb-4" />
                        )}
                        <h2 className="text-3xl font-black mb-2">
                            {result.correct ? 'Correct!' : (result.answered === false) ? 'Time up' : 'Wrong'}
                        </h2>
                        {result.score != null && <p className="text-white/60 font-bold mb-2">Score: {result.score}</p>}
                        {pointsWon > 0 && (
                            <p className="text-quizmoto-yellow font-black text-xl flex items-center gap-1">
                                <Sparkles className="w-5 h-5" /> +{pointsWon}
                            </p>
                        )}
                        {streak > 1 && (
                            <p className="text-sm text-white/50 mt-2 flex items-center gap-1">
                                <Flame className="w-4 h-4 text-orange-400" /> Streak x{streak}
                            </p>
                        )}
                        <p className="mt-8 text-white/40 text-sm font-bold uppercase tracking-widest">Waiting for next…</p>
                        <div className="mt-6">
                            <ReactionBar pin={playerInfo?.pin} />
                        </div>
                    </motion.div>
                )}

                {gameState === 'finished' && (
                    <motion.div key="finished" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="flex-1 flex flex-col min-h-0 overflow-y-auto">
                        <div className="flex justify-end items-center pt-1 pb-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    skipLeaveRef.current = true;
                                    try { localStorage.removeItem('player_info'); } catch (_) {}
                                    if (localStorage.getItem('playerToken')) navigate('/player/dashboard');
                                    else navigate('/');
                                }}
                                className="px-4 py-2 rounded-xl bg-white text-quizmoto-purple text-xs font-black shadow-lg"
                            >
                                Done
                            </button>
                        </div>

                        <FinalPodium
                            leaderboard={leaderboard}
                            compact
                            highlightNickname={playerInfo?.nickname}
                        />

                        <div className="mt-auto pt-5 pb-4 flex justify-center">
                            <ReactionBar pin={playerInfo?.pin} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PlayerGame;
