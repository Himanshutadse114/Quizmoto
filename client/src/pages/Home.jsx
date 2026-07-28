import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const Home = () => {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center relative overflow-hidden">
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="z-10 w-full max-w-lg"
            >
                <motion.h1
                    className="text-5xl sm:text-6xl md:text-7xl font-black mb-4 tracking-tighter italic drop-shadow-2xl"
                    style={{ WebkitTextStroke: '1px white' }}
                >
                    Qui
                    <span className="relative inline-flex justify-center">
                        <svg className="absolute -top-[0.8em] left-1/2 -translate-x-[60%] w-[1.2em] h-[1.2em] text-quizmoto-yellow drop-shadow-xl transform -rotate-12 z-10" viewBox="0 0 512 512" fill="currentColor">
                           <path d="M256 0c-15.5 0-29.3 11-31.6 26.2L192 244.5 44 266c-17 2.4-28 17.5-28 34.8 0 16.5 13.5 30 30 30h321.4c34 0 65.5-20.2 81.3-51.2l62.4-124.8c6.6-13.3 2.7-29.7-9.5-38-12-8-28.5-6.5-38.5 4.3L376.6 215.3l17.7-183.1C395.7 15 382.7 0 366.5 0h-110.5z"/>
                           <path d="M12.5 362.8c-12.2 4-18.7 17.3-14.7 29.5L25.3 481c4.5 13.5 17.1 23 31.3 23h398.8c14.2 0 26.8-9.5 31.3-23l27.5-88.7c4-12.2-2.5-25.5-14.7-29.5s-25.5 2.5-29.5 14.7L445 450H67l-25-80.6c-4-12.2-17.3-18.7-29.5-14.6z"/>
                        </svg>
                        z
                    </span>
                    moto<span className="text-quizmoto-yellow">!</span>
                </motion.h1>
                <p className="text-base md:text-lg font-bold mb-8 md:mb-10 opacity-80 tracking-wide uppercase">
                    Real-Time Quiz Experience
                </p>

                <div className="flex flex-col sm:flex-row gap-4 w-full px-4 sm:px-0 max-w-lg mx-auto">
                    <motion.button
                        whileHover={{ scale: 1.05, translateY: -3 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/join')}
                        className="flex-1 bg-white text-quizmoto-purple font-black py-5 px-10 rounded-xl text-xl shadow-[0_6px_0_0_rgba(255,255,255,0.3)] hover:shadow-none hover:translate-y-1 transition-all"
                    >
                        Join Game
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.05, translateY: -3 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/login')}
                        className="flex-1 bg-quizmoto-blue text-white font-black py-5 px-10 rounded-xl text-xl shadow-[0_6px_0_0_rgba(19,104,206,0.3)] hover:shadow-none hover:translate-y-1 transition-all"
                    >
                        Host Quiz
                    </motion.button>
                </div>
            </motion.div>

            <div className="mt-8 text-center z-10">
                <p className="text-sm text-white/70 font-bold uppercase tracking-widest">
                    Want to save your stats? <br className="sm:hidden" />
                    <button onClick={() => navigate('/player/login')} className="text-quizmoto-yellow hover:text-white underline transition-colors mt-2 sm:mt-0 sm:ml-2">
                        Player Login
                    </button>
                </p>
            </div>

            <footer className="mt-12 md:absolute md:bottom-8 opacity-40 text-[10px] md:text-sm font-bold tracking-widest uppercase">
                &copy; 2024 Quizmoto! &bull; Built for Speed
            </footer>
        </div>
    );
};

export default Home;
