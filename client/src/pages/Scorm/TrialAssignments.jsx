import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { BookOpen, CheckCircle2, LoaderCircle, Plus, Trash2, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

const LIMIT = 10;

export default function TrialAssignments() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [data, setData] = useState({ learners: [], courses: [], assignments: [] });
  const [selectedLearners, setSelectedLearners] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const response = await axios.get(apiUrl('/api/scorm/assignments'), { headers });
    setData(response.data || { learners: [], courses: [], assignments: [] });
  }, [headers]);

  useEffect(() => { if (token) load().catch((err) => setError(err.response?.data?.message || 'Unable to load assignments.')); }, [token, load]);

  const addLearner = async (event) => {
    event.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await axios.post(apiUrl('/api/scorm/roster'), { email: email.trim(), learnerName: name.trim() }, { headers });
      setEmail('');
      setName('');
      setMessage('Learner added. Select the learner and a course to create an assignment.');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to add the learner.');
    } finally {
      setBusy(false);
    }
  };

  const assign = async () => {
    if (!selectedLearners.length || !selectedCourses.length || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await axios.post(apiUrl('/api/scorm/assignments/bulk'), {
        learnerIds: selectedLearners,
        courseIds: selectedCourses,
        required: true
      }, { headers });
      setMessage(`${response.data?.created || 0} new course assignment${Number(response.data?.created || 0) === 1 ? '' : 's'} created. Learner invitations are queued.`);
      setSelectedLearners([]);
      setSelectedCourses([]);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to assign the selected courses.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id) => {
    if (!window.confirm('Remove this course assignment?')) return;
    setBusy(true);
    try {
      await axios.delete(apiUrl(`/api/scorm/assignments/${id}`), { headers });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to remove the assignment.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (setter, values, id) => setter(values.includes(id) ? values.filter((value) => value !== id) : [...values, id]);

  return (
    <div className="p-4 md:p-7 lg:p-9 max-w-7xl mx-auto">
      <header className="mb-7 pb-7 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
        <div className="scorm-micro text-[10px] uppercase font-semibold">Free learning workspace</div>
        <h1 className="scorm-display text-[36px] md:text-[48px] mt-2">Assign included courses</h1>
        <p className="text-sm mt-3 max-w-2xl" style={{ color: 'var(--scorm-ink-soft)' }}>Add up to {LIMIT} learners, choose one or more included courses, and send tracked assignments. Creating or uploading courses remains locked.</p>
      </header>

      {message && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(20,184,166,.3)', background: 'rgba(20,184,166,.08)' }}>{message}</div>}
      {error && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(251,113,133,.3)', background: 'rgba(251,113,133,.08)' }}>{error}</div>}

      <div className="grid xl:grid-cols-2 gap-5">
        <section className="scorm-panel rounded-2xl border p-5 md:p-6" style={{ borderColor: 'var(--scorm-line)' }}>
          <div className="flex items-center justify-between gap-3 mb-5">
            <div><h2 className="font-semibold text-lg">1. Choose learners</h2><p className="text-xs mt-1" style={{ color: 'var(--scorm-muted)' }}>{data.learners.length} of {LIMIT} learner seats used</p></div>
            <Users size={19} />
          </div>
          <form onSubmit={addLearner} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 mb-4">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Learner name" className="scorm-search-input min-h-11 px-3 text-sm" />
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required placeholder="name@company.com" className="scorm-search-input min-h-11 px-3 text-sm" />
            <button disabled={busy || data.learners.length >= LIMIT} className="scorm-button-secondary min-h-11 px-4 inline-flex items-center justify-center gap-2 text-xs font-semibold disabled:opacity-50"><Plus size={14} /> Add</button>
          </form>
          <div className="space-y-2 max-h-[330px] overflow-y-auto">
            {data.learners.map((learner) => (
              <label key={learner.id} className="flex items-center gap-3 rounded-xl border p-3 cursor-pointer" style={{ borderColor: selectedLearners.includes(String(learner.id)) ? 'var(--scorm-accent-strong)' : 'var(--scorm-line)' }}>
                <input type="checkbox" checked={selectedLearners.includes(String(learner.id))} onChange={() => toggle(setSelectedLearners, selectedLearners, String(learner.id))} />
                <span className="min-w-0"><span className="block text-sm font-semibold truncate">{learner.learnerName || 'Learner'}</span><span className="block text-xs truncate" style={{ color: 'var(--scorm-muted)' }}>{learner.email}</span></span>
              </label>
            ))}
            {!data.learners.length && <div className="rounded-xl border border-dashed p-7 text-center text-xs" style={{ color: 'var(--scorm-muted)', borderColor: 'var(--scorm-line)' }}>Add your first learner above.</div>}
          </div>
        </section>

        <section className="scorm-panel rounded-2xl border p-5 md:p-6" style={{ borderColor: 'var(--scorm-line)' }}>
          <div className="flex items-center justify-between gap-3 mb-5"><div><h2 className="font-semibold text-lg">2. Choose courses</h2><p className="text-xs mt-1" style={{ color: 'var(--scorm-muted)' }}>Only courses provided by LMSGEN are available.</p></div><BookOpen size={19} /></div>
          <div className="space-y-2 max-h-[395px] overflow-y-auto">
            {data.courses.map((course) => (
              <label key={course.id} className="flex items-center gap-3 rounded-xl border p-3 cursor-pointer" style={{ borderColor: selectedCourses.includes(String(course.id)) ? 'var(--scorm-accent-strong)' : 'var(--scorm-line)' }}>
                <input type="checkbox" checked={selectedCourses.includes(String(course.id))} onChange={() => toggle(setSelectedCourses, selectedCourses, String(course.id))} />
                <span className="min-w-0"><span className="block text-sm font-semibold truncate">{course.title}</span><span className="block text-xs line-clamp-2" style={{ color: 'var(--scorm-muted)' }}>{course.description || 'Trackable included course'}</span></span>
              </label>
            ))}
            {!data.courses.length && <div className="rounded-xl border border-dashed p-7 text-center text-xs" style={{ color: 'var(--scorm-muted)', borderColor: 'var(--scorm-line)' }}>The Super Admin has not added a default course yet.</div>}
          </div>
        </section>
      </div>

      <div className="mt-5 flex justify-end">
        <button type="button" onClick={assign} disabled={busy || !selectedLearners.length || !selectedCourses.length} className="scorm-button-primary min-h-11 px-5 inline-flex items-center gap-2 text-xs font-semibold disabled:opacity-50">
          {busy ? <LoaderCircle size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Assign selected courses
        </button>
      </div>

      <section className="scorm-panel rounded-2xl border mt-7 overflow-hidden" style={{ borderColor: 'var(--scorm-line)' }}>
        <div className="p-5 border-b" style={{ borderColor: 'var(--scorm-line)' }}><h2 className="font-semibold">Current assignments</h2></div>
        <div className="divide-y" style={{ borderColor: 'var(--scorm-line)' }}>
          {data.assignments.map((assignment) => (
            <div key={assignment.id} className="p-4 md:px-5 flex items-center gap-4">
              <div className="min-w-0 flex-1"><div className="text-sm font-semibold truncate">{assignment.course?.title || 'Course'}</div><div className="text-xs mt-1 truncate" style={{ color: 'var(--scorm-muted)' }}>{assignment.learnerName || assignment.learnerEmail} · {String(assignment.status || '').replace('_', ' ')}</div></div>
              <button type="button" onClick={() => revoke(assignment.id)} disabled={busy} className="scorm-button-secondary w-9 h-9 grid place-items-center" aria-label="Remove assignment"><Trash2 size={14} /></button>
            </div>
          ))}
          {!data.assignments.length && <div className="p-8 text-center text-xs" style={{ color: 'var(--scorm-muted)' }}>No assignments yet.</div>}
        </div>
      </section>
    </div>
  );
}
