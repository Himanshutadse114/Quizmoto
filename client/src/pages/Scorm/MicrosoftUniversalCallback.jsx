import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import { exchangeMicrosoftCode, readMicrosoftCallbackParams } from './microsoftPkce';

function friendlyMicrosoftError(message) {
  const text = String(message || '');
  if (text.includes('AADSTS9002326')) {
    return 'Microsoft Entra has this redirect URI configured as Web. Move the common LMSGEN callback to Authentication → Single-page application (SPA), then try again.';
  }
  if (text.includes('AADSTS700054')) {
    return 'Microsoft Entra rejected the old implicit sign-in flow. LMSGEN now uses PKCE; register the callback under Single-page application (SPA).';
  }
  return text || 'Microsoft sign-in failed.';
}

export default function MicrosoftUniversalCallback() {
  const navigate = useNavigate();
  const { loginScormWorkspaceWithMicrosoft } = useAuth();
  const [error, setError] = useState('');
  const [returnPath, setReturnPath] = useState('/login');

  useEffect(() => {
    let cancelled = false;
    const finish = async () => {
      const pendingKey = 'lmsgen_universal_ms_pending';
      let pending = null;
      try {
        const raw = sessionStorage.getItem(pendingKey);
        if (raw) pending = JSON.parse(raw);
      } catch (_) {
        pending = null;
      }
      const destination = pending?.returnPath || (pending?.flow === 'learner' ? '/learn' : '/login');
      setReturnPath(destination);

      try {
        const callback = readMicrosoftCallbackParams();
        if (!pending?.workspaceId || !pending?.state) throw new Error('Microsoft sign-in session is missing. Please start sign-in again.');
        if (callback.error) throw new Error(callback.error);
        if (!callback.state || callback.state !== pending.state) throw new Error('Microsoft sign-in state did not match. Please start sign-in again.');

        let idToken = callback.idToken;
        if (!idToken && callback.code) {
          idToken = await exchangeMicrosoftCode({
            code: callback.code,
            clientId: pending.clientId,
            tenantId: pending.tenantId,
            redirectUri: pending.redirectUri,
            verifier: pending.verifier,
            nonce: pending.nonce
          });
        }
        if (!idToken) throw new Error('Microsoft did not return an identity token.');

        sessionStorage.removeItem(pendingKey);

        if (pending.flow === 'learner') {
          const res = await axios.post(apiUrl(`/api/scorm-learner/workspace/${pending.workspaceId}/microsoft`), { idToken });
          if (!res.data?.token) throw new Error('Microsoft learner sign-in did not return a session.');
          localStorage.setItem('lmsgen_learner_universal', res.data.token);
          localStorage.setItem(`lmsgen_learner_${pending.workspaceId}`, res.data.token);
          if (!cancelled) navigate('/learn', { replace: true });
          return;
        }

        const result = await loginScormWorkspaceWithMicrosoft(pending.workspaceId, idToken);
        if (!result?.token) throw new Error('Microsoft staff sign-in did not return a session.');
        if (!cancelled) navigate('/scorm', { replace: true });
      } catch (err) {
        sessionStorage.removeItem(pendingKey);
        if (!cancelled) setError(friendlyMicrosoftError(err.response?.data?.message || err.message));
      }
    };
    finish();
    return () => { cancelled = true; };
  }, [navigate, loginScormWorkspaceWithMicrosoft]);

  return (
    <div className="min-h-screen bg-[#f4f8f7] text-[#102321] grid place-items-center p-4">
      <div className="w-full max-w-md bg-white border border-[#dce8e5] rounded-2xl p-7 text-center shadow-[0_20px_60px_rgba(16,35,33,.08)]">
        {error ? (
          <>
            <ShieldAlert size={24} className="mx-auto text-[#bd4258]" />
            <h1 className="text-xl font-semibold mt-3">Microsoft sign-in failed</h1>
            <p className="text-sm text-[#687e7a] mt-2 leading-relaxed">{error}</p>
            <button type="button" onClick={() => navigate(returnPath, { replace: true })} className="mt-5 h-10 px-4 rounded-xl bg-[#45c5bc] text-[#0d2926] text-xs font-semibold">Return to sign-in</button>
          </>
        ) : (
          <>
            <RefreshCw size={22} className="animate-spin mx-auto text-[#159b91]" />
            <h1 className="text-xl font-semibold mt-3">Verifying Microsoft identity</h1>
            <p className="text-sm text-[#687e7a] mt-2">Finding your organisation and checking access…</p>
          </>
        )}
      </div>
    </div>
  );
}
