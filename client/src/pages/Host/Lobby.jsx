import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { Users, Play, Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactionCanvas from '../../components/ReactionCanvas';
import AvatarDisplay from '../../components/AvatarDisplay';

const PlayerCard = ({ player }) => {
    const online = !!player.socketId;
    return (
        <motion.div
            layout
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: online ? 1 : 0.55 }}
            exit={{ scale: 0, opacity: 0 }}
            className={`bg-white/5 border p-3 rounded-2xl flex items-center gap-3 transition-all ${
                online
                    ? 'border-white/10 hover:bg-white/10'
                    : 'border-red-500/20 grayscale'
            }`}
        >
            <AvatarDisplay avatar={player.avatar} imgClass="w-8 h-8" textClass="text-2xl" />
            <div className="flex flex-col min-w-0 flex-1">
                <span className="font-black text-sm truncate text-white/80">{player.nickname}</span>
                <span
                    className={`text-[8px] font-black uppercase tracking-widest leading-none mt-0.5 ${
                        online ? 'text-emerald-400' : 'text-red-400'
                    }`}
                >
                    {online ? 'Active' : 'Offline'}
                </span>
            </div>
            <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                    online ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-red-400/70'
                }`}
                title={online ? 'Active' : 'Offline'}
            />
        </motion.div>
    );
};

const PresenceTab = ({ id, label, count, active, onClick, icon: Icon }) => (
    <button
        type="button"
        onClick={() => onClick(id)}
        className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
            active
                ? 'bg-white text-quizmoto-purple border-white shadow-lg'
                : 'bg-white/5 text-white/50 border-white/10 hover:text-white hover:bg-white/10'
        }`}
    >
        {Icon ? <Icon size={14} /> : null}
        {label}
        <span
            className={`min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-center ${
                active ? 'bg-quizmoto-purple/15 text-quizmoto-purple' : 'bg-white/10 text-white/60'
            }`}
        >
            {count}
        </span>
    </button>
);

