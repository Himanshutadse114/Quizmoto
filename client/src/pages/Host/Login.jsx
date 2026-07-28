import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await login(username, password);
            navigate('/dashboard');
        } catch (err) {
            setError('Invalid credentials');
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 relative z-10">
            <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-white/10 backdrop-blur-md border border-white/20 p-6 md:p-10 rounded-3xl shadow-2xl w-full max-w-md mx-auto"
            >
                <div className="text-center mb-6">
                    <h2 className="text-3xl font-black italic mb-1 text-white uppercase tracking-tight">Host Login</h2>
                    <p className="font-black opacity-40 uppercase tracking-[0.2em] text-[11px] text-white">Access your Dashboard</p>
                </div>

                {error && (
                    <motion.p
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        className="bg-quizmoto-red/20 text-white border border-quizmoto-red/30 p-3 md:p-4 rounded-xl mb-6 text-center font-bold text-sm"
                    >
                        {error}
                    </motion.p>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                    <div>
                        <label className="block text-[10px] md:text-xs font-black mb-2 uppercase tracking-tighter opacity-70 text-white">Username</label>
                        <input
                            type="text"
                            placeholder="Your unique name"
                            className="w-full p-4 bg-white/5 border-2 border-white/10 rounded-xl focus:border-white outline-none transition-all font-bold placeholder:text-white/20 text-white"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] md:text-xs font-black mb-2 uppercase tracking-tighter opacity-70 text-white">Password</label>
                        <input
                            type="password"
                            placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                            className="w-full p-4 bg-white/5 border-2 border-white/10 rounded-xl focus:border-white outline-none transition-all font-bold placeholder:text-white/30 text-white"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-white text-quizmoto-purple font-black py-4 rounded-xl text-lg shadow-[0_6px_0_0_#ccc] hover:shadow-none hover:translate-y-1 transition-all"
                    >
                        LOG IN
                    </button>
                </form>

                <p className="mt-6 md:mt-8 text-center font-bold text-sm md:text-base text-white">
                    <span className="opacity-60">New here?</span> <Link to="/register" className="text-quizmoto-yellow underline ml-1">Create Account</Link>
                </p>
            </motion.div>
        </div>
    );
};

export default Login;
