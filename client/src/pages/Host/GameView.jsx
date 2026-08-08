import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Users, Volume2, VolumeX, Trophy, Crown, ArrowUp, Zap, ChevronRight, Wifi, WifiOff } from 'lucide-react';
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
    const [players, setPlayers] = useState([]);
    const [presenceTab, setPresenceTab] = useState('active');
    const [viewMode, setViewMode] = useState('players');
    const [isProcessingNext, setIsProcessingNext] = useState(false);
    const [analyticsData, setAnalyticsData] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const offsetRef = useRef(0);
    const questionIndexRef = useRef(-1);
    const questionStartRef = useRef(0);
    const endedOnceRef = useRef(false);

    useEffect(() => {
        if (!socket) return;

        socket.emit('join_room', { pin, role: 'host', token });

        try {
            const pending = sessionStorage.getItem('pending_question_started');
            if (pending) {
                sessionStorage.removeItem('pending_question_started');
                const data = JSON.parse(pending);
                const offset = (data.serverTime != null) ? (data.serverTime - Date.now()) : 0;
                offsetRef.current = offset;
                setClockOffset(offset);
                const syncedNow = Date.now() + offset;
                const startTime = data.startTime || (syncedNow + 3000);
                questionIndexRef.current = data.index != null ? data.index : -1;
                questionStartRef.current = startTime;
                endedOnceRef.current = false;
                setQuestion({ ...data, startTime });
                setTimer(data.timer || 20);
                setAnswersCount(0);
                setAnswerDistribution([0, 0, 0, 0]);
                setResults(null);
                setIsProcessingNext(false);
                const delay = startTime - syncedNow;
                if (delay > 80) {
                    setGameState('countdown');
                    setCountdown(Math.min(3, Math.max(1, Math.ceil(delay / 1000))));
                } else {
                    setGameState('question');
                    const diff = Math.floor((syncedNow - startTime) / 1000);
                    setTimer(Math.max(0, (data.timer || 20) - diff));
                }
            }
        } catch (e) {
            console.warn('pending question handoff failed', e);
        }

        socket.on('room_info', (sessionData) => {
            const recoveredPlayers = Array.isArray(sessionData.players) ? sessionData.players : [];
            setPlayers(recoveredPlayers);
            setPlayersCount(recoveredPlayers.length);

            if (sessionData.status === 'question' || sessionData.status === 'result') {
                if (sessionData.currentQuestion) {
                    if (sessionData.serverTime != null) {
                        offsetRef.current = sessionData.serverTime - Date.now();
                        setClockOffset(offsetRef.current);
                    }
                    setQuestion(sessionData.currentQuestion);
                    questionIndexRef.current = sessionData.currentQuestion.index ?? sessionData.currentQuestionIndex ?? -1;
                    questionStartRef.current = sessionData.currentQuestion.startTime || 0;

                    if (sessionData.status === 'question') {
                        // The server replays answer_received_host for already
                        // answered players after this recovery payload, so reset
                        // before those replay events arrive to avoid double counts.
                        setAnswersCount(0);
                        setAnswerDistribution([0, 0, 0, 0]);
                        setResults(null);
                        endedOnceRef.current = false;
                        const now = Date.now() + offsetRef.current;
                        const delay = (sessionData.currentQuestion.startTime || 0) - now;
                        if (delay > 50) {
                            setGameState('countdown');
                            setCountdown(Math.min(3, Math.max(1, Math.ceil(delay / 1000))));
                        } else {
                            setGameState('question');
                            const diff = Math.floor((now - sessionData.currentQuestion.startTime) / 1000);
                            setTimer(Math.max(0, (sessionData.currentQuestion.timer || 20) - diff));
                        }
                    } else {
                        const recoveredDistribution = Array.isArray(sessionData.answerDistribution)
                            ? [...sessionData.answerDistribution].slice(0, 4)
                            : [0, 0, 0, 0];
                        while (recoveredDistribution.length < 4) recoveredDistribution.push(0);
                        const recoveredLeaderboard = [...recoveredPlayers]
                            .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
                            .slice(0, 5);
                        const recoveredTeams = Object.values(
                            recoveredPlayers.reduce((acc, player) => {
                                if (!player.teamName) return acc;
                                const key = player.teamName;
                                if (!acc[key]) acc[key] = { teamName: key, score: 0 };
                                acc[key].score += Number(player.score || 0);
                                return acc;
                            }, {})
                        ).sort((a, b) => b.score - a.score);

                        setAnswersCount(Number(sessionData.answersCount || 0));
                        setAnswerDistribution(recoveredDistribution);
                        setLeaderboard(recoveredLeaderboard);
                        setTeamStandings(recoveredTeams);
                        setResults({
                            correctIndex: sessionData.currentQuestion.correctIndex,
                            distribution: recoveredDistribution,
                            leaderboard: recoveredLeaderboard,
                            teamStandings: recoveredTeams,
                            answersCount: Number(sessionData.answersCount || 0),
                            index: sessionData.currentQuestion.index,
                            status: 'result'
                        });
                        setTimer(0);
                        endedOnceRef.current = true;
                        setGameState('result');
                    }
                }
            } else if (sessionData.status === 'finished') {
                const sortedPlayers = recoveredPlayers
                    ? [...recoveredPlayers].sort((a, b) => b.score - a.score)
                    : [];
                setLeaderboard(sortedPlayers);
                setGameState('finished');
            } else {
                let hasPending = false;
                try { hasPending = !!sessionStorage.getItem('pending_question_started'); } catch (_) {}
                if (!hasPending) socket.emit('start_question', { pin, token });
                setGameState('lobby');
            }
        });

        socket.on('player_joined', (list) => {
            const arr = Array.isArray(list) ? list : [];
            setPlayers(arr);
            setPlayersCount(arr.length);
        });

        socket.on('player_left', (payload) => {
            const arr = payload && Array.isArray(payload.players) ? payload.players : [];
            setPlayers(arr);
            setPlayersCount(arr.length);
        });

        socket.on('question_started', (data) => {
            const offset = (data.serverTime != null) ? (data.serverTime - Date.now()) : 0;
            offsetRef.current = offset;
            setClockOffset(offset);
            const syncedNow = Date.now() + offset;
            const startTime = data.startTime || (syncedNow + 3000);
            questionIndexRef.current = data.index != null ? data.index : -1;
            questionStartRef.current = startTime;
            endedOnceRef.current = false;
            setQuestion({ ...data, startTime });
            setTimer(data.timer || 20);
            setAnswersCount(0);
            setAnswerDistribution([0, 0, 0, 0]);
            setResults(null);
            setIsProcessingNext(false);
            const delay = startTime - syncedNow;
            if (delay > 80) {
                setGameState('countdown');
                setCountdown(Math.min(3, Math.max(1, Math.ceil(delay / 1000))));
            } else {
                setGameState('question');
                const diff = Math.floor((syncedNow - startTime) / 1000);
                setTimer(Math.max(0, (data.timer || 20) - diff));
            }
        });

        socket.on('countdown_tick', (data) => {
            if (!data) return;
            if (data.index != null && questionIndexRef.current >= 0 && data.index !== questionIndexRef.current) return;
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

        socket.on('answer_received_host', ({ answerIndex }) => {
            setAnswersCount(prev => prev + 1);
            setAnswerDistribution(prev => {
                const next = [...prev];
                if (answerIndex >= 0 && answerIndex < next.length) next[answerIndex] += 1;
                return next;
            });
        });

        socket.on('question_ended', (data) => {
            endedOnceRef.current = true;
            setIsProcessingNext(false);
            setGameState('result');
            setResults(data);
            setLeaderboard(data.leaderboard || []);
            if (data.teamStandings) setTeamStandings(data.teamStandings);
            if (typeof data.answersCount === 'number') setAnswersCount(data.answersCount);
            if (Array.isArray(data.distribution)) {
                const next = [...data.distribution].slice(0, 4);
                while (next.length < 4) next.push(0);
                setAnswerDistribution(next);
            }
            setTimer(0);
        });

        const onGameFinished = (data) => {
            setGameState('finished');
            setIsProcessingNext(false);
            const finalPlayers = Array.isArray(data) ? data : (data.players || data.podium || []);
            const finalTeams = (data && data.teamStandings) || [];
            setLeaderboard(finalPlayers);
            setTeamStandings(finalTeams);
            if (data && data.analytics) setAnalyticsData(data.analytics);
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        };
        socket.on('game_finished', onGameFinished);
        socket.on('game_over', onGameFinished);

        return () => {
            socket.off('room_info');
            socket.off('player_joined');
            socket.off('player_left');
            socket.off('question_started');
            socket.off('countdown_tick');
            socket.off('answer_received_host');
            socket.off('question_ended');
            socket.off('game_finished');
            socket.off('game_over');
            audio.stopAll();
        };
    }, [socket, pin, token]);

    useEffect(() => {
        if (gameState === 'lobby') audio.play('playful');
        else if (gameState === 'result' || gameState === 'finished') {
            audio.stopBg();
            audio.play('leaderboard');
        } else audio.stopBg();
    }, [gameState]);

    useEffect(() => {
        if (gameState === 'question' && timer > 0) audio.play('tick');
    }, [timer, gameState]);

    useEffect(() => {
        if (gameState !== 'countdown' || !question) return;
        const tick = () => {
            const now = Date.now() + offsetRef.current;
            const delay = question.startTime - now;
            if (delay <= 0) {
                setGameState('question');
                setTimer(question.timer);
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
            const remaining = Math.max(0, question.timer - elapsed);
            setTimer(remaining);
            if (remaining <= 0 && !endedOnceRef.current) {
                endedOnceRef.current = true;
                if (socket && pin && token) socket.emit('end_question', { pin, token });
            }
        };
        tick();
        const interval = setInterval(tick, 100);
        return () => clearInterval(interval);
    }, [gameState, question, pin, socket, token]);

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

    const abortSession = () => {
        if (!socket) return;
        const ok = window.confirm('Abort this session? All players will be disconnected.');
        if (!ok) return;
        socket.emit('leave_session', { pin, role: 'host', token });
        navigate('/dashboard');
    };

    const nextAction = () => {
        if (isProcessingNext) return;
        if (gameState === 'result') {
            setIsProcessingNext(true);
            setTimeout(() => setIsProcessingNext(false), 8000);
            if (question && (question.index + 1) < (question.totalQuestions || 0)) {
                socket.emit('start_question', { pin, token });
            } else {
                socket.emit('end_game', { pin, token });
            }
        } else if (gameState === 'finished') {
            navigate('/dashboard');
        }
    };

    if ((!question || gameState === 'lobby') && gameState !== 'finished') return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                <p className="font-bold opacity-60">Loading game...</p>
            </div>
        </div>
    );

    if (gameState === 'countdown') return (
        <div className="min-h-screen flex flex-col items-center justify-center relative z-10 px-4">
            <ReactionCanvas />
            <div className="text-[6rem] sm:text-[9rem] leading-none font-black text-white tabular-nums drop-shadow-[0_0_30px_rgba(255,255,255,0.4)]">
                {countdown}
            </div>
            <p className="text-white/70 text-base sm:text-xl font-medium tracking-widest uppercase mt-4">Get Ready!</p>
            <button type="button" onClick={abortSession} className="mt-8 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-400/40 text-red-300 bg-red-500/10 hover:bg-red-500/20">
                Abort Session
            </button>
        </div>
    );

    return (
        <div className="min-h-screen p-3 sm:p-6 flex flex-col relative z-10">
            <header className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-8 pb-3 sm:pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <h2 className="text-base font-bold tracking-tight">Quizmoto<span className="text-quizmoto-yellow">!</span></h2>
                    {question && (
                        <span className="text-xs font-medium text-white/40 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                            Q{question.index + 1}/{question.totalQuestions}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-start sm:justify-end">
                    {gameState === 'question' && (
                        <div className={'flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-sm font-semibold border transition-colors ' + (timer <= 5 ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'bg-white/5 border-white/10')}>
                            <Clock size={14} />
                            <span className="tabular-nums">{timer}s</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10">
                        <Users size={13} className="text-white/50" />
                        <span className="text-white/60">{answersCount}/{playersCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span className="text-emerald-300/90">{players.filter(p => p.socketId).length} active</span>
                        <span className="text-white/20">·</span>
                        <span className="text-red-300/80">{players.filter(p => !p.socketId).length} off</span>
                    </div>
                    {gameState !== 'finished' && (
                        <button type="button" onClick={abortSession} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-red-400/40 text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-all">
                            Abort
                        </button>
                    )}
                    {(gameState === 'result' || gameState === 'finished') && (
                        <motion.button whileHover={!isProcessingNext ? { scale: 1.02 } : {}} whileTap={!isProcessingNext ? { scale: 0.98 } : {}} onClick={nextAction} disabled={isProcessingNext} className={'px-4 sm:px-5 py-2 rounded-lg font-semibold text-sm shadow-sm transition-all ' + (isProcessingNext ? 'bg-white/40 text-quizmoto-purple/60 cursor-not-allowed' : 'bg-white text-quizmoto-purple hover:bg-white/95')}>
                            {isProcessingNext
                                ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-quizmoto-purple/30 border-t-quizmoto-purple rounded-full animate-spin" />…</span>
                                : gameState === 'finished' ? 'Dashboard' : <span className="flex items-center gap-1">Next <ChevronRight size={14} /></span>}
                        </motion.button>
                    )}
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center">
                {gameState === 'question' && question && (
                    <div className="w-full max-w-6xl">
                        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white/8 border border-white/12 rounded-2xl overflow-hidden mb-4 sm:mb-8 shadow-xl">
                            <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-indigo-500" />
                            <div className="p-4 sm:p-8 md:p-10 text-center">
                                <div className="inline-flex items-center justify-center bg-white/10 border border-white/15 px-3 sm:px-4 py-1.5 rounded-full mb-3 sm:mb-5">
                                    <span className="text-xs font-bold text-white/50 uppercase tracking-[0.25em]">Question {question.index + 1}</span>
                                </div>
                                <h1 className="text-xl sm:text-3xl md:text-4xl font-bold leading-snug tracking-tight">{question.questionText}</h1>
                            </div>
                        </motion.div>
                        <div className="flex justify-center gap-2 sm:gap-4 h-[160px] sm:h-[220px] md:h-[280px] w-full items-end bg-white/3 px-3 sm:px-8 py-4 sm:py-6 rounded-2xl border border-white/8">
                            {['red', 'blue', 'yellow', 'green'].map((color, idx) => {
                                const count = answerDistribution[idx];
                                const height = playersCount > 0 ? (count / playersCount) * 100 : 0;
                                return (
                                    <div key={idx} className="flex flex-col items-center gap-2 sm:gap-3 h-full flex-1">
                                        <div className="flex-1 w-full flex items-end relative">
                                            {count > 0 && <div className="absolute left-1/2 -translate-x-1/2 -top-6 sm:-top-7 font-bold text-sm sm:text-lg text-white/80">{count}</div>}
                                            <motion.div initial={{ height: 0 }} animate={{ height: Math.max(4, height) + '%' }} className={'w-full bg-quizmoto-' + color + ' rounded-t-lg'} />
                                        </div>
                                        <div className={'w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-quizmoto-' + color + ' flex items-center justify-center shadow-lg'}>
                                            <span className="font-bold text-white text-sm sm:text-base">{idx + 1}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {(gameState === 'question' || gameState === 'result') && players.length > 0 && (
                    <div className="w-full max-w-6xl mt-4 sm:mt-8 mb-6 sm:mb-10">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 sm:mb-4">
                                <h3 className="text-xs font-black uppercase tracking-widest text-white/40">Players in session</h3>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { id: 'active', label: 'Active', count: players.filter(p => p.socketId).length, Icon: Wifi },
                                        { id: 'offline', label: 'Offline', count: players.filter(p => !p.socketId).length, Icon: WifiOff },
                                        { id: 'all', label: 'All', count: players.length, Icon: Users }
                                    ].map(({ id, label, count, Icon }) => (
                                        <button key={id} type="button" onClick={() => setPresenceTab(id)} className={'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ' + (presenceTab === id ? 'bg-white text-quizmoto-purple border-white' : 'bg-white/5 text-white/50 border-white/10 hover:text-white')}>
                                            <Icon size={12} />
                                            {label}
                                            <span className={'min-w-[1.25rem] text-center rounded-full px-1 ' + (presenceTab === id ? 'bg-quizmoto-purple/15' : 'bg-white/10')}>{count}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                {(presenceTab === 'active' ? players.filter(p => p.socketId) : presenceTab === 'offline' ? players.filter(p => !p.socketId) : players).map((p) => (
                                    <div key={p.id || p.nickname} className={'flex items-center gap-2 px-2 sm:px-3 py-2 rounded-xl border text-sm ' + (p.socketId ? 'bg-white/5 border-white/10' : 'bg-red-500/5 border-red-500/20 opacity-60 grayscale')}>
                                        <AvatarDisplay avatar={p.avatar} imgClass="w-6 h-6" textClass="text-lg" />
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-xs truncate text-white/80">{p.nickname}</p>
                                            <p className={'text-[8px] font-black uppercase tracking-widest ' + (p.socketId ? 'text-emerald-400' : 'text-red-400')}>{p.socketId ? 'Active' : 'Offline'}</p>
                                        </div>
                                        <span className={'w-1.5 h-1.5 rounded-full shrink-0 ' + (p.socketId ? 'bg-emerald-400' : 'bg-red-400')} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {gameState === 'result' && results && question && (
                    <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-4 sm:gap-8 px-1 sm:px-4">
                        <motion.div initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="lg:w-2/5 flex flex-col">
                            <div className="flex items-center gap-2 mb-3 sm:mb-4">
                                <div className="w-1.5 h-5 rounded-full bg-green-400" />
                                <h2 className="text-base font-semibold text-white/90">Answer Revealed</h2>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 flex-1 flex flex-col justify-center shadow-lg">
                                <p className="text-xs font-medium text-white/40 uppercase tracking-widest mb-3 sm:mb-4">Correct answer</p>
                                <div className={'w-full p-4 sm:p-5 rounded-xl bg-quizmoto-' + ['red', 'blue', 'yellow', 'green'][results.correctIndex] + ' text-white text-base sm:text-lg font-semibold shadow-lg text-center'}>
                                    {(() => {
                                        const opts = Array.isArray(question.options) ? question.options : (() => { try { return JSON.parse(question.options || '[]'); } catch { return []; } })();
                                        return opts[results.correctIndex];
                                    })()}
                                </div>
                                <div className="mt-4 sm:mt-5 flex items-center justify-between pt-4 border-t border-white/10">
                                    <div className="flex items-center gap-2">
                                        <Users size={15} className="text-white/40" />
                                        <span className="text-sm font-medium text-white/60">{answersCount} of {playersCount} responded</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                        <motion.div initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="lg:w-3/5 flex flex-col">
                            <div className="flex items-center gap-2 mb-3 sm:mb-4">
                                <Trophy size={16} className="text-quizmoto-yellow" />
                                <h2 className="text-base font-semibold text-white/90">Leaderboard</h2>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4 space-y-2">
                                {(leaderboard || []).slice(0, 8).map((p, i) => (
                                    <div key={p.nickname || i} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 sm:px-4 py-2.5">
                                        <span className="font-black text-white/40 w-6 text-sm">{i + 1}</span>
                                        <AvatarDisplay avatar={p.avatar} imgClass="w-7 h-7" textClass="text-xl" />
                                        <span className="font-bold text-sm flex-1 truncate">{p.nickname}</span>
                                        <span className="font-black text-quizmoto-yellow">{p.score}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}

                {gameState === 'finished' && (
                    <div className="w-full max-w-4xl text-center px-1">
                        <h1 className="text-2xl sm:text-4xl font-black mb-2 italic uppercase">Game Over!</h1>
                        <p className="text-xs font-bold opacity-60 uppercase tracking-widest mb-6 sm:mb-8">Final Standing</p>

                        {(leaderboard || []).length > 0 && (
                            <div className="flex items-end justify-center gap-2 sm:gap-3 mb-8 sm:mb-10 px-2">
                                {[1, 0, 2].map((podiumIdx) => {
                                    const p = leaderboard[podiumIdx];
                                    if (!p) return <div key={podiumIdx} className="w-20 sm:w-28" />;
                                    const heights = ['h-24 sm:h-32', 'h-32 sm:h-44', 'h-16 sm:h-24'];
                                    const medals = ['🥈', '🥇', '🥉'];
                                    return (
                                        <div key={podiumIdx} className="flex flex-col items-center w-20 sm:w-28">
                                            <div className="text-2xl sm:text-3xl mb-1">{medals[podiumIdx]}</div>
                                            <AvatarDisplay avatar={p.avatar} imgClass="w-8 h-8 sm:w-10 sm:h-10 mb-1" textClass="text-xl sm:text-2xl" />
                                            <div className="text-xs sm:text-sm font-black truncate w-full text-center mb-1">{p.nickname}</div>
                                            <div className="text-quizmoto-yellow font-black text-sm sm:text-base mb-2">{p.score}</div>
                                            <div className={'w-full rounded-t-2xl bg-white/20 border border-white/10 ' + heights[podiumIdx]} />
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="space-y-2 sm:space-y-3 max-w-md mx-auto">
                            {(leaderboard || []).slice(0, 10).map((p, i) => (
                                <div key={p.nickname || i} className="flex items-center gap-3 bg-white/10 rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3">
                                    <span className="font-black text-white/40 w-6 sm:w-8">{i + 1}</span>
                                    <AvatarDisplay avatar={p.avatar} imgClass="w-7 h-7 sm:w-8 sm:h-8" textClass="text-xl sm:text-2xl" />
                                    <span className="font-black flex-1 text-left truncate text-sm sm:text-base">{p.nickname}</span>
                                    <span className="font-black text-quizmoto-yellow text-base sm:text-lg">{p.score}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
            <ReactionCanvas />
        </div>
    );
};

export default GameView;
