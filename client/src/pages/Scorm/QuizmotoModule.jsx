import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart3,
  BookOpenCheck,
  Download,
  Edit3,
  FileText,
  Gamepad2,
  Play,
  Plus,
  Radio,
  Search,
  Trash2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import FreeGamesSection, { GeometryPhysicsWorkspace } from './FreeGamesSection';

const TERMINAL_SESSION_STATES = new Set(['FINISHED', 'CANCELLED']);

export default function QuizmotoModule() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [geometryOpen, setGeometryOpen] = useState(false);
  const API_BASE_URL = apiUrl('/api/quizzes');

  const fetchQuizzes = async () => {
    const res = await axios.get(API_BASE_URL, { headers: { Authorization: `Bearer ${token}` } });
    setQuizzes(res.data || []);
  };

  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/active-sessions`, { headers: { Authorization: `Bearer ${token}` } });
      setActiveSessions((res.data || []).filter((session) => {
        const status = String(session?.status || '').toLowerCase();
        const state = String(session?.state || '').toUpperCase();
        return status !== 'finished' && !TERMINAL_SESSION_STATES.has(state);
      }));
    } catch (_) {
      setActiveSessions([]);
    }
  };

  useEffect(() => {
    if (!token) return;
    Promise.all([fetchQuizzes(), fetchSessions()]).catch((err) => setMessage(err.response?.data?.message || 'Could not load Quizmoto.'));
  }, [token]);

  const totalQuestions = useMemo(() => quizzes.reduce((sum, quiz) => sum + (quiz.questions?.length || 0), 0), [quizzes]);
  const shownQuizzes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...quizzes]
      .filter((quiz) => !needle || String(quiz.title || '').toLowerCase().includes(needle))
      .sort((a, b) => {
        if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
        if (sortBy === 'az') return String(a.title || '').localeCompare(String(b.title || ''));
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
  }, [quizzes, query, sortBy]);

  const startGame = async (quizId) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/${quizId}/start`, {}, { headers: { Authorization: `Bearer ${token}` } });
      navigate(`/host/lobby/${res.data.pin}`);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not start game.');
    }
  };

  const deleteQuiz = async (quizId) => {
    if (!window.confirm('Delete this quiz and all its game history? This cannot be undone.')) return;
    try {
      await axios.delete(`${API_BASE_URL}/${quizId}`, { headers: { Authorization: `Bearer ${token}` } });
      setQuizzes((items) => items.filter((quiz) => quiz.id !== quizId));
      setMessage('Quiz deleted.');
      fetchSessions();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not delete quiz.');
    }
  };

  const importDefaults = async () => {
    try {
      await axios.post(`${API_BASE_URL}/import-defaults`, {}, { headers: { Authorization: `Bearer ${token}` } });
      await fetchQuizzes();
      setMessage('Cybersecurity starter quizzes imported.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not import starter quizzes.');
    }
  };

  if (geometryOpen) {
    return <GeometryPhysicsWorkspace onClose={() => setGeometryOpen(false)} />;
  }

  return (
    <div className="p-4 md:p-7 lg:p-8 max-w-[1440px] mx-auto">
      <section className="scorm-page-hero mb-6">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
          <div className="max-w-3xl">
            <div className="scorm-eyebrow inline-flex items-center gap-2"><Gamepad2 size={13} /> Live engagement · Unlocked</div>
            <h1 className="scorm-display mt-2"><span>Quizmoto</span> <span className="text-blue-400">Live Quiz</span></h1>
            <p className="mt-3 text-sm md:text-[15px] max-w-2xl">Create quizzes, generate questions with AI, run real-time sessions and access interactive learning games from inside LMSGEN.</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={importDefaults} className="scorm-button-secondary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold"><Download size={14} /> Import starters</button>
            <Link to="/scorm/quizmoto/reports" className="scorm-button-secondary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold"><FileText size={14} /> Reports</Link>
            <Link to="/scorm/quizmoto/create" className="scorm-button-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold"><Plus size={14} /> Create quiz</Link>
          </div>
        </div>
      </section>

      {message && <div className="rounded-xl border border-[#29405f] bg-[#081321] px-4 py-3 mb-5 text-xs text-[#cbd5e1] flex items-center justify-between gap-3"><span>{message}</span><button type="button" onClick={() => setMessage('')} className="font-semibold text-[#60a5fa]">Dismiss</button></div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="scorm-metric-card"><div className="flex items-start justify-between"><div><div className="scorm-metric-value">{quizzes.length}</div><div className="scorm-metric-label">Quizzes</div></div><div className="scorm-metric-icon"><BookOpenCheck size={17} /></div></div></div>
        <div className="scorm-metric-card"><div className="flex items-start justify-between"><div><div className="scorm-metric-value">{totalQuestions}</div><div className="scorm-metric-label">Questions ready</div></div><div className="scorm-metric-icon"><BarChart3 size={17} /></div></div></div>
        <div className="scorm-metric-card"><div className="flex items-start justify-between"><div><div className="scorm-metric-value">{activeSessions.length}</div><div className="scorm-metric-label">Live sessions</div></div><div className="scorm-metric-icon"><Radio size={17} /></div></div></div>
      </div>

      <section className="scorm-panel overflow-hidden mb-6">
        <div className="scorm-panel-header flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div><div className="scorm-eyebrow">Quiz management</div><h2 className="text-[18px] mt-1">Quiz library</h2></div>
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <label className="rounded-xl border border-[#263950] bg-[#07111f] px-3 flex items-center gap-2 min-w-[260px]"><Search size={14} className="text-[#8295ae]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search quizzes" className="w-full bg-transparent border-0 p-2 text-xs outline-none" /></label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-xl border border-[#263950] bg-[#07111f] px-3 py-2.5 text-xs"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="az">A–Z title</option></select>
          </div>
        </div>

        <div className="scorm-list">
          {shownQuizzes.length === 0 && <div className="p-10 text-center text-xs text-[#8295ae]">{quizzes.length ? 'No quizzes match your search.' : 'No quizzes yet. Create one or import the starter set.'}</div>}
          {shownQuizzes.map((quiz) => (
            <article key={quiz.id} className="scorm-course-row grid md:grid-cols-[1fr_100px_110px_auto] gap-4 items-center">
              <div className="min-w-0"><div className="font-semibold text-sm truncate">{quiz.title}</div><div className="scorm-meta mt-1">Created {quiz.createdAt ? new Date(quiz.createdAt).toLocaleDateString() : '—'}</div></div>
              <div><div className="scorm-meta">Questions</div><div className="font-semibold mt-1">{quiz.questions?.length || 0}</div></div>
              <div><div className="scorm-meta">Mode</div><div className="font-semibold mt-1">Live</div></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => startGame(quiz.id)} className="scorm-button-primary inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold"><Play size={12} /> Start</button>
                <Link to={`/scorm/quizmoto/edit/${quiz.id}`} className="scorm-button-secondary grid place-items-center w-9 h-9" title="Edit quiz"><Edit3 size={14} /></Link>
                <button type="button" onClick={() => deleteQuiz(quiz.id)} className="scorm-button-secondary grid place-items-center w-9 h-9 text-[#fb7185]" title="Delete quiz"><Trash2 size={14} /></button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <FreeGamesSection onLaunch={() => setGeometryOpen(true)} />

      {activeSessions.length > 0 && (
        <section className="scorm-panel overflow-hidden mb-5">
          <div className="scorm-panel-header"><div className="scorm-eyebrow">Session operations</div><h2 className="text-[18px] mt-1">Active sessions</h2></div>
          <div className="scorm-list">
            {activeSessions.map((session) => (
              <div key={session.id} className="scorm-course-row grid md:grid-cols-[1fr_120px_120px_auto] gap-4 items-center">
                <div><div className="font-semibold text-sm">{session.Quiz?.title || 'Live quiz'}</div><div className="scorm-meta mt-1">Continue the active host session.</div></div>
                <div><div className="scorm-meta">Game PIN</div><div className="font-mono font-semibold mt-1">{session.pin}</div></div>
                <div><div className="scorm-meta">Status</div><div className="font-semibold mt-1 capitalize">{session.status || 'live'}</div></div>
                <button type="button" onClick={() => navigate(session.status === 'lobby' ? `/host/lobby/${session.pin}` : `/host/game/${session.pin}`)} className="scorm-button-primary inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold"><Play size={13} /> Rejoin</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
