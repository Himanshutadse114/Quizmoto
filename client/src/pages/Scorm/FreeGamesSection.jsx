import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, Gamepad2, LockKeyhole, Maximize2, Play, Shapes, Sparkles, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

const FREE_LEVELS = 25;
const TOTAL_LEVELS = 132;
const GAME_SRC = '/games/geometry-quest/index.html?embedded=1';

function isFullscreen() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

async function requestElementFullscreen(element) {
  if (!element) return false;
  try {
    if (element.requestFullscreen) {
      await element.requestFullscreen({ navigationUI: 'hide' });
      return true;
    }
    if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
      return true;
    }
  } catch (_) {}
  return false;
}

async function leaveFullscreen() {
  try {
    if (document.exitFullscreen && document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (document.webkitExitFullscreen && document.webkitFullscreenElement) {
      document.webkitExitFullscreen();
    }
  } catch (_) {}
}

function useGeometryAccess() {
  const { token, user } = useAuth();
  const [fullAccess, setFullAccess] = useState(Boolean(user?.isSuperAdmin || user?.role === 'super_admin'));
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    const superAdmin = Boolean(user?.isSuperAdmin || user?.role === 'super_admin');

    if (superAdmin) {
      setFullAccess(true);
      setChecking(false);
      return () => { mounted = false; };
    }

    if (!token) {
      setFullAccess(false);
      setChecking(false);
      return () => { mounted = false; };
    }

    axios.get(apiUrl('/api/scorm/access/me'), { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!mounted) return;
        setFullAccess(Boolean(res.data?.isSuperAdmin || res.data?.entitlement?.permissions?.geometryPhysicsFullAccess));
      })
      .catch(() => mounted && setFullAccess(false))
      .finally(() => mounted && setChecking(false));

    return () => { mounted = false; };
  }, [token, user?.isSuperAdmin, user?.role]);

  return { fullAccess, checking };
}

