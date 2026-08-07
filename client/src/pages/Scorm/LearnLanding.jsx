import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { apiUrl } from '../../config';

export default function ScormLearnLanding() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios
      .get(apiUrl(`/api/scorm/courses/code/${inviteCode}`))
      .then((r) => setCourse(r.data))
      .catch((e) => setError(e.response?.data?.message || 'Course not found or not published'));
  }, [inviteCode]);

  const start = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name');
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
      const q = new URLSearchParams({
        token: res.data.token,
        packageId: res.data.packageId || '',
        entryHref: res.data.entryHref || ''
      });
      try {
        sessionStorage.setItem(
          `scorm_reg_${res.data.registrationId}`,
          JSON.stringify({
            token: res.data.token,
            packageId: res.data.packageId,
            entryHref: res.data.entryHref
          })
        );
      } catch (_) {}
      navigate(`/scorm/player/${res.data.registrationId}?${q.toString()}`);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setLoading(false);
    }
  };

  if (error && !course) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative z-10">
        <div className="max-w-md w-full rounded-3xl bg-white/5 border border-white/10 p-8 text-center">
          <h1 className="text-2xl font-black mb-2">Course unavailable</h1>
          <p className="text-white/60 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative z-10">
      <div className="max-w-md w-full rounded-3xl bg-white/5 border border-white/10 p-8 shadow-2xl">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-quizmoto-yellow mb-2">
          SCORM World
        </div>
        <h1 className="text-2xl font-black italic tracking-tighter mb-1">
          {course?.title || 'Loading…'}
        </h1>
        {course?.description && (
          <p className="text-white/50 text-sm mb-6">{course.description}</p>
        )}

        <form onSubmit={start} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">
              Your name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-white/10 border border-white/10 rounded-xl py-3 px-4 font-bold text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-quizmoto-blue/40"
              placeholder="Enter your name"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">
              Email (optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-xl py-3 px-4 font-bold text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-quizmoto-blue/40"
              placeholder="you@example.com"
            />
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={loading || !course}
            className="w-full py-3.5 rounded-xl bg-quizmoto-green text-white font-black text-sm shadow-[0_4px_0_0_#1a5e08] hover:shadow-none hover:translate-y-1 transition-all disabled:opacity-50"
          >
            {loading ? 'Starting…' : 'Start course'}
          </button>
        </form>
        <p className="mt-4 text-[11px] text-white/40 text-center">
          Your progress is saved. You can resume later from the same link if the course allows it.
        </p>
      </div>
    </div>
  );
}
