import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { Users, Play, Copy, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactionCanvas from '../../components/ReactionCanvas';
import AvatarDisplay from '../../components/AvatarDisplay';

const PlayerCard = ({ player }) => (
    <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: player.socketId ? 1 : 0.4 }}
        exit={{ scale: 0, opacity: 0 }}
        className={`bg-white/5 border border-white/10 p-3 rounded-2xl flex items-center gap-3 transition-all ${!player.socketId ? 'grayscale pointer-events-none' : 'hover:bg-white/10'}`}
    >
        <AvatarDisplay avatar={player.avatar} imgClass="w-8 h-8" textClass="text-2xl" />
        <div className="flex flex-col min-w-0">
            <span className="font-black text-sm truncate text-white/80">{player.nickname}</span>
            {!player.socketId && <span className="text-[8px] font-black text-red-400 uppercase tracking-widest leading-none">Offline</span>}
        </div>
    </motion.div>
);

const Lobby = () => {
    const { pin } = useParams();
    const socket = useSocket();
    const navigate = useNavigate();
    const { token } = useAuth();
    const [players, setPlayers] = useState([]);
    const [session, setSession] = useState(null);

    useEffect(() => {
        if (!socket) return;

        socket.emit('join_room', { pin, role: 'host', token });

        socket.on('player_joined', (updatedPlayers) => {
            setPlayers(updatedPlayers);
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

        return () => {
            socket.off('player_joined');
            socket.off('room_info');
            socket.off('error');
        };
    }, [socket, pin, token]);

    const startGame = () => {
        socket.emit('start_question', { pin, token });
        navigate(`/host/game/${pin}`);
    };

    const toggleMode = (mode) => {
        if (!socket) return;
        socket.emit('set_game_mode', { pin, mode, token });
    };

    const groupedPlayers = session?.gameMode === 'team'
        ? players.reduce((acc, p) => {
            const team = p.teamName;
            if (team && acc[team]) acc[team].push(p);
            else acc['OTHERS'].push(p);
            return acc;
        }, { 'RED': [], 'BLUE': [], 'YELLOW': [], 'GREEN': [], 'OTHERS': [] })
        : null;

    const basename = import.meta.env.VITE_APP_BASENAME || '';
    const joinUrl = `${window.location.origin}${basename}/join?pin=${pin}`;

    return (
        <div className="min-h-screen flex flex-col items-center p-8 relative overflow-hidden bg-quizmoto-purple">
            <header className="w-full max-w-7xl flex justify-between items-center mb-10 relative z-20">
                <h2 className="text-2xl font-black italic tracking-tighter">Quizmoto<span className="text-quizmoto-yellow">!</span></h2>
                <div className="flex gap-4">
                    <div className="bg-white/5 p-1 rounded-xl flex border border-white/10">
                        {['classic', 'team'].map((m) => (
                            <button
                                key={m}
                                onClick={() => toggleMode(m)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${session?.gameMode === m ? 'bg-white text-quizmoto-purple shadow-lg' : 'text-white/40 hover:text-white'}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                    <div className="bg-white/10 px-4 py-1.5 rounded-full font-black flex items-center gap-2 border border-white/10 text-[10px]">
                        <Users size={16} /> {players.length} PLAYERS
                    </div>
                </div>
            </header>

            <div className="w-full max-w-7xl flex flex-col gap-10 items-center justify-center mb-10 relative z-20">
                {/* Top Row: PIN and START Button */}
                <div className="w-full flex flex-col md:flex-row gap-8 items-center justify-center">
                    <div className="flex flex-col gap-6 w-full max-w-md">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white text-gray-800 p-8 rounded-[32px] shadow-2xl text-center relative border-b-8 border-gray-200"
                        >
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-quizmoto-purple text-white px-4 py-1.5 rounded-full font-black text-[10px] tracking-widest uppercase">
                                Join at {window.location.hostname}{basename}/join
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 mt-2">Game PIN:</p>
                            <h1 className="text-7xl md:text-7xl font-black tracking-tighter mb-6 text-quizmoto-purple">{pin}</h1>
                            <div className="flex justify-center p-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                <QRCodeSVG value={joinUrl} size={160} />
                            </div>
                        </motion.div>
                    </div>

                    <div className="flex flex-col items-center gap-6 w-full max-w-md">
                        <motion.button
                            whileHover={{ scale: 1.05, translateY: -3 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={startGame}
                            disabled={players.length === 0}
                            className={`w-full py-8 rounded-[32px] font-black text-3xl shadow-xl flex items-center justify-center gap-4 transition-all ${players.length > 0
                                ? 'bg-white text-quizmoto-purple shadow-[0_8px_0_0_rgba(255,255,255,0.2)] hover:shadow-none hover:translate-y-1'
                                : 'bg-white/10 text-white/20 cursor-not-allowed border border-white/5'
                                }`}
                        >
                            <Play size={36} fill="currentColor" /> START GAME
                        </motion.button>
                        <p className="font-black opacity-30 animate-pulse text-[10px] uppercase tracking-[0.3em]">Ready to Launch?</p>
                    </div>
                </div>

                {/* Bottom Section: Full-Width Player Block */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="w-full bg-white/10 backdrop-blur-md rounded-[48px] p-10 border border-white/10 min-h-[400px]"
                >
                    <div className="flex justify-between items-center mb-8 px-4">
                        <h3 className="font-black italic uppercase tracking-tight text-white/50 text-base">Joined Players</h3>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em]">{session?.gameMode === 'team' ? 'Team Distribution' : 'Open Lobby'}</span>
                            <span className="bg-white/20 px-4 py-1.5 rounded-full text-xs font-black">{players.length}</span>
                        </div>
                    </div>

                    <div className="w-full">
                        <AnimatePresence mode="popLayout">
                            {session?.gameMode === 'team' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {Object.entries(groupedPlayers).map(([team, pList]) => {
                                        if (team === 'OTHERS' && pList.length === 0) return null;
                                        const teamConfig = {
                                            'RED': 'bg-red-500/5 border-red-500/20 text-red-400',
                                            'BLUE': 'bg-blue-500/5 border-blue-500/20 text-blue-400',
                                            'YELLOW': 'bg-yellow-500/5 border-yellow-500/20 text-yellow-400',
                                            'GREEN': 'bg-green-500/5 border-green-500/20 text-green-400',
                                            'OTHERS': 'bg-white/5 border-white/10 text-white/40'
                                        };
                                        const [bgClass, borderClass, textClass] = teamConfig[team].split(' ');

                                        return (
                                            <motion.div
                                                layout
                                                key={team}
                                                className={`space-y-4 ${bgClass} p-8 rounded-[40px] border-2 ${borderClass} transition-all duration-500`}
                                            >
                                                <div className="flex justify-between items-center px-2">
                                                    <h4 className={`text-xs font-black uppercase tracking-widest ${textClass}`}>{team} TEAM</h4>
                                                    <span className={`bg-white/10 px-3 py-1 rounded-full text-[10px] font-black ${textClass}`}>{pList.length}</span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {pList.map((player) => (
                                                        <PlayerCard key={player.nickname} player={player} />
                                                    ))}
                                                    {pList.length === 0 && team !== 'OTHERS' && (
                                                        <div className="col-span-full py-8 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center opacity-30">
                                                            <div className={`w-8 h-8 rounded-full ${bgClass.replace('/5', '/20')} mb-2 animate-pulse`} />
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Waiting...</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {players.map((player) => (
                                        <PlayerCard key={player.nickname} player={player} />
                                    ))}
                                </div>
                            )}
                        </AnimatePresence>

                        {players.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-64 opacity-20">
                                <Users size={64} className="mb-4" />
                                <p className="font-black text-xs uppercase tracking-widest text-center">Waiting for heroes to join the battle...</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* PIN Backdrop Text */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] select-none pointer-events-none z-0">
                <h1 className="text-[30vw] font-black leading-none">{pin}</h1>
            </div>

            <ReactionCanvas />
        </div>
    );
};

export default Lobby;
