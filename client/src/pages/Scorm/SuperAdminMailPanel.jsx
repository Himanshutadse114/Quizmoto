import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, CheckCircle2, Mail, RefreshCw, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

function StatusBadge({ status }) {
  if (!status) return <span className="rounded-full border px-2.5 py-1 text-[9px] opacity-60">Not checked</span>;
  if (status.verified) return <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-semibold text-emerald-400">Email API verified</span>;
  if (status.configured) return <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[9px] font-semibold text-amber-400">Provider check failed</span>;
  return <span className="rounded-full border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-[9px] font-semibold text-rose-400">Email not configured</span>;
}

export default function SuperAdminMailPanel() {
  const { token, user } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [recipient, setRecipient] = useState(user?.email || '');
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState('');
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!recipient && user?.email) setRecipient(user.email);
  }, [recipient, user?.email]);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    setNotice(null);
    try {
      const response = await axios.get(apiUrl('/api/scorm/mail/status'), { headers });
      setStatus(response.data);
    } catch (error) {
      const payload = error.response?.data || {};
      setStatus({ ...payload, configured: Boolean(payload.configured), verified: false });
      setNotice({ type: 'error', text: payload.message || 'Could not verify email delivery.' });
    } finally {
      setChecking(false);
    }
  }, [headers]);

  useEffect(() => {
    if (token) checkStatus();
  }, [token, checkStatus]);

  const sendTest = async (kind) => {
    const to = recipient.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(to)) {
      setNotice({ type: 'error', text: 'Enter a valid recipient email address.' });
      return;
    }

    setSending(kind);
    setNotice(null);
    try {
      const response = await axios.post(apiUrl('/api/scorm/mail/test'), { to, kind }, { headers });
      const label = kind === 'campaign' ? 'Campaign test email' : 'Email delivery test';
      setNotice({
        type: 'success',
        text: `${label} sent to ${response.data.recipient} using ${response.data.provider || 'the configured provider'}.${response.data.messageId ? ` Message ID: ${response.data.messageId}` : ''}`
      });
      await checkStatus();
    } catch (error) {
      const payload = error.response?.data || {};
      if (payload.diagnostics) setStatus((current) => ({ ...(current || {}), provider: payload.provider, diagnostics: payload.diagnostics, configured: payload.code !== 'MAIL_NOT_CONFIGURED', verified: false }));
      setNotice({ type: 'error', text: payload.message || 'Could not send the test email.' });
    } finally {
      setSending('');
    }
  };

  const d = status?.diagnostics || {};
  const provider = status?.provider || d.provider || 'unknown';
  const isBrevo = provider === 'brevo';

  return (
    <section className="scorm-panel rounded-2xl border p-4 md:p-5 mb-4">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-9 h-9 rounded-xl grid place-items-center border text-[#4FC9BF]"><Mail size={17} /></div>
            <div>
              <h2 className="text-base md:text-lg font-semibold">Email delivery diagnostics</h2>
              <p className="mt-1 text-[10px] opacity-55">Test the same delivery service used for registration OTPs, password resets, tenant invitations, course assignments and campaign emails.</p>
            </div>
            <StatusBadge status={status} />
          </div>
        </div>
        <button type="button" onClick={checkStatus} disabled={checking} className="scorm-button-secondary min-h-9 px-3 text-[10px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
          <RefreshCw size={13} className={checking ? 'animate-spin' : ''} /> {checking ? 'Checking…' : 'Check email service'}
        </button>
      </div>

      <div className="mt-4 grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
        <div className="rounded-xl border px-3 py-2.5"><div className="text-[9px] uppercase tracking-[.07em] opacity-45">Provider</div><div className="mt-1 text-xs font-semibold">{isBrevo ? 'Brevo HTTPS API' : provider === 'smtp' ? 'SMTP' : 'Not available'}</div></div>
        <div className="rounded-xl border px-3 py-2.5"><div className="text-[9px] uppercase tracking-[.07em] opacity-45">Connection</div><div className="mt-1 text-xs font-semibold break-all">{isBrevo ? (d.apiHost || 'api.brevo.com') : (d.host ? `${d.host}:${d.port || ''}` : 'Not available')}</div></div>
        <div className="rounded-xl border px-3 py-2.5"><div className="text-[9px] uppercase tracking-[.07em] opacity-45">From address</div><div className="mt-1 text-xs font-semibold break-all">{d.fromAddress || 'Not configured'}</div></div>
        <div className="rounded-xl border px-3 py-2.5"><div className="text-[9px] uppercase tracking-[.07em] opacity-45">Credentials</div><div className="mt-1 text-xs font-semibold">{isBrevo ? (d.apiConfigured ? 'Brevo API key set' : 'API key missing') : (d.userSet && d.passwordSet ? 'Username + password set' : 'Missing credentials')}</div></div>
      </div>

      <div className="mt-4 rounded-xl border p-3.5 bg-[rgba(79,201,191,.025)]">
        <label className="block">
          <span className="text-[9px] uppercase tracking-[.08em] opacity-55">Test recipient</span>
          <input type="email" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="you@company.com" className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-xs bg-transparent outline-none focus:border-[#4FC9BF]" />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => sendTest('email')} disabled={Boolean(sending)} className="scorm-button-primary min-h-9 px-3 text-[10px] font-semibold inline-flex items-center gap-2 disabled:opacity-50">
            <Send size={13} /> {sending === 'email' ? 'Sending…' : 'Send test email'}
          </button>
          <button type="button" onClick={() => sendTest('campaign')} disabled={Boolean(sending)} className="scorm-button-secondary min-h-9 px-3 text-[10px] font-semibold inline-flex items-center gap-2 disabled:opacity-50">
            <Mail size={13} /> {sending === 'campaign' ? 'Sending…' : 'Send campaign + passkey test'}
          </button>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed opacity-55">The campaign test uses the live campaign invitation template and a sample Email + access code passkey. If this succeeds, campaign invitation delivery is using the same working provider path.</p>
      </div>

      {notice && (
        <div className={`mt-3 rounded-xl border px-3.5 py-3 text-[10px] leading-relaxed flex items-start gap-2 ${notice.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' : 'border-rose-500/20 bg-rose-500/5 text-rose-400'}`}>
          {notice.type === 'success' ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
          <span>{notice.text}</span>
        </div>
      )}
    </section>
  );
}
