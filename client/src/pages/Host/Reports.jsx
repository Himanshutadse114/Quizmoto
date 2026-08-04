import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { ArrowLeft, Trophy, Users, Calendar, ChevronDown, ChevronUp, Download, Crown, CheckCircle, XCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiUrl } from '../../config';
import AvatarDisplay from '../../components/AvatarDisplay';

const Reports = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [expandedPlayerId, setExpandedPlayerId] = useState(null);
    const [downloadingKey, setDownloadingKey] = useState(null);
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
        if (!session?.id) {
            alert('Session not found.');
            return;
        }
        const key = `${session.id}-${format}`;
        if (downloadingKey) return;
        setDownloadingKey(key);
        try {
            const res = await axios.get(
                apiUrl(`/api/quizzes/reports/${session.id}/export?format=${format}`),
                {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'blob',
                    validateStatus: () => true
                }
            );

            const contentType = String(res.headers['content-type'] || '').toLowerCase();
            const isJson = contentType.includes('application/json') || contentType.includes('text/plain');

            // Async enqueue path (REPORTS_ASYNC=true)
            if (res.status === 202) {
                let msg = 'Report is being generated. Please try again in a few seconds.';
                try {
                    const text = await res.data.text();
                    const data = JSON.parse(text);
                    if (data.message) msg = data.message;
                    if (data.downloadPath) {
                        const dl = await axios.get(apiUrl(data.downloadPath), {
                            headers: { Authorization: `Bearer ${token}` },
                            responseType: 'blob',
                            validateStatus: () => true
                        });
                        if (dl.status === 200) {
                            const ext = format === 'pdf' ? 'pdf' : 'xlsx';
                            const url = window.URL.createObjectURL(dl.data);
                            const link = document.createElement('a');
                            link.href = url;
                            link.setAttribute('download', `Quizmoto_Report.${ext}`);
                            document.body.appendChild(link);
                            link.click();
                            link.remove();
                            window.URL.revokeObjectURL(url);
                            return;
                        }
                    }
                } catch (_) {}
                alert(msg);
                return;
            }

            if (res.status !== 200 || isJson) {
                let message = 'Failed to generate report. Please try again.';
                try {
                    const text = await res.data.text();
                    const data = JSON.parse(text);
                    if (data && data.message) message = data.message;
                } catch (_) {}
                alert(message);
                return;
            }

            const ext = format === 'pdf' ? 'pdf' : 'xlsx';
            const quizTitle = String(session.Quiz?.title || 'Quiz')
                .replace(/[^\w\-]+/g, '_')
                .slice(0, 40);
            const date = new Date(session.updatedAt || Date.now()).toISOString().slice(0, 10);
            const filename = `Quizmoto_${quizTitle}_${date}.${ext}`;

            const url = window.URL.createObjectURL(res.data);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to download report', err);
            const status = err?.response?.status;
            const msg =
                status === 401 ? 'Please log in again to download reports.' :
                status === 404 ? 'Session report not found.' :
                status === 500 ? 'Report generation failed on the server. Check that the session has finished.' :
                'Failed to generate report. Please try again.';
            alert(msg);
        } finally {
            setDownloadingKey(null);
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
                        const sorted = [...(session.players || [])].sort((a, b) => b.score - a.score);
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
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 sm:p-5 gap-3 sm:gap-4">
                                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                        <div className="bg-quizmoto-purple/20 p-3 rounded-xl shrink-0">
                                            <Trophy size={20} className="text-quizmoto-yellow" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-semibold text-white text-base truncate">
                                                {session.Quiz?.title || 'Unknown Quiz'}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-xs text-white/40">
                                                <span className="flex items-center gap-1"><Calendar size={11} /> {date}</span>
                                                <span className="flex items-center gap-1"><Users size={11} /> {(session.players || []).length} players</span>
                                                {winner && <span className="flex items-center gap-1"><Crown size={11} className="text-yellow-400" /> {winner.nickname} ({winner.score} pts)</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                        <button
                                            type="button"
                                            onClick={() => downloadReport(session, 'pdf')}
                                            disabled={!!downloadingKey}
                                            title="Download PDF"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50"
                                        >
                                            <Download size={13} />
                                            {downloadingKey === `${session.id}-pdf` ? '…' : 'PDF'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => downloadReport(session, 'excel')}
                                            disabled={!!downloadingKey}
                                            title="Download Excel"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-all disabled:opacity-50"
                                        >
                                            <Download size={13} />
                                            {downloadingKey === `${session.id}-excel` ? '…' : 'Excel'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setExpandedId(isExpanded ? null : session.id)}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/8 border border-white/10 hover:bg-white/15 transition-all"
                                        >
                                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            {isExpanded ? 'Hide' : 'Details'}
                                        </button>
                                    </div>
                                </div>

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
                                                    <div className="mt-6 mb-8 border-t border-white/10 pt-8">
                                                        <div className="flex items-center gap-2 mb-6">
                                                            <div className="w-1.5 h-6 rounded-full bg-quizmoto-blue" />
                                                            <h3 className="text-xl font-bold">Class Analytics Report</h3>
                                                        </div>
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
                                                    </div>
                                                )}

                                                <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Full Leaderboard</h4>
                                                <div className="overflow-x-auto">
                                                <table className="w-full text-sm min-w-[320px]">
                                                    <thead>
                                                        <tr className="text-white/40 text-xs uppercase tracking-wider">
                                                            <th className="text-left py-2 px-3 font-medium">Rank</th>
                                                            <th className="text-left py-2 px-3 font-medium">Player</th>
                                                            {(session.players || []).some(p => p.teamName) && (
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
                                                                                <AvatarDisplay avatar={player.avatar} imgClass="w-5 h-5" textClass="text-base" />
                                                                                <span className="font-semibold">{player.nickname}</span>
                                                                            </div>
                                                                        </td>
                                                                        {(session.players || []).some(p => p.teamName) && (
                                                                            <td className="py-2.5 px-3 text-white/50 text-xs">{player.teamName || '-'}</td>
                                                                        )}
                                                                        <td className="py-2.5 px-3 text-right">
                                                                            <span className="font-bold tabular-nums">{(player.score || 0).toLocaleString()}</span>
                                                                            <span className="text-white/30 text-xs ml-1">pts</span>
                                                                        </td>
                                                                    </tr>
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                                </div>
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
