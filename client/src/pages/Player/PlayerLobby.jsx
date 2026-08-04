import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { motion } from 'framer-motion';
import ReactionBar from '../../components/ReactionBar';
import AvatarDisplay from '../../components/AvatarDisplay';

const PlayerLobby = () => {
    const socket = useSocket();
    const navigate = useNavigate();
    const [playerInfo, setPlayerInfo] = useState(null);
    const [isHostDisconnected, setIsHostDisconnected] = useState(false);
    /** When true, cleanup must NOT leave_session (navigating into the live game). */
    const stayingInSessionRef = useRef(false);

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
        setPlayerInfo(info);

        if (!socket) return;

        stayingInSessionRef.current = false;

        socket.emit('join_room', {
            pin: info.pin,
            nickname: info.nickname,
            role: 'player',
            token: info.token
        });

        socket.on('question_started', (data) => {
            stayingInSessionRef.current = true;
            // Persist payload so PlayerGame can apply Q1 if the event is missed during navigate
            try {
                sessionStorage.setItem('pending_question_started', JSON.stringify(data));
            } catch (_) {}
            navigate('/player/game');
        });

        socket.on('session_info', (data) => {
            if (data.status === 'question' || data.status === 'result') {
                stayingInSessionRef.current = true;
                navigate('/player/game');
            }
        });

        socket.on('host_left', (data) => {
            setIsHostDisconnected(false);
            stayingInSessionRef.current = true;
            try { localStorage.removeItem('player_info'); } catch (_) {}
            alert((data && data.message) || 'Host left the session.');
            navigate('/');
        });

        socket.on('host_disconnected', () => {
            setIsHostDisconnected(true);
        });

        socket.on('host_reconnected', () => {
            setIsHostDisconnected(false);
        });

        socket.on('error', (msg) => {
            if (msg === 'Game not found' || msg === 'Game is already finished' || msg === 'Unauthorized Host Entry') {
                stayingInSessionRef.current = true;
                alert(msg);
                try { localStorage.removeItem('player_info'); } catch (_) {}
                navigate('/');
            }
        });

        const onPageHide = () => {
            if (!stayingInSessionRef.current) {
                leaveSession({ clearStorage: true });
            }
        };
        window.addEventListener('pagehide', onPageHide);
        window.addEventListener('beforeunload', onPageHide);

        return () => {
            window.removeEventListener('pagehide', onPageHide);
            window.removeEventListener('beforeunload', onPageHide);
            socket.off('question_started');
            socket.off('session_info');
            socket.off('host_disconnected');
            socket.off('host_left');
            socket.off('host_reconnected');
            socket.off('error');
            if (!stayingInSessionRef.current) {
                leaveSession({ clearStorage: true });
            }
        };
    }, [socket, navigate, leaveSession]);

    const handleLeaveClick = () => {
        stayingInSessionRef.current = true;
        leaveSession({ clearStorage: true });
        navigate('/');
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
            {isHostDisconnected && (
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
            )}

            <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="mb-8"
            >
                <AvatarDisplay avatar={playerInfo?.avatar} imgClass="w-32 h-32" textClass="text-8xl" />
            </motion.div>
            <h2 className="text-3xl font-black mb-2 uppercase tracking-tight">You're in!</h2>
            <p className="text-xl font-bold opacity-80 mb-12">See your name on screen?</p>

            <div className="bg-white/10 px-8 py-4 rounded-full font-black text-2xl">
                {playerInfo?.nickname}
            </div>

            <p className="mt-16 font-bold opacity-60">Wait for the host to start...</p>

            <button
                type="button"
                onClick={handleLeaveClick}
                className="mt-8 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/20 text-white/70 hover:bg-white/10 transition-all"
            >
                Leave session
            </button>

            <ReactionBar pin={playerInfo?.pin} />
        </div>
    );
};

export default PlayerLobby;
