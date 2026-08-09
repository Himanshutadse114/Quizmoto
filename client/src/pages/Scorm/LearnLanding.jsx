import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BookOpen, ArrowRight } from 'lucide-react';
import { apiUrl } from '../../config';
import './scormEditorialTheme.css';

export default function ScormLearnLanding() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
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
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(apiUrl('/api/scorm/registrations/accept'), {
        inviteCode,
        learnerName: name.trim(),
        learnerEmail: email.trim() || null
      });
      const {
        registrationId,
        token,
        playToken,
        entryHref,
        packageId
      } = res.data;
      const registrationToken = token || playToken || '';

      if (!registrationId || !registrationToken || !entryHref) {
        throw new Error('Course launch information is incomplete. Please reopen the invite link.');
      }

      const launch = {
        token: registrationToken,
        entryHref,
        packageId: packageId || ''
      };
      try {
        sessionStorage.setItem(`scorm_reg_${registrationId}`, JSON.stringify(launch));
      } catch (_) {}

      const q = new URLSearchParams({
        token: registrationToken,
        entryHref,
        packageId: packageId || ''
      });
      navigate(`/scorm/player/${registrationId}?${q.toString()}`);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (error && !course) {
    return (
      <div className="scorm-editorial min-h-screen flex items-center justify-center p-5 md:p-8 relative z-20">
        <div className="scorm-soft-card max-w-lg w-full p-7 md:p-9 text-center">
          <div className="w-11 h-11 mx-auto rounded-xl bg-[#f7eeee] grid place-items-center text-[#a86963] mb-4"><BookOpen size={20} /></div>
          <h1 className="text-2xl font-semibold mb-2">Course unavailable</h1>
          <p className="text-sm leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="scorm-editorial min-h-screen flex items-center justify-center p-4 md:p-8 relative z-20">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.05fr_.95fr] scorm-soft-card overflow-hidden">
        <section className="scorm-tint-sage p-7 sm:p-9 md:p-11 lg:p-12 border-b lg:border-b-0 lg:border-r border-[#e1e6e2] flex flex-col justify-between min-h-[330px]">
          <div>
            <div className="w-11 h-11 rounded-xl bg-white grid place-items-center text-[#647b6e] border border-[#e0e7e2] mb-7">
              <BookOpen size={20} />
            </div>
            <div className="text-[11px] font-semibold text-[#78877f] mb-2">SCORM World</div>
            <h1 className="text-3xl sm:text-4xl md:text-[44px] font-semibold tracking-[-0.045em] leading-[1.02] break-words text-[#2d3933]">
              {course?.title || 'Loading course…'}
            </h1>
            <p className="mt-4 text-sm md:text-[15px] leading-relaxed max-w-xl text-[#68746e]">
              {course?.description || 'Enter your details to begin this learning experience.'}
            </p>
          </div>
          <div className="mt-8 flex items-center gap-2 text-[10px] text-[#8a958f]">
            <span className="font-semibold">Invite code</span>
            <span className="font-mono bg-white/70 border border-white rounded-lg px-2 py-1 text-[#64716b]">{inviteCode}</span>
          </div>
        </section>

        <section className="bg-white p-7 sm:p-9 md:p-10 lg:p-11 flex flex-col justify-center">
          <div className="text-[11px] font-semibold text-[#829087]">Learner details</div>
          <h2 className="text-2xl md:text-[30px] font-semibold tracking-[-0.035em] mt-1 mb-2">Ready when you are</h2>
          <p className="text-xs leading-relaxed mb-6">Your progress will be saved automatically while you learn.</p>

          <form onSubmit={start} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#5d6963] mb-1.5">Your name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full py-3 px-3.5 text-sm font-medium"
                placeholder="Enter your name"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#5d6963] mb-1.5">Email <span className="font-normal text-[#9aa39f]">optional</span></label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full py-3 px-3.5 text-sm font-medium"
                placeholder="you@example.com"
              />
            </div>
            {error && <div className="rounded-xl border border-[#ead4d1] bg-[#f7eeee] p-3 text-xs text-[#9e625d]">{error}</div>}
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
