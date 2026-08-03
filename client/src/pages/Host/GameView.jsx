import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Users, Volume2, VolumeX, Trophy, Crown, ArrowUp, Zap, ChevronRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import ReactionCanvas from '../../components/ReactionCanvas';
import AvatarDisplay from '../../components/AvatarDisplay';
import { audio } from '../../utils/audioEngine';

const GameView = () => {
    const { pin } = useParams();
    const socket = useSocket();
    const navigate = useNavigate();
    const { token } = useAuth();

    const [gameState, setGameState] = useState('question');
    const [question, setQuestion] = useState(null);
    const [timer, setTimer] = useState(0);
    const [countdown, setCountdown] = useState(0);
    const [clockOffset, setClockOffset] = useState(0);
    const [answersCount, setAnswersCount] = useState(0);
    const [answerDistribution, setAnswerDistribution] = useState([0, 0, 0, 0]);
    const [results, setResults] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [teamStandings, setTeamStandings] = useState([]);
    const [playersCount, setPlayersCount] = useState(0);
    const [viewMode, setViewMode] = useState('players');
    const [isProcessingNext, setIsProcessingNext] = useState(false);
    const [analyticsData, setAnalyticsData] = useState(null);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        if (!socket) return;

        socket.emit('join_room', { pin, role: 'host', token });

        socket.on('room_info', (sessionData) => {
            setPlayersCount(sessionData.players ? sessionData.players.length : 0);

            if (sessionData.status === 'question' || sessionData.status === 'result') {
                if (sessionData.currentQuestion) {
                    setQuestion(sessionData.currentQuestion);
                    
                    if (sessionData.status === 'question') {
                        const now = Date.now() + clockOffset;
                        const delay = sessionData.currentQuestion.startTime - now;
                        if (delay > 0) {
                            setGameState('countdown');
                            setCountdown(Math.ceil(delay / 1000));
                        } else {
                            setGameState('question');
                            const diff = Math.floor((now - sessionData.currentQuestion.startTime) / 1000);
                            setTimer(Math.max(0, sessionData.currentQuestion.timer - diff));
                        }
                    } else {
                        setGameState('result');
                    }
                }
            } else if (sessionData.status === 'finished') {
                const sortedPlayers = sessionData.players
                    ? [...sessionData.players].sort((a, b) => b.score - a.score)
                    : [];
                setLeaderboard(sortedPlayers);
                setGameState('finished');
            } else {
                socket.emit('start_question', { pin, token });
                setGameState('lobby');
            }
        });

        socket.on('player_joined', (players) => {
            setPlayersCount(players.length);
        });

        socket.on('question_started', (data) => {
            const offset = data.serverTime ? data.serverTime - Date.now() : 0;
            setClockOffset(offset);
            const syncedNow = Date.now() + offset;

            setQuestion(data);
            setTimer(data.timer);
            setGameState('countdown');
            setAnswersCount(0);
            setAnswerDistribution([0, 0, 0, 0]);
            setResults(null);
            setIsProcessingNext(false);

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

        socket.on('answer_received_host', ({ answerIndex }) => {
            setAnswersCount(prev => prev + 1);
            setAnswerDistribution(prev => {
                const next = [...prev];
                next[answerIndex]++;
                return next;
            });
        });

        socket.on('question_ended', (data) => {
            setGameState('result');
            setResults(data);
            setLeaderboard(data.leaderboard);
            if (data.teamStandings) setTeamStandings(data.teamStandings);
        });

        socket.on('game_finished', (data) => {
            setGameState('finished');
            setIsProcessingNext(false);
            const finalPlayers = Array.isArray(data) ? data : data.players;
            const finalTeams = data.teamStandings || [];

            setLeaderboard(finalPlayers);
            setTeamStandings(finalTeams);
            if (data.analytics) setAnalyticsData(data.analytics);

            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 }
            });
        });

        return () => {
            socket.off('room_info');
            socket.off('player_joined');
            socket.off('question_started');
            socket.off('answer_received_host');
            socket.off('question_ended');
            socket.off('game_finished');
            audio.stopAll();
        };
    }, [socket, pin, token]);

    useEffect(() => {
        if (gameState === 'lobby') {
            audio.play('playful');
        } else if (gameState === 'result' || gameState === 'finished') {
            audio.stopBg();
            audio.play('leaderboard');
        } else {
            audio.stopBg();
        }
    }, [gameState]);

    useEffect(() => {
        if (gameState === 'question' && timer > 0) {
            audio.play('tick');
        }
    }, [timer, gameState]);

    useEffect(() => {
        if (gameState === 'countdown' && question) {
            const interval = setInterval(() => {
                const now = Date.now() + clockOffset;
                const delay = question.startTime - now;
                if (delay <= 0) {
                    clearInterval(interval);
                    setGameState('question');
                    setTimer(question.timer);
                } else {
                    const nextVal = Math.ceil(delay / 1000);
                    setCountdown(nextVal);
                    if (nextVal === 1) audio.play('countdownEnd');
                    else audio.play('countdown');
                }
            }, 100);
            return () => clearInterval(interval);
        }
    }, [gameState, question, clockOffset]);

    useEffect(() => {
        if (gameState !== 'question' || !question) return;

        const interval = setInterval(() => {
            const now = Date.now() + clockOffset;
            const diff = Math.floor((now - question.startTime) / 1000);
            const remaining = Math.max(0, question.timer - diff);
            
            setTimer(t => {
                if (remaining <= 0) {
                    clearInterval(interval);
                    if (t > 0) {
                        socket.emit('end_question', { pin, token });
                    }
                    return 0;
                }
                return remaining;
            });
        }, 100);

        return () => clearInterval(interval);
    }, [gameState, question, pin, socket, token, clockOffset]);

    useEffect(() => {
        if (gameState === 'finished') {
            const duration = 5 * 1000;
            const animationEnd = Date.now() + duration;
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

            const randomInRange = (min, max) => Math.random() * (max - min) + min;

            const interval = setInterval(() => {
                const timeLeft = animationEnd - Date.now();
                if (timeLeft <= 0) return clearInterval(interval);

                const particleCount = 50 * (timeLeft / duration);
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
            }, 250);

            return () => clearInterval(interval);
        }
    }, [gameState]);

    const nextAction = () => {
        if (isProcessingNext) return;
        if (gameState === 'result') {
            setIsProcessingNext(true);
            if (question.index + 1 < question.totalQuestions) {
                socket.emit('start_question', { pin, token });
            } else {
                socket.emit('end_game', { pin, token });
            }
        } else if (gameState === 'finished') {
            navigate('/dashboard');
        }
    };

    const goToDashboard = () => navigate('/dashboard');

    const top3 = viewMode === 'teams' && teamStandings.length > 0
        ? teamStandings.slice(0, 3).map(t => ({ nickname: t.teamName, score: t.score, avatar: '🏆' }))
        : leaderboard.slice(0, 3);

    const toggleMute = () => {
        audio.setMute(!isMuted);
        setIsMuted(!isMuted);
    };

    if ((!question || gameState === 'lobby') && gameState !== 'finished') return (
        <div className="flex flex-col items-center justify-center h-screen gap-4">
            <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-white/50 text-sm font-medium">Starting session...</p>
        </div>
    );

    if (gameState === 'countdown') return (
        <div className="flex flex-col items-center justify-center h-screen gap-6 relative overflow-hidden">
            <AnimatePresence mode="wait">
                <motion.div 
                    key={countdown}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="text-9xl font-black text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.4)]"
                >
                    {countdown}
                </motion.div>
            </AnimatePresence>
            <p className="text-white/70 text-xl font-medium tracking-widest uppercase mt-4">Get Ready!</p>
        </div>
    );

    return (
        <div className="min-h-screen p-6 flex flex-col relative z-10">
            <header className="flex justify-between items-center mb-8 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <h2 className="text-base font-bold tracking-tight">Quizmoto<span className="text-quizmoto-yellow">!</span></h2>
                    {question && (
                        <span className="text-xs font-medium text-white/40 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                            Question {question.index + 1} of {question.totalQuestions}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {gameState === 'question' && (
                        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${timer <= 5 ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'bg-white/5 border-white/10'
                            }`}>
                            <Clock size={14} />
                            <span className="tabular-nums">{timer}s</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10">
                        <Users size={13} className="text-white/50" />
                        <span className="text-white/60">{answersCount}/{playersCount}</span>
                    </div>
                    {teamStandings.length > 0 && (gameState === 'result' || gameState === 'finished') && (
                        <button
                            onClick={() => setViewMode(viewMode === 'players' ? 'teams' : 'players')}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                        >
                            {viewMode === 'players' ? 'View Teams' : 'View Players'}
                        </button>
                    )}
                    {gameState === 'finished' && analyticsData && (
                        <button
                            onClick={() => setViewMode(viewMode === 'analytics' ? 'players' : 'analytics')}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-quizmoto-blue text-white shadow-sm hover:bg-quizmoto-blue/90 transition-all"
                        >
                            {viewMode === 'analytics' ? 'Show Podium' : 'View Full Report'}
                        </button>
                    )}
                    {(gameState === 'result' || gameState === 'finished') && (
                        <motion.button
                            whileHover={!isProcessingNext ? { scale: 1.02 } : {}}
                            whileTap={!isProcessingNext ? { scale: 0.98 } : {}}
                            onClick={nextAction}
                            disabled={isProcessingNext}
                            className={`px-5 py-2 rounded-lg font-semibold text-sm shadow-sm transition-all ${isProcessingNext
                                ? 'bg-white/40 text-quizmoto-purple/60 cursor-not-allowed'
                                : 'bg-white text-quizmoto-purple hover:bg-white/95'
                                }`}
                        >
                            {isProcessingNext
                                ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-quizmoto-purple/30 border-t-quizmoto-purple rounded-full animate-spin" />Loading...</span>
                                : gameState === 'finished' ? 'Dashboard' : <span className="flex items-center gap-1">Next <ChevronRight size={14} /></span>
                            }
                        </motion.button>
                    )}
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center">
                {gameState === 'question' && (
                    <div className="w-full max-w-6xl">
                        {question.image ? (
                            <div className="flex flex-col gap-6">
                                <motion.div
                                    initial={{ y: -20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="bg-white/8 border border-white/12 rounded-2xl overflow-hidden shadow-xl"
                                >
                                    <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-indigo-500" />
                                    <div className="p-8 text-center">
                                        <div className="inline-flex items-center justify-center bg-white/10 border border-white/15 px-4 py-1.5 rounded-full mb-3">
                                            <span className="text-xs font-bold text-white/50 uppercase tracking-[0.25em]">Question {question.index + 1}</span>
                                        </div>
                                        <h1 className="text-3xl md:text-4xl font-bold leading-snug tracking-tight">{question.questionText}</h1>
                                    </div>
                                </motion.div>
                                
                                <div className="flex flex-col md:flex-row gap-6 h-[320px]">
                                    <div className="w-full md:w-1/2 flex items-center justify-center bg-white/5 border border-white/10 rounded-2xl p-4 shadow-xl">
                                        <motion.img 
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            src={question.image} 
                                            alt="Question" 
                                            className="max-h-full max-w-full object-contain rounded-xl shadow-lg border border-white/20" 
                                        />
                                    </div>
                                    <div className="w-full md:w-1/2 flex justify-center gap-3 items-end bg-white/3 px-6 py-6 rounded-2xl border border-white/8 shadow-xl">
                                        {['red', 'blue', 'yellow', 'green'].map((color, idx) => {
                                            const count = answerDistribution[idx];
                                            const labels = ['A', 'B', 'C', 'D'];
                                            const height = playersCount > 0 ? (count / playersCount) * 100 : 0;
                                            return (
                                                <div key={idx} className="flex flex-col items-center gap-3 h-full flex-1">
                                                    <div className="flex-1 w-full flex items-end relative">
                                                        {count > 0 && (
                                                            <div className="absolute left-1/2 -translate-x-1/2 -top-7 font-bold text-lg text-white/80">{count}</div>
                                                        )}
                                                        <motion.div
                                                            initial={{ height: 0 }}
                                                            animate={{ height: `${Math.max(4, height)}%` }}
                                                            className={`w-full bg-quizmoto-${color} rounded-t-lg`}
                                                        />
                                                    </div>
                                                    <div className={`w-10 h-10 rounded-xl bg-quizmoto-${color} flex items-center justify-center shadow-lg`}>
                                                        <span className="font-bold text-white text-sm">{labels[idx]}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <motion.div
                                    initial={{ y: -20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="bg-white/8 border border-white/12 rounded-2xl overflow-hidden mb-8 shadow-xl"
                                >
                                    <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-indigo-500" />
                                    <div className="p-10 text-center">
                                        <div className="inline-flex items-center justify-center bg-white/10 border border-white/15 px-4 py-1.5 rounded-full mb-5">
                                            <span className="text-xs font-bold text-white/50 uppercase tracking-[0.25em]">Question {question.index + 1}</span>
                                        </div>
                                        <h1 className="text-3xl md:text-4xl font-bold leading-snug tracking-tight">{question.questionText}</h1>
                                    </div>
                                </motion.div>
                                <div className="flex justify-center gap-4 h-[280px] w-full items-end bg-white/3 px-8 py-6 rounded-2xl border border-white/8">
                                    {['red', 'blue', 'yellow', 'green'].map((color, idx) => {
                                        const count = answerDistribution[idx];
                                        const labels = ['A', 'B', 'C', 'D'];
                                        const height = playersCount > 0 ? (count / playersCount) * 100 : 0;
                                        return (
                                            <div key={idx} className="flex flex-col items-center gap-3 h-full flex-1">
                                                <div className="flex-1 w-full flex items-end relative">
                                                    {count > 0 && (
                                                        <div className="absolute left-1/2 -translate-x-1/2 -top-7 font-bold text-lg text-white/80">{count}</div>
                                                    )}
                                                    <motion.div
                                                        initial={{ height: 0 }}
                                                        animate={{ height: `${Math.max(4, height)}%` }}
                                                        className={`w-full bg-quizmoto-${color} rounded-t-lg`}
                                                    />
                                                </div>
                                                <div className={`w-12 h-12 rounded-xl bg-quizmoto-${color} flex items-center justify-center shadow-lg`}>
                                                    <span className="font-bold text-white text-base">{labels[idx]}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {gameState === 'result' && (
                    <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-8 px-4">
                        <motion.div
                            initial={{ x: -40, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className="lg:w-2/5 flex flex-col"
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-1.5 h-5 rounded-full bg-green-400" />
                                <h2 className="text-base font-semibold text-white/90">Answer Revealed</h2>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex-1 flex flex-col justify-center shadow-lg">
                                <p className="text-xs font-medium text-white/40 uppercase tracking-widest mb-4">Correct answer</p>
                                <div className={`w-full p-5 rounded-xl bg-quizmoto-${['red', 'blue', 'yellow', 'green'][results.correctIndex]} text-white text-lg font-semibold shadow-lg text-center`}>
                                    {question.options[results.correctIndex]}
                                </div>
                                <div className="mt-5 flex items-center justify-between pt-4 border-t border-white/10">
                                    <div className="flex items-center gap-2">
                                        <Users size={15} className="text-white/40" />
                                        <span className="text-sm font-medium text-white/60">{answersCount} of {playersCount} responded</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ x: 40, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className="lg:w-3/5 flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-5 rounded-full bg-quizmoto-yellow" />
                                    <h2 className="text-base font-semibold text-white/90">Live Standings</h2>
                                </div>
                                <span className="text-xs text-white/30 font-medium">{viewMode === 'players' ? 'Individual' : 'Teams'}</span>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-2xl flex-1 overflow-hidden">
                                <div className="p-4 space-y-2 overflow-y-auto max-h-[400px]">
                                    {(viewMode === 'players' ? leaderboard : teamStandings).map((p, idx) => {
                                        const name = p.nickname || p.teamName;
                                        const medalColors = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];
                                        const isTop3 = idx < 3;
                                        return (
                                            <motion.div
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.07 }}
                                                key={name}
                                                className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${idx === 0 ? 'bg-yellow-400/8 border-yellow-400/20' : 'bg-white/3 border-white/8'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-6 flex items-center justify-center">
                                                        {idx === 0 ? (
                                                            <Crown size={15} className="text-yellow-400" />
                                                        ) : (
                                                            <span className={`text-sm font-bold ${isTop3 ? medalColors[idx] : 'text-white/25'}`}>{idx + 1}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <AvatarDisplay avatar={p.avatar} imgClass="w-6 h-6" textClass="text-base leading-none" />
                                                        <span className="font-medium text-white/85 text-sm">{name}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-bold tabular-nums">{p.score.toLocaleString()}</div>
                                                    <div className="text-[10px] text-white/25 uppercase tracking-wider">pts</div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {gameState === 'finished' && viewMode === 'analytics' && analyticsData && (
                    <div className="w-full max-w-6xl px-4 py-8 overflow-y-auto max-h-[85vh] scrollbar-hide z-50">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-2 rounded-full h-8 bg-quizmoto-blue" />
                            <h2 className="text-3xl font-bold">Class Analytics Report</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                                <span className="text-sm text-white/50 uppercase tracking-widest font-bold mb-2">Class Accuracy</span>
                                <span className={`text-4xl font-black ${analyticsData.classAnalytics.averageAccuracy >= 70 ? 'text-green-400' : 'text-quizmoto-yellow'}`}>
                                    {analyticsData.classAnalytics.averageAccuracy}%
                                </span>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                                <span className="text-sm text-white/50 uppercase tracking-widest font-bold mb-2">Participation</span>
                                <span className="text-4xl font-black text-white">
                                    {analyticsData.classAnalytics.participationRate}%
                                </span>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                                <span className="text-sm text-white/50 uppercase tracking-widest font-bold mb-2">Needs Review</span>
                                <span className={`text-4xl font-black ${analyticsData.classAnalytics.questionsNeedingReview > 0 ? 'text-quizmoto-red' : 'text-white/30'}`}>
                                    {analyticsData.classAnalytics.questionsNeedingReview}
                                </span>
                                <span className="text-xs text-white/40 mt-1">Questions</span>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                                <span className="text-sm text-white/50 uppercase tracking-widest font-bold mb-2">Need Help</span>
                                <span className={`text-4xl font-black ${analyticsData.classAnalytics.studentsNeedingAttention > 0 ? 'text-quizmoto-yellow' : 'text-white/30'}`}>
                                    {analyticsData.classAnalytics.studentsNeedingAttention}
                                </span>
                                <span className="text-xs text-white/40 mt-1">Students {"<"} 60%</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-6">Question Breakdown</h3>
                                <div className="space-y-3">
                                    {analyticsData.questionAnalytics.map((q, idx) => (
                                        <div key={idx} className={`p-4 rounded-xl border ${q.needsReview ? 'bg-quizmoto-red/10 border-quizmoto-red/30' : 'bg-white/3 border-white/5'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex-1 pr-4">
                                                    <span className="text-xs font-bold text-white/40 uppercase mb-1 block">Q{idx + 1}</span>
                                                    <p className="text-sm font-medium">{q.title}</p>
                                                </div>
                                                <div className={`text-xl font-black shrink-0 ${q.correctPercentage >= 70 ? 'text-green-400' : q.correctPercentage >= 40 ? 'text-quizmoto-yellow' : 'text-quizmoto-red'`}>
                                                    {q.correctPercentage}%
                                                </div>
                                            </div>
                                            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden flex">
                                                <div style={{ width: `${q.correctPercentage}%` }} className="bg-green-400 h-full" />
                                                <div style={{ width: `${100 - q.correctPercentage}%` }} className="bg-quizmoto-red h-full" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-6">Student Performance</h3>
                                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                                    {analyticsData.studentAnalytics.sort((a, b) => b.accuracy - a.accuracy).map((s, idx) => (
                                        <div key={idx} className={`flex items-center justify-between p-4 rounded-xl border ${s.needsAttention ? 'bg-quizmoto-yellow/10 border-quizmoto-yellow/30' : 'bg-white/3 border-white/5'}`}>
                                            <div className="flex items-center gap-3">
                                                <AvatarDisplay avatar={s.avatar} imgClass="w-8 h-8" textClass="text-2xl" />
                                                <div>
                                                    <p className="font-bold text-base">{s.name}</p>
                                                    <span className="text-xs text-white/50">{s.correctAnswers} / {s.totalAnswered} Correct</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-lg font-black ${s.accuracy >= 70 ? 'text-green-400' : s.accuracy >= 50 ? 'text-white' : 'text-quizmoto-yellow'`}>
                                                    {s.accuracy}%
                                                </div>
                                                {s.needsAttention && <span className="text-[10px] uppercase font-bold text-quizmoto-yellow">Needs Refresher</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {gameState === 'finished' && viewMode !== 'analytics' && (
                    <div className="w-full max-w-4xl text-center px-4">
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6"
                        >
                            <div className="inline-flex items-center gap-2 bg-quizmoto-yellow/10 border border-quizmoto-yellow/20 px-4 py-1.5 rounded-full mb-3">
                                <Trophy size={13} className="text-quizmoto-yellow" />
                                <span className="text-xs font-semibold text-quizmoto-yellow uppercase tracking-widest">Session Complete</span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Final Results</h1>
                            <p className="text-white/40 text-sm mt-1">Congratulations to all participants</p>
                        </motion.div>

                        <div className="flex items-end justify-center gap-3 mt-2 w-full">
                            <div className="flex flex-col items-center">
                                {top3[1] && (
                                    <motion.div
                                        initial={{ y: 40, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.9, duration: 0.6 }}
                                        className="flex flex-col items-center mb-3"
                                    >
                                        <div className="mb-1 drop-shadow-lg flex items-center justify-center">
                                            <AvatarDisplay avatar={top3[1].avatar} imgClass="w-10 h-10" textClass="text-4xl" />
                                        </div>
                                        <div className="bg-white/15 px-3 py-0.5 rounded-full text-xs font-semibold text-white truncate max-w-[90px]">{top3[1].nickname}</div>
                                        <div className="text-slate-300 text-xs font-bold mt-1">{top3[1].score.toLocaleString()} pts</div>
                                    </motion.div>
                                )}
                                <motion.div
                                    initial={{ scaleY: 0 }}
                                    animate={{ scaleY: 1 }}
                                    transition={{ delay: 0.4, duration: 0.6, ease: 'easeOut' }}
                                    style={{ originY: 'bottom', width: '140px', height: '180px' }}
                                    className="bg-gradient-to-t from-slate-700 to-slate-400 rounded-t-2xl flex items-end justify-center pb-5 shadow-2xl border-t-4 border-slate-300/40"
                                >
                                    <span className="text-3xl font-black text-white/70">2</span>
                                </motion.div>
                            </div>

                            <div className="flex flex-col items-center">
                                {top3[0] && (
                                    <motion.div
                                        initial={{ y: 60, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 1.6, duration: 0.7 }}
                                        className="flex flex-col items-center mb-3"
                                    >
                                        <motion.div
                                            initial={{ scale: 0, rotate: -15 }}
                                            animate={{ scale: 1, rotate: 0 }}
                                            transition={{ delay: 2.2, duration: 0.5, type: 'spring' }}
                                        >
                                            <Crown size={26} className="text-quizmoto-yellow mb-1 mx-auto" />
                                        </motion.div>
                                        <div className="mb-1 drop-shadow-lg flex items-center justify-center">
                                            <AvatarDisplay avatar={top3[0].avatar} imgClass="w-14 h-14" textClass="text-5xl" />
                                        </div>
                                        <div className="bg-quizmoto-yellow/20 border border-quizmoto-yellow/40 px-3 py-0.5 rounded-full text-xs font-bold text-quizmoto-yellow truncate max-w-[110px]">{top3[0].nickname}</div>
                                        <div className="text-quizmoto-yellow text-xs font-bold mt-1">{top3[0].score.toLocaleString()} pts</div>
                                    </motion.div>
                                )}
                                <motion.div
                                    initial={{ scaleY: 0 }}
                                    animate={{ scaleY: 1 }}
                                    transition={{ delay: 1.0, duration: 0.8, ease: 'easeOut' }}
                                    style={{ originY: 'bottom', width: '160px', height: '260px' }}
                                    className="bg-gradient-to-t from-yellow-700 to-quizmoto-yellow rounded-t-2xl flex items-center justify-center shadow-[0_0_50px_rgba(255,166,2,0.25)] border-t-4 border-yellow-300/60"
                                >
                                    <span className="text-5xl font-black text-white/90 drop-shadow-lg">1</span>
                                </motion.div>
                            </div>

                            <div className="flex flex-col items-center">
                                {top3[2] && (
                                    <motion.div
                                        initial={{ y: 30, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.4, duration: 0.5 }}
                                        className="flex flex-col items-center mb-3"
                                    >
                                        <div className="mb-1 drop-shadow-lg flex items-center justify-center">
                                            <AvatarDisplay avatar={top3[2].avatar} imgClass="w-10 h-10" textClass="text-4xl" />
                                        </div>
                                        <div className="bg-white/15 px-3 py-0.5 rounded-full text-xs font-semibold text-white truncate max-w-[90px]">{top3[2].nickname}</div>
                                        <div className="text-amber-400 text-xs font-bold mt-1">{top3[2].score.toLocaleString()} pts</div>
                                    </motion.div>
                                )}
                                <motion.div
                                    initial={{ scaleY: 0 }}
                                    animate={{ scaleY: 1 }}
                                    transition={{ delay: 0.1, duration: 0.5, ease: 'easeOut' }}
                                    style={{ originY: 'bottom', width: '140px', height: '130px' }}
                                    className="bg-gradient-to-t from-amber-900 to-amber-600 rounded-t-2xl flex items-end justify-center pb-5 shadow-xl border-t-4 border-amber-400/40"
                                >
                                    <span className="text-2xl font-black text-white/70">3</span>
                                </motion.div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <ReactionCanvas />
        </div>
    );
};

export default GameView;
