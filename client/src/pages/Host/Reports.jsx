import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { ArrowLeft, Trophy, Users, Calendar, ChevronDown, ChevronUp, Download, Crown, CheckCircle, XCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiUrl } from '../../config';

const Reports = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [expandedPlayerId, setExpandedPlayerId] = useState(null);
    const { token } = useAuth();
    const navigate = useNavigate();

    const API_URL = apiUrl('/api/quizzes/reports/all');

    useEffect(() => {
        const fetchReports = async () => {
            try {
                const res = await axios.get(API_URL, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setReports(res.data);
                setLoading(false);
            } catch (err) {
                console.error(err);
                setLoading(false);
            }
        };
        fetchReports();
    }, [token]);

    const downloadReport = async (session, format) => {
        try {
            const res = await axios.get(apiUrl(`/api/quizzes/reports/${session.id}/export?format=${format}`)), {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            const ext = format === 'pdf' ? '.pdf' : '.xlsx';
            const quizTitle = session.Quiz?.title || 'Unknown_Quiz';
            const date = new Date(session.updatedAt).toLocaleDateString('en-US').replace(/\//g, '-');
            link.setAttribute('download', `Report${ext}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Failed to download report', err);
            alert('Failed to generate report. Please try again.');
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-screen gap-4">
            <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-white/50 text-sm font-medium">Loading reports...</p>
        </div>
    );

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto relative z-10">
            {/* Header */}
            <header className="flex items-center gap-4 mb-8 pb-4 border-b border-white/10">
                <button onClick={() => navigate('/dashboard')} className="p-2 bg-white/8 hover:bg-white/15 rounded-lg transition-all">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Session Reports</h1>
                    <p className="text-white/40 text-xs mt-0.5">Review past game performance</p>
                </div>
            </header>

            {reports.length > 0 ? (
                <div className="space-y-3">
                    {reports.map((session, idx) => {
                        const date = new Date(session.updatedAt).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                        });
                        const sorted = [...session.players].sort((a, b) => b.score - a.score);
                        const winner = sorted[0];
                        const isExpanded = expandedId === session.id;

                        return (
                            <motion.div
                                key={session.id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                            >
                                {/* Session Summary Row */}
                                <div className="flex items-center justify-between p-5 gap-4">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="bg-quizmoto-purple/20 p-3 rounded-xl shrink-0">
                                            <Trophy size={20} className="text-quizmoto-yellow" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-semibold text-white text-base truncate">
                                                {session.Quiz?.title || 'Unknown Quiz'}
                                            </h3>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                                                <span className="flex items-center gap-1"><Calendar size={11} /> {date}</span>
                                                <span className="flex items-center gap-1"><Users size={11} /> {session.players.length} players</span>
                                                {winner && <span className="flex items-center gap-1"><Crown size={11} className="text-yellow-400" /> {winner.nickname} ({winner.score} pts)</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => downloadReport(session, 'pdf')}
                                            title="Download PDF"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                                        >
                                            <Download size={13} />
                                            PDF
                                        </button>
                                        <button
                                            onClick={() => downloadReport(session, 'excel')}
                                            title="Download Excel"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-all"
                                        >
                                            <Download size={13} />
                                            Excel
                                        </button>
                                        <button
                                            onClick={() => setExpandedId(isExpanded ? null : session.id)}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/8 border border-white/10 hover:bg-white/15 transition-all"
                                        >
                                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            {isExpanded ? 'Hide' : 'Details'}
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Player Table */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="border-t border-white/10 p-4">
                                                {session.analytics && session.analytics.classAnalytics && (
                                                    <div className="mt-6 mb-8 border-t border-white/10 pt-8 animate-in fade-in slide-in-from-top-4 duration-500">
                                                        <div className="flex items-center gap-2 mb-6">
                                                            <div className="w-1.5 h-6 rounded-full bg-quizmoto-blue" />
                                                            <h3 className="text-xl font-bold">Class Analytics Report</h3>
                                                        </div>

                                                        {/* High-level Highlights */}
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                                                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                                                                <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Accuracy</span>
                                                                <span className={`text-2xl font-black ${session.analytics.classAnalytics.averageAccuracy >= 70 ? 'text-green-400' : 'text-quizmoto-yellow'}`}>
                                                                    {session.analytics.classAnalytics.averageAccuracy}%
                                                                </span>
                                                            </div>
                                                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                                                                <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Participation</span>
                                                                <span className="text-2xl font-black text-white">
                                                                    {session.analytics.classAnalytics.participationRate}%
                                                                </span>
                                                            </div>
                                                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                                                                <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Reviews</span>
                                                                <span className={`text-2xl font-black ${session.analytics.classAnalytics.questionsNeedingReview > 0 ? 'text-quizmoto-red' : 'text-white/30'}`}>
                                                                    {session.analytics.classAnalytics.questionsNeedingReview}
                                                                </span>
                                                                <span className="text-[8px] text-white/30 uppercase mt-0.5">Questions</span>
                                                            </div>
                                                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                                                                <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Attention</span>
                                                                <span className={`text-2xl font-black ${session.analytics.classAnalytics.studentsNeedingAttention > 0 ? 'text-quizmoto-yellow' : 'text-white/30'}`}>
                                                                    {session.analytics.classAnalytics.studentsNeedingAttention}
                                                                </span>
                                                                <span className="text-[8px] text-white/30 uppercase mt-0.5">Students</span>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                                                            {/* Question Breakdown */}
                                                            <div>
                                                                <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Question Performance</h4>
                                                                <div className="space-y-2">
                                                                    {(session.analytics.questionAnalytics || []).map((q, idx) => (
                                                                        <div key={idx} className={`p-3 rounded-xl border ${q.needsReview ? 'bg-quizmoto-red/10 border-quizmoto-red/30' : 'bg-white/3 border-white/5'}`}>
                                                                            <div className="flex justify-between items-center">
                                                                                <div className="flex-1 pr-4 min-w-0">
                                                                                    <p className="text-sm font-medium truncate">{q.title}</p>
                                                                                </div>
                                                                                <div className={`text-sm font-black ${q.correctPercentage >= 70 ? 'text-green-400' : q.correctPercentage >= 40 ? 'text-quizmoto-yellow' : 'text-quizmoto-red'}`}>
                                                                                    {q.correctPercentage}%
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {/* Student Breakdown */}
                                                            <div>
                                                                <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Student Accuracy</h4>
                                                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                                                    {[...(session.analytics.studentAnalytics || [])].sort((a, b) => b.accuracy - a.accuracy).map((s, idx) => (
                                                                        <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${s.needsAttention ? 'bg-quizmoto-yellow/10 border-quizmoto-yellow/30' : 'bg-white/3 border-white/5'}`}>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-lg">{s.avatar || '🎓'}</span>
                                                                                <span className="font-bold text-sm">{s.name}</span>
                                                                            </div>
                                                                            <div className={`text-sm font-black ${s.accuracy >= 70 ? 'text-green-400' : s.accuracy >= 50 ? 'text-white' : 'text-quizmoto-yellow'}`}>
                                                                                {s.accuracy}%
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Full Leaderboard</h4>
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="text-white/40 text-xs uppercase tracking-wider">
                                                            <th className="text-left py-2 px-3 font-medium">Rank</th>
                                                            <th className="text-left py-2 px-3 font-medium">Player</th>
                                                            {session.players.some(p => p.teamName) && (
                                                                <th className="text-left py-2 px-3 font-medium">Team</th>
                                                            )}
                                                            <th className="text-right py-2 px-3 font-medium">Score</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {sorted.map((player, rank) => {
                                                            const isPlayerExpanded = expandedPlayerId === player.id;
                                                            return (
                                                                <React.Fragment key={player.id || player.nickname}>
                                                                    <tr
                                                                        onClick={() => setExpandedPlayerId(isPlayerExpanded ? null : player.id)}
                                                                        className={`cursor-pointer hover:bg-white/5 transition-colors ${rank === 0 ? 'bg-yellow-400/5' : ''}`}
                                                                    >
                                                                        <td className="py-2.5 px-3 text-white/40 font-medium w-12">
                                                                            {rank === 0 ? (
                                                                                <Crown size={14} className="text-yellow-400" />
                                                                            ) : (
                                                                                <span className={rank < 3 ? 'text-white/60' : ''}>{rank + 1}</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="py-2.5 px-3">
                                                                            <div className="flex items-center gap-2">
                                                                                {player.avatar && <span className="text-base">{player.avatar}</span>}
                                                                                <span className="font-medium text-white/90">{player.nickname}</span>
                                                                            </div>
                                                                        </td>
                                                                        {session.players.some(p => p.teamName) && (
                                                                            <td className="py-2.5 px-3 text-white/50 text-xs">{player.teamName || '-'}</td>
                                                                        )}
                                                                        <td className="py-2.5 px-3 text-right">
                                                                            <span className="font-bold tabular-nums">{player.score.toLocaleString()}</span>
                                                                            <span className="text-white/30 text-xs ml-1">pts</span>
                                                                            {isPlayerExpanded ? <ChevronUp size={14} className="inline ml-2 text-white/30" /> : <ChevronDown size={14} className="inline ml-2 text-white/30" />}
                                                                        </td>
                                                                    </tr>
                                                                    {isPlayerExpanded && session.Quiz?.questions && (
                                                                        <tr>
                                                                            <td colSpan={session.players.some(p => p.teamName) ? 4 : 3} className="p-0 border-0">
                                                                                <motion.div 
                                                                                    initial={{ height: 0, opacity: 0 }} 
                                                                                    animate={{ height: 'auto', opacity: 1 }} 
                                                                                    exit={{ height: 0, opacity: 0 }}
                                                                                    className="bg-black/20 p-4 border-l-2 border-quizmoto-purple overflow-hidden"
                                                                                >
                                                                                    <h5 className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">Detailed Breakdown</h5>
                                                                                    <div className="space-y-2">
                                                                                        {session.Quiz.questions.map((q, qIndex) => {
                                                                                            const answer = (player.answers || []).find(a => a.questionIndex === qIndex);
                                                                                            const isCorrect = answer ? answer.isCorrect : false;
                                                                                            const answerText = answer ? (q.options[answer.answerIndex] || `Option ${answer.answerIndex + 1}`) : 'No Answer';
                                                                                            
                                                                                            return (
                                                                                                <div key={qIndex} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border ${answer ? (isCorrect ? 'bg-green-500/10 border-green-500/20' : 'bg-quizmoto-red/10 border-quizmoto-red/20') : 'bg-white/5 border-white/10'}`}>
                                                                                                    <div className="flex-1 pr-4 min-w-0 mb-2 sm:mb-0">
                                                                                                        <span className="text-[10px] font-bold text-white/30 mr-2">Q{qIndex + 1}</span>
                                                                                                        <span className="text-sm font-medium text-white/90">{q.questionText}</span>
                                                                                                    </div>
                                                                                                    <div className="flex items-center gap-4 shrink-0">
                                                                                                        <div className="flex flex-col items-end">
                                                                                                            <span className={`text-xs font-bold ${answer ? (isCorrect ? 'text-green-400' : 'text-quizmoto-red') : 'text-white/30'}`}>
                                                                                                                {answerText}
                                                                                                            </span>
                                                                                                            {answer && (
                                                                                                                <span className="text-[10px] text-white/40 flex items-center gap-1 mt-0.5">
                                                                                                                    <Clock size={10} /> {answer.timeTaken}s
                                                                                                                </span>
                                                                                                            )}
                                                                                                        </div>
                                                                                                        <div className="w-6 flex justify-end">
                                                                                                            {answer ? (
                                                                                                                isCorrect ? <CheckCircle size={16} className="text-green-400" /> : <XCircle size={16} className="text-quizmoto-red" />
                                                                                                            ) : (
                                                                                                                <span className="text-xl leading-none opacity-20">-</span>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                </motion.div>
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-20 bg-white/3 rounded-2xl border border-dashed border-white/10">
                    <Trophy size={40} className="mx-auto text-white/15 mb-4" />
                    <h2 className="text-lg font-semibold text-white/30">No completed sessions yet</h2>
                    <p className="text-white/20 text-sm mt-1">Finish a game session to see reports here.</p>
                </div>
            )}
        </div>
    );
};

export default Reports;
