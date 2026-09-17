import React, { useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { Film, X } from 'lucide-react';
import { apiUrl } from '../../config';

export default function LearnerVideoModal({ item, streamUrl, token, progressPath, onClose, onProgress }) {
  const videoRef = useRef(null);
  const checkpoint = useRef({ position: Number(item?.lastPositionSeconds || 0), wall: 0, seeking: false });
  const send = useCallback(async (event, includeSegment = true) => {
    const player = videoRef.current;
    if (!player || !progressPath) return;
    const now = performance.now();
    const current = Number(player.currentTime || 0);
    const elapsed = Math.max(0, (now - checkpoint.current.wall) / 1000);
    const mayCredit = includeSegment && !checkpoint.current.seeking && (!player.paused || event === 'pause' || event === 'ended');
    const payload = { event, position: current, duration: Number(player.duration || item.durationSeconds || 0), playbackRate: Number(player.playbackRate || 1), from: checkpoint.current.position, to: current, elapsed: mayCredit ? elapsed : 0 };
    checkpoint.current = { position: current, wall: now, seeking: false };
    try {
      const response = await axios.post(apiUrl(progressPath), payload, { headers: { Authorization: `Bearer ${token}` } });
      onProgress?.(response.data?.progress);
    } catch {
      // The next checkpoint retries naturally; playback must not be interrupted.
    }
  }, [item, token, progressPath, onProgress]);

  useEffect(() => {
    const player = videoRef.current;
    checkpoint.current.wall = performance.now();
    if (player && item?.lastPositionSeconds > 0) player.currentTime = Number(item.lastPositionSeconds);
    const timer = window.setInterval(() => { if (player && !player.paused && !player.seeking) send('progress', true); }, 5000);
    const suspendWhenHidden = () => {
      if (document.hidden && player && !player.paused) {
        send('pause', true);
        player.pause();
      }
    };
    document.addEventListener('visibilitychange', suspendWhenHidden);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', suspendWhenHidden);
    };
  }, [item?.lastPositionSeconds, send]);

  return <div className="fixed inset-0 z-[100] bg-black/80 p-3 md:p-8 grid place-items-center" role="dialog" aria-modal="true"><div className="w-full max-w-5xl rounded-2xl bg-[#0d1d1b] text-white border border-white/15 overflow-hidden shadow-2xl"><div className="h-14 px-4 flex items-center gap-3 border-b border-white/10"><Film size={17} className="text-[#54d0c6]" /><strong className="truncate">{item.title}</strong><button type="button" onClick={() => { send('pause', true); onClose(); }} className="ml-auto w-9 h-9 rounded-xl border border-white/15 grid place-items-center"><X size={16} /></button></div><div className="bg-black aspect-video"><video ref={videoRef} src={apiUrl(streamUrl)} controls playsInline controlsList="nodownload" className="w-full h-full" onPlay={() => send('play', false)} onPause={() => send('pause', true)} onSeeking={() => { checkpoint.current.seeking = true; }} onSeeked={() => send('seek', false)} onEnded={() => send('ended', true)} /></div><div className="px-4 py-3 text-[11px] text-white/60">{progressPath ? 'Progress is saved automatically from genuine watched coverage.' : 'Private administrator preview.'}</div></div></div>;
}
