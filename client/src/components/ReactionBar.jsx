import React from 'react';
import { motion } from 'framer-motion';
import { useSocket } from '../context/SocketContext';

const REACTIONS = ['🔥', '😂', '👏', '🛡️', '😮', '💯'];

const ReactionBar = ({ pin }) => {
    const socket = useSocket();

    const sendReaction = (emoji) => {
        if (!socket || !pin) return;
        socket.emit('send_reaction', { pin, emoji });
    };

    return (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 flex gap-4 shadow-2xl z-50">
            {REACTIONS.map((emoji, idx) => (
                <motion.button
                    key={idx}
                    whileTap={{ scale: 1.4, rotate: [0, -10, 10, 0] }}
                    onClick={() => sendReaction(emoji)}
                    className="text-2xl hover:scale-120 transition-transform"
                >
                    {emoji}
                </motion.button>
            ))}
        </div>
    );
};

export default ReactionBar;