const Lobby = () => {
    const { pin } = useParams();
    const socket = useSocket();
    const navigate = useNavigate();
    const { token } = useAuth();
    const [players, setPlayers] = useState([]);
    const [session, setSession] = useState(null);
    const [presenceTab, setPresenceTab] = useState('active');

    useEffect(() => {
        if (!socket) return;

        socket.emit('join_room', { pin, role: 'host', token });

        socket.on('player_joined', (updatedPlayers) => {
            setPlayers(Array.isArray(updatedPlayers) ? updatedPlayers : []);
        });

        socket.on('player_left', (payload) => {
            if (payload && Array.isArray(payload.players)) {
                setPlayers(payload.players);
            }
        });

        socket.on('room_info', (sessionData) => {
            setSession(sessionData);
            if (sessionData.players) {
                setPlayers(sessionData.players);
            }
        });

        socket.on('error', (msg) => {
            console.error('Socket Error:', msg);
            alert(msg);
        });

        socket.on('question_started', () => {
            navigate(`/host/game/${pin}`);
        });

        return () => {
            socket.off('player_joined');
            socket.off('player_left');
            socket.off('room_info');
            socket.off('error');
            socket.off('question_started');
        };
    }, [socket, pin, token, navigate]);

    const startGame = () => {
        socket.emit('start_question', { pin, token });
    };

    const abortSession = () => {
        if (!socket) return;
        const ok = window.confirm('Abort this session? All players will be disconnected.');
        if (!ok) return;
        socket.emit('leave_session', { pin, role: 'host', token });
        navigate('/dashboard');
    };

    const toggleMode = (mode) => {
        if (!socket) return;
        socket.emit('change_mode', { pin, mode, token });
    };

    const onlinePlayers = useMemo(
        () => players.filter((p) => !!p.socketId),
        [players]
    );
    const offlinePlayers = useMemo(
        () => players.filter((p) => !p.socketId),
        [players]
    );

    const visiblePlayers = useMemo(() => {
        if (presenceTab === 'active') return onlinePlayers;
        if (presenceTab === 'offline') return offlinePlayers;
        return players;
    }, [presenceTab, onlinePlayers, offlinePlayers, players]);

    const groupedPlayers = session?.gameMode === 'team'
        ? visiblePlayers.reduce(
            (acc, p) => {
                const team = p.teamName;
                if (team && acc[team]) acc[team].push(p);
                else acc['OTHERS'].push(p);
                return acc;
            },
            { RED: [], BLUE: [], YELLOW: [], GREEN: [], OTHERS: [] }
        )
        : null;

    const basename = import.meta.env.VITE_APP_BASENAME || '';
    const joinUrl = `${window.location.origin}${basename}/join?pin=${pin}`;
    const canStart = onlinePlayers.length > 0;

    return (
        <div className="min-h-screen flex flex-col items-center p-4 sm:p-8 relative overflow-hidden bg-quizmoto-purple">
            <header className="w-full max-w-7xl flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-10 relative z-20">
                <h2 className="text-xl sm:text-2xl font-black italic tracking-tighter">
                    Quizmoto<span className="text-quizmoto-yellow">!</span>
                </h2>
                <div className="flex gap-2 sm:gap-4 flex-wrap justify-start sm:justify-end items-center">
                    <div className="bg-white/5 p-1 rounded-xl flex border border-white/10">
                        {['classic', 'team'].map((m) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => toggleMode(m)}
                                className={`px-3 sm:px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                    session?.gameMode === m
                                        ? 'bg-white text-quizmoto-purple shadow-lg'
                                        : 'text-white/40 hover:text-white'
                                }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                    <div className="bg-white/10 px-3 sm:px-4 py-1.5 rounded-full font-black flex items-center gap-2 border border-white/10 text-[10px]">
                        <Users size={16} />
                        <span className="text-emerald-300">{onlinePlayers.length} active</span>
                        <span className="text-white/30">·</span>
                        <span className="text-red-300">{offlinePlayers.length} offline</span>
                    </div>
                    <button
                        type="button"
                        onClick={abortSession}
                        className="px-3 sm:px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-400/40 text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-all"
                    >
                        Abort
                    </button>
                </div>
            </header>

            <div className="w-full max-w-7xl flex flex-col gap-6 sm:gap-10 items-center justify-center mb-8 sm:mb-10 relative z-20">
                <div className="w-full flex flex-col md:flex-row gap-4 sm:gap-8 items-center justify-center">
                    <div className="flex flex-col gap-6 w-full max-w-md">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white text-gray-800 p-5 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-2xl text-center relative border-b-8 border-gray-200"
                        >
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-quizmoto-purple text-white px-3 sm:px-4 py-1.5 rounded-full font-black text-[9px] sm:text-[10px] tracking-widest uppercase max-w-[90%] truncate">
                                Join at {window.location.hostname}{basename}/join
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 mt-2">
                                Game PIN:
                            </p>
                            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter mb-4 sm:mb-6 text-quizmoto-purple">
                                {pin}
                            </h1>
                            <div className="flex justify-center p-3 sm:p-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                <QRCodeSVG value={joinUrl} size={140} className="sm:hidden" />
                                <QRCodeSVG value={joinUrl} size={160} className="hidden sm:block" />
                            </div>
                        </motion.div>
                    </div>

                    <div className="flex flex-col items-center gap-4 sm:gap-6 w-full max-w-md">
                        <motion.button
                            whileHover={canStart ? { scale: 1.05, translateY: -3 } : {}}
                            whileTap={canStart ? { scale: 0.95 } : {}}
                            onClick={startGame}
                            disabled={!canStart}
                            type="button"
                            className={`w-full py-5 sm:py-8 rounded-[24px] sm:rounded-[32px] font-black text-xl sm:text-3xl shadow-xl flex items-center justify-center gap-3 sm:gap-4 transition-all ${
                                canStart
                                    ? 'bg-white text-quizmoto-purple shadow-[0_8px_0_0_rgba(255,255,255,0.2)] hover:shadow-none hover:translate-y-1'
                                    : 'bg-white/10 text-white/20 cursor-not-allowed border border-white/5'
                            }`}
                        >
                            <Play size={28} className="sm:w-9 sm:h-9" fill="currentColor" /> START GAME
                        </motion.button>
                        <p className="font-black opacity-30 animate-pulse text-[10px] uppercase tracking-[0.3em] text-center">
                            {canStart
                                ? `${onlinePlayers.length} player${onlinePlayers.length === 1 ? '' : 's'} ready`
                                : 'Waiting for active players…'}
                        </p>
                        <button
                            type="button"
                            onClick={abortSession}
                            className="mt-1 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-red-400/40 text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-all"
                        >
                            Abort Session
                        </button>
                    </div>
                </div>

                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="w-full bg-white/10 backdrop-blur-md rounded-[24px] sm:rounded-[48px] p-4 sm:p-10 border border-white/10 min-h-[240px] sm:min-h-[400px]"
                >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8 px-1 sm:px-2">
                        <h3 className="font-black italic uppercase tracking-tight text-white/50 text-sm sm:text-base">
                            Players
                        </h3>
                        <div className="flex flex-wrap items-center gap-2">
                            <PresenceTab
                                id="active"
                                label="Active"
                                count={onlinePlayers.length}
                                active={presenceTab === 'active'}
                                onClick={setPresenceTab}
                                icon={Wifi}
                            />
                            <PresenceTab
                                id="offline"
                                label="Offline"
                                count={offlinePlayers.length}
                                active={presenceTab === 'offline'}
                                onClick={setPresenceTab}
                                icon={WifiOff}
                            />
                            <PresenceTab
                                id="all"
                                label="All"
                                count={players.length}
                                active={presenceTab === 'all'}
                                onClick={setPresenceTab}
                                icon={Users}
                            />
                        </div>
                    </div>

                    <div className="w-full">
                        <AnimatePresence mode="popLayout">
                            {session?.gameMode === 'team' && groupedPlayers ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                                    {Object.entries(groupedPlayers).map(([team, pList]) => {
                                        if (team === 'OTHERS' && pList.length === 0) return null;
                                        const teamConfig = {
                                            RED: 'bg-red-500/5 border-red-500/20 text-red-400',
                                            BLUE: 'bg-blue-500/5 border-blue-500/20 text-blue-400',
                                            YELLOW: 'bg-yellow-500/5 border-yellow-500/20 text-yellow-400',
                                            GREEN: 'bg-green-500/5 border-green-500/20 text-green-400',
                                            OTHERS: 'bg-white/5 border-white/10 text-white/40'
                                        };
                                        const classes = teamConfig[team] || teamConfig.OTHERS;
                                        const [bgClass, borderClass, textClass] = classes.split(' ');

                                        return (
                                            <motion.div
                                                layout
                                                key={team}
                                                className={`space-y-3 sm:space-y-4 ${bgClass} p-4 sm:p-8 rounded-[24px] sm:rounded-[40px] border-2 ${borderClass}`}
                                            >
                                                <div className="flex justify-between items-center px-1 sm:px-2">
                                                    <h4 className={`text-xs font-black uppercase tracking-widest ${textClass}`}>
                                                        {team} TEAM
                                                    </h4>
                                                    <span className={`bg-white/10 px-3 py-1 rounded-full text-[10px] font-black ${textClass}`}>
                                                        {pList.length}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {pList.map((player) => (
                                                        <PlayerCard key={player.id || player.nickname} player={player} />
                                                    ))}
                                                    {pList.length === 0 && team !== 'OTHERS' && (
                                                        <div className="col-span-full py-8 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center opacity-30">
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-white/20">
                                                                No one here
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                                    {visiblePlayers.map((player) => (
                                        <PlayerCard key={player.id || player.nickname} player={player} />
                                    ))}
                                </div>
                            )}
                        </AnimatePresence>

                        {visiblePlayers.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-40 sm:h-48 opacity-30">
                                {presenceTab === 'offline' ? (
                                    <>
                                        <WifiOff size={40} className="mb-4" />
                                        <p className="font-black text-xs uppercase tracking-widest text-center">
                                            No offline players
                                        </p>
                                    </>
                                ) : presenceTab === 'active' ? (
                                    <>
                                        <Wifi size={40} className="mb-4" />
                                        <p className="font-black text-xs uppercase tracking-widest text-center">
                                            Waiting for players to join…
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <Users size={40} className="mb-4" />
                                        <p className="font-black text-xs uppercase tracking-widest text-center">
                                            Waiting for heroes to join the battle…
                                        </p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>

            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] select-none pointer-events-none z-0">
                <h1 className="text-[30vw] font-black leading-none">{pin}</h1>
            </div>

            <ReactionCanvas />
        </div>
    );
};

export default Lobby;
