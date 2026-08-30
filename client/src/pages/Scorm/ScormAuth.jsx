import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LockKeyhole, Mail, UserRound, Sun, Moon, Building2 } from 'lucide-react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import axios from 'axios';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import { readScormPlatformTheme, saveScormPlatformTheme } from './platformTheme';
import './scormAuthWorkbench.css';
import './scormAuthTealRestore.css';
import './scormAuthGoogleButtonFix.css';
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

function GoogleButton({ clientId, width, onSuccess, onError }) {
  const content = (
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

  return clientId
    ? <GoogleOAuthProvider clientId={clientId}>{content}</GoogleOAuthProvider>
    : content;
}

export default function ScormAuth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workspaceId = String(searchParams.get('workspace') || '').trim();
  const {
    loginScorm,
    loginScormWithGoogle,
    loginScormWorkspaceWithGoogle,
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
  const [staffConfig, setStaffConfig] = useState(null);
  const [staffConfigLoading, setStaffConfigLoading] = useState(Boolean(workspaceId));

  const workspaceMode = Boolean(workspaceId);

  useEffect(() => {
    prepareScormLogin();
  }, []);

  useEffect(() => {
    saveScormPlatformTheme(theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    if (!workspaceId) {
      setStaffConfig(null);
      setStaffConfigLoading(false);
      return () => {};
    }
    setMode('login');
    setStaffConfigLoading(true);
    setError('');
    axios.get(apiUrl(`/api/scorm/staff-auth/workspace/${workspaceId}/config`))
      .then((res) => {
        if (!cancelled) setStaffConfig(res.data?.config || null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'This staff login link is not available.');
      })
      .finally(() => {
        if (!cancelled) setStaffConfigLoading(false);
      });
    return () => { cancelled = true; };
  }, [workspaceId]);

  useEffect(() => {
    const updateGoogleWidth = () => {
      const el = document.querySelector('.sa-google-button');
      const width = el ? Math.floor(el.getBoundingClientRect().width) : 360;
      setGoogleWidth(Math.max(240, Math.min(400, width)));
    };
    updateGoogleWidth();
    window.addEventListener('resize', updateGoogleWidth);
    return () => window.removeEventListener('resize', updateGoogleWidth);
  }, [staffConfig]);

  const switchMode = (nextMode) => {
    if (workspaceMode && nextMode === 'register') return;
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
      const result = workspaceMode
        ? await loginScormWorkspaceWithGoogle(workspaceId, credentialResponse.credential)
        : await loginScormWithGoogle(credentialResponse.credential);
      finishPlatformLogin(result);
    } catch (err) {
      const data = err.response?.data;
      setError(data?.message || err.message || 'Google Sign-In failed.');
    } finally {
      setBusy(false);
    }
  };

  const loginMicrosoft = () => {
    if (!workspaceId || !staffConfig?.staffMicrosoftClientId || !staffConfig?.staffMicrosoftTenantId) return;
    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    sessionStorage.setItem(`lmsgen_staff_ms_state_${workspaceId}`, state);
    const redirectUri = `${window.location.origin}/login/workspace/${workspaceId}/microsoft/callback`;
    const params = new URLSearchParams({
      client_id: staffConfig.staffMicrosoftClientId,
      response_type: 'id_token',
      redirect_uri: redirectUri,
      response_mode: 'fragment',
      scope: 'openid profile email',
      state,
      nonce,
      prompt: 'select_account'
    });
    window.location.assign(`https://login.microsoftonline.com/${encodeURIComponent(staffConfig.staffMicrosoftTenantId)}/oauth2/v2.0/authorize?${params.toString()}`);
  };

  const isLogin = mode === 'login';
  const isLight = theme === 'light';
  const ThemeIcon = isLight ? Moon : Sun;
  const logoSrc = isLight ? '/branding/lmsgen-logo-light.png' : '/branding/lmsgen-logo-dark.png';
  const showWorkspaceGoogle = workspaceMode && Boolean(staffConfig?.staffGoogleEnabled && staffConfig?.staffGoogleClientId);
  const showWorkspaceMicrosoft = workspaceMode && Boolean(staffConfig?.staffMicrosoftEnabled);
  const showPassword = !workspaceMode || Boolean(staffConfig?.staffPasswordEnabled);
  const showGlobalGoogle = !workspaceMode;
  const hasSso = showGlobalGoogle || showWorkspaceGoogle || showWorkspaceMicrosoft;

  const workspaceSubtitle = useMemo(() => {
    if (!workspaceMode) return null;
    if (staffConfigLoading) return 'Loading organisation sign-in…';
    return staffConfig?.workspaceName ? `${staffConfig.workspaceName} staff access` : 'Organisation staff access';
  }, [workspaceMode, staffConfigLoading, staffConfig]);

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
            <h2 className="sa-form-title">{workspaceMode ? 'Staff sign in' : isLogin ? 'Sign in' : 'Create account'}</h2>
            {workspaceSubtitle && (
              <div className="mt-2 mb-4 flex items-center gap-2 text-xs opacity-70">
                <Building2 size={14} /> {workspaceSubtitle}
              </div>
            )}

            {!workspaceMode && (
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
            )}

            {error && <div className="sa-error">{error}</div>}

            {!staffConfigLoading && (showGlobalGoogle || showWorkspaceGoogle) && (
              <div className="sa-google-block">
                <GoogleButton
                  clientId={showWorkspaceGoogle ? staffConfig.staffGoogleClientId : null}
                  width={googleWidth}
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google Sign-In failed. Please try again.')}
                />
              </div>
            )}

            {!staffConfigLoading && showWorkspaceMicrosoft && (
              <button type="button" onClick={loginMicrosoft} disabled={busy} className="sa-submit" style={{ marginTop: 10 }}>
                Continue with Microsoft
              </button>
            )}

            {hasSso && showPassword && <div className="sa-divider" aria-hidden="true"><span>or</span></div>}

            {!staffConfigLoading && showPassword && (
              <form onSubmit={submit} className="sa-form">
                {!isLogin && !workspaceMode && (
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
            )}

            {workspaceMode && staffConfig?.staffSsoRequired && (
              <div className="mt-4 text-xs opacity-70 leading-relaxed">
                This organisation requires verified SSO for Admin, Co-admin and Analytics Viewer access. Password sign-in is disabled for this workspace.
              </div>
            )}
          </section>
        </motion.main>
      </div>
    </div>
  );
}
