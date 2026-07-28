import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../context/SocketContext';

const ReactionCanvas = () => {
    const socket = useSocket();
    const [reactions, setReactions] = useState([]);

    useEffect(() => {
        if (!socket) return;

        socket.on('new_reaction', (data) => {
            // Create a unique instance of this reaction with randomized properties
            const reaction = {
                ...data,
                x: Math.random() * 80 + 10, // 10% to 90% width
                duration: Math.random() * 2 + 3, // 3 to 5 seconds
                rotation: (Math.random() - 0.5) * 45, // -22.5 to 22.5 deg
                scale: Math.random() * 0.5 + 0.8 // 0.8x to 1.3x scale
            };

            setReactions(prev => [...prev.slice(-30), reaction]); // Limit to 30 visible

            // Auto-remove after animation
            setTimeout(() => {
                setReactions(prev => prev.filter(r => r.id !== reaction.id));
            }, 5000);
        });

        return () => socket.off('new_reaction');
    }, [socket]);

    return (
        <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
            <AnimatePresence>
                {reactions.map((r) => (
                    <motion.div
                        key={r.id}
                        initial={{ y: '90vh', x: `${r.x}vw`, opacity: 0, scale: 0 }}
                        animate={{
                            y: '-20vh',
                            opacity: [0, 1, 1, 0],
                            scale: [0, r.scale, r.scale],
                            x: `${r.x + (Math.random() - 0.5) * 10}vw` // Subtle drift
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: r.duration, ease: "easeOut" }}
                        className="absolute text-5xl md:text-7xl filter drop-shadow-2xl select-none"
                        style={{ rotate: `${r.rotation}deg` }}
                    >
                        {r.emoji}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

export default ReactionCanvas;
