import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { Download, Edit, Play, Plus, Search, Trash2, ListChecks, Radio, Sparkles, Trophy, Zap } from 'lucide-react';
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
        if (!token) return navigate('/login');
        fetchQuizzes();
        fetchActiveSessions();
    }, [token, navigate, API_BASE_URL]);

    const fetchQuizzes = async () => {
        try {
            const res = await axios.get(API_BASE_URL, { headers: { Authorization: `Bearer ${token}` } });
            setQuizzes(res.data || []);
        } catch (err) { setActionMsg(err.response?.data?.message || 'Failed to load quizzes'); }
    };

    const fetchActiveSessions = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/active-sessions`, { headers: { Authorization: `Bearer ${token}` } });
            setActiveSessions(res.data || []);
        } catch (_) {}
    };

    const handleStartGame = async (quizId) => {
        try {
            const res = await axios.post(`${API_BASE_URL}/${quizId}/start`, {}, { headers: { Authorization: `Bearer ${token}` } });
            navigate(`/host/lobby/${res.data.pin}`);
        } catch (err) { setActionMsg(err.response?.data?.message || 'Could not start game'); }
    };

    const handleDelete = async (quizId) => {
        if (!window.confirm('Delete this quiz and all its game history? This cannot be undone.')) return;
        try {
            await axios.delete(`${API_BASE_URL}/${quizId}`, { headers: { Authorization: `Bearer ${token}` } });
            setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
            setActionMsg('Quiz deleted');
            fetchActiveSessions();
        } catch (err) { setActionMsg(err.response?.data?.message || 'Could not delete quiz. End any active games first.'); }
    };

    const handleImportDefaults = async () => {
        try {
            await axios.post(`${API_BASE_URL}/import-defaults`, {}, { headers: { Authorization: `Bearer ${token}` } });
            await fetchQuizzes();
            setActionMsg('Cybersecurity quizzes imported successfully');
        } catch (_) { setActionMsg('Failed to import defaults'); }
    };

    const stats = useMemo(() => ({
        totalQuizzes: quizzes.length,
        totalQuestions: quizzes.reduce((acc, q) => acc + (q.questions?.length || 0), 0),
        liveSessions: activeSessions.length
    }), [quizzes, activeSessions]);

    const sortedQuizzes = useMemo(() => [...quizzes]
        .filter((q) => String(q.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => sortBy === 'newest' ? new Date(b.createdAt) - new Date(a.createdAt) : sortBy === 'oldest' ? new Date(a.createdAt) - new Date(b.createdAt) : String(a.title || '').localeCompare(String(b.title || ''))), [quizzes, searchQuery, sortBy]);

    return (
        <div className="min-h-screen bg-[#f7f7f7] text-[#3c3c3c] p-4 md:p-7 pb-24">
            <div className="max-w-7xl mx-auto">
                <section className="rounded-[28px] bg-gradient-to-br from-[#6b2fc2] to-[#46178f] text-white border-b-[7px] border-[#32105f] p-6 md:p-8 mb-5 overflow-hidden relative">
                    <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full border-[26px] border-white/8" />
                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                        <div><div className="text-xs font-black uppercase tracking-wider text-white/60">Quizmoto host</div><h1 className="mt-2 text-4xl md:text-5xl font-black tracking-[-.045em]">Ready to play, {user?.username || 'Host'}?</h1><p className="mt-3 text-white/70 font-bold max-w-2xl">Create a new challenge, continue a live session, or launch one of your saved quizzes.</p></div>
                        <button onClick={() => navigate('/host/create')} className="min-h-14 px-6 rounded-2xl bg-quizmoto-green text-white font-black text-sm border-b-[6px] border-[#1a5e08] hover:translate-y-1 hover:border-b-[3px] transition-all inline-flex items-center justify-center gap-2 shrink-0"><Plus size={19} /> CREATE QUIZ</button>
                    </div>
                </section>

                {actionMsg && <div className="mb-5 rounded-2xl bg-white border-2 border-[#e5e5e5] p-4 flex items-center justify-between gap-3 font-bold text-sm"><span>{actionMsg}</span><button onClick={() => setActionMsg(null)} className="text-gray-400 hover:text-gray-700 text-xs font-black">DISMISS</button></div>}

                {activeSessions.length > 0 && <section className="mb-5"><div className="flex items-center gap-2 mb-3 font-black text-sm"><Radio size={18} className="text-quizmoto-red" /> LIVE NOW</div><div className="grid md:grid-cols-2 gap-3">{activeSessions.map((session) => <button key={session.id} onClick={() => navigate(session.status === 'lobby' ? `/host/lobby/${session.pin}` : `/host/game/${session.pin}`)} className="text-left bg-white rounded-2xl border-2 border-[#e5e5e5] border-b-[5px] p-5 hover:border-quizmoto-blue/40 transition-colors"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-2xl bg-quizmoto-red/10 text-quizmoto-red grid place-items-center"><Play size={20} fill="currentColor" /></div><div className="min-w-0"><div className="font-black text-lg truncate">{session.Quiz?.title || 'Active Quiz'}</div><div className="text-xs font-bold text-gray-400 mt-1">PIN {session.pin} · {session.status}</div></div><span className="ml-auto text-quizmoto-blue font-black text-xs">REJOIN</span></div></button>)}</div></section>}

                <div className="grid xl:grid-cols-[1fr_300px] gap-5 items-start">
                    <main>
                        <div className="bg-white rounded-[24px] border-2 border-[#e5e5e5] border-b-[5px] overflow-hidden">
                            <div className="p-5 border-b-2 border-[#eeeeee] flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div><h2 className="text-2xl font-black">Your quizzes</h2><p className="text-sm font-bold text-gray-400 mt-1">Pick a quiz and start a live game.</p></div><div className="flex gap-2"><label className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search" className="w-full md:w-52 min-h-11 pl-9 pr-3 rounded-xl border-2 border-[#e5e5e5] bg-[#f7f7f7] font-bold outline-none focus:border-quizmoto-blue" /></label><select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="min-h-11 rounded-xl border-2 border-[#e5e5e5] bg-[#f7f7f7] px-3 text-xs font-black"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="az">A–Z</option></select></div></div>
                            <div className="divide-y-2 divide-[#eeeeee]">
                                {sortedQuizzes.length === 0 && <div className="p-10 text-center"><div className="w-14 h-14 rounded-2xl bg-quizmoto-blue/10 text-quizmoto-blue grid place-items-center mx-auto"><Plus size={25} /></div><div className="font-black text-xl mt-4">No quizzes yet</div><button onClick={() => navigate('/host/create')} className="mt-4 bg-quizmoto-blue text-white rounded-xl px-5 py-3 font-black border-b-4 border-[#0e4b94]">CREATE YOUR FIRST QUIZ</button></div>}
                                {sortedQuizzes.map((quiz, idx) => { const accents = ['bg-quizmoto-blue','bg-quizmoto-red','bg-quizmoto-yellow','bg-quizmoto-green']; const accent = accents[idx % accents.length]; return <motion.div key={quiz.id} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4"><div className={`w-12 h-12 rounded-2xl ${accent} text-white grid place-items-center font-black border-b-4 border-black/15 shrink-0`}><ListChecks size={20} /></div><div className="min-w-0 flex-1"><div className="font-black text-lg truncate">{quiz.title}</div><div className="text-xs font-bold text-gray-400 mt-1">{quiz.questions?.length || 0} questions</div></div><div className="flex gap-2"><button onClick={() => handleStartGame(quiz.id)} className="min-h-11 px-5 rounded-xl bg-quizmoto-green text-white font-black text-xs border-b-4 border-[#1a5e08] hover:translate-y-0.5">START</button><button onClick={() => navigate(`/host/edit/${quiz.id}`)} className="w-11 rounded-xl border-2 border-[#e5e5e5] text-gray-500 hover:bg-gray-50 grid place-items-center" aria-label={`Edit ${quiz.title}`}><Edit size={16} /></button><button onClick={() => handleDelete(quiz.id)} className="w-11 rounded-xl border-2 border-red-100 text-red-400 hover:bg-red-50 grid place-items-center" aria-label={`Delete ${quiz.title}`}><Trash2 size={16} /></button></div></motion.div>; })}
                            </div>
                        </div>
                    </main>

                    <aside className="space-y-4">
                        <div className="grid grid-cols-3 xl:grid-cols-1 gap-3">{[[Trophy,stats.totalQuizzes,'Quizzes','text-quizmoto-yellow','bg-yellow-50'],[Zap,stats.totalQuestions,'Questions','text-quizmoto-blue','bg-blue-50'],[Radio,stats.liveSessions,'Live now','text-quizmoto-red','bg-red-50']].map(([Icon,value,label,text,bg]) => <div key={label} className="bg-white rounded-2xl border-2 border-[#e5e5e5] border-b-[5px] p-4 flex xl:items-center gap-3"><div className={`w-10 h-10 rounded-xl ${bg} ${text} grid place-items-center shrink-0`}><Icon size={18} /></div><div><div className="text-2xl font-black leading-none">{value}</div><div className="text-[10px] font-black uppercase tracking-wide text-gray-400 mt-1">{label}</div></div></div>)}</div>
                        <button onClick={() => navigate('/host/create')} className="w-full rounded-2xl bg-quizmoto-blue text-white p-5 text-left border-b-[6px] border-[#0e4b94]"><Sparkles size={22} /><div className="font-black text-lg mt-4">Create with AI</div><div className="text-sm font-bold text-white/70 mt-1">Use a topic, description or document.</div></button>
                        <button onClick={handleImportDefaults} className="w-full rounded-2xl bg-white border-2 border-[#e5e5e5] border-b-[5px] p-5 text-left"><Download size={20} className="text-quizmoto-purple" /><div className="font-black mt-3">Import starter quizzes</div><div className="text-xs font-bold text-gray-400 mt-1">Add the cybersecurity starter set.</div></button>
                    </aside>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
