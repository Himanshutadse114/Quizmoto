import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole, Mail, ShieldCheck, UserRound, Zap, Sun, Moon } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { readScormPlatformTheme, saveScormPlatformTheme } from './platformTheme';
import './scormAuthWorkbench.css';
import './scormAuthTealRestore.css';
import './scormLightTheme.css';
import './scormLightContrastGuard.css';

export default function ScormAuth() {
  const navigate = useNavigate();
  const {
    loginScorm,
    loginScormWithGoogle,
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

  useEffect(() => {
    prepareScormLogin();
  }, []);

  useEffect(() => {
    saveScormPlatformTheme(theme);
  }, [theme]);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
  };

  const finishPlatformLogin = (result) => {
    if (!result?.token) {
      setError(result?.message || 'A platform session could not be created.');
      return;
    }
    navigate('/scorm', { replace: true });
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
      const data = err.response?.data;
      setError(data?.message || err.message || 'Authentication failed.');
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
      finishPlatformLogin(await loginScormWithGoogle(credentialResponse.credential));
    } catch (err) {
      const data = err.response?.data;
      setError(data?.message || err.message || 'Google Sign-In failed.');
    } finally {
      setBusy(false);
    }
  };

  const isLogin = mode === 'login';
  const isLight = theme === 'light';
  const ThemeIcon = isLight ? Moon : Sun;
  const logoSrc = isLight ? '/branding/lmsgen-logo-light.png' : '/branding/lmsgen-logo-dark.png';

  return (
    <div className={`scorm-auth-workbench scorm-theme-${theme}`}>
      <div className="sa-shell">
        <div className="sa-topbar">
          <div className="sa-top-note">LMSGEN Platform · Quizmoto included</div>
          <div className="flex items-center gap-3">
            <div className="sa-top-note">SCORM capabilities unlock after administrator approval</div>
            <button
              type="button"
              className="sa-theme-toggle"
              onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
              aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
              aria-pressed={isLight}
              title={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
            >
              <ThemeIcon size={15} strokeWidth={2} />
              <span className="scorm-theme-toggle-label">{isLight ? 'Dark' : 'Light'}</span>
              <span className="scorm-theme-toggle-track" aria-hidden="true"><span className="scorm-theme-toggle-knob" /></span>
            </button>
          </div>
        </div>

        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="sa-card"
        >
          <section className="sa-brand-panel">
            <img src={logoSrc} alt="LMSGEN" className="sa-logo" />
            <div className="sa-kicker" style={{ marginTop: 22 }}>AI learning creation & live engagement</div>
            <p className="sa-copy">
              One workspace for AI-assisted course creation, SCORM delivery, learner intelligence and Quizmoto live engagement.
            </p>
            <div className="sa-points" aria-label="LMSGEN platform highlights">
              <div className="sa-point"><span className="sa-point-dot" /> Quizmoto is available immediately after registration</div>
              <div className="sa-point"><span className="sa-point-dot" /> LMSGEN capabilities stay visible while approval is pending</div>
              <div className="sa-point"><span className="sa-point-dot" /> Approval unlocks authoring, courses, tracking and reports</div>
            </div>
            <div className="sa-notice" style={{ marginTop: 24 }}>
              <div className="sa-notice-title"><Zap size={14} style={{ display: 'inline', marginRight: 7 }} />Start before approval</div>
              <div>Register, enter the platform and use Quizmoto straight away. Locked LMSGEN modules explain exactly what becomes available after approval.</div>
            </div>
          </section>

          <section className="sa-form-panel">
            <div className="sa-form-kicker">Platform access</div>
            <h2 className="sa-form-title">{isLogin ? 'Sign in to LMSGEN' : 'Create your platform account'}</h2>
            <p className="sa-form-sub">
              {isLogin
                ? 'Sign in with your LMSGEN account. Pending users can still access Quizmoto and preview locked LMSGEN capabilities.'
                : 'Registration gives you immediate platform access with Quizmoto unlocked. The Super Admin separately approves the LMSGEN feature set.'}
            </p>

            <div className="sa-tabs" role="tablist" aria-label="LMSGEN authentication mode">
              <button
                type="button"
                role="tab"
                aria-selected={isLogin}
                onClick={() => switchMode('login')}
                className={`sa-tab ${isLogin ? 'is-active' : ''}`}
              >
                Log in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!isLogin}
                onClick={() => switchMode('register')}
                className={`sa-tab ${!isLogin ? 'is-active' : ''}`}
              >
                Register
              </button>
            </div>

            {error && <div className="sa-error">{error}</div>}

            <div className="sa-google-block">
              <div className="sa-google-label"><ShieldCheck size={13} /> Google account</div>
              <div className="sa-google-button">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google Sign-In failed. Please try again.')}
                  theme="outline"
                  size="large"
                  shape="rectangular"
                  text="continue_with"
                  width="400"
                />
              </div>
              <div className="sa-google-hint">A new Google identity is captured for approval and receives immediate limited platform access.</div>
            </div>

            <div className="sa-divider" aria-hidden="true"><span>or use platform credentials</span></div>

            <form onSubmit={submit} className="sa-form">
              {!isLogin && (
                <label>
                  <span className="sa-label">Name</span>
                  <div className="sa-input-wrap">
                    <UserRound size={15} />
                    <input
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      required
                      minLength={2}
                      placeholder="Your name"
                      className="sa-input"
                      autoComplete="name"
                    />
                  </div>
                </label>
              )}

              <label>
                <span className="sa-label">{isLogin ? 'Email or username' : 'Email'}</span>
                <div className="sa-input-wrap">
                  <Mail size={15} />
                  <input
                    type={isLogin ? 'text' : 'email'}
                    value={isLogin ? identifier : email}
                    onChange={(event) => isLogin ? setIdentifier(event.target.value) : setEmail(event.target.value)}
                    required
                    placeholder={isLogin ? 'you@company.com or username' : 'you@company.com'}
                    className="sa-input"
                    autoComplete={isLogin ? 'username' : 'email'}
                  />
                </div>
              </label>

              <label>
                <span className="sa-label">Password</span>
                <div className="sa-input-wrap">
                  <LockKeyhole size={15} />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                    placeholder="Minimum 8 characters"
                    className="sa-input"
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                  />
                </div>
              </label>

              <button type="submit" disabled={busy} className="sa-submit">
                {busy ? 'Please wait…' : isLogin ? 'Enter platform' : 'Create account & enter'}
              </button>
            </form>
          </section>
        </motion.main>
      </div>
    </div>
  );
}
