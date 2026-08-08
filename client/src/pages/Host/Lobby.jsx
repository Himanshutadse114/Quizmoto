import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { Users, Play, Wifi, WifiOff, UserX, X } from 'lucide-react';
import QRCode from 'react-qr-code';

const PresenceTab = ({ id, label, count, active, onClick, icon: Icon }) => (
    <button
        type="button"
        onClick={() => onClick(id)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors ${
            active ? 'bg-quizmoto-purple/15 text-quizmoto-purple' : 'bg-white/10 text-white/60'
        }`}
    >
        {Icon && <Icon size={12} />}
        {label}
        <span
            className={`ml-0.5 min-w-[1.25rem] h-5 px-1.5 rounded-full flex items-center justify-center text-[10px] font-black ${
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

        socket.on('question_started', (data) => {
            try {
                if (data) sessionStorage.setItem('pending_question_started', JSON.stringify(data));
            } catch (_) {}
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
        socket.emit('change_mode', { pin, token, mode });
    };

    const activePlayers = useMemo(
        () => players.filter((p) => p.socketId),
        [players]
    );
    const offlinePlayers = useMemo(
        () => players.filter((p) => !p.socketId),
        [players]
    );

    const displayed =
        presenceTab === 'active'
            ? activePlayers
            : presenceTab === 'offline'
              ? offlinePlayers
              : players;

    const joinUrl =
        typeof window !== 'undefined'
            ? `${window.location.origin}/join`
            : 'https://quizmoto-frontend.onrender.com/join';

    return (
        <div className="min-h-screen relative z-10 p-4 md:p-8 max-w-6xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <h1 className="text-2xl md:text-3xl font-black italic tracking-tighter">Quizmoto!</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => toggleMode('classic')}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            (session?.gameMode || 'classic') === 'classic'
                                ? 'bg-white text-black'
                                : 'bg-white/10 text-white/60'
                        }`}
                    >
                        Classic
                    </button>
                    <button
                        type="button"
                        onClick={() => toggleMode('team')}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            session?.gameMode === 'team' ? 'bg-white text-black' : 'bg-white/10 text-white/60'
                        }`}
                    >
                        Team
                    </button>
                    <span className="text-[10px] font-bold text-white/50 px-2">
                        {activePlayers.length} active · {offlinePlayers.length} offline
                    </span>
                    <button
                        type="button"
                        onClick={abortSession}
                        className="px-3 py-1.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-black uppercase tracking-wider"
                    >
                        Abort
                    </button>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="rounded-3xl bg-white/5 border border-white/10 p-6 flex flex-col items-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">
                        Join at {typeof window !== 'undefined' ? window.location.host : 'quizmoto'}/join
                    </p>
                    <p className="text-sm font-bold text-white/50 mb-1">Game PIN:</p>
                    <div className="text-5xl md:text-6xl font-black tracking-tight text-white mb-4">{pin}</div>
                    <div className="bg-white p-3 rounded-2xl">
                        <QRCode value={`${joinUrl}?pin=${pin}`} size={160} />
                    </div>
                </div>

                <div className="rounded-3xl bg-white/5 border border-white/10 p-6 flex flex-col justify-center items-center gap-4">
                    <button
                        type="button"
                        onClick={startGame}
                        disabled={players.length === 0}
                        className="w-full max-w-xs py-4 rounded-2xl bg-quizmoto-purple text-white font-black text-lg shadow-[0_4px_0_0_#4c1d95] disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                        <Play size={22} fill="currentColor" />
                        Start Game
                    </button>
                    <p className="text-xs text-white/40 text-center">Waiting for active players…</p>
                    <button
                        type="button"
                        onClick={abortSession}
                        className="text-xs font-bold text-red-300/80 uppercase tracking-wider"
                    >
                        Abort Session
                    </button>
                </div>
            </div>

            <div className="mt-8">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                    <h2 className="text-sm font-black uppercase tracking-widest text-white/40 mr-2">Players</h2>
                    <PresenceTab
                        id="active"
                        label="Active"
                        count={activePlayers.length}
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {displayed.map((p) => (
                        <div
                            key={p.id || p.nickname}
                            className={`rounded-2xl border px-3 py-3 flex items-center gap-2 ${
                                p.socketId
                                    ? 'bg-white/5 border-white/10'
                                    : 'bg-white/[0.03] border-white/5 opacity-60'
                            }`}
                        >
                            <div className="w-9 h-9 rounded-full bg-quizmoto-purple/30 flex items-center justify-center text-sm font-black">
                                {(p.nickname || '?')[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="font-bold text-sm truncate">{p.nickname}</div>
                                {p.teamName && (
                                    <div className="text-[10px] text-white/40 truncate">{p.teamName}</div>
                                )}
                            </div>
                            {!p.socketId && <UserX size={14} className="text-white/30 shrink-0" />}
                        </div>
                    ))}
                    {displayed.length === 0 && (
                        <p className="text-sm text-white/40 col-span-full">No players in this list yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Lobby;
