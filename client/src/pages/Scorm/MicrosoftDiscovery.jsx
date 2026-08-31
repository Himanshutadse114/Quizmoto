import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Building2, Mail, ShieldCheck, Sun, Moon } from 'lucide-react';
import { apiUrl } from '../../config';
import { createMicrosoftPkceRequest } from './microsoftPkce';
import { readScormPlatformTheme, saveScormPlatformTheme } from './platformTheme';
import './scormAuthWorkbench.css';
import './scormAuthTealRestore.css';
import './scormLightTheme.css';
import './scormLightContrastGuard.css';

function MicrosoftMark() {
  return (
    <span className="grid grid-cols-2 gap-[2px] w-5 h-5" aria-hidden="true">
      <span className="bg-[#f25022]" /><span className="bg-[#7fba00]" />
      <span className="bg-[#00a4ef]" /><span className="bg-[#ffb900]" />
    </span>
  );
}

export default function MicrosoftDiscovery() {
  const location = useLocation();
  const navigate = useNavigate();
  const learnerFlow = location.pathname.startsWith('/learn');
  const returnPath = learnerFlow ? '/learn' : '/login';
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState(readScormPlatformTheme);

  useEffect(() => { saveScormPlatformTheme(theme); }, [theme]);

  const startMicrosoft = async (event) => {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter your work email address.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const endpoint = learnerFlow ? '/api/scorm-learner/discover' : '/api/scorm/staff-auth/discover';
      const res = await axios.post(apiUrl(endpoint), { email: cleanEmail });
      const config = res.data?.config || null;
      const workspaceId = res.data?.workspaceId || config?.workspaceId || '';
      const clientId = learnerFlow ? config?.microsoftClientId : config?.staffMicrosoftClientId;
      const tenantId = learnerFlow ? config?.microsoftTenantId : config?.staffMicrosoftTenantId;
      const enabled = learnerFlow ? config?.microsoftEnabled : config?.staffMicrosoftEnabled;

      if (!workspaceId || !config) throw new Error('Your LMSGEN organisation could not be identified.');
      if (!enabled || !clientId || !tenantId) {
        throw new Error('Microsoft sign-in is not enabled for this organisation. Contact your administrator.');
      }

      const redirectUri = `${window.location.origin}/auth/microsoft/callback`;
      const pending = await createMicrosoftPkceRequest({ clientId, tenantId, redirectUri });
      sessionStorage.setItem('lmsgen_universal_ms_pending', JSON.stringify({
        ...pending,
        flow: learnerFlow ? 'learner' : 'staff',
        workspaceId,
        discoveryEmail: cleanEmail,
        returnPath
      }));
      window.location.assign(pending.authorizeUrl);
    } catch (err) {
      setBusy(false);
      setError(err.response?.data?.message || err.message || 'Microsoft sign-in could not start.');
    }
  };

  const light = theme === 'light';
  const ThemeIcon = light ? Moon : Sun;
  const logoSrc = light ? '/branding/lmsgen-logo-light.png' : '/branding/lmsgen-logo-dark.png';

  return (
    <div className={`scorm-auth-workbench scorm-theme-${theme} sa-login-only`}>
      <div className="sa-shell">
        <div className="sa-topbar">
          <img src={logoSrc} alt="LMSGEN" className="sa-logo" style={{ width: 132, height: 'auto' }} />
          <button type="button" className="sa-theme-toggle" onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}>
            <ThemeIcon size={15} strokeWidth={2} />
            <span className="scorm-theme-toggle-label">{light ? 'Dark' : 'Light'}</span>
            <span className="scorm-theme-toggle-track" aria-hidden="true"><span className="scorm-theme-toggle-knob" /></span>
          </button>
        </div>

        <main className="sa-card sa-card-login">
          <section className="sa-form-panel">
            <button type="button" onClick={() => navigate(returnPath)} className="inline-flex items-center gap-2 text-xs opacity-70 mb-5 hover:opacity-100">
              <ArrowLeft size={14} /> Back to sign in
            </button>

            <div className="w-11 h-11 rounded-xl grid place-items-center mb-4" style={{ background: 'rgba(69,197,188,.12)' }}><MicrosoftMark /></div>
            <h2 className="sa-form-title">Enter your work email</h2>
            <p className="mt-2 mb-5 text-xs opacity-70 leading-relaxed">
              {learnerFlow
                ? 'We use your verified work email to find the organisation that assigned your learning.'
                : 'We use your work email to find your LMSGEN organisation and its Microsoft Entra configuration.'}
            </p>

            {error && <div className="sa-error">{error}</div>}

            <form onSubmit={startMicrosoft} className="sa-form">
              <label>
                <span className="sa-label">Work email address</span>
                <div className="sa-input-wrap">
                  <Mail size={15} />
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@company.com" className="sa-input" autoComplete="email" autoFocus />
                </div>
              </label>
              <button type="submit" disabled={busy} className="sa-submit flex items-center justify-center gap-2">
                <MicrosoftMark /> {busy ? 'Finding organisation…' : 'Continue with Microsoft'}
              </button>
            </form>

            <div className="mt-5 rounded-xl border p-3 text-[10px] leading-relaxed opacity-75 flex gap-2" style={{ borderColor: 'rgba(69,197,188,.25)' }}>
              <ShieldCheck size={14} className="shrink-0 mt-0.5" />
              <span>{learnerFlow ? 'Your exact learner assignment is checked after Microsoft verifies your identity.' : 'Your exact Admin, Co-admin or Analytics Viewer membership is checked after Microsoft verifies your identity.'}</span>
            </div>

            <div className="mt-4 flex items-center gap-2 text-[10px] opacity-60"><Building2 size={13} /> One Microsoft entry point for every LMSGEN tenant</div>
          </section>
        </main>
      </div>
    </div>
  );
}
