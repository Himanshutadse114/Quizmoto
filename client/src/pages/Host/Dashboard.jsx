import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { Plus, Play, Trash2, Edit, FileText, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiUrl } from '../../config';

const Dashboard = () => {
    const [quizzes, setQuizzes] = useState([]);
    const { token, user, logout } = useAuth();
    const navigate = useNavigate();

    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('newest');

    const API_BASE_URL = apiUrl('/api/quizzes');

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }

        fetchQuizzes();
    }, [token, navigate, API_BASE_URL]);

    const fetchQuizzes = async () => {
        try {
            const res = await axios.get(API_BASE_URL, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setQuizzes(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleStartGame = async (quizId) => {
        try {
            const res = await axios.post(`${API_BASE_URL}/${quizId}/start`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            navigate(`/host/lobby/${res.data.pin}`);
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (quizId) => {
        if (!window.confirm('Are you sure you want to delete this quiz?')) return;
        try {
            await axios.delete(`${API_BASE_URL}/${quizId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setQuizzes(prev => prev.filter(q => q.id !== quizId));
        } catch (err) {
            console.error(err);
        }
    };

    const handleImportDefaults = async () => {
        try {
            await axios.post(`${API_BASE_URL}/import-defaults`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchQuizzes();
            alert('Cybersecurity quizzes imported successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to import defaults');
        }
    };

    // Statistics Calculation
    const stats = {
        totalQuizzes: quizzes.length,
        totalQuestions: quizzes.reduce((acc, q) => acc + q.questions.length, 0),
        activePlayers: 0 // In a real app this would come from a 'live-sessions' API
    };

    // Filtering & Sorting Logic
    const sortedQuizzes = [...quizzes]
        .filter(q => q.title.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
            if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
            if (sortBy === 'az') return a.title.localeCompare(b.title);
            return 0;
        });

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto relative z-10">
            <header className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter mb-1">Quizmoto Dashboard</h1>
                    <p className="font-bold opacity-60 uppercase tracking-widest text-xs">Welcome back, {user?.username}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={handleImportDefaults}
                        className="bg-white/5 hover:bg-white/10 text-white/70 px-3 py-2 rounded-xl font-bold transition-all border border-white/10 flex items-center gap-2 text-[10px]"
                    >
                        <Download size={14} /> IMPORT DEFAULTS
                    </button>
                    <button
                        onClick={() => navigate('/reports')}
                        className="bg-quizmoto-purple text-white px-4 py-2 rounded-xl font-black text-xs shadow-[0_3px_0_0_#6a2d9c] hover:shadow-none hover:translate-y-1 transition-all flex items-center gap-2"
                    >
                        <FileText size={16} /> REPORTS
                    </button>
                    <button
                        onClick={() => navigate('/create-quiz')}
                        className="bg-quizmoto-blue text-white px-5 py-2 rounded-xl font-black text-sm shadow-[0_4px_0_0_#0e4b94] hover:shadow-none hover:translate-y-1 transition-all flex items-center gap-2"
                    >
                        <Plus size={18} /> CREATE
                    </button>
                    <button onClick={logout} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl font-black transition-colors border border-white/10 text-xs">LOGOUT</button>
                </div>
            </header>

            {/* Statistics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {[
                    { label: 'Total Quizzes', value: stats.totalQuizzes, color: 'blue' },
                    { label: 'Total Questions', value: stats.totalQuestions, color: 'purple' },
                    { label: 'Active Players', value: stats.activePlayers, color: 'green' }
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 flex flex-col items-center justify-center text-center group hover:bg-white/10 transition-all cursor-default"
                    >
                        <span className="text-3xl font-black mb-1 text-white">{stat.value}</span>
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] text-quizmoto-${stat.color} opacity-60`}>{stat.label}</span>
                    </motion.div>
                ))}
            </div>

            {/* Search & Utility Bar */}
            <div className="mb-6 flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="relative w-full md:max-w-md">
                    <input
                        type="text"
                        placeholder="Search quizzes by title..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-xl py-3 px-5 font-bold text-white placeholder:text-white/30 focus:outline-none focus:ring-4 focus:ring-quizmoto-blue/20 transition-all text-sm"
                    />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40 whitespace-nowrap">Sort By:</span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-white/10 border border-white/10 rounded-xl py-2 px-4 font-bold text-xs focus:outline-none appearance-none cursor-pointer hover:bg-white/20 transition-colors"
                    >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="az">A-Z Title</option>
                    </select>
                </div>
            </div>

            {quizzes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                    <motion.div
                        whileHover={{ scale: 1.02, translateY: -3 }}
                        onClick={() => navigate('/create-quiz')}
                        className="border-2 border-dashed border-white/20 rounded-[24px] flex flex-col items-center justify-center p-6 cursor-pointer hover:border-white/40 hover:bg-white/5 transition-all text-white/50 hover:text-white group h-full min-h-[220px]"
                    >
                        <div className="bg-white/10 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                            <Plus size={24} />
                        </div>
                        <span className="text-lg font-black uppercase tracking-tight">Create New Quiz</span>
                    </motion.div>

                    {sortedQuizzes.map((quiz, idx) => {
                        const date = new Date(quiz.createdAt).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric'
                        });

                        return (
                            <motion.div
                                key={quiz.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.05 }}
                                className="bg-white rounded-[24px] overflow-hidden shadow-2xl group relative border-b-4 border-gray-200"
                            >
                                <div className={`h-1.5 bg-quizmoto-${['blue', 'red', 'yellow', 'green', 'purple'][idx % 5]}`} />
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400">{date}</span>
                                        <span className="bg-quizmoto-green/10 text-quizmoto-green text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Ready</span>
                                    </div>

                                    <h3 className="text-lg font-black text-gray-800 mb-3 group-hover:text-quizmoto-purple transition-colors line-clamp-2 min-h-[3rem]">
                                        {quiz.title}
                                    </h3>

                                    <div className="flex items-center gap-2 mb-8">
                                        <div className="bg-gray-100 flex items-center gap-2 px-3 py-1.5 rounded-xl">
                                            <span className="w-1.5 h-1.5 rounded-full bg-quizmoto-purple" />
                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                                {quiz.questions.length} Questions
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleStartGame(quiz.id)}
                                            className="flex-[2] bg-quizmoto-green text-white font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_0_0_#1a5e08] hover:shadow-none hover:translate-y-1 transition-all text-xs"
                                        >
                                            <Play size={14} fill="currentColor" /> START
                                        </button>
                                        <button
                                            onClick={() => navigate(`/edit-quiz/${quiz.id}`)}
                                            className="flex-1 bg-gray-50 text-gray-500 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-all border border-gray-100"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(quiz.id)}
                                            className="w-10 bg-gray-50 text-red-300 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all border border-gray-100"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-16 bg-white/5 rounded-[40px] border-2 border-dashed border-white/10 flex flex-col items-center justify-center"
                >
                    <div className="bg-white/10 p-8 rounded-full mb-6 relative">
                        <Plus size={48} className="text-white/20" />
                        <motion.div
                            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="absolute inset-0 bg-quizmoto-blue/20 rounded-full blur-2xl"
                        />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-4 italic tracking-tighter">No Quizzes Yet!</h2>
                    <p className="text-white/40 font-bold mb-8 max-w-sm mx-auto text-sm leading-relaxed">
                        Create your first Quizmoto quiz to start engaging your audience with compact, professional challenges.
                    </p>
                    <button
                        onClick={() => navigate('/create-quiz')}
                        className="bg-quizmoto-blue text-white px-8 py-4 rounded-xl font-black text-lg shadow-[0_6px_0_0_#0e4b94] hover:shadow-none hover:translate-y-1 transition-all"
                    >
                        GET STARTED NOW
                    </button>
                </motion.div>
            )}

            {quizzes.length > 0 && sortedQuizzes.length === 0 && searchQuery !== '' && (
                <div className="text-center py-16 bg-white/5 rounded-[30px] border-2 border-dashed border-white/10">
                    <p className="text-xl font-black italic opacity-40">No quizzes found matching "{searchQuery}"</p>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
