import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers3, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import './scormAuthWorkbench.css';

export default function ScormAuth() {
  const navigate = useNavigate();
  const {
    loginScorm,
    loginScormWithGoogle,
    registerScorm,
    prepareScormLogin,
    leaveScorm
  } = useAuth();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    prepareScormLogin();
  }, []);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setNotice('');
  };

  const handlePending = (result, fallbackEmail = '') => {
    setError('');
    setNotice(result?.message || 'Your SCORM AI registration is pending administrator approval.');
    if (fallbackEmail) {
      setMode('login');
      setIdentifier(fallbackEmail);
      setPassword('');
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'login') {
        const result = await loginScorm({ identifier: identifier.trim(), password });
        if (result?.pendingApproval) {
          handlePending(result);
          return;
        }
      } else {
        const registeredEmail = email.trim().toLowerCase();
        const result = await registerScorm({
          username: username.trim(),
          email: registeredEmail,
          password
        });
        if (result?.pendingApproval) {
          handlePending(result, registeredEmail);
          return;
        }
      }
      navigate('/scorm');
    } catch (err) {
      const data = err.response?.data;
      if (data?.pendingApproval || data?.code === 'SCORM_APPROVAL_PENDING') {
        handlePending(data);
      } else {
        setError(data?.message || err.message || 'Authentication failed.');
      }
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
    setNotice('');
    try {
      const result = await loginScormWithGoogle(credentialResponse.credential);
      if (result?.pendingApproval) {
        handlePending(result);
        return;
      }
      navigate('/scorm');
    } catch (err) {
      const data = err.response?.data;
      if (data?.pendingApproval || data?.code === 'SCORM_APPROVAL_PENDING') {
        handlePending(data);
      } else {
        setError(data?.message || err.message || 'Google Sign-In failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  const goBackToQuizmoto = () => {
    const restored = leaveScorm();
    navigate(restored ? '/host' : '/login');
  };
  const isLogin = mode === 'login';

  return (
    <div className="scorm-auth-workbench">
      <div className="sa-shell">
        <div className="sa-topbar">
          <button type="button" onClick={goBackToQuizmoto} className="sa-back">
            <ArrowLeft size={15} /> <span>Back to Quizmoto</span>
          </button>
          <div className="sa-top-note">Administrator-approved SCORM AI access</div>
        </div>

        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="sa-card"
        >
          <section className="sa-brand-panel">
            <div className="sa-mark"><Layers3 size={22} /></div>
            <div className="sa-kicker">AI course creation workspace</div>
            <h1 className="sa-title">SCORM <span>AI</span></h1>
            <p className="sa-copy">
              Create, publish and track AI-assisted SCORM learning experiences from a dedicated workspace protected separately from Quizmoto.
            </p>
            <div className="sa-points" aria-label="SCORM AI workspace highlights">
              <div className="sa-point"><span className="sa-point-dot" /> Register first with your own credentials</div>
              <div className="sa-point"><span className="sa-point-dot" /> Super Admin unlocks SCORM AI access</div>
              <div className="sa-point"><span className="sa-point-dot" /> Use the same credentials after approval</div>
            </div>
          </section>

          <section className="sa-form-panel">
            <div className="sa-form-kicker">Secure access</div>
            <h2 className="sa-form-title">{isLogin ? 'Sign in to SCORM AI' : 'Register for SCORM AI'}</h2>
            <p className="sa-form-sub">
              {isLogin
                ? 'Only accounts approved by the SCORM AI Super Admin can enter the workspace.'
                : 'Register normally. Your details will be saved immediately, then the Super Admin must approve your account before you can sign in.'}
            </p>

            <div className="sa-tabs" role="tablist" aria-label="SCORM AI authentication mode">
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

            {notice && (
              <div className="sa-notice" role="status">
                <div className="sa-notice-title">Registration captured — approval pending</div>
                <div>{notice}</div>
              </div>
            )}
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
                  width="320"
                />
              </div>
              <div className="sa-google-hint">If your Google email is not approved yet, the request is captured for Super Admin approval.</div>
            </div>

            <div className="sa-divider" aria-hidden="true"><span>or use SCORM AI credentials</span></div>

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
                {busy ? 'Please wait…' : isLogin ? 'Log in to SCORM AI' : 'Register account'}
              </button>
            </form>
          </section>
        </motion.main>
      </div>
    </div>
  );
}
