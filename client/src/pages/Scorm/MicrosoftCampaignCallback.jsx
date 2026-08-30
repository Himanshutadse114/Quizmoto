import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { apiUrl } from '../../config';

export default function MicrosoftCampaignCallback() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const finish = async () => {
      try {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const returnedState = params.get('state') || '';
        const expectedState = sessionStorage.getItem(`lmsgen_campaign_ms_state_${campaignId}`) || '';
        const idToken = params.get('id_token') || '';
        const providerError = params.get('error_description') || params.get('error') || '';
        sessionStorage.removeItem(`lmsgen_campaign_ms_state_${campaignId}`);

        if (providerError) throw new Error(providerError);
        if (!returnedState || !expectedState || returnedState !== expectedState) {
          throw new Error('Microsoft sign-in state did not match. Please start sign-in again.');
        }
        if (!idToken) throw new Error('Microsoft did not return an identity token.');

        const res = await axios.post(apiUrl(`/api/scorm-learner/campaign/${campaignId}/microsoft`), { idToken });
        if (!res.data?.token) throw new Error('Microsoft campaign sign-in did not return a session.');
        localStorage.setItem(`lmsgen_campaign_${campaignId}`, res.data.token);
        if (!cancelled) navigate(`/campaign/${campaignId}`, { replace: true });
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || err.message || 'Microsoft campaign sign-in failed.');
      }
    };
    finish();
    return () => { cancelled = true; };
  }, [campaignId, navigate]);

  return (
    <div className="min-h-screen bg-[#f4f8f7] text-[#102321] grid place-items-center p-4">
      <div className="w-full max-w-md bg-white border border-[#dce8e5] rounded-2xl p-7 text-center shadow-[0_20px_60px_rgba(16,35,33,.08)]">
        {error ? (
          <>
            <ShieldAlert size={24} className="mx-auto text-[#bd4258]" />
            <h1 className="text-xl font-semibold mt-3">Microsoft sign-in failed</h1>
            <p className="text-sm text-[#687e7a] mt-2 leading-relaxed">{error}</p>
            <button type="button" onClick={() => navigate(`/campaign/${campaignId}`, { replace: true })} className="mt-5 h-10 px-4 rounded-xl bg-[#45c5bc] text-[#0d2926] text-xs font-semibold">Return to campaign</button>
          </>
        ) : (
          <>
            <RefreshCw size={22} className="animate-spin mx-auto text-[#159b91]" />
            <h1 className="text-xl font-semibold mt-3">Verifying Microsoft identity</h1>
            <p className="text-sm text-[#687e7a] mt-2">Checking your campaign access…</p>
          </>
        )}
      </div>
    </div>
  );
}
