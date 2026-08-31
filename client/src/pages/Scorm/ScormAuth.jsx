import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole, Mail, UserRound, Sun, Moon } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { readScormPlatformTheme, saveScormPlatformTheme } from './platformTheme';
import './scormAuthWorkbench.css';
import './scormAuthTealRestore.css';
import './scormAuthGoogleButtonFix.css';
import './scormAuthAutofillFix.css';
import './scormLightTheme.css';
import './scormLightContrastGuard.css';

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 0 1 3.69 9c0-.6.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96L3.97 7.29C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <span className="grid grid-cols-2 gap-[2px] w-4 h-4" aria-hidden="true">
      <span className="bg-[#f25022]" /><span className="bg-[#7fba00]" />
      <span className="bg-[#00a4ef]" /><span className="bg-[#ffb900]" />
    </span>
  );
}

function GoogleButton({ width, onSuccess, onError }) {
  return (
    <div className="sa-google-button">
      <div className="sa-google-face" aria-hidden="true">
        <GoogleMark />
        <span>Continue with Google</span>
      </div>
      <div className="sa-google-overlay">
        <GoogleLogin
          onSuccess={onSuccess}
          onError={onError}
          theme="outline"
          size="large"
          shape="rectangular"
          text="continue_with"
          logo_alignment="center"
          width={String(width)}
        />
      </div>
    </div>
  );
}

export default function ScormAuth() {
  const navigate = useNavigate();
  const {
    loginScorm,
    loginQuizmotoOnlyWithGoogle,
    registerScorm,
    prepareScormLogin
  } = useAuth();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState(readScormPlatformTheme);
  const [googleWidth, setGoogleWidth] = useState(360);

  useEffect(() => { prepareScormLogin(); }, []);
  useEffect(() => { saveScormPlatformTheme(theme); }, [theme]);

  useEffect(() => {
    const updateGoogleWidth = () => {
      const el = document.querySelector('.sa-google-button');
      const width = el ? Math.floor(el.getBoundingClientRect().width) : 360;
      setGoogleWidth(Math.max(240, Math.min(400, width)));
    };
    updateGoogleWidth();
    window.addEventListener('resize', updateGoogleWidth);
    return () => window.removeEventListener('resize', updateGoogleWidth);
  }, [mode]);

  const finishPlatformLogin = (result, destination = '/scorm') => {
    if (!result?.token) {
      setError(result?.message || 'Sign in failed.');
      return;
    }
    navigate(destination, { replace: true });
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') {
        finishPlatformLogin(await loginScorm({ identifier: identifier.trim(), password }));
      } else {
        finishPlatformLogin(await registerScorm({
          username: username.trim(),
          email: email.trim().toLowerCase(),
          password
        }));
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      setError('Google Sign-In did not return a valid credential.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await loginQuizmotoOnlyWithGoogle(credentialResponse.credential);
      finishPlatformLogin(result, '/scorm/quizmoto');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Google Sign-In failed.');
    } finally {
      setBusy(false);
    }
  };

  const isLogin = mode === 'login';
  const isLight = theme === 'light';
  const ThemeIcon = isLight ? Moon : Sun;
  const logoSrc = isLight ? '/branding/lmsgen-logo-light.png' : '/branding/lmsgen-logo-dark.png';

  return (
    <div className={`scorm-auth-workbench scorm-theme-${theme} sa-login-only`}>
      <div className="sa-shell">
        <div className="sa-topbar">
          <img src={logoSrc} alt="LMSGEN" className="sa-logo" style={{ width: 132, height: 'auto' }} />
          <button
            type="button"
            className="sa-theme-toggle"
            onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
            aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
            aria-pressed={isLight}
          >
            <ThemeIcon size={15} strokeWidth={2} />
            <span className="scorm-theme-toggle-label">{isLight ? 'Dark' : 'Light'}</span>
            <span className="scorm-theme-toggle-track" aria-hidden="true"><span className="scorm-theme-toggle-knob" /></span>
          </button>
        </div>

        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="sa-card sa-card-login"
        >
          <section className="sa-form-panel">
            <h2 className="sa-form-title">{isLogin ? 'Sign in' : 'Create account'}</h2>
            <p className="mt-2 mb-5 text-xs opacity-70 leading-relaxed">
              {isLogin
                ? 'Use your LMSGEN account or choose an identity provider below.'
                : 'Create an account for Quizmoto and LMSGEN access approval.'}
            </p>

            {error && <div className="sa-error">{error}</div>}

            <form onSubmit={submit} className="sa-form">
              {!isLogin && (
                <label>
                  <span className="sa-label">Name</span>
                  <div className="sa-input-wrap">
                    <UserRound size={15} />
                    <input value={username} onChange={(event) => setUsername(event.target.value)} required minLength={2} placeholder="Your name" className="sa-input" autoComplete="name" />
                  </div>
                </label>
              )}

              <label>
                <span className="sa-label">{isLogin ? 'Email or username' : 'Email address'}</span>
                <div className="sa-input-wrap">
                  <Mail size={15} />
                  <input
                    type={isLogin ? 'text' : 'email'}
                    value={isLogin ? identifier : email}
                    onChange={(event) => isLogin ? setIdentifier(event.target.value) : setEmail(event.target.value)}
                    required
                    placeholder={isLogin ? 'you@company.com' : 'you@company.com'}
                    className="sa-input"
                    autoComplete={isLogin ? 'username' : 'email'}
                  />
                </div>
              </label>

              <label>
                <span className="sa-label">Password</span>
                <div className="sa-input-wrap">
                  <LockKeyhole size={15} />
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} placeholder="Password" className="sa-input" autoComplete={isLogin ? 'current-password' : 'new-password'} />
                </div>
              </label>

              <button type="submit" disabled={busy} className="sa-submit">
                {busy ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
              </button>
            </form>

            {isLogin && (
              <>
                <div className="sa-divider" aria-hidden="true"><span>or</span></div>

                <button
                  type="button"
                  onClick={() => navigate('/login/microsoft')}
                  disabled={busy}
                  className="sa-submit flex items-center justify-center gap-3"
                  style={{ background: 'transparent', border: '1px solid var(--sa-border, rgba(255,255,255,.16))' }}
                >
                  <MicrosoftMark /> Continue with Microsoft
                </button>

                <div className="sa-google-block" style={{ marginTop: 10 }}>
                  <GoogleButton
                    width={googleWidth}
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError('Google Sign-In failed. Please try again.')}
                  />
                </div>

                <p className="mt-3 text-[10px] opacity-60 leading-relaxed text-center">
                  Google sign-in opens Quizmoto only. Use password or Microsoft organisation sign-in for LMSGEN tenant access.
                </p>
              </>
            )}

            <div className="mt-5 text-center text-xs opacity-75">
              {isLogin ? 'Need an account?' : 'Already have an account?'}{' '}
              <button type="button" className="underline font-semibold" onClick={() => { setMode(isLogin ? 'register' : 'login'); setError(''); setPassword(''); }}>
                {isLogin ? 'Register' : 'Sign in'}
              </button>
            </div>
          </section>
        </motion.main>
      </div>
    </div>
  );
}
