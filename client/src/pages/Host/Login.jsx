import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import { ArrowLeft, Gamepad2, ShieldCheck } from 'lucide-react';

const Login = () => {
    const [error, setError] = useState('');
    const { loginWithGoogle } = useAuth();
    const navigate = useNavigate();

    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            await loginWithGoogle(credentialResponse.credential);
            navigate('/host');
        } catch (err) {
            setError('Authentication failed. Please try again.');
        }
    };

    const handleGoogleError = () => setError('Google Sign-In failed');

    return (
        <div className="min-h-screen bg-quizmoto-purple relative z-30 flex items-center justify-center p-5 overflow-hidden">
            <motion.section
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.28 }}
                className="w-full max-w-md bg-white text-[#3c3c3c] rounded-[30px] border-b-[7px] border-[#d8d8d8] p-7 sm:p-9 shadow-2xl relative z-10"
            >
                <button type="button" onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 text-xs font-black text-gray-400 hover:text-quizmoto-purple mb-6">
                    <ArrowLeft size={15} /> BACK
                </button>

                <div className="w-14 h-14 rounded-2xl bg-quizmoto-blue text-white grid place-items-center shadow-[0_5px_0_0_#0e4b94]"><Gamepad2 size={27} /></div>
                <h1 className="mt-6 text-5xl font-black tracking-[-.055em] leading-none text-quizmoto-purple">Quizmoto<span className="text-quizmoto-yellow">!</span></h1>
                <p className="mt-4 text-sm font-bold text-gray-500 leading-relaxed">
                    Sign in as a host to create quizzes, launch live sessions and review game reports.
                </p>

                {error && <div className="mt-5 bg-red-50 border-2 border-red-100 rounded-2xl p-3 text-red-500 text-xs font-bold">{error}</div>}

                <div className="mt-7 p-4 rounded-2xl bg-gray-50 border-2 border-gray-100 flex justify-center overflow-hidden">
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={handleGoogleError}
                        theme="outline"
                        size="large"
                        shape="rectangular"
                        text="continue_with"
                        width="320"
                    />
                </div>

                <div className="mt-5 text-center text-[10px] font-black uppercase tracking-wider text-gray-400">
                    <ShieldCheck size={13} className="inline-block mr-1.5 -mt-0.5 text-quizmoto-green" />
                    Secure host access
                </div>
            </motion.section>
        </div>
    );
};

export default Login;
