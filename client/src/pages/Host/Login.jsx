import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import { ShieldCheck, Users, Zap } from 'lucide-react';
import './quizmotoArenaPolish.css';

const getGoogleButtonWidth = () => {
    if (typeof window === 'undefined') return 320;
    return Math.max(220, Math.min(320, window.innerWidth - 72));
};

const Login = () => {
    const [error, setError] = useState('');
    const [googleButtonWidth, setGoogleButtonWidth] = useState(getGoogleButtonWidth);
    const { loginWithGoogle } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const updateWidth = () => setGoogleButtonWidth(getGoogleButtonWidth());
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            setError('');
            await loginWithGoogle(credentialResponse.credential);
            navigate('/host');
        } catch (err) {
            setError('Authentication failed. Please try again.');
        }
    };

    const handleGoogleError = () => {
        setError('Google Sign-In failed. Please try again.');
    };

    return (
        <div className="quizmoto-login-arena">
            <motion.main
                initial={{ y: 18, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="ql-shell"
            >
                <section className="ql-brand-panel">
                    <div>
                        <div className="ql-logo">Quizmoto<span>!</span></div>
                        <div className="ql-eyebrow">Real-time learning arena</div>
                        <h1 className="ql-headline">Launch quizzes that feel <em>alive.</em></h1>
                        <p className="ql-copy">
                            Host fast, interactive knowledge challenges with live players, instant scoring, reactions, analytics and AI-assisted quiz creation.
                        </p>
                    </div>

                    <div className="ql-live-strip" aria-label="Quizmoto capabilities">
                        <div className="ql-chip"><span className="ql-chip-dot" /> Live sessions</div>
                        <div className="ql-chip"><Zap size={12} /> Instant scoring</div>
                        <div className="ql-chip"><Users size={12} /> Audience play</div>
                    </div>
                </section>

                <section className="ql-form-panel">
                    <div className="ql-mini-label">Host control</div>
                    <h2 className="ql-title">Enter Quizmoto</h2>
                    <p className="ql-sub">Sign in securely to create, host and review your live quiz sessions.</p>

                    {error && <div className="ql-error">{error}</div>}

                    <div className="ql-google-wrap">
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={handleGoogleError}
                            theme="outline"
                            size="large"
                            shape="rectangular"
                            text="continue_with"
                            width={String(googleButtonWidth)}
                        />
                    </div>

                    <div className="ql-divider"><span>or join as a player</span></div>

                    <button type="button" onClick={() => navigate('/join')} className="ql-join">
                        Join a live game
                    </button>

                    <div className="ql-foot">
                        <ShieldCheck size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
                        Google authentication for hosts · Game PIN access for players
                    </div>
                </section>
            </motion.main>
        </div>
    );
};

export default Login;