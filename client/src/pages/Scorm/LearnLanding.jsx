import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { apiUrl } from '../../config';

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
      <div className="min-h-screen flex items-center justify-center p-6 relative z-10">
        <div className="max-w-md w-full rounded-3xl bg-white/5 border border-white/10 p-8 text-center">
          <p className="text-red-300 text-sm">{error}</p>
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
        <h1
          className="text-xl sm:text-2xl font-black italic tracking-tighter mb-1 break-words leading-tight"
          title={course?.title || ''}
        >
          {course?.title || 'Loading…'}
        </h1>
        {course?.description && (
          <p className="text-white/50 text-sm mb-6 break-words leading-relaxed">{course.description}</p>
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
      </div>
    </div>
  );
}
