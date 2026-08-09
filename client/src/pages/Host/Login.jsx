import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';

const Login = () => {
    const [error, setError] = useState('');
    const { loginWithGoogle } = useAuth();
    const navigate = useNavigate();

    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            await loginWithGoogle(credentialResponse.credential);
            navigate('/scorm');
        } catch (err) {
            setError('Authentication failed. Please try again.');
        }
    };

    const handleGoogleError = () => {
        setError('Google Sign-In failed');
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 relative z-10">
            <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-white/10 backdrop-blur-md border border-white/20 p-6 md:p-10 rounded-3xl shadow-2xl w-full max-w-md mx-auto flex flex-col items-center"
            >
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-black italic mb-1 text-white uppercase tracking-tight">Host Login</h2>
                    <p className="font-black opacity-40 uppercase tracking-[0.2em] text-[11px] text-white">Access SCORM World</p>
                </div>

                {error && (
                    <motion.p
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        className="bg-quizmoto-red/20 text-white border border-quizmoto-red/30 p-3 md:p-4 rounded-xl mb-6 text-center font-bold text-sm w-full"
                    >
                        {error}
                    </motion.p>
                )}

                <div className="w-full flex justify-center py-4 bg-white/5 rounded-2xl border border-white/10">
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={handleGoogleError}
                        theme="outline"
                        size="large"
                        shape="pill"
                        text="continue_with"
                    />
                </div>

                <p className="mt-8 text-center font-bold text-sm md:text-base text-white opacity-60">
                    Secure authentication via Google
                </p>
            </motion.div>
        </div>
    );
};

export default Login;
