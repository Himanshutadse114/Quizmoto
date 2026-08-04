import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { motion } from 'framer-motion';
import AvatarDisplay from '../../components/AvatarDisplay';
import ReactionBar from '../../components/ReactionBar';
import ReactionCanvas from '../../components/ReactionCanvas';

const PlayerGame = () => {
    const socket = useSocket();
    const navigate = useNavigate();
    const [gameState, setGameState] = useState('loading');
    const [question, setQuestion] = useState(null);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [result, setResult] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [teamStandings, setTeamStandings] = useState([]);
    const [streak, setStreak] = useState(0);
    const [pointsWon, setPointsWon] = useState(0);
    const [timer, setTimer] = useState(0);
    const [countdown, setCountdown] = useState(0);
    const [clockOffset, setClockOffset] = useState(0);
    const [isHostDisconnected, setIsHostDisconnected] = useState(false);
    const resultRef = useRef(null);
    const answeredRef = useRef(false);
    /** Skip leave_session on cleanup when we already left or were kicked. */
    const skipLeaveRef = useRef(false);

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

    useEffect(() => {
        const info = JSON.parse(localStorage.getItem('player_info'));
        if (!info) {
            navigate('/join');
            return;
        }
        if (!socket) return;

        skipLeaveRef.current = false;

        socket.emit('join_room', {
            pin: info.pin,
            nickname: info.nickname,
            role: 'player',
            token: info.token,
            avatar: info.avatar
        });

        socket.on('question_started', (data) => {
            const offset = data.serverTime ? data.serverTime - Date.now() : 0;
            setClockOffset(offset);
            const syncedNow = Date.now() + offset;
            setQuestion(data);
            setSelectedAnswer(null);
            setResult(null);
            resultRef.current = null;
            answeredRef.current = false;
            setPointsWon(0);

            const delay = data.startTime - syncedNow;
            if (delay > 0) {
                setGameState('countdown');
                setCountdown(Math.ceil(delay / 1000));
            } else {
                setGameState('question');
                const diff = Math.floor((syncedNow - data.startTime) / 1000);
                setTimer(Math.max(0, data.timer - diff));
            }
        });

        socket.on('question_result', (data) => {
            setResult(data);
            resultRef.current = data;
            setGameState('result');
        });

        socket.on('question_ended', () => {
            if (resultRef.current) setGameState('result');
            else setGameState('waiting');
        });

        socket.on('session_info', (data) => {
            try {
                if (data.status === 'question' && data.currentQuestion) {
                    setQuestion(data.currentQuestion);
                    setGameState('question');
                } else if (data.status === 'result') {
                    if (data.result) {
                        setResult(data.result);
                        resultRef.current = data.result;
                        setGameState('result');
                    }
                } else if (data.status === 'lobby') {
                    skipLeaveRef.current = true;
                    navigate('/player/lobby');
                }
            } catch (err) {
                console.error('Error in session_info handler:', err);
            }
        });

        socket.on('game_finished', (data) => {
            const finalPlayers = Array.isArray(data) ? data : data.players;
            const finalTeams = data.teamStandings || [];
            setLeaderboard(finalPlayers || []);
            setTeamStandings(finalTeams);
            setGameState('finished');
        });

        socket.on('host_disconnected', () => {
            setIsHostDisconnected(true);
        });

        socket.on('host_reconnected', () => {
            setIsHostDisconnected(false);
        });

        socket.on('host_left', (data) => {
            setIsHostDisconnected(false);
            skipLeaveRef.current = true;
            try { localStorage.removeItem('player_info'); } catch (_) {}
            alert((data && data.message) || 'Host aborted the session.');
            navigate('/');
        });

        socket.on('answer_confirmed', (data) => {
            setStreak(data.streak);
            setPointsWon(data.points);
        });

        socket.on('error', (msg) => {
            console.error('Socket error in PlayerGame:', msg);
            if (msg === 'Game not found' || msg === 'Game is already finished' || msg === 'Unauthorized Host Entry') {
                skipLeaveRef.current = true;
                alert(msg);
                try { localStorage.removeItem('player_info'); } catch (_) {}
                navigate('/');
                return;
            }
            setGameState(prev => {
                if (prev === 'loading') {
                    alert('Error: ' + msg);
                    navigate('/');
                }
                return prev;
            });
        });

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && socket.connected) {
                const info2 = JSON.parse(localStorage.getItem('player_info'));
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
            if (!skipLeaveRef.current) {
                leaveSession({ clearStorage: true });
            }
        };
        window.addEventListener('pagehide', onPageHide);
        window.addEventListener('beforeunload', onPageHide);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', onPageHide);
            window.removeEventListener('beforeunload', onPageHide);
            socket.off('question_started');
            socket.off('question_result');
            socket.off('question_ended');
            socket.off('session_info');
            socket.off('game_finished');
            socket.off('host_disconnected');
            socket.off('host_left');
            socket.off('host_reconnected');
            socket.off('answer_confirmed');
            socket.off('error');
            // Browser back / navigate away mid-game → host must see Offline
            if (!skipLeaveRef.current) {
                leaveSession({ clearStorage: true });
            }
        };
    }, [socket, navigate, leaveSession]);

    useEffect(() => {
        if (gameState === 'countdown' && question) {
            const interval = setInterval(() => {
                const now = Date.now() + clockOffset;
                const remaining = Math.ceil((question.startTime - now) / 1000);
                if (remaining <= 0) {
                    setGameState('question');
                    setTimer(question.timer);
                    clearInterval(interval);
                } else setCountdown(remaining);
            }, 100);
            return () => clearInterval(interval);
        }
    }, [gameState, question, clockOffset]);

    useEffect(() => {
        if (gameState !== 'question' || !question) return;
        const interval = setInterval(() => {
            const now = Date.now() + clockOffset;
            const elapsed = Math.floor((now - question.startTime) / 1000);
            setTimer(Math.max(0, question.timer - elapsed));
        }, 200);
        return () => clearInterval(interval);
    }, [gameState, question, clockOffset]);

    const submitAnswer = (index) => {
        if (answeredRef.current || selectedAnswer !== null) return;
        answeredRef.current = true;
        setSelectedAnswer(index);
        const info = JSON.parse(localStorage.getItem('player_info') || '{}');
        socket.emit('submit_answer', {
            pin: info.pin,
            nickname: info.nickname,
            answerIndex: index
        });
        setGameState('waiting');
    };

    const handleLeaveClick = () => {
        skipLeaveRef.current = true;
        leaveSession({ clearStorage: true });
        navigate('/');
    };

    if (isHostDisconnected) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 relative">
                <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
                    <div className="bg-white text-quizmoto-purple p-8 rounded-3xl text-center max-w-sm shadow-2xl">
                        <h2 className="text-2xl font-black mb-4 uppercase tracking-tight">Host Disconnected</h2>
                        <p className="font-bold opacity-80 mb-6">Waiting for the host to reconnect... Don't leave!</p>
                        <div className="w-8 h-8 border-4 border-quizmoto-purple/20 border-t-quizmoto-purple rounded-full animate-spin mx-auto mb-6" />
                        <button
                            type="button"
                            onClick={handleLeaveClick}
                            className="text-sm underline opacity-60 font-black tracking-widest hover:opacity-100"
                        >
                            LEAVE GAME
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (gameState === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    if (gameState === 'countdown') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center">
                <motion.div key={countdown} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-9xl font-black text-white">
                    {countdown}
                </motion.div>
                <p className="text-white/70 text-xl font-medium tracking-widest uppercase mt-4">Get Ready!</p>
            </div>
        );
    }

    if (gameState === 'question' && question) {
        const colors = ['bg-quizmoto-red', 'bg-quizmoto-blue', 'bg-quizmoto-yellow', 'bg-quizmoto-green'];
        const labels = ['A', 'B', 'C', 'D'];
        const options = Array.isArray(question.options)
            ? question.options
            : (() => { try { return JSON.parse(question.options || '[]'); } catch { return []; } })();

        return (
            <div className="min-h-screen p-6 flex flex-col relative z-10">
                <ReactionCanvas />
                <div className="flex justify-between items-center mb-6">
                    <span className="text-sm font-bold text-white/50">Q{(question.index || 0) + 1}/{question.totalQuestions || '?'}</span>
                    <span className="text-lg font-black tabular-nums">{timer}s</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-center mb-8">{question.questionText}</h1>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto w-full">
                    {options.map((opt, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => submitAnswer(idx)}
                            disabled={selectedAnswer !== null}
                            className={colors[idx] + ' text-white p-6 rounded-2xl font-bold text-lg shadow-lg disabled:opacity-60 transition-transform active:scale-95'}
                        >
                            <span className="opacity-70 mr-2">{labels[idx]}</span>
                            {typeof opt === 'string' ? opt : (opt && opt.text) || String(opt)}
                        </button>
                    ))}
                </div>
                <div className="mt-auto pt-8 flex justify-center">
                    <ReactionBar pin={(JSON.parse(localStorage.getItem('player_info') || '{}')).pin} />
                </div>
            </div>
        );
    }

    if (gameState === 'waiting') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6">
                <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
                <p className="font-bold text-white/70">Answer locked in…</p>
            </div>
        );
    }

    if (gameState === 'result' && result) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6">
                <div className={'text-6xl mb-4'}>{result.correct ? '✓' : '✗'}</div>
                <h2 className="text-3xl font-black mb-2">{result.correct ? 'Correct!' : 'Wrong'}</h2>
                <p className="text-white/60 font-bold mb-2">Score: {result.score}</p>
                {pointsWon > 0 && <p className="text-quizmoto-yellow font-black">+{pointsWon}</p>}
                {streak > 1 && <p className="text-sm text-white/50 mt-2">Streak x{streak}</p>}
                <p className="mt-8 text-white/40 text-sm font-bold uppercase tracking-widest">Waiting for next…</p>
            </div>
        );
    }

    if (gameState === 'finished') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6">
                <h1 className="text-4xl font-black mb-8 italic uppercase">Game Over!</h1>
                <div className="space-y-3 w-full max-w-md">
                    {(leaderboard || []).slice(0, 10).map((p, i) => (
                        <div key={p.nickname || i} className="flex items-center gap-3 bg-white/10 rounded-2xl px-5 py-3">
                            <span className="font-black text-white/40 w-8">{i + 1}</span>
                            <AvatarDisplay avatar={p.avatar} imgClass="w-8 h-8" textClass="text-2xl" />
                            <span className="font-black flex-1 truncate">{p.nickname}</span>
                            <span className="font-black text-quizmoto-yellow">{p.score}</span>
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={() => {
                        skipLeaveRef.current = true;
                        try { localStorage.removeItem('player_info'); } catch (_) {}
                        if (localStorage.getItem('playerToken')) navigate('/player/dashboard');
                        else navigate('/');
                    }}
                    className="mt-10 px-8 py-3 rounded-2xl bg-white text-quizmoto-purple font-black"
                >
                    Done
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
            <p className="font-bold text-white/50">Waiting for host…</p>
            <button
                type="button"
                onClick={handleLeaveClick}
                className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/20 text-white/70"
            >
                Leave session
            </button>
        </div>
    );
};

export default PlayerGame;
