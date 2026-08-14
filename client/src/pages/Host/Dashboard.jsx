import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { Download, Edit, Play, Plus, Search, Trash2, Users, ListChecks, Radio } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiUrl } from '../../config';

const Dashboard = () => {
    const [quizzes, setQuizzes] = useState([]);
    const [activeSessions, setActiveSessions] = useState([]);
    const [actionMsg, setActionMsg] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const API_BASE_URL = apiUrl('/api/quizzes');

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }
        fetchQuizzes();
        fetchActiveSessions();
    }, [token, navigate, API_BASE_URL]);

    const fetchQuizzes = async () => {
        try {
            const res = await axios.get(API_BASE_URL, { headers: { Authorization: `Bearer ${token}` } });
            setQuizzes(res.data || []);
        } catch (err) {
            console.error(err);
            setActionMsg(err.response?.data?.message || 'Failed to load quizzes');
        }
    };

    const fetchActiveSessions = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/active-sessions`, { headers: { Authorization: `Bearer ${token}` } });
            setActiveSessions(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleStartGame = async (quizId) => {
        try {
            const res = await axios.post(`${API_BASE_URL}/${quizId}/start`, {}, { headers: { Authorization: `Bearer ${token}` } });
            navigate(`/scorm/live-quiz/lobby/${res.data.pin}`);
        } catch (err) {
            console.error(err);
            setActionMsg(err.response?.data?.message || 'Could not start game');
        }
    };

    const handleDelete = async (quizId) => {
        if (!window.confirm('Delete this quiz and all its game history? This cannot be undone.')) return;
        try {
            await axios.delete(`${API_BASE_URL}/${quizId}`, { headers: { Authorization: `Bearer ${token}` } });
            setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
            setActionMsg('Quiz deleted');
            fetchActiveSessions();
        } catch (err) {
            console.error(err);
            setActionMsg(err.response?.data?.message || 'Could not delete quiz. End any active games first.');
        }
    };

    const handleImportDefaults = async () => {
        try {
            await axios.post(`${API_BASE_URL}/import-defaults`, {}, { headers: { Authorization: `Bearer ${token}` } });
            await fetchQuizzes();
            setActionMsg('Cybersecurity quizzes imported successfully');
        } catch (err) {
            console.error(err);
            setActionMsg('Failed to import defaults');
        }
    };

    const stats = useMemo(() => ({
        totalQuizzes: quizzes.length,
        totalQuestions: quizzes.reduce((acc, q) => acc + (q.questions?.length || 0), 0),
        liveSessions: activeSessions.length
    }), [quizzes, activeSessions]);

    const sortedQuizzes = useMemo(() => [...quizzes]
        .filter((q) => String(q.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
            if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
            if (sortBy === 'az') return String(a.title || '').localeCompare(String(b.title || ''));
            return 0;
        }), [quizzes, searchQuery, sortBy]);

    const metricCards = [
        { label: 'Quiz library', value: stats.totalQuizzes, icon: ListChecks, tone: 'blue' },
        { label: 'Questions', value: stats.totalQuestions, icon: Users, tone: 'purple' },
        { label: 'Live sessions', value: stats.liveSessions, icon: Radio, tone: 'yellow' }
    ];

    return (
        <div className="p-4 md:p-7 max-w-7xl mx-auto relative z-10 pb-24">
            <header className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5 mb-6 md:mb-8">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40 mb-2">// LIVE QUIZ · HOST STUDIO</div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none">QUIZ LIBRARY</h1>
                    <p className="text-white/50 text-sm mt-2">Welcome back, {user?.username || user?.name || 'Host'}. Create, launch and review interactive quiz sessions.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2.5 w-full xl:w-auto">
                    <button onClick={handleImportDefaults} className="min-h-[46px] px-4 bg-white/7 hover:bg-white/12 text-white/70 border border-white/10 font-black text-[10px] flex items-center justify-center gap-2 transition-all">
                        <Download size={15} /> IMPORT DEFAULTS
                    </button>
                    <button onClick={() => navigate('/scorm/live-quiz/create')} className="min-h-[46px] px-5 bg-quizmoto-blue text-white font-black text-xs shadow-[0_5px_0_0_#0e4b94] hover:shadow-none hover:translate-y-1 transition-all flex items-center justify-center gap-2">
                        <Plus size={17} /> CREATE QUIZ
                    </button>
                </div>
            </header>

            {actionMsg && (
                <div className="mb-5 p-3.5 bg-white/8 border border-white/10 text-sm flex items-center justify-between gap-3 rounded-xl">
                    <span>{actionMsg}</span>
                    <button className="min-h-0 px-2 py-1 text-white/45 hover:text-white text-[10px]" onClick={() => setActionMsg(null)}>DISMISS</button>
                </div>
            )}

            {activeSessions.length > 0 && (
                <section className="mb-7">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35 mb-2">ACTIVE NOW</div>
                    <div className="grid gap-3">
                        {activeSessions.map((session) => (
                            <motion.div key={session.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-quizmoto-purple/20 border border-quizmoto-yellow/40 p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-2xl">
                                <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="w-11 h-11 rounded-xl bg-quizmoto-yellow text-quizmoto-darkPurple grid place-items-center shadow-[0_4px_0_0_#a87400] shrink-0"><Play size={19} fill="currentColor" /></div>
                                    <div className="min-w-0">
                                        <h3 className="font-black text-xl truncate">{session.Quiz?.title || 'Active Quiz'}</h3>
                                        <p className="text-white/50 text-[10px] uppercase tracking-[0.13em] mt-1">PIN {session.pin} · {session.status}</p>
                                    </div>
                                </div>
                                <button onClick={() => navigate(session.status === 'lobby' ? `/scorm/live-quiz/lobby/${session.pin}` : `/scorm/live-quiz/game/${session.pin}`)} className="min-h-[44px] px-5 bg-quizmoto-yellow text-quizmoto-darkPurple font-black text-xs shadow-[0_4px_0_0_#a87400] hover:shadow-none hover:translate-y-1 transition-all">
                                    REJOIN SESSION
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </section>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7">
                {metricCards.map(({ label, value, icon: Icon, tone }, i) => (
                    <motion.div key={label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .05 }} className="bg-white/6 border border-white/10 p-4 md:p-5 rounded-2xl flex items-center gap-4">
                        <div className={`w-11 h-11 rounded-xl bg-quizmoto-${tone}/20 text-quizmoto-${tone} grid place-items-center border border-white/8`}><Icon size={20} /></div>
                        <div><div className="text-3xl font-black leading-none">{value}</div><div className="text-[9px] uppercase tracking-[.15em] text-white/40 mt-1.5 font-black">{label}</div></div>
                    </motion.div>
                ))}
            </div>

            <section className="bg-white/5 border border-white/10 p-3 md:p-4 mb-5 rounded-2xl flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                <label className="relative flex-1 max-w-xl">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
                    <input type="text" placeholder="Search quiz library" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-black/15 border border-white/10 py-3 pl-10 pr-4 font-bold text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-quizmoto-blue/30" />
                </label>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/35">SORT</span>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="min-h-[44px] bg-black/15 border border-white/10 py-2 px-3 font-bold text-xs focus:outline-none">
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="az">A–Z title</option>
                    </select>
                </div>
            </section>

            {quizzes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <button onClick={() => navigate('/scorm/live-quiz/create')} className="min-h-[244px] border-2 border-dashed border-white/18 bg-white/3 p-6 text-white/48 hover:text-white hover:border-quizmoto-blue/50 hover:bg-white/6 transition-all flex flex-col items-center justify-center gap-3 rounded-2xl">
                        <span className="w-12 h-12 rounded-xl grid place-items-center bg-quizmoto-blue text-white shadow-[0_4px_0_0_#0e4b94]"><Plus size={23} /></span>
                        <strong className="text-lg">CREATE NEW QUIZ</strong>
                        <span className="text-[10px] text-white/35">Build manually or generate with AI</span>
                    </button>

                    {sortedQuizzes.map((quiz, idx) => {
                        const date = new Date(quiz.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        const accent = ['blue', 'red', 'yellow', 'green', 'purple'][idx % 5];
                        return (
                            <motion.article key={quiz.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * .035 }} className="bg-white text-gray-800 border-b-4 border-gray-200 overflow-hidden rounded-2xl shadow-xl">
                                <div className={`h-1.5 bg-quizmoto-${accent}`} />
                                <div className="p-5 flex flex-col min-h-[238px]">
                                    <div className="flex items-center justify-between gap-3 mb-3"><span className="text-[8px] font-black uppercase tracking-[.16em] text-gray-400">{date}</span><span className="text-[8px] px-2 py-1 rounded-md bg-quizmoto-green/10 text-quizmoto-green font-black tracking-wider">READY</span></div>
                                    <h3 className="text-2xl font-black leading-tight line-clamp-2">{quiz.title}</h3>
                                    <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-gray-400">{quiz.questions?.length || 0} QUESTIONS</div>
                                    <div className="mt-auto pt-6 grid grid-cols-[1fr_auto_auto] gap-2">
                                        <button onClick={() => handleStartGame(quiz.id)} className="min-h-[44px] bg-quizmoto-green text-white font-black text-xs flex items-center justify-center gap-2 shadow-[0_4px_0_0_#1a5e08] hover:shadow-none hover:translate-y-1 transition-all"><Play size={14} fill="currentColor" /> START</button>
                                        <button onClick={() => navigate(`/scorm/live-quiz/edit/${quiz.id}`)} className="w-11 min-h-[44px] bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 grid place-items-center" aria-label={`Edit ${quiz.title}`}><Edit size={16} /></button>
                                        <button onClick={() => handleDelete(quiz.id)} className="w-11 min-h-[44px] bg-red-50 text-red-400 border border-red-100 hover:bg-red-100 hover:text-red-600 grid place-items-center" aria-label={`Delete ${quiz.title}`}><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            </motion.article>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-16 bg-white/5 border-2 border-dashed border-white/10 rounded-2xl px-5">
                    <div className="w-14 h-14 rounded-xl bg-quizmoto-blue text-white grid place-items-center mx-auto shadow-[0_5px_0_0_#0e4b94]"><Plus size={26} /></div>
                    <h2 className="text-3xl font-black mt-5">BUILD YOUR FIRST QUIZ</h2>
                    <p className="text-white/40 text-sm mt-2 max-w-md mx-auto">Create a quiz manually, generate one with AI, or import the cybersecurity starter set.</p>
                    <button onClick={() => navigate('/scorm/live-quiz/create')} className="mt-6 min-h-[46px] px-6 bg-quizmoto-blue text-white font-black text-xs shadow-[0_5px_0_0_#0e4b94] hover:shadow-none hover:translate-y-1 transition-all"><Plus size={16} className="inline mr-2" />CREATE QUIZ</button>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
