import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { apiUrl } from '../../config';
import { exchangeMicrosoftCode, readMicrosoftCallbackParams } from './microsoftPkce';

export default function MicrosoftLearnerCallback() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [returnPath, setReturnPath] = useState(`/learn/${workspaceId}`);

  useEffect(() => {
    let cancelled = false;
    const finish = async () => {
      const learnerPendingKey = `lmsgen_ms_pending_${workspaceId}`;
      const learnerLegacyStateKey = `lmsgen_ms_state_${workspaceId}`;
      try {
        const callback = readMicrosoftCallbackParams();
        let campaignPending = null;
        let learnerPending = null;
        try {
          const campaignRaw = sessionStorage.getItem('lmsgen_ms_campaign_pending');
          if (campaignRaw) campaignPending = JSON.parse(campaignRaw);
          const learnerRaw = sessionStorage.getItem(learnerPendingKey);
          if (learnerRaw) learnerPending = JSON.parse(learnerRaw);
        } catch (_) {
          campaignPending = null;
          learnerPending = null;
        }

        const isCampaign = Boolean(
          campaignPending?.campaignId &&
          campaignPending?.workspaceId === workspaceId &&
          campaignPending?.state
        );
        const pending = isCampaign ? campaignPending : learnerPending;
        const expectedState = String(
          pending?.state || (!isCampaign ? sessionStorage.getItem(learnerLegacyStateKey) : '') || ''
        );
        const destination = isCampaign ? `/campaign/${campaignPending.campaignId}` : `/learn/${workspaceId}`;
        setReturnPath(destination);

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

        sessionStorage.removeItem(learnerPendingKey);
        sessionStorage.removeItem(learnerLegacyStateKey);
        sessionStorage.removeItem('lmsgen_ms_campaign_pending');

        if (isCampaign) {
          const res = await axios.post(apiUrl(`/api/scorm-learner/campaign/${campaignPending.campaignId}/microsoft`), { idToken });
          if (!res.data?.token) throw new Error('Microsoft campaign sign-in did not return a session.');
          localStorage.setItem(`lmsgen_campaign_${campaignPending.campaignId}`, res.data.token);
        } else {
          const res = await axios.post(apiUrl(`/api/scorm-learner/workspace/${workspaceId}/microsoft`), { idToken });
          if (!res.data?.token) throw new Error('Microsoft learner sign-in did not return a session.');
          localStorage.setItem(`lmsgen_learner_${workspaceId}`, res.data.token);
        }

        if (!cancelled) navigate(destination, { replace: true });
      } catch (err) {
        sessionStorage.removeItem(learnerPendingKey);
        sessionStorage.removeItem(learnerLegacyStateKey);
        sessionStorage.removeItem('lmsgen_ms_campaign_pending');
        if (!cancelled) setError(err.response?.data?.message || err.message || 'Microsoft learner sign-in failed.');
      }
    };
    finish();
    return () => { cancelled = true; };
  }, [workspaceId, navigate]);

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
            <p className="text-sm text-[#687e7a] mt-2">Checking your learner access…</p>
          </>
        )}
      </div>
    </div>
  );
}
