import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiUrl } from '../../config';

const PlayerDashboard = () => {
    const [profile, setProfile] = useState(null);
    const [history, setHistory] = useState([]);
    const [expandedSessionId, setExpandedSessionId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const navigate = useNavigate();

    const SVG_SEEDS = ['Felix', 'Aneka', 'Jasper', 'Max', 'Mimi', 'Loki', 'Garfield', 'Leo', 'Zoe', 'Simba', 'Jack', 'Luna'];

    useEffect(() => {
        const fetchProfile = async () => {
            const token = localStorage.getItem('playerToken');
            if (!token) {
                navigate('/player/login');
                return;
            }

            try {
                const res = await fetch(apiUrl('/api/player/profile'), {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                const histRes = await fetch(apiUrl('/api/player/history'), {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (res.ok && histRes.ok) {
                    const data = await res.json();
                    const histData = await histRes.json();
                    setProfile(data);
                    setHistory(histData);
                    localStorage.setItem('playerProfile', JSON.stringify(data));
                } else {
                    localStorage.removeItem('playerToken');
                    navigate('/player/login');
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('playerToken');
        localStorage.removeItem('playerProfile');
        navigate('/');
    };

    if (loading) {
        return <div className="min-h-screen bg-quizmoto-purple flex items-center justify-center text-white font-black text-2xl animate-pulse">Loading Your Profile...</div>;
    }

    if (!profile) return null;

    const nextLevelXP = profile.level * 1000;
    const currentLevelXP = (profile.level - 1) * 1000;
    const progress = Math.min(100, Math.max(0, ((profile.xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100));
    
    const isSvgUrl = profile.avatar && profile.avatar.startsWith('http');
    const displayAvatar = isSvgUrl 
        ? <img src={profile.avatar} alt="avatar" className="w-full h-full rounded-full object-cover" />
        : ((!profile.avatar || profile.avatar === 'default_avatar.png') ? profile.username.charAt(0).toUpperCase() : profile.avatar);

    const handleAvatarSelect = async (seed) => {
        const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
        try {
            const token = localStorage.getItem('playerToken');
            const res = await fetch(apiUrl('/api/player/avatar'), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ avatar: avatarUrl })
            });
            if (res.ok) {
                const data = await res.json();
                const newProfile = { ...profile, avatar: data.avatar };
                setProfile(newProfile);
                localStorage.setItem('playerProfile', JSON.stringify(newProfile));
                setShowAvatarModal(false);
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="flex flex-col md:flex-row h-screen bg-quizmoto-darkPurple font-sans overflow-y-auto md:overflow-hidden">
            
            {/* Sidebar Navigation */}
            <motion.div 
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="w-full md:w-72 shrink-0 bg-black/20 border-b md:border-b-0 md:border-r border-white/5 p-6 flex flex-col relative z-20 backdrop-blur-xl"
            >
                <div className="text-center mb-6 md:mb-10 mt-2 md:mt-4">
                    <h1 className="text-3xl font-black italic tracking-tighter text-white drop-shadow-lg">
                        Quizmoto<span className="text-quizmoto-yellow">!</span>
                    </h1>
                </div>

                {/* Sidebar Profile */}
                <div className="flex flex-col items-center mb-6 md:mb-10">
                    <div className="relative cursor-pointer mb-4" onClick={() => setShowAvatarModal(true)}>
                        <motion.div 
                            whileHover={{ scale: 1.05, rotate: 5 }}
                            className="w-24 h-24 bg-gradient-to-br from-gray-50 to-gray-200 rounded-full flex items-center justify-center text-4xl shadow-inner border-[4px] border-white ring-4 ring-quizmoto-purple/10"
                        >
                            <span className={!isSvgUrl ? "drop-shadow-md" : ""}>{displayAvatar}</span>
                        </motion.div>
                        <div className="absolute -bottom-1 -right-1 bg-quizmoto-yellow text-quizmoto-darkPurple w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-md border-2 border-white hover:scale-110 transition-transform">
                            ✎
                        </div>
                    </div>
                    <h2 className="text-xl font-black text-white tracking-tight text-center">{profile.username}</h2>
                    <div className="bg-gradient-to-r from-quizmoto-yellow to-yellow-500 text-quizmoto-darkPurple font-black px-3 py-1 rounded-lg text-xs uppercase tracking-widest mt-2 shadow-md">
                        Level {profile.level}
                    </div>
                </div>

                {/* Sidebar Actions */}
                <div className="flex-1 space-y-4 mb-6 md:mb-0">
                    <Link to="/join" className="block">
                        <motion.div 
                            whileHover={{ scale: 1.02, translateY: -2 }}
                            whileTap={{ scale: 0.98 }}
                            className="bg-gradient-to-br from-quizmoto-blue to-blue-600 rounded-2xl py-4 px-6 text-center cursor-pointer shadow-lg hover:shadow-xl text-white transition-all flex flex-col justify-center items-center"
                        >
                            <h3 className="text-lg font-black italic tracking-tight uppercase drop-shadow-md">Join Battle</h3>
                            <p className="opacity-80 mt-1 font-bold text-[10px] tracking-wide">Enter a PIN</p>
                        </motion.div>
                    </Link>
                </div>

                {/* Disconnect */}
                <button 
                    onClick={handleLogout}
                    className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 font-black uppercase text-xs tracking-widest py-4 rounded-xl transition-all border border-red-500/20 mt-auto"
                >
                    Disconnect
                </button>
            </motion.div>

            {/* Main Content Area */}
            <div className="flex-1 w-full md:h-full overflow-y-visible md:overflow-y-auto relative p-6 md:p-12 custom-scrollbar">
                {/* Ambient Background Elements */}
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-quizmoto-blue rounded-full blur-[120px] opacity-30 pointer-events-none"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-quizmoto-purple rounded-full blur-[120px] opacity-40 pointer-events-none"></div>

                <div className="max-w-6xl mx-auto relative z-10 space-y-8">
                    {/* Header Row */}
                    <div>
                        <h2 className="text-3xl font-black text-white italic tracking-tight mb-2">Dashboard</h2>
                        <p className="text-white/60 font-bold text-sm tracking-wide">Welcome back, {profile.username}. Here are your stats.</p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* XP Progress Card */}
                        <motion.div 
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="bg-white/10 backdrop-blur-xl rounded-[24px] p-6 border border-white/20"
                        >
                            <h4 className="text-white/70 text-xs font-black uppercase tracking-widest mb-4">Experience Progress</h4>
                            <div className="flex items-end justify-between mb-2">
                                <div className="text-4xl font-black text-white">{profile.xp} <span className="text-lg opacity-60">XP</span></div>
                                <div className="text-sm font-bold text-quizmoto-yellow uppercase tracking-widest">{nextLevelXP - profile.xp} to next level</div>
                            </div>
                            <div className="h-4 w-full bg-black/40 rounded-full overflow-hidden p-1">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
                                    className="h-full rounded-full bg-gradient-to-r from-quizmoto-yellow to-orange-500 relative"
                                >
                                    <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
                                </motion.div>
                            </div>
                        </motion.div>

                        {/* Battles Fought */}
                        <motion.div 
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white/10 backdrop-blur-xl rounded-[24px] p-6 border border-white/20 flex flex-col justify-center"
                        >
                            <h4 className="text-white/70 text-xs font-black uppercase tracking-widest mb-2">Battles Fought</h4>
                            <div className="text-5xl font-black text-white">{profile.gamesPlayed}</div>
                        </motion.div>
                    </div>

                {/* Battle History */}
                <motion.div 
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="mb-12"
                >
                    <h3 className="text-2xl font-black text-white italic tracking-tight mb-6 uppercase drop-shadow-md">Battle History</h3>
                    
                    {history.length === 0 ? (
                        <div className="bg-white/5 border border-white/10 rounded-[32px] p-10 text-center text-white/60 font-bold backdrop-blur-md">
                            No battles fought yet. Join a game to start making history!
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {history.map((session, idx) => {
                                const isExpanded = expandedSessionId === session.sessionId;
                                return (
                                    <div key={session.sessionId || idx} className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[24px] overflow-hidden transition-all">
                                        {/* Card Header (Clickable) */}
                                        <div 
                                            onClick={() => setExpandedSessionId(isExpanded ? null : session.sessionId)}
                                            className="p-6 cursor-pointer hover:bg-white/5 transition-colors flex flex-col md:flex-row items-center justify-between gap-4"
                                        >
                                            <div className="flex items-center gap-4 w-full md:w-auto">
                                                <div className="bg-quizmoto-purple/50 w-12 h-12 rounded-full flex items-center justify-center text-white font-black shadow-inner border border-white/20">
                                                    #{history.length - idx}
                                                </div>
                                                <div>
                                                    <h4 className="text-white font-black text-xl tracking-tight">{session.quizTitle || 'Unknown Quiz'}</h4>
                                                    <p className="text-white/50 text-xs font-bold uppercase tracking-widest">
                                                        {new Date(session.date).toLocaleDateString()} &bull; PIN: {session.pin}
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                                                <div className="text-right">
                                                    <div className="text-quizmoto-yellow font-black text-2xl">{session.score} <span className="text-sm opacity-70">XP</span></div>
                                                    <div className="text-white/70 text-xs font-bold uppercase tracking-widest">Score</div>
                                                </div>
                                                <div className="text-right border-l border-white/10 pl-6">
                                                    <div className="text-white font-black text-2xl">{session.totalCorrect}/{session.totalQuestions}</div>
                                                    <div className="text-white/70 text-xs font-bold uppercase tracking-widest">Accuracy</div>
                                                </div>
                                                <div className="text-white/40 transform transition-transform duration-300">
                                                    {isExpanded ? '▲' : '▼'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && session.detailedAnswers && (
                                            <div className="bg-black/20 p-6 border-t border-white/10">
                                                <h5 className="text-white/80 font-black text-xs uppercase tracking-widest mb-4">Question Breakdown</h5>
                                                <div className="space-y-2">
                                                    {session.detailedAnswers.map((ans, qIdx) => (
                                                        <div key={qIdx} className="flex items-start gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
                                                            <div className="mt-1">
                                                                {!ans.answered ? (
                                                                    <span className="text-gray-400 text-sm font-bold bg-white/10 px-2 py-1 rounded" title="Unanswered">Unanswered</span>
                                                                ) : ans.isCorrect ? (
                                                                    <span className="text-green-400 text-sm font-bold bg-green-400/10 px-2 py-1 rounded" title="Correct">Correct</span>
                                                                ) : (
                                                                    <span className="text-red-400 text-sm font-bold bg-red-400/10 px-2 py-1 rounded" title="Incorrect">Incorrect</span>
                                                                )}
                                                            </div>
                                                            <div className="w-full">
                                                                <p className="text-white/90 font-bold text-sm mb-3">{ans.questionText}</p>
                                                                
                                                                {/* Options Grid */}
                                                                {ans.options && ans.options.length > 0 && (
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 w-full">
                                                                        {ans.options.map((opt, oIdx) => {
                                                                            const isChosen = ans.chosenAnswerIndex === oIdx;
                                                                            const isRightOption = ans.correctIndex === oIdx;
                                                                            
                                                                            let optionClasses = "p-2 rounded text-xs font-bold border break-words ";
                                                                            if (isRightOption) {
                                                                                optionClasses += "bg-green-500/20 border-green-500 text-green-300";
                                                                            } else if (isChosen && !isRightOption) {
                                                                                optionClasses += "bg-red-500/20 border-red-500 text-red-300";
                                                                            } else {
                                                                                optionClasses += "bg-white/5 border-white/10 text-white/60";
                                                                            }

                                                                            return (
                                                                                <div key={oIdx} className={optionClasses}>
                                                                                    {opt} 
                                                                                    {isChosen && <span className="ml-2 opacity-80">(Your Pick)</span>}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                                
                                                                {!ans.answered && <p className="text-xs text-white/40 italic mt-2">Did not answer in time</p>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </motion.div>

                {/* Avatar Picker Modal */}
                {showAvatarModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white rounded-[32px] p-8 max-w-2xl w-full shadow-2xl relative"
                        >
                            <button 
                                onClick={() => setShowAvatarModal(false)}
                                className="absolute top-4 right-4 bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800 w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors"
                            >
                                ✕
                            </button>
                            <h3 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">Choose Your Avatar</h3>
                            <p className="text-gray-500 text-sm font-bold mb-6">Select a custom SVG hero for your profile</p>
                            
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                                {SVG_SEEDS.map((seed) => (
                                    <div 
                                        key={seed} 
                                        onClick={() => handleAvatarSelect(seed)}
                                        className="cursor-pointer group relative aspect-square bg-gray-50 rounded-2xl border-2 border-gray-100 hover:border-quizmoto-purple transition-all overflow-hidden p-2"
                                    >
                                        <img 
                                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9`} 
                                            alt={seed} 
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
                                        />
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}

                </div>
            </div>
        </div>
    );
};

export default PlayerDashboard;
