import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, Layers3, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react';
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
  const [activationCode, setActivationCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    prepareScormLogin();
  }, []);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') {
        await loginScorm({ identifier: identifier.trim(), password });
      } else {
        await registerScorm({
          username: username.trim(),
          email: email.trim(),
          password,
          activationCode: activationCode.trim()
        });
      }
      navigate('/scorm');
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
      await loginScormWithGoogle(credentialResponse.credential);
      navigate('/scorm');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Google Sign-In failed.');
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
          <div className="sa-top-note">Approval-only SCORM AI access</div>
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
              <div className="sa-point"><span className="sa-point-dot" /> Google or password authentication</div>
              <div className="sa-point"><span className="sa-point-dot" /> Administrator-approved accounts only</div>
              <div className="sa-point"><span className="sa-point-dot" /> Password registration uses one-time activation</div>
            </div>
          </section>

          <section className="sa-form-panel">
            <div className="sa-form-kicker">Secure access</div>
            <h2 className="sa-form-title">{isLogin ? 'Sign in to SCORM AI' : 'Create your SCORM AI account'}</h2>
            <p className="sa-form-sub">
              {isLogin
                ? 'Sign in with an administrator-approved account.'
                : 'Use the approved email and one-time activation code supplied by the SCORM AI administrator.'}
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
                Create account
              </button>
            </div>

            {error && <div className="sa-error">{error}</div>}

            <div className="sa-google-block">
              <div className="sa-google-label"><ShieldCheck size={13} /> Approved Google account</div>
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
                <span className="sa-label">{isLogin ? 'Email or username' : 'Approved email'}</span>
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

              {!isLogin && (
                <label>
                  <span className="sa-label">One-time activation code</span>
                  <div className="sa-input-wrap">
                    <KeyRound size={15} />
                    <input
                      value={activationCode}
                      onChange={(event) => setActivationCode(event.target.value.toUpperCase())}
                      required
                      placeholder="XXXX-XXXX-XXXX"
                      className="sa-input sa-code-input"
                      autoComplete="one-time-code"
                    />
                  </div>
                </label>
              )}

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
                {busy ? 'Please wait…' : isLogin ? 'Log in to SCORM AI' : 'Create SCORM AI account'}
              </button>
            </form>
          </section>
        </motion.main>
      </div>
    </div>
  );
}
