import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, KeyRound, Mail, RefreshCw } from 'lucide-react';
import { apiUrl } from '../../config';

function normaliseCode(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 6);
}

export default function LearnerEmailOtpLogin({
  workspaceId: fixedWorkspaceId = '',
  onWorkspaceResolved,
  onAuthenticated,
  compact = false
}) {
  const [email, setEmail] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [resolvedWorkspaceId, setResolvedWorkspaceId] = useState(fixedWorkspaceId || '');
  const [step, setStep] = useState('email');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);
  const [expiresInSeconds, setExpiresInSeconds] = useState(0);

  useEffect(() => {
    if (fixedWorkspaceId) setResolvedWorkspaceId(fixedWorkspaceId);
  }, [fixedWorkspaceId]);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => setResendSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  const expiryMinutes = useMemo(() => Math.max(1, Math.ceil(expiresInSeconds / 60)), [expiresInSeconds]);

  const resolveWorkspace = async (cleanEmail) => {
    if (fixedWorkspaceId) return fixedWorkspaceId;
    if (resolvedWorkspaceId) return resolvedWorkspaceId;
    const discovery = await axios.post(apiUrl('/api/scorm-learner/discover'), { email: cleanEmail });
    const id = discovery.data?.workspaceId || discovery.data?.config?.workspaceId || '';
    if (!id) throw new Error('Your learning organisation could not be identified.');
    setResolvedWorkspaceId(id);
    onWorkspaceResolved?.(id);
    return id;
  };

  const requestCode = async ({ isResend = false } = {}) => {
    const cleanEmail = (verifiedEmail || email).trim().toLowerCase();
    if (!cleanEmail) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const id = await resolveWorkspace(cleanEmail);
      const res = await axios.post(apiUrl(`/api/scorm-learner/workspace/${id}/email`), { email: cleanEmail });
      setResolvedWorkspaceId(id);
      onWorkspaceResolved?.(id);
      setVerifiedEmail(cleanEmail);
      setEmail(cleanEmail);
      setCode('');
      setStep('verify');
      setExpiresInSeconds(Number(res.data?.expiresInSeconds || 600));
      setResendSeconds(Number(res.data?.resendAfterSeconds || 60));
      setNotice(isResend ? 'A new verification code has been requested.' : (res.data?.message || 'Check your email for the verification code.'));
    } catch (err) {
      const retryAfter = Number(err.response?.data?.retryAfter || err.response?.headers?.['retry-after'] || 0);
      if (retryAfter > 0) setResendSeconds(retryAfter);
      setError(err.response?.data?.message || err.message || 'Could not send a verification code.');
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = async (event) => {
    event.preventDefault();
    await requestCode();
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    if (code.length !== 6 || !resolvedWorkspaceId || !verifiedEmail) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await axios.post(apiUrl(`/api/scorm-learner/workspace/${resolvedWorkspaceId}/email/verify`), {
        email: verifiedEmail,
        code
      });
      await onAuthenticated?.(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'The verification code could not be verified.');
    } finally {
      setBusy(false);
    }
  };

  const changeEmail = () => {
    setStep('email');
    setCode('');
    setVerifiedEmail('');
    setNotice('');
    setError('');
    if (!fixedWorkspaceId) {
      setResolvedWorkspaceId('');
      onWorkspaceResolved?.('');
    }
  };

  const panelClass = compact ? 'space-y-3' : 'space-y-4';

  if (step === 'verify') {
    return (
      <form onSubmit={verifyCode} className={panelClass}>
        <div className="rounded-xl border border-[#dce8e5] bg-[#f7fbfa] px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#dff4f1] text-[#0b837a] grid place-items-center shrink-0"><KeyRound size={16} /></div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#244d49]">Verify your email</div>
              <p className="text-[11px] leading-relaxed text-[#6a7f7c] mt-1">Enter the 6-digit code sent to <strong className="font-semibold text-[#355f5a] break-all">{verifiedEmail}</strong>. The code expires in about {expiryMinutes} minute{expiryMinutes === 1 ? '' : 's'}.</p>
            </div>
          </div>
        </div>

        {notice && <div className="rounded-xl border border-[#cfe8e4] bg-[#eff9f7] text-[#386b65] px-4 py-3 text-xs leading-relaxed">{notice}</div>}
        {error && <div className="rounded-xl border border-[#f5c4cc] bg-[#fff3f5] text-[#9f3345] px-4 py-3 text-xs leading-relaxed">{error}</div>}

        <label className="block">
          <span className="block text-[10px] uppercase tracking-[.1em] font-bold text-[#5e7773] mb-1.5">Verification code</span>
          <input
            value={code}
            onChange={(event) => setCode(normaliseCode(event.target.value))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            className="w-full h-12 rounded-xl border border-[#cfdcda] bg-white px-4 text-center text-xl font-semibold tracking-[.32em] outline-none focus:border-[#1aa99e]"
            placeholder="000000"
            aria-label="6-digit verification code"
          />
        </label>

        <button type="submit" disabled={busy || code.length !== 6} className="w-full h-11 rounded-xl bg-[#45c5bc] hover:bg-[#36b7ae] text-[#0d2926] text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2">
          {busy ? <RefreshCw size={14} className="animate-spin" /> : <KeyRound size={14} />}
          {busy ? 'Verifying…' : 'Verify & continue'}
        </button>

        <div className="flex items-center justify-between gap-3 text-[11px]">
          <button type="button" onClick={changeEmail} disabled={busy} className="inline-flex items-center gap-1.5 font-semibold text-[#4b6e69] disabled:opacity-50"><ArrowLeft size={12} /> Change email</button>
          <button type="button" onClick={() => requestCode({ isResend: true })} disabled={busy || resendSeconds > 0} className="font-semibold text-[#167f77] disabled:text-[#8a9c99] disabled:cursor-not-allowed">
            {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend code'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submitEmail} className={panelClass}>
      {error && <div className="rounded-xl border border-[#f5c4cc] bg-[#fff3f5] text-[#9f3345] px-4 py-3 text-xs leading-relaxed">{error}</div>}
      <label className="block">
        <span className="block text-[10px] uppercase tracking-[.1em] font-bold text-[#5e7773] mb-1.5">Work email</span>
        <div className="relative">
          <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#69817d]" />
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full h-11 rounded-xl border border-[#cfdcda] bg-white pl-10 pr-3.5 text-sm outline-none focus:border-[#1aa99e]"
            placeholder="you@company.com"
            autoComplete="email"
          />
        </div>
      </label>
      <button type="submit" disabled={busy || !email.trim()} className="w-full h-11 rounded-xl bg-[#45c5bc] hover:bg-[#36b7ae] text-[#0d2926] text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2">
        {busy ? <RefreshCw size={14} className="animate-spin" /> : <Mail size={14} />}
        {busy ? 'Sending code…' : 'Send verification code'}
      </button>
      <p className="text-[11px] leading-relaxed text-[#718581]">For security, email access requires a one-time code. A learner session is created only after the code is verified.</p>
    </form>
  );
}
