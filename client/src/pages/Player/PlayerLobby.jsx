import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { motion } from 'framer-motion';
import ReactionBar from '../../components/ReactionBar';

const PlayerLobby = () => {
    const socket = useSocket();
    const navigate = useNavigate();
    const [playerInfo, setPlayerInfo] = useState(null);
    const [isHostDisconnected, setIsHostDisconnected] = useState(false);

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

        socket.on('question_started', () => {
            navigate('/player/game');
        });

        socket.on('session_info', (data) => {
            if (data.status === 'question' || data.status === 'result') {
                navigate('/player/game');
            }
        });

        socket.on('host_disconnected', () => {
            setIsHostDisconnected(true);
        });

        socket.on('host_reconnected', () => {
            setIsHostDisconnected(false);
        });

        return () => {
            socket.off('question_started');
            socket.off('session_info');
            socket.off('host_disconnected');
            socket.off('host_reconnected');
        };
    }, [socket, navigate]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
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
            
            <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="mb-8"
            >
                <span className="text-8xl">{playerInfo?.avatar || '🎮'}</span>
            </motion.div>
            <h2 className="text-3xl font-black mb-2 uppercase tracking-tight">You're in!</h2>
            <p className="text-xl font-bold opacity-80 mb-12">See your name on screen?</p>

            <div className="bg-white/10 px-8 py-4 rounded-full font-black text-2xl">
                {playerInfo?.nickname}
            </div>

            <p className="mt-20 font-bold opacity-60">Wait for the host to start...</p>
            <ReactionBar pin={playerInfo?.pin} />
        </div>
    );
};

export default PlayerLobby;
