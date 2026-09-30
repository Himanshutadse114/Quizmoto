import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpenCheck, Gamepad2, KeyRound, Loader2, LockKeyhole, Mail } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './mobileAppLogin.css';

function formatAccessCode(value) {
  const compact = String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 12);
  return compact.match(/.{1,4}/g)?.join('-') || '';
}

export default function MobileAppLogin() {
  const navigate = useNavigate();
  const { token, platformAccess, loading, loginWithMobileCode } = useAuth();
  const [code, setCode] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const installed = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const installMode = new URLSearchParams(window.location.search).get('install');

  useEffect(() => {
    if (!installMode) return;
    window.history.replaceState(null, '', '/app');
  }, [installMode]);

  // Keep the browser install page visible to signed-in users. Once the app is
  // launched in standalone mode, take an existing session straight into the
  // workspace instead of showing the access-code form again.
  if (!loading && token && platformAccess && installed) return <Navigate to="/scorm" replace />;

  const submit = async (event) => {
    event.preventDefault();
    if (code.replace(/-/g, '').length !== 12 || working) return;
    setWorking(true);
    setError('');
    try {
      await loginWithMobileCode(code);
      navigate('/scorm', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not sign in with this access code.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <main className="lmsgen-app-login">
      <section className="lmsgen-app-card" aria-labelledby="lmsgen-app-title">
        <div className="lmsgen-app-brand" aria-label="LMSGEN">
          <img src="/branding/lmsgen-logo-dark.png" alt="LMSGEN" />
        </div>

        <div className="lmsgen-app-copy">
          <span className="lmsgen-app-kicker">Secure app access</span>
          <h1 id="lmsgen-app-title">Your learning workspace, ready anywhere.</h1>
          <p>Use the private access code created in your LMSGEN account settings. You can then use courses, Awareness Emails, Publica, Quizmoto and analytics from the installed app.</p>
        </div>

        <div className="lmsgen-app-capabilities" aria-label="Available LMSGEN tools">
          <span><BookOpenCheck size={14} /> Courses</span>
          <span><Gamepad2 size={14} /> Quizmoto</span>
          <span><Mail size={14} /> Awareness</span>
        </div>

        {installMode && (
          <div className="lmsgen-app-install-guidance" role="status">
            {installMode === 'ios'
              ? 'To install LMSGEN, tap Safari’s Share button and choose “Add to Home Screen”.'
              : 'To install LMSGEN, open your browser menu and choose “Install app” or “Add to Home screen”.'}
          </div>
        )}

        <form onSubmit={submit} className="lmsgen-app-form">
          <label htmlFor="lmsgen-access-code">App access code</label>
          <div className="lmsgen-app-input">
            <KeyRound size={18} aria-hidden="true" />
            <input
              id="lmsgen-access-code"
              value={code}
              onChange={(event) => setCode(formatAccessCode(event.target.value))}
              autoComplete="one-time-code"
              autoCapitalize="characters"
              inputMode="text"
              placeholder="XXXX-XXXX-XXXX"
              aria-describedby="lmsgen-code-help"
              disabled={working}
            />
          </div>
          <p id="lmsgen-code-help" className="lmsgen-app-help"><LockKeyhole size={13} /> Codes are stored securely and can be revoked from account settings.</p>
          {error && <div className="lmsgen-app-error" role="alert">{error}</div>}
          <button type="submit" disabled={working || code.replace(/-/g, '').length !== 12}>
            {working ? <Loader2 size={17} className="animate-spin" /> : null}
            {working ? 'Signing in…' : 'Open LMSGEN'}
            {!working ? <ArrowRight size={17} /> : null}
          </button>
        </form>

        <p className="lmsgen-app-standard-login">No app code? <Link to="/login">Use your regular LMSGEN sign-in</Link></p>
      </section>
    </main>
  );
}
