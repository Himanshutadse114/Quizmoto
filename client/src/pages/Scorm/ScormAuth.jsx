import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole, Mail, UserRound, Sun, Moon } from 'lucide-react';
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
      setError(result?.message || 'Sign in failed.');
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
            title={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
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

            <div className="sa-tabs" role="tablist" aria-label="Authentication mode">
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
            </div>

            <div className="sa-divider" aria-hidden="true"><span>or</span></div>

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
                    placeholder="Password"
                    className="sa-input"
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                  />
                </div>
              </label>

              <button type="submit" disabled={busy} className="sa-submit">
                {busy ? 'Please wait...' : isLogin ? 'Sign in' : 'Create account'}
              </button>
            </form>
          </section>
        </motion.main>
      </div>
    </div>
  );
}
