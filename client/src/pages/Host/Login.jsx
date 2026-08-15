import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import { Layers3, ShieldCheck } from 'lucide-react';

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

    const handleGoogleError = () => setError('Google Sign-In failed');

    return (
        <div className="live-quiz-login relative z-30">
            <motion.section
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.28 }}
                className="lq-login-card"
            >
                <div className="lq-login-mark"><Layers3 size={23} strokeWidth={2.1} /></div>
                <div className="lq-login-kicker">QUIZMOTO · SECURE ACCESS</div>
                <h1 className="lq-login-title">SCORM <span>WORLD</span></h1>
                <p className="lq-login-copy">
                    Sign in to your learning workbench to create SCORM courses, track learner activity and launch Live Quiz sessions.
                </p>

                {error && <div className="lq-login-error">{error}</div>}

                <div className="lq-google-wrap">
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

                <div className="lq-login-note">
                    <ShieldCheck size={13} className="inline-block mr-1.5 -mt-0.5" />
                    GOOGLE AUTHENTICATION · HOST ACCESS · SECURE SESSION
                </div>
            </motion.section>
        </div>
    );
};

export default Login;
