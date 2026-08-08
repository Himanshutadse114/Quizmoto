import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
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
      const res = await axios.post(apiUrl('/api/scorm/registrations/join'), {
        inviteCode,
        learnerName: name.trim(),
        learnerEmail: email.trim() || null
      });
      const { registrationId, playToken, entryHref } = res.data;
      const q = new URLSearchParams({
        token: playToken || '',
        entry: entryHref || ''
      });
      navigate(`/scorm/play/${registrationId}?${q.toString()}`);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (error && !course) {
    return (
      <div className="scorm-editorial min-h-screen flex items-center justify-center p-5 md:p-8 relative z-20">
        <div className="max-w-lg w-full border-2 border-[#111111] p-6 md:p-10">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] mb-4">SCORM World / Access</div>
          <h1 className="text-3xl font-black uppercase leading-none mb-5">Course unavailable.</h1>
          <div className="border-t-2 border-[#111111] pt-5 text-sm font-bold">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="scorm-editorial min-h-screen flex items-center justify-center p-4 md:p-8 relative z-20">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.15fr_.85fr] border-2 border-[#111111]">
        <section className="p-6 sm:p-8 md:p-12 lg:p-14 border-b-2 lg:border-b-0 lg:border-r-2 border-[#111111]">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] mb-5">SCORM World / Learning Access</div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-[-0.05em] leading-[0.92] break-words">
            {course?.title || 'Loading course.'}
          </h1>
          <div className="w-full border-t-2 border-[#111111] mt-7 pt-5">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-2">Course brief</div>
            <p className="text-sm md:text-base leading-relaxed font-semibold max-w-2xl">
              {course?.description || 'Enter your details to begin this learning experience.'}
            </p>
          </div>
          <div className="mt-8 text-xs font-black uppercase tracking-[0.12em]">Invite code / {inviteCode}</div>
        </section>

        <section className="p-6 sm:p-8 md:p-10 lg:p-12 flex flex-col justify-center">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-2">Learner details</div>
          <h2 className="text-2xl md:text-3xl font-black uppercase leading-none mb-6">Start your course.</h2>

          <form onSubmit={start} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.16em] mb-2">Your name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full py-3.5 px-4 font-bold"
                placeholder="Enter your name"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.16em] mb-2">Email / optional</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full py-3.5 px-4 font-bold"
                placeholder="you@example.com"
              />
            </div>
            {error && <div className="border-2 border-[#111111] p-3 text-sm font-black uppercase tracking-[0.04em]">! {error}</div>}
            <button
              type="submit"
              disabled={loading || !course}
              className="scorm-button-primary w-full py-4 px-5 font-black text-sm uppercase tracking-[0.12em] disabled:opacity-50"
            >
              {loading ? 'Starting…' : 'Start course →'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
