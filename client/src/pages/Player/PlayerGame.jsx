import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Flame, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import ReactionBar from '../../components/ReactionBar';
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
        setQuestion(data);
        setLastAnswer(-1);
        lastAnswerRef.current = -1;
        setResult(null);
        resultRef.current = null;
        setPointsWon(0);
        const delay = data.startTime - syncedNow;
        if (delay > 0) {
            setGameState('countdown');
            setCountdown(Math.min(3, Math.max(1, Math.ceil(delay / 1000))));
        } else {
            setGameState('question');
            const elapsed = Math.floor((syncedNow - data.startTime) / 1000);
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

        socket.on('question_ended', (data) => {
            if (resultRef.current) setGameState('result');
            else setGameState('submitted');
        });

        socket.on('question_result', (data) => {
            setResult(data);
            resultRef.current = data;
            setGameState('result');
            if (data.correct) {
                try {
                    confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 } });
                } catch (_) {}
            }
        });

        socket.on('session_info', (data) => {
            try {
                if (data.status === 'question' && data.currentQuestion) {
                    applyQuestion({
                        ...data.currentQuestion,
                        startTime: data.currentQuestion.startTime || Date.now(),
                        timer: data.currentQuestion.timer || 20,
                        index: data.currentQuestionIndex ?? data.currentQuestion.index,
                        totalQuestions: data.totalQuestions
                    });
                } else if (data.status === 'result' && data.result) {
                    setResult(data.result);
                    resultRef.current = data.result;
                    setGameState('result');
                } else if (data.status === 'lobby') {
                    skipLeaveRef.current = true;
                    navigate('/player/lobby');
                }
            } catch (err) {
                console.error('session_info error', err);
            }
        });

        socket.on('game_finished', (data) => {
            const finalPlayers = Array.isArray(data) ? data : (data.players || []);
            setLeaderboard(finalPlayers);
            setTeamStandings(data.teamStandings || []);
            setGameState('finished');
            try {
                confetti({ particleCount: 120, spread: 60, origin: { y: 0.6 } });
            } catch (_) {}
        });

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
            if (msg === 'Game not found' || msg === 'Game is already finished' || msg === 'Unauthorized Host Entry') {
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
                        token: info2.token
                    });
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const onPageHide = () => {
            if (!skipLeaveRef.current) leaveSession({ clearStorage: true });
        };
        window.addEventListener('pagehide', onPageHide);
        window.addEventListener('beforeunload', onPageHide);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', onPageHide);
            window.removeEventListener('beforeunload', onPageHide);
            socket.off('question_started');
            socket.off('question_ended');
            socket.off('question_result');
            socket.off('game_finished');
            socket.off('session_info');
            socket.off('answer_confirmed');
            socket.off('host_disconnected');
            socket.off('host_reconnected');
            socket.off('host_left');
            socket.off('error');
            if (timerRef.current) clearInterval(timerRef.current);
            try { audio.stopAll(); } catch (_) {}
            if (!skipLeaveRef.current) leaveSession({ clearStorage: true });
        };
    }, [socket, navigate, leaveSession, applyQuestion]);

    useEffect(() => {
        if (gameState !== 'countdown' || !question) return;
        const tick = () => {
            const now = Date.now() + offsetRef.current;
            const delay = question.startTime - now;
            if (delay <= 0) {
                setGameState('question');
                setTimeLeft(question.timer || 20);
            } else {
                setCountdown(Math.min(3, Math.max(1, Math.ceil(delay / 1000))));
            }
        };
        tick();
        const interval = setInterval(tick, 50);
        return () => clearInterval(interval);
    }, [gameState, question]);

    useEffect(() => {
        if (gameState !== 'question' || !question) return;
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
                        className="flex-1 flex flex-col items-center justify-center">
                        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
                        <p className="font-bold text-white/70">Answer locked in…</p>
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
                        ) : (
                            <XCircle className="w-20 h-20 text-quizmoto-red mb-4" />
                        )}
                        <h2 className="text-3xl font-black mb-2">{result.correct ? 'Correct!' : 'Wrong'}</h2>
                        <p className="text-white/60 font-bold mb-2">Score: {result.score}</p>
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
                        <div className="flex justify-between items-center pt-2 pb-4">
                            <div>
                                <h1 className="text-2xl font-black italic leading-none">GAME OVER!</h1>
                                <p className="text-xs font-bold opacity-70 uppercase tracking-widest">Final Standing</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    skipLeaveRef.current = true;
                                    try { localStorage.removeItem('player_info'); } catch (_) {}
                                    if (localStorage.getItem('playerToken')) navigate('/player/dashboard');
                                    else navigate('/');
                                }}
                                className="px-4 py-2 rounded-xl bg-white text-quizmoto-purple text-xs font-black"
                            >
                                Done
                            </button>
                        </div>

                        {leaderboard.length > 0 && (
                            <div className="flex items-end justify-center gap-2 mb-6 px-2">
                                {[1, 0, 2].map((podiumIdx) => {
                                    const p = leaderboard[podiumIdx];
                                    if (!p) return <div key={podiumIdx} className="w-24" />;
                                    const heights = ['h-28', 'h-36', 'h-20'];
                                    const medals = ['🥈', '🥇', '🥉'];
                                    return (
                                        <div key={podiumIdx} className="flex flex-col items-center w-24">
                                            <div className="text-2xl mb-1">{medals[podiumIdx]}</div>
                                            <div className="text-xs font-black truncate w-full text-center mb-1">{p.nickname}</div>
                                            <div className="text-quizmoto-yellow font-black text-sm mb-1">{p.score}</div>
                                            <div className={'w-full rounded-t-xl bg-white/20 ' + heights[podiumIdx]} />
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="space-y-2 pb-6">
                            {leaderboard.slice(0, 10).map((p, i) => (
                                <div key={p.nickname || i} className="flex items-center gap-3 bg-white/10 rounded-2xl px-4 py-3">
                                    <span className="font-black text-white/40 w-6">{i + 1}</span>
                                    <span className="font-black flex-1 truncate">{p.nickname}</span>
                                    <span className="font-black text-quizmoto-yellow">{p.score}</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-auto pt-2 pb-4 flex justify-center">
                            <ReactionBar pin={playerInfo?.pin} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PlayerGame;