export function GeometryPhysicsWorkspace({ onClose }) {
  const { fullAccess } = useGeometryAccess();
  const rootRef = useRef(null);
  const iframeRef = useRef(null);
  const [fullscreenActive, setFullscreenActive] = useState(() => isFullscreen());
  const [resumeError, setResumeError] = useState('');

  const notifyGame = (active) => {
    const frame = iframeRef.current;
    if (!frame?.contentWindow) return;
    try {
      frame.contentWindow.postMessage({ type: 'lmsgen:geometry-focus', active: Boolean(active) }, window.location.origin);
      frame.contentWindow.postMessage({ type: 'lmsgen:geometry-fullscreen', active: Boolean(active) }, window.location.origin);
    } catch (_) {}
  };

  useEffect(() => {
    const syncFullscreen = () => {
      const active = isFullscreen();
      setFullscreenActive(active);
      notifyGame(active);
      if (!active && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    };

    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    syncFullscreen();

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
    };
  }, []);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'lmsgen:geometry-close') onClose?.();
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onClose]);

  const resumeFullscreen = async () => {
    setResumeError('');
    const ok = await requestElementFullscreen(rootRef.current || document.documentElement);
    if (!ok) setResumeError('Fullscreen could not be started. Please allow fullscreen in your browser and try again.');
  };

  const exitGame = async () => {
    if (isFullscreen()) await leaveFullscreen();
    onClose?.();
  };

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[9999] h-[100dvh] w-screen overflow-hidden bg-[#F4F8F7]"
      style={{ isolation: 'isolate', filter: 'none', opacity: 1 }}
      aria-label="Geometry Physics fullscreen game"
    >
      <iframe
        ref={iframeRef}
        src={GAME_SRC}
        title="Geometry Physics"
        className="block w-full h-full border-0 bg-[#F4F8F7]"
        style={{
          filter: 'none',
          opacity: fullscreenActive ? 1 : 0,
          visibility: fullscreenActive ? 'visible' : 'hidden',
          pointerEvents: fullscreenActive ? 'auto' : 'none'
        }}
        allow="autoplay; fullscreen"
        allowFullScreen
        tabIndex={fullscreenActive ? 0 : -1}
        onLoad={() => notifyGame(fullscreenActive)}
      />

      {fullscreenActive && (
        <button
          type="button"
          onClick={exitGame}
          className="absolute top-[max(10px,env(safe-area-inset-top))] right-[max(10px,env(safe-area-inset-right))] z-30 h-10 px-3 rounded-xl border border-[#D7E5E2] bg-white/95 text-[#315B55] shadow-[0_8px_24px_rgba(30,72,66,.14)] inline-flex items-center gap-2 text-[11px] font-semibold hover:bg-[#ECF7F5]"
          title="Exit Geometry Physics"
        >
          <X size={14} /> Exit game
        </button>
      )}

      {!fullscreenActive && (
        <div className="absolute inset-0 z-40 grid place-items-center p-5 bg-[#F4F8F7] text-[#14201E]">
          <div className="w-full max-w-[460px] rounded-3xl border border-[#D7E5E2] bg-white p-6 sm:p-8 text-center shadow-[0_24px_70px_rgba(30,72,66,.14)]">
            <div className="mx-auto w-14 h-14 rounded-2xl grid place-items-center border border-[#B8E5DF] bg-[#E7F8F5] text-[#178C82]"><Shapes size={24} /></div>
            <div className="mt-5 text-[10px] uppercase tracking-[.12em] font-semibold text-[#6F817E]">Geometry Physics</div>
            <h2 className="mt-2 text-[24px] sm:text-[28px] font-semibold tracking-[-.025em]">Fullscreen required</h2>
            <p className="mt-2 text-[12px] sm:text-[13px] leading-relaxed text-[#5D706C]">
              Geometry Physics can only be played in fullscreen. Your game is paused while fullscreen is closed.
            </p>
            <div className="mt-5 rounded-xl border border-[#D7E5E2] bg-[#F8FBFA] px-4 py-3 text-[10px] text-[#526662]">
              {fullAccess ? `All ${TOTAL_LEVELS} levels are available for this tenant.` : `Levels 1–${FREE_LEVELS} are available on the free tier.`}
            </div>
            {resumeError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">{resumeError}</div>}
            <button
              type="button"
              onClick={resumeFullscreen}
              className="mt-6 w-full min-h-12 rounded-xl bg-[#07111F] text-white inline-flex items-center justify-center gap-2 text-[12px] font-semibold hover:bg-[#102033]"
            >
              <Maximize2 size={15} /> Resume Fullscreen
            </button>
            <button
              type="button"
              onClick={exitGame}
              className="mt-3 min-h-10 px-3 text-[11px] font-semibold text-[#526662] hover:text-[#178C82] inline-flex items-center gap-2"
            >
              <ArrowLeft size={13} /> Exit game and return to Quizmoto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FreeGamesSection({ onLaunch }) {
  const { fullAccess, checking } = useGeometryAccess();

  return (
    <section className="scorm-panel overflow-hidden mb-6">
      <div className="scorm-panel-header flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="scorm-eyebrow inline-flex items-center gap-2"><Gamepad2 size={13} /> Learning Games</div>
          <h3 className="text-[18px] mt-1">Learn by playing</h3>
          <p className="scorm-meta mt-1.5">Interactive learning games available directly inside Quizmoto.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-semibold text-emerald-500 self-start md:self-auto">
          <Sparkles size={12} /> {FREE_LEVELS} levels free
        </span>
      </div>

      <div className="p-3 sm:p-4 md:p-5">
        <button
          type="button"
          onClick={onLaunch}
          className="group block w-full text-left rounded-2xl border border-[var(--scorm-border,#D7E5E2)] bg-[var(--scorm-panel,#fff)] hover:border-[#4FC9BF] transition-colors overflow-hidden"
        >
          <div className="grid lg:grid-cols-[minmax(0,1fr)_auto] gap-4 sm:gap-5 items-center p-4 sm:p-5 md:p-6">
            <div className="flex items-start gap-3 sm:gap-4 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl grid place-items-center shrink-0 border border-[#4FC9BF]/30 bg-[#4FC9BF]/10 text-[#238E85]"><Shapes size={21} /></div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-[15px] sm:text-[17px] font-semibold">Geometry Physics</h4>
                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[8px] sm:text-[9px] uppercase tracking-[.1em] font-bold text-emerald-500">Free game</span>
                  <span className="rounded-full border border-[#4FC9BF]/30 bg-[#4FC9BF]/10 px-2.5 py-1 text-[8px] sm:text-[9px] uppercase tracking-[.1em] font-bold text-[#238E85]">Fullscreen only</span>
                  {!checking && fullAccess && <span className="rounded-full border border-[#4FC9BF]/30 bg-[#4FC9BF]/10 px-2.5 py-1 text-[8px] sm:text-[9px] uppercase tracking-[.1em] font-bold text-[#238E85]">Full access</span>}
                </div>
                <p className="text-[11px] sm:text-xs md:text-[13px] opacity-65 mt-2 leading-relaxed max-w-3xl">
                  Learn equations visually, construct 100 different shapes and turn formulas into physical ramps. The first {FREE_LEVELS} missions are included for every LMSGEN tenant.
                </p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3 text-[9px] sm:text-[10px] opacity-70">
                  <span className="rounded-lg border px-2 py-1.5 sm:px-2.5">100 Shape Academy missions</span>
                  <span className="rounded-lg border px-2 py-1.5 sm:px-2.5">32 Gravity missions</span>
                  <span className="rounded-lg border px-2 py-1.5 sm:px-2.5">Learn → Build → Test</span>
                  <span className="rounded-lg border px-2 py-1.5 sm:px-2.5">{TOTAL_LEVELS} total levels</span>
                </div>
                <div className={`mt-3 sm:mt-4 rounded-xl border px-3 sm:px-3.5 py-2.5 sm:py-3 text-[9px] sm:text-[10px] leading-relaxed ${fullAccess ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-amber-500/25 bg-amber-500/5'}`}>
                  {checking ? (
                    <span>Checking tenant game access…</span>
                  ) : fullAccess ? (
                    <span><strong>Full curriculum unlocked.</strong> This tenant can play all {TOTAL_LEVELS} levels.</span>
                  ) : (
                    <span className="inline-flex items-start gap-2"><LockKeyhole size={13} className="mt-0.5 shrink-0" /><span><strong>Levels 1–{FREE_LEVELS} are free.</strong> Levels {FREE_LEVELS + 1}–{TOTAL_LEVELS} can only be unlocked for this tenant by the LMSGEN Super Admin.</span></span>
                  )}
                </div>
              </div>
            </div>
            <span className="scorm-button-primary w-full lg:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 lg:py-2.5 text-xs font-semibold whitespace-nowrap">{fullAccess ? 'Play fullscreen' : 'Play free fullscreen'} <Play size={13} /></span>
          </div>
        </button>
      </div>
    </section>
  );
}
