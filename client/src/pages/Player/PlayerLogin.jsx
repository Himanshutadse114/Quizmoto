import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiUrl } from '../../config';
import { GoogleLogin } from '@react-oauth/google';

const PlayerLogin = () => {
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            const res = await fetch(apiUrl('/api/player/google'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: credentialResponse.credential })
            });
            const data = await res.json();
            
            if (res.ok) {
                localStorage.setItem('playerToken', data.token);
                localStorage.setItem('playerProfile', JSON.stringify(data.player));
                navigate('/player/dashboard');
            } else {
                setError(data.message || 'Authentication failed');
            }
        } catch (err) {
            setError('Network error');
        }
    };

    const handleGoogleError = () => {
        setError('Google Sign-In failed');
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
                className="w-full max-w-md bg-white/10 backdrop-blur-2xl border border-white/20 p-8 md:p-12 rounded-[40px] shadow-[0_30px_60px_rgba(0,0,0,0.4)] mx-auto relative z-10 flex flex-col items-center"
            >
                <div className="text-center mb-10">
                    <h1 className="text-4xl md:text-5xl font-black mb-2 text-white italic tracking-tighter drop-shadow-md">Quizmoto<span className="text-quizmoto-yellow">!</span></h1>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-white/60">Player Login</p>
                </div>

                {error && (
                    <motion.p 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-full bg-red-500/20 text-red-200 p-4 rounded-2xl mb-8 text-center font-bold text-sm uppercase tracking-wider border border-red-500/30 shadow-inner"
                    >
                        {error}
                    </motion.p>
                )}

                <div className="w-full flex justify-center py-6 bg-black/20 rounded-[24px] border border-white/10 shadow-inner">
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={handleGoogleError}
                        theme="outline"
                        size="large"
                        shape="pill"
                        text="continue_with"
                    />
                </div>

                <div className="mt-10 text-center">
                    <p className="text-sm text-white/60 font-bold uppercase tracking-widest text-[10px]">
                        Secure player authentication
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default PlayerLogin;
