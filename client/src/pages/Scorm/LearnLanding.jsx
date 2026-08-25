import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { BookOpen, ArrowRight } from 'lucide-react';
import { apiUrl } from '../../config';
import './scormEditorialTheme.css';
import './scormContrastPolish.css';
import './scormModernDark.css';

function isValidEmail(value) {
  const email = String(value || '').trim();
  return email.length > 0 && email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ScormLearnLanding() {
  const { inviteCode } = useParams();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!inviteCode) return;
    axios
      .get(apiUrl(`/api/scorm/courses/code/${inviteCode}`))
      .then((r) => setCourse(r.data))
      .catch((e) => setError(e.response?.data?.message || e.message));
  }, [inviteCode]);

  const start = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!email.trim()) {
      setError('Email address is required');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Enter a valid email address');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(apiUrl('/api/scorm/registrations/accept'), {
        inviteCode,
        learnerName: name.trim(),
        learnerEmail: email.trim()
      });
      const {
        registrationId,
        token,
        playToken,
        entryHref,
        packageId,
        playUrl
      } = res.data;
      const registrationToken = token || playToken || '';

      // The backend validates/reconstructs package launch metadata before it
      // creates the registration. The client only needs the signed registration
      // identity to enter the canonical same-origin player route.
      if (!registrationId || !registrationToken) {
        throw new Error('Course registration could not be created. Please reopen the invite link.');
      }

      const launch = {
        token: registrationToken,
        entryHref: entryHref || '',
        packageId: packageId || ''
      };
      try {
        sessionStorage.setItem(`scorm_reg_${registrationId}`, JSON.stringify(launch));
      } catch (_) {}

      const q = new URLSearchParams({ token: registrationToken });
      if (entryHref) q.set('entryHref', entryHref);
      if (packageId) q.set('packageId', packageId);

      const canonicalPlayUrl = playUrl || `/api/scorm/play/${registrationId}`;
      window.location.assign(apiUrl(`${canonicalPlayUrl}?${q.toString()}`));
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setLoading(false);
    }
  };

  if (error && !course) {
    return (
      <div className="scorm-editorial min-h-screen flex items-center justify-center p-5 md:p-8 relative z-20">
        <div className="scorm-soft-card max-w-lg w-full p-7 md:p-9 text-center">
          <div className="w-11 h-11 mx-auto rounded-xl bg-[#35131d] border border-[#7f2739] grid place-items-center text-[#fda4af] mb-4"><BookOpen size={20} /></div>
          <h1 className="text-2xl font-semibold mb-2">Course unavailable</h1>
          <p className="text-sm leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="scorm-editorial min-h-screen flex items-center justify-center p-4 md:p-8 relative z-20">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] scorm-soft-card overflow-hidden">
        <section className="min-w-0 scorm-tint-sage p-7 sm:p-9 md:p-11 lg:p-12 border-b lg:border-b-0 lg:border-r border-[#223a59] flex flex-col justify-between min-h-[330px]">
          <div className="min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#0e2039] grid place-items-center text-[#bfdbfe] border border-[#2a4b74] mb-7">
              <BookOpen size={20} />
            </div>
            <div className="text-[11px] font-semibold text-[#93a4bb]">SCORM AI</div>
            <h1
              className="max-w-full text-3xl sm:text-4xl md:text-[44px] font-semibold tracking-[-0.045em] leading-[1.02] text-[#f8fafc]"
              style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
            >
              {course?.title || 'Loading course…'}
            </h1>
            <p className="mt-4 text-sm md:text-[15px] leading-relaxed max-w-xl text-[#cbd5e1]">
              {course?.description || 'Enter your details to begin this learning experience.'}
            </p>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-2 text-[10px] text-[#93a4bb] min-w-0">
            <span className="font-semibold">Invite code</span>
            <span className="max-w-full break-all font-mono bg-[#0e2039] border border-[#2a4b74] rounded-lg px-2 py-1 text-[#bfdbfe]">{inviteCode}</span>
          </div>
        </section>

        <section className="min-w-0 bg-[#08111e] p-7 sm:p-9 md:p-10 lg:p-11 flex flex-col justify-center">
          <div className="text-[11px] font-semibold text-[#93a4bb]">Learner details</div>
          <h2 className="text-2xl md:text-[30px] font-semibold tracking-[-0.035em] mt-1 mb-2">Ready when you are</h2>
          <p className="text-xs leading-relaxed mb-6">Your progress will be saved automatically while you learn.</p>

          <form onSubmit={start} className="space-y-4 min-w-0">
            <div className="min-w-0">
              <label className="block text-[11px] font-semibold text-[#cbd5e1] mb-1.5">Your name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className="w-full min-w-0 py-3 px-3.5 text-sm font-medium"
                placeholder="Enter your name"
              />
            </div>
            <div className="min-w-0">
              <label className="block text-[11px] font-semibold text-[#cbd5e1] mb-1.5">Email <span className="text-[#fda4af]">*</span></label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                inputMode="email"
                className="w-full min-w-0 py-3 px-3.5 text-sm font-medium"
                placeholder="you@example.com"
              />
              <div className="mt-1.5 text-[10px] text-[#71839c]">Required to identify your learner record and save course progress.</div>
            </div>
            {error && <div className="rounded-xl border border-[#7f2739] bg-[#35131d] p-3 text-xs text-[#fecdd3]">{error}</div>}
            <button
              type="submit"
              disabled={loading || !course}
              className="scorm-button-primary w-full py-3.5 px-5 font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Starting…' : 'Start course'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
