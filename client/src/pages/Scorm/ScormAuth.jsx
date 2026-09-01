import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole, Mail, UserRound, Sun, Moon, ShieldCheck, KeyRound } from 'lucide-react';
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
        <span>Sign in with Google</span>
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

function messageFromError(err, fallback) {
  return err?.response?.data?.message || err?.message || fallback;
}

export default function ScormAuth() {
  const navigate = useNavigate();
  const {
    loginScorm,
    loginScormWithGoogle,
    requestMailOtp,
    verifyMailOtp,
    registerScorm,
    resetScormPassword,
    prepareScormLogin
  } = useAuth();

  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
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

  const finishPlatformLogin = (result) => {
    if (!result?.token) {
      setError(result?.message || 'Sign in failed.');
      return;
    }
    navigate(result.quizmotoOnly ? '/scorm/quizmoto' : '/scorm', { replace: true });
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setNotice('');
    setOtp('');
    setVerificationToken('');
    setConfirmPassword('');
    if (nextMode === 'login') setPassword('');
  };

  const submitLogin = async () => {
    finishPlatformLogin(await loginScorm({ identifier: identifier.trim(), password }));
  };

  const requestRegistrationOtp = async () => {
    if (username.trim().length < 2) throw new Error('Enter your name before continuing.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error('Enter a valid email address.');
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');
    if (password !== confirmPassword) throw new Error('Passwords do not match.');

    await requestMailOtp({
      email: email.trim().toLowerCase(),
      purpose: 'email_verification',
      name: username.trim()
    });
    setOtp('');
    setNotice(`We sent a 6-digit verification code to ${email.trim().toLowerCase()}.`);
    setMode('register-otp');
  };

  const completeRegistration = async () => {
    const verified = await verifyMailOtp({
      email: email.trim().toLowerCase(),
      purpose: 'email_verification',
      code: otp
    });
    if (!verified?.verificationToken) throw new Error('Email verification failed. Request a new code.');

    const result = await registerScorm({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password,
      verificationToken: verified.verificationToken
    });
    finishPlatformLogin(result);
  };

  const requestPasswordResetOtp = async () => {
    const resetEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(resetEmail)) throw new Error('Enter a valid email address.');
    await requestMailOtp({ email: resetEmail, purpose: 'password_reset' });
    setOtp('');
    setNotice(`We sent a 6-digit password reset code to ${resetEmail}.`);
    setMode('forgot-otp');
  };

  const verifyPasswordResetOtp = async () => {
    const verified = await verifyMailOtp({
      email: email.trim().toLowerCase(),
      purpose: 'password_reset',
      code: otp
    });
    if (!verified?.verificationToken) throw new Error('Verification failed. Request a new code.');
    setVerificationToken(verified.verificationToken);
    setPassword('');
    setConfirmPassword('');
    setNotice('Email verified. Choose a new password.');
    setMode('reset-password');
  };

  const completePasswordReset = async () => {
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');
    if (password !== confirmPassword) throw new Error('Passwords do not match.');
    const result = await resetScormPassword({
      email: email.trim().toLowerCase(),
      newPassword: password,
      verificationToken
    });
    setIdentifier(email.trim().toLowerCase());
    setPassword('');
    setConfirmPassword('');
    setNotice(result?.message || 'Password reset complete. Sign in with your new password.');
    setMode('login');
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') await submitLogin();
      else if (mode === 'register') await requestRegistrationOtp();
      else if (mode === 'register-otp') await completeRegistration();
      else if (mode === 'forgot') await requestPasswordResetOtp();
      else if (mode === 'forgot-otp') await verifyPasswordResetOtp();
      else if (mode === 'reset-password') await completePasswordReset();
    } catch (err) {
      setError(messageFromError(err, 'Authentication failed.'));
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    setBusy(true);
    setError('');
    try {
      if (mode === 'register-otp') {
        await requestMailOtp({ email: email.trim().toLowerCase(), purpose: 'email_verification', name: username.trim() });
      } else {
        await requestMailOtp({ email: email.trim().toLowerCase(), purpose: 'password_reset' });
      }
      setNotice(`A new verification code was sent to ${email.trim().toLowerCase()}.`);
      setOtp('');
    } catch (err) {
      setError(messageFromError(err, 'Could not resend the verification code.'));
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
      setError(messageFromError(err, 'Google Sign-In failed.'));
    } finally {
      setBusy(false);
    }
  };

  const isLogin = mode === 'login';
  const isRegister = mode === 'register';
  const isOtp = mode === 'register-otp' || mode === 'forgot-otp';
  const isForgot = mode === 'forgot';
  const isResetPassword = mode === 'reset-password';
  const isLight = theme === 'light';
  const ThemeIcon = isLight ? Moon : Sun;
  const logoSrc = isLight ? '/branding/lmsgen-logo-light.png' : '/branding/lmsgen-logo-dark.png';

  const title = isLogin
    ? 'Sign in'
    : isRegister
      ? 'Create account'
      : mode === 'register-otp'
        ? 'Verify your email'
        : isForgot
          ? 'Forgot password'
          : mode === 'forgot-otp'
            ? 'Verify reset code'
            : 'Set new password';

  const description = isLogin
    ? 'Use your account or sign in with the Google or Microsoft identity assigned to your LMSGEN tenant.'
    : isRegister
      ? 'Create your account and verify your email before registration is completed.'
      : mode === 'register-otp'
        ? `Enter the 6-digit code sent to ${email || 'your email address'}.`
        : isForgot
          ? 'Enter the email address linked to your LMSGEN account. We will send a password reset code.'
          : mode === 'forgot-otp'
            ? `Enter the 6-digit code sent to ${email || 'your email address'}.`
            : 'Choose a new password for your LMSGEN account.';

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
            <h2 className="sa-form-title">{title}</h2>
            <p className="mt-2 mb-5 text-xs opacity-70 leading-relaxed">{description}</p>

            {error && <div className="sa-error">{error}</div>}
            {notice && !error && (
              <div className="mb-4 rounded-[8px] border px-3 py-2 text-[11px] leading-relaxed" style={{ borderColor: 'rgba(71,199,193,.35)', background: 'rgba(71,199,193,.08)' }}>
                {notice}
              </div>
            )}

            <form onSubmit={submit} className="sa-form">
              {isRegister && (
                <label>
                  <span className="sa-label">Name</span>
                  <div className="sa-input-wrap">
                    <UserRound size={15} />
                    <input value={username} onChange={(event) => setUsername(event.target.value)} required minLength={2} placeholder="Your name" className="sa-input" autoComplete="name" />
                  </div>
                </label>
              )}

              {(isLogin || isRegister || isForgot) && (
                <label>
                  <span className="sa-label">Email address</span>
                  <div className="sa-input-wrap">
                    <Mail size={15} />
                    <input
                      type={isLogin ? 'text' : 'email'}
                      value={isLogin ? identifier : email}
                      onChange={(event) => isLogin ? setIdentifier(event.target.value) : setEmail(event.target.value)}
                      required
                      placeholder="you@company.com"
                      className="sa-input"
                      autoComplete={isLogin ? 'username' : 'email'}
                    />
                  </div>
                </label>
              )}

              {(isLogin || isRegister || isResetPassword) && (
                <label>
                  <span className="sa-label">{isResetPassword ? 'New password' : 'Password'}</span>
                  <div className="sa-input-wrap">
                    <LockKeyhole size={15} />
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      minLength={8}
                      placeholder={isResetPassword ? 'New password' : 'Password'}
                      className="sa-input"
                      autoComplete={isLogin ? 'current-password' : 'new-password'}
                    />
                  </div>
                </label>
              )}

              {(isRegister || isResetPassword) && (
                <label>
                  <span className="sa-label">Confirm password</span>
                  <div className="sa-input-wrap">
                    <KeyRound size={15} />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                      minLength={8}
                      placeholder="Confirm password"
                      className="sa-input"
                      autoComplete="new-password"
                    />
                  </div>
                </label>
              )}

              {isOtp && (
                <label>
                  <span className="sa-label">Verification code</span>
                  <div className="sa-input-wrap">
                    <ShieldCheck size={15} />
                    <input
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={otp}
                      onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      placeholder="6-digit code"
                      className="sa-input"
                      autoComplete="one-time-code"
                    />
                  </div>
                </label>
              )}

              {isLogin && (
                <div className="-mt-1 text-right">
                  <button type="button" className="text-[11px] underline opacity-75 hover:opacity-100" onClick={() => { setEmail(identifier.includes('@') ? identifier.trim().toLowerCase() : ''); switchMode('forgot'); }}>
                    Forgot password?
                  </button>
                </div>
              )}

              <button type="submit" disabled={busy} className="sa-submit">
                {busy
                  ? 'Please wait…'
                  : isLogin
                    ? 'Sign in'
                    : isRegister
                      ? 'Send verification code'
                      : mode === 'register-otp'
                        ? 'Verify & create account'
                        : isForgot
                          ? 'Send reset code'
                          : mode === 'forgot-otp'
                            ? 'Verify code'
                            : 'Reset password'}
              </button>
            </form>

            {isOtp && (
              <div className="mt-4 text-center text-[11px] opacity-75">
                Didn&apos;t receive the code?{' '}
                <button type="button" disabled={busy} onClick={resendOtp} className="underline font-semibold disabled:opacity-50">Resend code</button>
              </div>
            )}

            {isLogin && (
              <>
                <div className="sa-divider" aria-hidden="true"><span>or</span></div>

                <button
                  type="button"
                  onClick={() => navigate('/login/microsoft')}
                  disabled={busy}
                  className="w-full min-h-[45px] mt-3 rounded-[9px] border text-[11px] font-semibold flex items-center justify-center gap-3 transition hover:opacity-90 disabled:opacity-50"
                  style={{ borderColor: 'var(--sa-border)', background: 'var(--sa-panel-2)', color: 'var(--sa-cream)' }}
                >
                  <MicrosoftMark /> Sign in with Microsoft
                </button>

                <div className="sa-google-block" style={{ marginTop: 10 }}>
                  <GoogleButton
                    width={googleWidth}
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError('Google Sign-In failed. Please try again.')}
                  />
                </div>

                <p className="mt-3 text-[10px] opacity-60 leading-relaxed text-center">
                  Google and Microsoft identities open the tenant and role assigned to that exact email. Unassigned Google accounts can use Quizmoto only.
                </p>
              </>
            )}

            <div className="mt-5 text-center text-xs opacity-75">
              {isLogin ? (
                <>
                  Need an account?{' '}
                  <button type="button" className="underline font-semibold" onClick={() => switchMode('register')}>Register</button>
                </>
              ) : isRegister ? (
                <>
                  Already have an account?{' '}
                  <button type="button" className="underline font-semibold" onClick={() => switchMode('login')}>Sign in</button>
                </>
              ) : (
                <button type="button" className="underline font-semibold" onClick={() => switchMode(mode.startsWith('register') ? 'register' : 'login')}>
                  {mode.startsWith('register') ? 'Back to registration' : 'Back to sign in'}
                </button>
              )}
            </div>
          </section>
        </motion.main>
      </div>
    </div>
  );
}
