import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Copy,
  ExternalLink,
  RefreshCw,
  Search,
  Trash2,
  Users,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

function formatDate(value) {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Assignments() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [learners, setLearners] = useState([]);
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedLearners, setSelectedLearners] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [learnerQuery, setLearnerQuery] = useState('');
  const [courseQuery, setCourseQuery] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [required, setRequired] = useState(true);
  const [learnerPortalPath, setLearnerPortalPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(apiUrl('/api/scorm/assignments'), { headers });
      setLearners(res.data?.learners || []);
      setCourses(res.data?.courses || []);
      setAssignments(res.data?.assignments || []);
      setLearnerPortalPath(res.data?.learnerPortalPath || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load course assignments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) load(); }, [token]);

  const filteredLearners = useMemo(() => {
    const q = learnerQuery.trim().toLowerCase();
    return !q ? learners : learners.filter((item) => `${item.learnerName || ''} ${item.email}`.toLowerCase().includes(q));
  }, [learners, learnerQuery]);

  const filteredCourses = useMemo(() => {
    const q = courseQuery.trim().toLowerCase();
    return !q ? courses : courses.filter((item) => `${item.title || ''} ${item.description || ''}`.toLowerCase().includes(q));
  }, [courses, courseQuery]);

  const learnerPortalUrl = learnerPortalPath ? `${window.location.origin}${learnerPortalPath}` : '';
  const toggle = (setter, id) => setter((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  const copyPortal = async () => {
    if (!learnerPortalUrl) return;
    try {
      await navigator.clipboard.writeText(learnerPortalUrl);
      setMessage('Learner portal link copied. Send this one link to assigned learners.');
    } catch (_) {
      setError('Could not copy the learner portal link.');
    }
  };

  const assign = async () => {
    setError('');
    setMessage('');
    if (!selectedLearners.length) return setError('Select at least one learner.');
    if (!selectedCourses.length) return setError('Select at least one published course.');
    setSaving(true);
    try {
      const res = await axios.post(apiUrl('/api/scorm/assignments/bulk'), {
        learnerIds: selectedLearners,
        courseIds: selectedCourses,
        dueAt: dueAt || null,
        required
      }, { headers });
      if (res.data?.learnerPortalPath) setLearnerPortalPath(res.data.learnerPortalPath);
      setMessage(`${res.data?.combinations || 0} learner-course assignment${res.data?.combinations === 1 ? '' : 's'} processed. Each new assignment has its own independent course/assessment instance.`);
      setSelectedLearners([]);
      setSelectedCourses([]);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to assign the selected courses.');
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (assignment) => {
    if (!window.confirm(`Remove ${assignment.course?.title || 'this course'} from ${assignment.learnerEmail}?`)) return;
    setError('');
    try {
      await axios.delete(apiUrl(`/api/scorm/assignments/${assignment.registrationId}`), { headers });
      setAssignments((current) => current.filter((item) => item.registrationId !== assignment.registrationId));
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to remove this assignment.');
    }
  };

  return (
    <div className="p-4 md:p-7 lg:p-9 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-7 pb-7 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
        <div className="max-w-3xl">
          <div className="scorm-micro text-[10px] uppercase font-semibold">Learner delivery</div>
          <h1 className="scorm-display text-[36px] md:text-[50px] mt-2">Assign courses</h1>
          <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--scorm-ink-soft)' }}>
            Select multiple learners and multiple published courses in one action. Every learner-course assignment gets its own registration instance, progress, assessment state and score.
          </p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="scorm-button-secondary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {message && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(20,184,166,.28)', background: 'rgba(20,184,166,.08)' }}>{message}</div>}
      {error && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(251,113,133,.3)', background: 'rgba(251,113,133,.08)' }}>{error}</div>}

      <section className="scorm-panel rounded-2xl border p-4 md:p-5 mb-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="w-10 h-10 rounded-xl grid place-items-center border shrink-0" style={{ borderColor: 'var(--scorm-line)' }}><ExternalLink size={17} /></div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Learner portal link</div>
            <div className="text-xs mt-1" style={{ color: 'var(--scorm-muted)' }}>After assigning courses, send this single workspace link to learners. They sign in once and see all courses assigned to their verified email.</div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 lg:min-w-[430px]">
            <input readOnly value={learnerPortalUrl} className="min-w-0 flex-1 px-3 py-2.5 text-[11px]" placeholder="Portal link becomes available when the workspace is ready" />
            <button type="button" disabled={!learnerPortalUrl} onClick={copyPortal} className="scorm-button-secondary px-4 py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-2"><Copy size={13} /> Copy link</button>
          </div>
        </div>
      </section>

      <div className="grid xl:grid-cols-2 gap-5">
        <section className="scorm-panel rounded-2xl border overflow-hidden">
          <div className="p-4 md:p-5 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2"><Users size={17} /><h2 className="font-semibold">1. Select learners</h2></div>
              <span className="scorm-micro text-[9px]">{selectedLearners.length} selected</span>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={learnerQuery} onChange={(e) => setLearnerQuery(e.target.value)} className="w-full pl-9 pr-3 py-2.5 text-xs" placeholder="Search learners" />
            </div>
          </div>
          <div className="max-h-[360px] overflow-y-auto divide-y" style={{ borderColor: 'var(--scorm-line)' }}>
            {filteredLearners.length ? filteredLearners.map((learner) => {
              const checked = selectedLearners.includes(learner.id);
              return (
                <label key={learner.id} className="px-4 md:px-5 py-3.5 flex gap-3 items-center cursor-pointer">
                  <input type="checkbox" checked={checked} onChange={() => toggle(setSelectedLearners, learner.id)} />
                  <span className="w-9 h-9 rounded-xl grid place-items-center border shrink-0" style={{ borderColor: 'var(--scorm-line)' }}><UserCheck size={15} /></span>
                  <span className="min-w-0"><span className="block text-sm font-semibold truncate">{learner.learnerName || 'Learner'}</span><span className="block text-xs truncate" style={{ color: 'var(--scorm-muted)' }}>{learner.email}</span></span>
                </label>
              );
            }) : <div className="p-8 text-center text-sm" style={{ color: 'var(--scorm-muted)' }}>Add learners to the Learner Roster first.</div>}
          </div>
        </section>

        <section className="scorm-panel rounded-2xl border overflow-hidden">
          <div className="p-4 md:p-5 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2"><BookOpen size={17} /><h2 className="font-semibold">2. Select courses</h2></div>
              <span className="scorm-micro text-[9px]">{selectedCourses.length} selected</span>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={courseQuery} onChange={(e) => setCourseQuery(e.target.value)} className="w-full pl-9 pr-3 py-2.5 text-xs" placeholder="Search courses" />
            </div>
          </div>
          <div className="max-h-[360px] overflow-y-auto divide-y" style={{ borderColor: 'var(--scorm-line)' }}>
            {filteredCourses.length ? filteredCourses.map((course) => {
              const published = course.status === 'published';
              const checked = selectedCourses.includes(course.id);
              return (
                <label key={course.id} className={`px-4 md:px-5 py-3.5 flex gap-3 items-center ${published ? 'cursor-pointer' : 'opacity-55 cursor-not-allowed'}`}>
                  <input type="checkbox" disabled={!published} checked={checked} onChange={() => published && toggle(setSelectedCourses, course.id)} />
                  <span className="w-9 h-9 rounded-xl grid place-items-center border shrink-0" style={{ borderColor: 'var(--scorm-line)' }}><BookOpen size={15} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold truncate">{course.title}</span><span className="block text-[10px] uppercase mt-0.5" style={{ color: published ? 'var(--scorm-accent-strong)' : 'var(--scorm-muted)' }}>{published ? 'Published' : `${course.status} · publish before assigning`}</span></span>
                </label>
              );
            }) : <div className="p-8 text-center text-sm" style={{ color: 'var(--scorm-muted)' }}>Create and publish a course first.</div>}
          </div>
        </section>
      </div>

      <section className="scorm-panel rounded-2xl border p-4 md:p-5 mt-5">
        <div className="grid md:grid-cols-[1fr_auto_auto] gap-4 md:items-end">
          <label>
            <span className="scorm-micro block text-[9px] uppercase font-semibold mb-1.5">Due date · optional</span>
            <div className="relative"><CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2" /><input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="w-full pl-9 pr-3 py-2.5 text-sm" /></div>
          </label>
          <label className="flex items-center gap-2 min-h-[42px] text-sm"><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required course</label>
          <button type="button" onClick={assign} disabled={saving || !selectedLearners.length || !selectedCourses.length} className="scorm-button-primary px-5 py-3 text-xs font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"><CheckCircle2 size={15} />{saving ? 'Assigning…' : `Assign ${selectedCourses.length || ''} course${selectedCourses.length === 1 ? '' : 's'}`}</button>
        </div>
      </section>

      <section className="scorm-panel rounded-2xl border overflow-hidden mt-7">
        <div className="p-4 md:p-5 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--scorm-line)' }}>
          <div><h2 className="font-semibold">Current assignments</h2><div className="scorm-micro text-[9px] mt-1">{assignments.length} active assignment{assignments.length === 1 ? '' : 's'}</div></div>
        </div>
        {loading ? <div className="p-10 text-center text-sm" style={{ color: 'var(--scorm-muted)' }}>Loading assignments…</div> : assignments.length === 0 ? <div className="p-10 text-center text-sm" style={{ color: 'var(--scorm-muted)' }}>No courses have been assigned yet.</div> : (
          <div className="divide-y" style={{ borderColor: 'var(--scorm-line)' }}>
            {assignments.map((assignment) => (
              <div key={assignment.registrationId} className="p-4 md:p-5 grid lg:grid-cols-[1.15fr_1.15fr_.65fr_.65fr_auto] gap-2.5 lg:items-center">
                <div className="min-w-0"><div className="text-sm font-semibold truncate">{assignment.learnerName || 'Learner'}</div><div className="text-xs truncate" style={{ color: 'var(--scorm-muted)' }}>{assignment.learnerEmail}</div></div>
                <div className="min-w-0"><div className="text-sm font-semibold truncate">{assignment.course?.title || 'Course'}</div><div className="text-[10px] uppercase mt-0.5" style={{ color: 'var(--scorm-muted)' }}>{assignment.required ? 'Required' : 'Optional'} · Instance {String(assignment.instanceId || assignment.registrationId).slice(0, 8)}</div></div>
                <div><div className="scorm-micro text-[8px] uppercase">Progress</div><div className="text-xs font-semibold mt-1 capitalize">{String(assignment.status || '').replace('_', ' ')}</div></div>
                <div><div className="scorm-micro text-[8px] uppercase">Due</div><div className="text-xs font-semibold mt-1">{formatDate(assignment.dueAt)}</div></div>
                <button type="button" onClick={() => revoke(assignment)} className="w-9 h-9 rounded-lg border grid place-items-center" style={{ borderColor: 'rgba(251,113,133,.28)', color: '#fb7185' }} aria-label="Remove assignment"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
