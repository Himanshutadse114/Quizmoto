import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Flame, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import ReactionBar from '../../components/ReactionBar';

const PlayerGame = () => {
    const socket = useSocket();
    const navigate = useNavigate();
    const [question, setQuestion] = useState(null);
    const [gameState, setGameState] = useState('loading'); // 'loading', 'question', 'submitted', 'result', 'finished', 'countdown'
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
    const [viewMode, setViewMode] = useState('players'); // 'players' or 'teams'
    const [isHostDisconnected, setIsHostDisconnected] = useState(false);

    const timerRef = useRef(null);
    const lastAnswerRef = useRef(-1);
    const resultRef = useRef(null);

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
            token: info.token
        });

        socket.on('question_started', (data) => {
            const offset = data.serverTime ? data.serverTime - Date.now() : 0;
            setClockOffset(offset);
            const syncedNow = Date.now() + offset;
            
            setQuestion(data);
            setGameState('countdown');
            setResult(null);
            resultRef.current = null;
            setLastAnswer(-1);
            lastAnswerRef.current = -1;
            setPointsWon(0);

            if (syncedNow >= data.startTime) {
                setGameState('question');
            }

            const calculateTimeLeft = () => {
                const now = Date.now() + offset;
                const diff = Math.floor((now - data.startTime) / 1000);
                return Math.max(0, data.timer - diff);
            };

            setTimeLeft(calculateTimeLeft());

            if (timerRef.current) clearInterval(timerRef.current);

            timerRef.current = setInterval(() => {
                const remaining = calculateTimeLeft();
                setTimeLeft(remaining);
                if (remaining <= 0) clearInterval(timerRef.current);
            }, 1000);
        });

        socket.on('question_result', (data) => {
            if (data.correct) {
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            } else {
                // Audio call removed
            }
            const newResult = {
                ...data,
                answered: data.answered ?? (lastAnswerRef.current !== -1)
            };
            setResult(newResult);
            resultRef.current = newResult;
            setGameState('result');
        });

        socket.on('question_ended', (data) => {
            if (timerRef.current) clearInterval(timerRef.current);

            setLeaderboard(data.leaderboard || []);
            if (data.teamStandings) setTeamStandings(data.teamStandings);

            // Ensure we are in result state
            setGameState('result');

            setResult(prev => {
                if (prev) return prev;
                const fallback = {
                    correct: lastAnswerRef.current === data.correctIndex,
                    score: 0,
                    answered: lastAnswerRef.current !== -1
                };
                resultRef.current = fallback;
                return fallback;
            });
        });

        socket.on('session_info', (data) => {
            try {
                if (data.status === 'question') {
                    const qData = data.question;
                    if (!qData) {
                        console.error('Received session_info with question status but no question data!');
                        return;
                    }
                    setQuestion(qData);
                    
                    const offset = data.serverTime ? data.serverTime - Date.now() : 0;
                    setClockOffset(offset);
                    const syncedNow = Date.now() + offset;

                    const delay = qData.startTime - syncedNow;
                    if (delay > 0 && !data.answered) {
                        setGameState('countdown');
                        setCountdown(Math.ceil(delay / 1000));
                    } else {
                        setGameState(data.answered ? 'submitted' : 'question');
                    }

                    // Calculate real time left based on absolute server startTime
                    const calculateTimeLeft = () => {
                        const now = Date.now() + offset;
                        const diff = Math.floor((now - qData.startTime) / 1000);
                        return Math.max(0, qData.timer - diff);
                    };

                    const remaining = calculateTimeLeft();
                    setTimeLeft(remaining);
                    setLastAnswer(data.lastAnswerIndex);
                    lastAnswerRef.current = data.lastAnswerIndex;

                    if (timerRef.current) clearInterval(timerRef.current);
                    timerRef.current = setInterval(() => {
                        const currentRemaining = calculateTimeLeft();
                        setTimeLeft(currentRemaining);
                        if (currentRemaining <= 0) clearInterval(timerRef.current);
                    }, 1000);

                } else if (data.status === 'result') {
                    setResult(data.result);
                    resultRef.current = data.result;
                    setGameState('result');
                } else if (data.status === 'lobby') {
                    navigate('/player/lobby');
                }
            } catch (err) {
                console.error("Error in session_info handler:", err);
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

        socket.on('answer_confirmed', (data) => {
            setStreak(data.streak);
            setPointsWon(data.points);
        });

        socket.on('error', (msg) => {
            console.error('Socket error in PlayerGame:', msg);
            // Check state via a ref or functional update to avoid adding gameState to dependencies
            setGameState(prev => {
                if (prev === 'loading') {
                    alert(`Error: ${msg}`);
                }
                return prev;
            });
        });

        // Proactive Re-sync on Tab Focus (Mobile Sleep Recovery)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && socket.connected) {
                const info = JSON.parse(localStorage.getItem('player_info'));
                if (info) {
                    socket.emit('join_room', {
                        pin: info.pin,
                        nickname: info.nickname,
                        role: 'player',
                        token: info.token
                    });
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            socket.off('question_started');
            socket.off('question_ended');
            socket.off('game_finished');
            socket.off('session_info');
            socket.off('answer_confirmed');
            socket.off('host_disconnected');
            socket.off('host_reconnected');
            socket.off('error');
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [socket, navigate]);

    useEffect(() => {
        if (gameState === 'countdown' && question) {
            const interval = setInterval(() => {
                const now = Date.now() + clockOffset;
                const delay = question.startTime - now;
                if (delay <= 0) {
                    clearInterval(interval);
                    setGameState('question');
                } else {
                    setCountdown(Math.ceil(delay / 1000));
                }
            }, 100);
            return () => clearInterval(interval);
        }
    }, [gameState, question, clockOffset]);

    const submitAnswer = (idx) => {
        if (gameState !== 'question') return;

        socket.emit('submit_answer', {
            pin: playerInfo.pin,
            nickname: playerInfo.nickname,
            answerIndex: idx,
            timeRemaining: timeLeft
        });
        setLastAnswer(idx);
        lastAnswerRef.current = idx;
        setGameState('submitted');
    };

    return (
        <div className="h-screen flex flex-col p-4 bg-quizmoto-purple overflow-hidden fixed inset-0">
            {isHostDisconnected && (
                <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
                    <div className="bg-white text-quizmoto-purple p-8 rounded-3xl text-center max-w-sm shadow-2xl">
                        <h2 className="text-2xl font-black mb-4 uppercase tracking-tight">Host Disconnected</h2>
                        <p className="font-bold opacity-80 mb-6">Waiting for the host to reconnect... Don't leave!</p>
                        <div className="w-8 h-8 border-4 border-quizmoto-purple/20 border-t-quizmoto-purple rounded-full animate-spin mx-auto mb-6" />
                        <button onClick={() => navigate('/')} className="text-sm underline opacity-60 font-black tracking-widest hover:opacity-100">LEAVE GAME</button>
                    </div>
                </div>
            )}
            
            <AnimatePresence mode="wait">
                {gameState === 'loading' && (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 flex flex-col items-center justify-center text-center"
                    >
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                            className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full mb-4"
                        />
                        <p className="text-xl font-bold opacity-60 italic">Connecting to question...</p>
                    </motion.div>
                )}
                
                {gameState === 'countdown' && (
                    <motion.div
                        key="countdown"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.2 }}
                        transition={{ duration: 0.3 }}
                        className="flex-1 flex flex-col items-center justify-center text-center"
                    >
                        <AnimatePresence mode="wait">
                            <motion.div 
                                key={countdown}
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 1.5, opacity: 0 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                                className="text-9xl font-black text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)] mb-4"
                            >
                                {countdown}
                            </motion.div>
                        </AnimatePresence>
                        <p className="text-2xl font-black opacity-80 uppercase tracking-[0.2em]">Get Ready!</p>
                    </motion.div>
                )}
                
                {gameState === 'question' && (
                    <motion.div
                        key="question"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 flex flex-col pt-8 pb-24 px-4 overflow-y-auto custom-scrollbar"
                    >
                        <div className="text-center mb-6 md:mb-8">
                            <h3 className="font-black text-sm md:text-xl mb-1 mt-2 uppercase tracking-widest opacity-60">Question {question?.index + 1} of {question?.totalQuestions}</h3>
                            {playerInfo?.teamName && (
                                <div className={`inline-block px-3 py-1 rounded-full text-[10px] font-black mb-2 border ${playerInfo.teamName === 'RED' ? 'bg-red-500/20 border-red-500 text-red-400' :
                                    playerInfo.teamName === 'BLUE' ? 'bg-blue-500/20 border-blue-500 text-blue-400' :
                                        playerInfo.teamName === 'YELLOW' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' :
                                            playerInfo.teamName === 'GREEN' ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-white/10 border-white/20'
                                    }`}>
                                    TEAM {playerInfo.teamName}
                                </div>
                            )}
                            <h2 className="text-2xl md:text-3xl font-black mb-4 md:mb-6 leading-tight drop-shadow-lg">
                                {question?.questionText}
                            </h2>
                            {/* Small progress bar */}
                            <div className="w-full bg-white/20 h-2 md:h-3 rounded-full overflow-hidden mb-6 md:mb-8 border border-white/5">
                                <motion.div
                                    initial={{ width: '100%' }}
                                    animate={{ width: 0 }}
                                    transition={{ duration: question?.timer, ease: 'linear' }}
                                    className="bg-white h-full"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 md:gap-4 flex-1 pb-4">
                            {['red', 'blue', 'yellow', 'green'].map((color, idx) => (
                                <motion.button
                                    key={idx}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => submitAnswer(idx)}
                                    className={`bg-quizmoto-${color} rounded-2xl shadow-[0_8px_0_0_rgba(0,0,0,0.2)] flex flex-col items-center justify-center p-2 md:p-6 text-center transition-all hover:brightness-110 min-h-[120px] md:min-h-0`}
                                >
                                    <div className="w-6 h-6 md:w-10 md:h-10 border-2 md:border-4 border-white/30 rounded-full mb-1 md:mb-3 flex items-center justify-center">
                                        <div className="w-1 h-1 md:w-2 md:h-2 bg-white rounded-full" />
                                    </div>
                                    <span className="text-sm md:text-xl font-black leading-tight drop-shadow-md break-words">
                                        {question?.options[idx]}
                                    </span>
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                )}

                {gameState === 'submitted' && (
                    <motion.div
                        key="submitted"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex-1 flex flex-col items-center justify-center px-4 w-full"
                    >
                        <div className="bg-white/10 w-full max-w-sm rounded-[32px] p-6 shadow-2xl border border-white/20 backdrop-blur-md flex flex-col items-center">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full mb-6"
                            />
                            <h2 className="text-3xl font-black italic mb-2 text-center">Answer Submitted!</h2>
                            <p className="text-lg font-bold opacity-70 mb-6">Waiting for others...</p>
                            
                            <div className="w-full bg-black/20 rounded-2xl p-4 flex flex-col items-center mb-6">
                                <span className="text-xs font-black opacity-60 uppercase tracking-widest mb-1">Time Remaining</span>
                                <span className="text-4xl font-black text-quizmoto-yellow">{timeLeft}s</span>
                            </div>

                            {question?.explanation && (
                                <div className="w-full text-left bg-quizmoto-purple/40 border border-white/10 rounded-2xl p-5 shadow-inner">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-quizmoto-yellow mb-2 flex items-center gap-2">
                                        <Sparkles size={16} /> Did you know?
                                    </h3>
                                    <p className="text-sm font-bold opacity-90 leading-relaxed">
                                        {question.explanation}
                                    </p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {gameState === 'result' && (
                    <motion.div
                        key="result"
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="flex-1 flex flex-col"
                    >
                        {/* Result Status Header (Top, Small, Bold) */}
                        <div className={`p-4 rounded-b-3xl text-center shadow-lg mb-6 ${!result?.answered ? 'bg-quizmoto-yellow text-white' : (result?.correct ? 'bg-quizmoto-green text-white' : 'bg-quizmoto-red text-white')
                            }`}>
                            <h1 className="text-xl font-black uppercase tracking-widest italic">
                                {!result?.answered ? "Time's Up!" : (result?.correct ? "Correct!" : "Incorrect")}
                            </h1>
                            {result?.correct && <p className="text-xs font-bold opacity-80">+{pointsWon || result?.score} points</p>}
                        </div>

                        {/* Leaderboard Part */}
                        <div className="flex-1 overflow-y-auto px-2">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-2xl font-black italic uppercase tracking-tighter opacity-60">
                                    {viewMode === 'players' ? 'Scoreboard' : 'Team Standings'}
                                </h2>
                                {teamStandings.length > 0 && (
                                    <button
                                        onClick={() => setViewMode(viewMode === 'players' ? 'teams' : 'players')}
                                        className="bg-white/10 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/10"
                                    >
                                        {viewMode === 'players' ? 'Show Teams' : 'Show Solo'}
                                    </button>
                                )}
                            </div>
                            <div className="space-y-3">
                                {(viewMode === 'players' ? leaderboard : teamStandings).map((p, idx) => {
                                    const name = p.nickname || p.teamName;
                                    const isMe = name === playerInfo?.nickname;
                                    const isMyTeam = name === playerInfo?.teamName && viewMode === 'teams';

                                    return (
                                        <motion.div
                                            key={name}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.1 }}
                                            className={`p-4 rounded-xl flex justify-between items-center border-b-4 ${isMe || isMyTeam
                                                ? 'bg-white text-quizmoto-purple border-gray-200'
                                                : 'bg-white/10 text-white border-black/20'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg font-black opacity-40 w-5">{idx + 1}</span>
                                                <span className="text-base font-black truncate max-w-[120px]">{name}</span>
                                                {(isMe || isMyTeam) && (
                                                    <span className="bg-quizmoto-purple text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">YOU</span>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lg font-black">{p.score}</span>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>

                        {streak >= 3 && result?.correct && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="mt-4 mx-auto flex items-center gap-2 bg-orange-500 px-4 py-2 rounded-full shadow-lg"
                            >
                                <Flame fill="currentColor" size={16} />
                                <span className="font-black text-sm italic">{streak}X STREAK!</span>
                            </motion.div>
                        )}

                        <p className="mt-4 text-center font-bold opacity-30 uppercase tracking-[0.2em] text-[10px] animate-pulse">
                            Get ready for the next round!
                        </p>
                    </motion.div>
                )}

                {gameState === 'finished' && (
                    <motion.div
                        key="finished"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex-1 flex flex-col h-full"
                    >
                        <div className="flex justify-between items-center pt-4 pb-6 px-2">
                            <div className="text-left">
                                <h1 className="text-2xl font-black italic leading-none">GAME OVER!</h1>
                                <p className="text-xs font-bold opacity-70 uppercase tracking-widest">Final Standing</p>
                            </div>
                            <button
                                onClick={() => {
                                    if (localStorage.getItem('playerToken')) {
                                        navigate('/player/dashboard');
                                    } else {
                                        navigate('/');
                                    }
                                }}
                                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-black text-xs border border-white/20 transition-all uppercase tracking-widest"
                            >
                                Leave
                            </button>
                        </div>

                        {/* Leaderboard Part */}
                        <div className="flex-1 overflow-y-auto px-2 mb-6 custom-scrollbar">
                            <div className="space-y-3">
                                {leaderboard.map((p, idx) => (
                                    <motion.div
                                        key={p.nickname}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className={`p-4 rounded-xl flex justify-between items-center border-b-4 ${p.nickname === playerInfo?.nickname
                                            ? 'bg-white text-quizmoto-purple border-gray-200'
                                            : 'bg-white/10 text-white border-black/20'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg font-black opacity-40 w-5">{idx + 1}</span>
                                            <span className="text-base font-black truncate max-w-[120px]">{p.nickname}</span>
                                            {p.nickname === playerInfo?.nickname && (
                                                <span className="bg-quizmoto-purple text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">YOU</span>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <span className="text-lg font-black">{p.score}</span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Exit button moved to top */}
                    </motion.div>
                )}
            </AnimatePresence>
            {(gameState === 'submitted' || gameState === 'result' || gameState === 'finished') && (
                <ReactionBar pin={playerInfo?.pin} />
            )}
        </div>
    );
};

export default PlayerGame;
