import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const PlayerLogin = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            const res = await fetch('/api/player/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            
            if (res.ok) {
                localStorage.setItem('playerToken', data.token);
                localStorage.setItem('playerProfile', JSON.stringify(data.player));
                navigate('/player/dashboard');
            } else {
                setError(data.message || 'Login failed');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-quizmoto-darkPurple relative z-10 overflow-hidden font-sans">
            {/* Ambient Background Elements */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-quizmoto-purple rounded-full blur-[120px] opacity-50 z-0"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-quizmoto-blue rounded-full blur-[120px] opacity-30 z-0"></div>

            <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-full max-w-md bg-white/10 backdrop-blur-2xl border border-white/20 p-8 md:p-12 rounded-[40px] shadow-[0_30px_60px_rgba(0,0,0,0.4)] mx-auto relative z-10"
            >
                <div className="text-center mb-8">
                    <h1 className="text-4xl md:text-5xl font-black mb-2 text-white italic tracking-tighter drop-shadow-md">Quizmoto<span className="text-quizmoto-yellow">!</span></h1>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-white/60">Player Login</p>
                </div>

                {error && (
                    <motion.p 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-red-500/20 text-red-200 p-4 rounded-2xl mb-8 text-center font-bold text-sm uppercase tracking-wider border border-red-500/30 shadow-inner"
                    >
                        {error}
                    </motion.p>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/70 mb-3 ml-2">Username</label>
                        <input
                            type="text"
                            placeholder="Enter your hero name"
                            className="w-full p-5 bg-black/20 border-2 border-white/10 rounded-2xl text-center font-bold text-lg text-white focus:border-quizmoto-yellow focus:bg-black/40 outline-none transition-all placeholder:text-white/30"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/70 mb-3 ml-2">Password</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            className="w-full p-5 bg-black/20 border-2 border-white/10 rounded-2xl text-center font-bold text-lg text-white focus:border-quizmoto-yellow focus:bg-black/40 outline-none transition-all placeholder:text-white/30 tracking-[0.3em]"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    
                    <div className="pt-4">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-quizmoto-yellow to-orange-500 text-quizmoto-darkPurple font-black py-5 rounded-[24px] text-lg hover:shadow-[0_0_30px_rgba(242,169,0,0.5)] transition-all uppercase tracking-widest disabled:opacity-50"
                        >
                            {loading ? 'Logging in...' : 'Login & Play'}
                        </motion.button>
                    </div>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-sm text-white/60 font-bold">
                        Don't have a profile? <Link to="/player/register" className="text-quizmoto-yellow underline hover:text-white transition-colors ml-1">Register Now</Link>
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default PlayerLogin;
