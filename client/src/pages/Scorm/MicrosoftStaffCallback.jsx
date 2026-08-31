import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { exchangeMicrosoftCode, readMicrosoftCallbackParams } from './microsoftPkce';

export default function MicrosoftStaffCallback() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { loginScormWorkspaceWithMicrosoft } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const finish = async () => {
      const pendingKey = `lmsgen_staff_ms_pending_${workspaceId}`;
      const legacyStateKey = `lmsgen_staff_ms_state_${workspaceId}`;
      try {
        const callback = readMicrosoftCallbackParams();
        let pending = null;
        try {
          const raw = sessionStorage.getItem(pendingKey);
          if (raw) pending = JSON.parse(raw);
        } catch (_) {
          pending = null;
        }
        const expectedState = String(pending?.state || sessionStorage.getItem(legacyStateKey) || '');

        if (callback.error) throw new Error(callback.error);
        if (!callback.state || !expectedState || callback.state !== expectedState) {
          throw new Error('Microsoft sign-in state did not match. Please start sign-in again.');
        }

        let idToken = callback.idToken;
        if (!idToken && callback.code) {
          idToken = await exchangeMicrosoftCode({
            code: callback.code,
            clientId: pending?.clientId,
            tenantId: pending?.tenantId,
            redirectUri: pending?.redirectUri,
            verifier: pending?.verifier,
            nonce: pending?.nonce
          });
        }
        if (!idToken) throw new Error('Microsoft did not return an identity token.');

        sessionStorage.removeItem(pendingKey);
        sessionStorage.removeItem(legacyStateKey);

        const result = await loginScormWorkspaceWithMicrosoft(workspaceId, idToken);
        if (!result?.token) throw new Error('Microsoft staff sign-in did not return a session.');
        if (!cancelled) navigate('/scorm', { replace: true });
      } catch (err) {
        sessionStorage.removeItem(pendingKey);
        sessionStorage.removeItem(legacyStateKey);
        if (!cancelled) setError(err.response?.data?.message || err.message || 'Microsoft staff sign-in failed.');
      }
    };
    finish();
    return () => { cancelled = true; };
  }, [workspaceId, navigate, loginScormWorkspaceWithMicrosoft]);

  return (
    <div className="min-h-screen bg-[#f4f8f7] text-[#102321] grid place-items-center p-4">
      <div className="w-full max-w-md bg-white border border-[#dce8e5] rounded-2xl p-7 text-center shadow-[0_20px_60px_rgba(16,35,33,.08)]">
        {error ? (
          <>
            <ShieldAlert size={24} className="mx-auto text-[#bd4258]" />
            <h1 className="text-xl font-semibold mt-3">Microsoft sign-in failed</h1>
            <p className="text-sm text-[#687e7a] mt-2 leading-relaxed">{error}</p>
            <button type="button" onClick={() => navigate(`/login?workspace=${encodeURIComponent(workspaceId)}`, { replace: true })} className="mt-5 h-10 px-4 rounded-xl bg-[#45c5bc] text-[#0d2926] text-xs font-semibold">Return to staff sign-in</button>
          </>
        ) : (
          <>
            <RefreshCw size={22} className="animate-spin mx-auto text-[#159b91]" />
            <h1 className="text-xl font-semibold mt-3">Verifying Microsoft identity</h1>
            <p className="text-sm text-[#687e7a] mt-2">Checking your workspace membership…</p>
          </>
        )}
      </div>
    </div>
  );
}
