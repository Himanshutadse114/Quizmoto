import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

export default function CoursePreviewRedirect() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/', { replace: true });
      return undefined;
    }

    let cancelled = false;

    const launch = async () => {
      try {
        const response = await axios.post(
          apiUrl(`/api/scorm/courses/${encodeURIComponent(id || '')}/preview`),
          {},
          { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 }
        );
        if (cancelled) return;

        const registrationId = response.data?.registrationId;
        const previewToken = response.data?.token;
        const playPath = response.data?.playUrl || (registrationId ? `/api/scorm/play/${encodeURIComponent(registrationId)}` : '');
        if (!registrationId || !previewToken || !playPath) {
          throw new Error('Preview session could not be created.');
        }

        const separator = playPath.includes('?') ? '&' : '?';
        window.location.replace(`${apiUrl(playPath)}${separator}token=${encodeURIComponent(previewToken)}&preview=1`);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.message || err.message || 'Unable to launch course preview.');
      }
    };

    launch();
    return () => { cancelled = true; };
  }, [id, navigate, token]);

  return (
    <div className="min-h-screen bg-[#f5f7f7] text-[#142321] grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-[#d9e5e3] bg-white shadow-sm p-7 text-center">
        {error ? (
          <>
            <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 grid place-items-center mx-auto">
              <AlertCircle size={20} />
            </div>
            <h1 className="text-lg font-semibold mt-4">Preview could not be opened</h1>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={() => navigate(`/scorm/courses/${encodeURIComponent(id || '')}`, { replace: true })}
              className="mt-5 inline-flex items-center justify-center rounded-lg bg-[#4FC9BF] px-4 py-2.5 text-sm font-semibold text-[#10211f]"
            >
              Back to course
            </button>
          </>
        ) : (
          <>
            <div className="w-11 h-11 rounded-xl border border-[#c8dedb] bg-[#ecf8f6] grid place-items-center mx-auto text-[#177E78]">
              <Loader2 size={20} className="animate-spin" />
            </div>
            <h1 className="text-lg font-semibold mt-4">Opening course preview</h1>
            <p className="text-sm text-slate-500 mt-2">Preparing a QA-only preview session…</p>
          </>
        )}
      </div>
    </div>
  );
}
