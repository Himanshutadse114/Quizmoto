import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Crown, Medal, Trophy } from 'lucide-react';
import AvatarDisplay from './AvatarDisplay';

const formatScore = (score) => Number(score || 0).toLocaleString();

const ordinal = (rank) => {
    if (rank === 1) return '1st';
    if (rank === 2) return '2nd';
    if (rank === 3) return '3rd';
    return `${rank}th`;
};

/**
 * Final Live Quiz leaderboard.
 *
 * - Always ranks by score descending.
 * - Stable sort preserves the server order when scores are tied, so any
 *   server-side tie-break remains authoritative.
 * - The podium is displayed in the conventional 2nd / 1st / 3rd layout.
 * - Only ranks 4-7 are listed beneath the podium.
 */
const FinalPodium = ({ leaderboard = [], compact = false, highlightNickname = null }) => {
    const sortedPlayers = useMemo(() => (
        (Array.isArray(leaderboard) ? leaderboard : [])
            .map((player, sourceIndex) => ({ ...player, __sourceIndex: sourceIndex }))
            .sort((a, b) => {
                const scoreDelta = Number(b.score || 0) - Number(a.score || 0);
                return scoreDelta !== 0 ? scoreDelta : a.__sourceIndex - b.__sourceIndex;
            })
    ), [leaderboard]);

    const first = sortedPlayers[0] || null;
    const second = sortedPlayers[1] || null;
    const third = sortedPlayers[2] || null;
    const remaining = sortedPlayers.slice(3, 7);

    const podiumSlots = [
        {
            player: second,
            rank: 2,
            orderClass: 'order-1',
            heightClass: compact ? 'h-24 sm:h-28' : 'h-28 sm:h-36',
            badgeClass: 'bg-slate-200 text-slate-700',
            pedestalClass: 'bg-slate-200 text-slate-800',
            Icon: Medal
        },
        {
            player: first,
            rank: 1,
            orderClass: 'order-2',
            heightClass: compact ? 'h-32 sm:h-40' : 'h-40 sm:h-52',
            badgeClass: 'bg-quizmoto-yellow text-quizmoto-purple',
            pedestalClass: 'bg-quizmoto-yellow text-quizmoto-purple',
            Icon: Crown
        },
        {
            player: third,
            rank: 3,
            orderClass: 'order-3',
            heightClass: compact ? 'h-20 sm:h-24' : 'h-24 sm:h-32',
            badgeClass: 'bg-amber-700 text-white',
            pedestalClass: 'bg-amber-700 text-white',
            Icon: Medal
        }
    ];

    if (sortedPlayers.length === 0) {
        return (
            <div className="w-full rounded-3xl bg-[#35106f] border border-[#6f49ad] p-8 text-center">
                <Trophy className="w-10 h-10 mx-auto mb-3 text-quizmoto-yellow" />
                <p className="font-black text-white">No final scores available</p>
            </div>
        );
    }

    return (
        <section className={`w-full mx-auto ${compact ? 'max-w-3xl' : 'max-w-5xl'}`} aria-label="Final leaderboard">
            <div className="text-center mb-5 sm:mb-8">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#35106f] border border-[#6f49ad] px-3.5 py-2 mb-3">
                    <Trophy size={16} className="text-quizmoto-yellow" />
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.22em] text-white/80">Final Leaderboard</span>
                </div>
                <h1 className={`${compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-5xl'} font-black tracking-tight text-white`}>
                    Top Performers
                </h1>
                <p className="mt-2 text-xs sm:text-sm font-semibold text-white/60">Highest score takes first place</p>
            </div>

            <div className="grid grid-cols-3 items-end gap-2 sm:gap-4 md:gap-6 px-1 sm:px-4 mb-5 sm:mb-8">
                {podiumSlots.map(({ player, rank, orderClass, heightClass, badgeClass, pedestalClass, Icon }, slotIndex) => (
                    <motion.div
                        key={rank}
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 0.08 * slotIndex }}
                        className={`min-w-0 flex flex-col items-center ${orderClass}`}
                    >
                        {player ? (
                            <>
                                <div className={`mb-2 sm:mb-3 rounded-full ${badgeClass} w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center shadow-lg`}>
                                    <Icon size={rank === 1 ? 20 : 18} strokeWidth={2.6} />
                                </div>

                                <div className={`relative ${rank === 1 ? 'mb-2 sm:mb-3' : 'mb-2'}`}>
                                    <div className={`rounded-full p-1 ${rank === 1 ? 'bg-quizmoto-yellow' : rank === 2 ? 'bg-slate-200' : 'bg-amber-700'}`}>
                                        <div className="rounded-full bg-[#46178F] p-1">
                                            <AvatarDisplay
                                                avatar={player.avatar}
                                                imgClass={compact ? 'w-10 h-10 sm:w-12 sm:h-12' : 'w-11 h-11 sm:w-16 sm:h-16'}
                                                textClass={compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'}
                                            />
                                        </div>
                                    </div>
                                    <div className={`absolute -right-1 -bottom-1 min-w-6 h-6 px-1 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-[#46178F] ${badgeClass}`}>
                                        {rank}
                                    </div>
                                </div>

                                <div className="w-full text-center px-1 mb-2 sm:mb-3">
                                    <p className={`${compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'} font-black text-white truncate`} title={player.nickname}>
                                        {player.nickname || 'Player'}
                                    </p>
                                    <p className={`${compact ? 'text-xs' : 'text-sm'} font-black text-quizmoto-yellow mt-0.5`}>
                                        {formatScore(player.score)} pts
                                    </p>
                                </div>

                                <div className={`relative w-full ${heightClass} ${pedestalClass} rounded-t-xl sm:rounded-t-2xl shadow-[0_14px_28px_rgba(19,5,60,0.28)] flex flex-col items-center justify-start pt-3 sm:pt-4 border-t border-white/30`}>
                                    <span className={`${compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-4xl'} font-black leading-none`}>{rank}</span>
                                    <span className="mt-1 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.18em] opacity-75">{ordinal(rank)} Place</span>
                                </div>
                            </>
                        ) : (
                            <div className="w-full h-24 sm:h-32 rounded-t-2xl bg-[#35106f] border border-[#6f49ad] flex items-center justify-center text-white/30 text-xs font-bold">
                                —
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>

            {remaining.length > 0 && (
                <div className="rounded-2xl sm:rounded-3xl bg-[#35106f] border border-[#6f49ad] overflow-hidden shadow-[0_18px_40px_rgba(18,5,53,0.2)]">
                    <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-[#6f49ad] bg-[#2b0c62]">
                        <div className="flex items-center gap-2">
                            <Trophy size={15} className="text-quizmoto-yellow" />
                            <h2 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-white/80">Ranks 4–7</h2>
                        </div>
                        <span className="text-[10px] font-bold text-white/45">Final score</span>
                    </div>

                    <div className="divide-y divide-[#5b3794]">
                        {remaining.map((player, index) => {
                            const rank = index + 4;
                            const isHighlighted = highlightNickname && player.nickname === highlightNickname;
                            return (
                                <motion.div
                                    key={player.id || `${player.nickname}-${rank}`}
                                    initial={{ opacity: 0, x: -12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.25, delay: 0.04 * index }}
                                    className={`flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 ${isHighlighted ? 'bg-[#5a2ca0]' : 'bg-[#35106f]'}`}
                                >
                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#46178F] border border-[#7a56b7] flex items-center justify-center font-black text-white text-sm">
                                        {rank}
                                    </div>
                                    <AvatarDisplay
                                        avatar={player.avatar}
                                        imgClass="w-8 h-8 sm:w-9 sm:h-9"
                                        textClass="text-xl sm:text-2xl"
                                    />
                                    <div className="min-w-0 flex-1 text-left">
                                        <p className="font-black text-xs sm:text-sm text-white truncate">{player.nickname || 'Player'}</p>
                                        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-white/40">{ordinal(rank)} place</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-black text-sm sm:text-base text-quizmoto-yellow">{formatScore(player.score)}</p>
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-white/35">points</p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            )}
        </section>
    );
};

export default FinalPodium;
