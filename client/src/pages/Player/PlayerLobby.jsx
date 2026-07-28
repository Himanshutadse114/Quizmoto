import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { motion } from 'framer-motion';
import ReactionBar from '../../components/ReactionBar';

const PlayerLobby = () => {
    const socket = useSocket();
    const navigate = useNavigate();
    const [playerInfo, setPlayerInfo] = useState(null);

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

        return () => {
            socket.off('question_started');
            socket.off('session_info');
        };
    }, [socket, navigate]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
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
