import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { motion } from 'framer-motion';

const PlayerLobby = () => {
    const socket = useSocket();
    const navigate = useNavigate();
    const [pin, setPin] = useState('');
    const [nickname, setNickname] = useState('');
    const [isHostDisconnected, setIsHostDisconnected] = useState(false);

    useEffect(() => {
        const info = JSON.parse(localStorage.getItem('player_info'));
        if (!info) {
            navigate('/join');
            return;
        }
        setPin(info.pin);
        setNickname(info.nickname);

        if (!socket) return;

        // Re-join to ensure we are in the room
        socket.emit('join_room', {
            pin: info.pin,
            nickname: info.nickname,
            role: 'player',
            token: info.token
        });

        socket.on('question_started', () => {
            navigate('/player/game');
        });

        socket.on('session_info', (data) => {
            if (data.status === 'question' || data.status === 'result') {
                navigate('/player/game');
            }
        });

        socket.on('host_left', (data) => {
            setIsHostDisconnected(false);
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
            console.error(msg);
            if (msg === 'Game not found' || msg === 'Game is already finished') {
                alert(msg);
                navigate('/');
            }
        });

        return () => {
            socket.off('question_started');
            socket.off('session_info');
            socket.off('host_disconnected');
            socket.off('host_left');
            socket.off('host_reconnected');
            socket.off('error');
        };
    }, [socket, navigate]);

    return (
        <div className="min-h-screen bg-quizmoto-dark text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {isHostDisconnected && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
                    <div className="bg-quizmoto-card border border-quizmoto-red/50 p-8 rounded-[2.5rem] text-center max-w-sm shadow-2xl animate-bounce">
                        <div className="text-5xl mb-4">📡</div>
                        <h2 className="text-2xl font-black italic uppercase mb-2 text-quizmoto-red">Host Offline</h2>
                        <p className="font-bold opacity-80 mb-6">Waiting for the host to reconnect... Don't leave!</p>
                        <button onClick={() => {
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
                                localStorage.removeItem('player_info');
                            } catch (_) {}
                            navigate('/');
                        }} className="text-sm underline opacity-60 font-black tracking-widest hover:opacity-100">LEAVE GAME</button>
                    </div>
                </div>
            )}

            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
            >
                <h1 className="text-4xl font-black italic uppercase mb-2">You're in!</h1>
                <p className="text-white/60 font-bold mb-8">See your nickname on the host screen</p>
                <div className="bg-white/10 border border-white/20 rounded-3xl px-10 py-8 mb-6">
                    <p className="text-xs font-black tracking-widest text-white/40 uppercase mb-2">Playing as</p>
                    <p className="text-3xl font-black">{nickname}</p>
                    <p className="text-sm font-bold text-white/50 mt-2">PIN {pin}</p>
                </div>
                <p className="text-white/40 font-bold animate-pulse">Waiting for host to start...</p>
            </motion.div>
        </div>
    );
};

export default PlayerLobby;
