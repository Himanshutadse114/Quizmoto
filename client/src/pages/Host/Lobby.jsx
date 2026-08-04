import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
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
            setPlayers(updatedPlayers || []);
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

    const toggleMode = (mode) => {
        if (!socket) return;
        socket.emit('change_mode', { pin, mode, token });
    };

    const groupedPlayers = session?.gameMode === 'team'
        ? players.reduce((acc, p) => {
            const team = p.teamName;
            if (team && acc[team]) acc[team].push(p);
            else {
                if (!acc['OTHERS']) acc['OTHERS'] = [];
                acc['OTHERS'].push(p);
            }
            return acc;
        }, {})
        : null;

    const onlineCount = players.filter((p) => p.socketId).length;

    return (
        <div className="min-h-screen bg-quizmoto-dark text-white p-6 relative overflow-hidden">
            <ReactionCanvas />
            <div className="max-w-5xl mx-auto relative z-10">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    <div className="flex-1">
                        <h1 className="text-4xl font-black italic uppercase mb-2">Lobby</h1>
                        <p className="text-white/60 font-bold mb-6">PIN: <span className="text-white text-2xl tracking-widest">{pin}</span></p>
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-6 inline-block">
                            <QRCodeSVG value={`${window.location.origin}/join?pin=${pin}`} size={160} bgColor="transparent" fgColor="#ffffff" />
                        </div>
                        <div className="flex gap-3 mb-6">
                            <button
                                type="button"
                                onClick={() => toggleMode('classic')}
                                className={`px-4 py-2 rounded-xl font-black text-sm ${session?.gameMode !== 'team' ? 'bg-quizmoto-purple' : 'bg-white/10'}`}
                            >
                                Classic
                            </button>
                            <button
                                type="button"
                                onClick={() => toggleMode('team')}
                                className={`px-4 py-2 rounded-xl font-black text-sm ${session?.gameMode === 'team' ? 'bg-quizmoto-purple' : 'bg-white/10'}`}
                            >
                                Team
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={startGame}
                            disabled={onlineCount === 0}
                            className="bg-quizmoto-green text-quizmoto-dark font-black px-8 py-4 rounded-2xl text-lg disabled:opacity-40"
                        >
                            Start Game ({onlineCount} online)
                        </button>
                    </div>
                    <div className="flex-1 w-full">
                        <h2 className="font-black uppercase tracking-widest text-sm text-white/50 mb-4">
                            Players ({players.length})
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <AnimatePresence>
                                {players.map((p) => (
                                    <PlayerCard key={p.id || p.nickname} player={p} />
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Lobby;
