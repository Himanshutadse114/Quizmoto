import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { motion } from 'framer-motion';

const Join = () => {
    const [searchParams] = useSearchParams();
    const [pin, setPin] = useState(searchParams.get('pin') || '');
    const [nickname, setNickname] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [error, setError] = useState('');
    const socket = useSocket();
    const navigate = useNavigate();
    const [selectedAvatar, setSelectedAvatar] = useState('🛡️');

    const avatars = ['🛡️', '🤖', '🦄', '🦊', '🐉', '🐱', '🐶', '🐯', '🐼', '🦁'];

    const [gameMode, setGameMode] = useState('classic');
    const [teamName, setTeamName] = useState('');

    const teams = [
        { name: 'RED', color: 'bg-red-500', shadow: 'shadow-red-900/40' },
        { name: 'BLUE', color: 'bg-blue-500', shadow: 'shadow-blue-900/40' },
        { name: 'YELLOW', color: 'bg-yellow-500', shadow: 'shadow-yellow-900/40' },
        { name: 'GREEN', color: 'bg-green-500', shadow: 'shadow-green-900/40' }
    ];

    const [resumeInfo, setResumeInfo] = useState(null);
    const [resuming, setResuming] = useState(false);

    // Detect accidental leave: saved player_info means seat can be resumed
    useEffect(() => {
        try {
            const raw = localStorage.getItem('player_info');
            if (!raw) return;
            const info = JSON.parse(raw);
            if (info && info.pin && info.nickname && info.token) {
                setResumeInfo(info);
                if (!pin) setPin(String(info.pin));
                if (!nickname) setNickname(info.nickname);
                if (info.avatar) setSelectedAvatar(info.avatar);
            }
        } catch (_) {}
    }, []);

    // Prefill from logged-in player profile (login → dashboard → join)
    useEffect(() => {
        const storedProfile = localStorage.getItem('playerProfile');
        if (storedProfile) {
            try {
                const profile = JSON.parse(storedProfile);
                setNickname(profile.username);
                setIsLoggedIn(true);
                if (profile.avatar && profile.avatar !== 'default_avatar.png') {
                    setSelectedAvatar(profile.avatar);
                }
            } catch (e) {
                console.error('Error parsing profile');
            }
        }
    }, []);

    // Socket listeners — same path for login, guest join, and resume
    useEffect(() => {
        if (!socket) return;

        const onJoined = (data) => {
            try { sessionStorage.removeItem('pending_question_started'); } catch (_) {}
            const info = {
                pin: data.pin || pin,
                nickname: data.nickname || nickname,
                token: data.token,
                sessionId: data.sessionId,
                avatar: selectedAvatar,
                teamName: teamName || null
            };
            localStorage.setItem('player_info', JSON.stringify(info));
            setResumeInfo(info);
            setResuming(false);
            // Default to lobby; session_info will redirect into active game if needed
            navigate('/player/lobby');
        };

        const onSessionInfo = (data) => {
            try {
                if (data.status === 'question' || data.status === 'result') {
                    navigate('/player/game');
                } else if (data.status === 'finished') {
                    navigate('/player/game');
                }
            } catch (_) {}
        };

        socket.on('joined_successfully', onJoined);
        socket.on('session_info', onSessionInfo);
        socket.on('room_info', (data) => {
            setGameMode(data.gameMode || 'classic');
        });
        socket.on('error', (msg) => {
            setResuming(false);
            setError(typeof msg === 'string' ? msg : (msg && msg.message) || 'Join failed');
            // Stale resume seat (game finished / removed)
            if (msg === 'Game not found' || msg === 'Game is already finished') {
                try { localStorage.removeItem('player_info'); } catch (_) {}
                setResumeInfo(null);
            }
        });

        return () => {
            socket.off('joined_successfully', onJoined);
            socket.off('session_info', onSessionInfo);
            socket.off('room_info');
            socket.off('error');
        };
    }, [socket, navigate, pin, nickname, selectedAvatar, teamName]);

    // Soft room probe when PIN is complete
    useEffect(() => {
        if (!socket || !pin || String(pin).length !== 6) return;
        socket.emit('join_room', { pin, role: 'player_check' });
    }, [socket, pin]);

    const handleResume = () => {
        if (!socket || !resumeInfo) return;
        setError('');
        setResuming(true);
        socket.emit('join_room', {
            pin: resumeInfo.pin,
            nickname: resumeInfo.nickname,
            role: 'player',
            token: resumeInfo.token,
            avatar: resumeInfo.avatar
        });
    };

    const dismissResume = () => {
        try { localStorage.removeItem('player_info'); } catch (_) {}
        setResumeInfo(null);
    };

    const handleJoin = (e) => {
        e.preventDefault();
        if (!socket) return;
        if (gameMode === 'team' && !teamName) return setError('Please select a team');

        const docElm = document.documentElement;
        try {
            const requestFs = docElm.requestFullscreen ||
                docElm.webkitRequestFullscreen ||
                docElm.mozRequestFullScreen ||
                docElm.msRequestFullscreen;

            if (requestFs) {
                requestFs.call(docElm).catch(err => {
                    console.log(`Error attempting to enable full-screen mode: ${err.message}`);
                });
            }
        } catch (err) {
            console.warn('Fullscreen API not supported', err);
        }

        const info = JSON.parse(localStorage.getItem('player_info') || '{}');
        const storedToken = (info.pin === pin && info.nickname === nickname) ? info.token : null;
        const playerProfileToken = localStorage.getItem('playerToken');

        socket.emit('join_room', {
            pin,
            nickname,
            role: 'player',
            avatar: selectedAvatar,
            token: storedToken,
            playerProfileToken,
            teamName
        });
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-quizmoto-purple">
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-full max-w-sm bg-white p-6 md:p-10 rounded-[32px] shadow-2xl text-gray-800 mx-auto relative overflow-hidden"
            >
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-blue-500 to-green-500 opacity-20" />

                <h1 className="text-3xl md:text-3xl font-black text-center mb-8 text-quizmoto-purple italic tracking-tighter">Quizmoto<span className="text-quizmoto-yellow">!</span></h1>

                {error && <p className="bg-red-50 text-red-500 p-3 rounded-2xl mb-6 text-center font-black text-[10px] uppercase tracking-widest border border-red-100">{error}</p>}

                <div className="mb-8">
                    <label className="block text-[8px] font-black uppercase tracking-[0.3em] text-gray-400 mb-4 text-center">Pick Your Identity</label>
                    <div className="grid grid-cols-5 gap-3 mb-6">
                        {avatars.map(char => (
                            <button
                                key={char}
                                type="button"
                                onClick={() => setSelectedAvatar(char)}
                                className={`text-2xl p-2 rounded-xl transition-all ${selectedAvatar === char ? 'bg-quizmoto-purple/10 scale-125 ring-2 ring-quizmoto-purple' : 'opacity-40 hover:opacity-100'}`}
                            >
                                {char}
                            </button>
                        ))}
                    </div>

                    {gameMode === 'team' && (
                        <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <label className="block text-[8px] font-black uppercase tracking-[0.3em] text-gray-400 mb-4 text-center">Select Your Team</label>
                            <div className="grid grid-cols-2 gap-3">
                                {teams.map(t => (
                                    <button
                                        key={t.name}
                                        type="button"
                                        onClick={() => setTeamName(t.name)}
                                        className={`py-3 rounded-2xl font-black text-white text-xs transition-all border-b-4 ${t.color} ${teamName === t.name ? 'scale-105 brightness-110 border-white/40' : 'opacity-40 hover:opacity-100 border-black/20'}`}
                                    >
                                        {t.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {resumeInfo && (
                    <div className="mb-6 p-4 rounded-2xl border-2 border-quizmoto-yellow/40 bg-quizmoto-yellow/10 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-quizmoto-purple/70 mb-1">
                            Session in progress
                        </p>
                        <p className="font-black text-quizmoto-purple text-lg leading-tight">
                            PIN {resumeInfo.pin}
                        </p>
                        <p className="text-sm font-bold text-quizmoto-purple/80 mb-3">
                            Continue as {resumeInfo.nickname}
                        </p>
                        <button
                            type="button"
                            onClick={handleResume}
                            disabled={resuming}
                            className="w-full bg-quizmoto-purple text-white font-black py-3.5 rounded-2xl text-base hover:bg-opacity-90 transition-all shadow-[0_4px_0_0_#33125e] active:translate-y-0.5 active:shadow-none uppercase tracking-tight disabled:opacity-60"
                        >
                            {resuming ? 'Rejoining…' : 'Resume game'}
                        </button>
                        <button
                            type="button"
                            onClick={dismissResume}
                            className="mt-2 text-[10px] font-black uppercase tracking-widest text-quizmoto-purple/50 hover:text-quizmoto-purple"
                        >
                            Dismiss — join a different game
                        </button>
                    </div>
                )}

                <form onSubmit={handleJoin} className="space-y-4">
                    <div className="relative group">
                        <input
                            type="text"
                            placeholder="Game PIN"
                            className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-center font-black text-2xl focus:border-quizmoto-purple outline-none transition-all uppercase placeholder:text-gray-200"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            required
                        />
                    </div>
                    <div className="relative group">
                        {isLoggedIn && (
                            <span className="absolute -top-3 right-4 bg-quizmoto-yellow text-quizmoto-darkPurple text-[10px] font-black px-2 py-1 rounded-full z-10">
                                LOGGED IN
                            </span>
                        )}
                        <input
                            type="text"
                            placeholder="Nickname"
                            className={`w-full p-4 border-2 rounded-2xl text-center font-black text-xl outline-none transition-all placeholder:text-gray-200 ${
                                isLoggedIn
                                ? 'bg-quizmoto-purple/10 border-quizmoto-purple/30 text-quizmoto-purple cursor-not-allowed'
                                : 'bg-gray-50 border-gray-100 focus:border-quizmoto-purple text-gray-800'
                            }`}
                            value={nickname}
                            onChange={(e) => !isLoggedIn && setNickname(e.target.value)}
                            readOnly={isLoggedIn}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-quizmoto-purple text-white font-black py-5 rounded-[20px] text-lg hover:bg-opacity-90 transition-all shadow-[0_6px_0_0_#33125e] active:translate-y-1 active:shadow-none uppercase tracking-tight italic"
                    >
                        Join Battle
                    </button>
                </form>
            </motion.div>
        </div>
    );
};

export default Join;
