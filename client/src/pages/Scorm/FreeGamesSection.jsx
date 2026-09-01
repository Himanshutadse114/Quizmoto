import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, Gamepad2, LockKeyhole, Maximize2, Minimize2, Play, Shapes, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

const FREE_LEVELS = 25;
const TOTAL_LEVELS = 132;
const GAME_SRC = '/games/geometry-quest/index.html?embedded=1';

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
  const { fullAccess, checking } = useGeometryAccess();
  const [focusMode, setFocusMode] = useState(false);
  const iframeRef = useRef(null);

  const sendFocusState = (active) => {
    const frame = iframeRef.current;
    if (!frame?.contentWindow) return;
    try {
      frame.contentWindow.postMessage({ type: 'lmsgen:geometry-focus', active: Boolean(active) }, window.location.origin);
    } catch (_) {}
  };

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'lmsgen:geometry-close') onClose?.();
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onClose]);

  useEffect(() => {
    sendFocusState(focusMode);
  }, [focusMode]);

  useEffect(() => {
    if (!focusMode) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setFocusMode(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusMode]);

  return (
    <div
      className="relative h-[calc(100dvh-64px)] min-h-0 w-full overflow-hidden flex flex-col bg-[#F4F8F7]"
      style={{ isolation: 'isolate', filter: 'none', opacity: 1 }}
    >
      {!focusMode && (
        <div
          className="h-[56px] sm:h-[64px] md:h-[68px] shrink-0 border-b border-[#D7E5E2] px-2.5 sm:px-4 md:px-6 flex items-center justify-between gap-2 sm:gap-4 text-[#14201E]"
          style={{ backgroundColor: '#FFFFFF', backdropFilter: 'none', WebkitBackdropFilter: 'none', filter: 'none', opacity: 1 }}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl grid place-items-center shrink-0 border border-[#B8E5DF] bg-[#E7F8F5] text-[#178C82]"><Shapes size={17} className="sm:w-[19px] sm:h-[19px]" /></div>
            <div className="min-w-0">
              <div className="hidden sm:block text-[9px] md:text-[10px] uppercase tracking-[.1em] font-semibold text-[#6F817E]">Quizmoto · Learning Games</div>
              <div className="text-[13px] sm:text-[15px] font-semibold text-[#14201E] truncate">Geometry Physics</div>
              <div className="mt-0.5 text-[9px] sm:text-[10px] text-[#6F817E] truncate">
                {checking ? 'Checking access…' : fullAccess ? `All ${TOTAL_LEVELS} levels unlocked` : `Levels 1–${FREE_LEVELS} free`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setFocusMode(true)}
              className="min-h-10 min-w-10 px-2.5 sm:px-3.5 rounded-xl border border-[#B8D4CF] bg-[#F7FBFA] text-[#315B55] hover:bg-[#ECF7F5] inline-flex items-center justify-center gap-2 text-[10px] sm:text-[11px] font-semibold"
              title="Hide game headers and maximise the play area"
              aria-label="Enter focus mode"
            >
              <Maximize2 size={14} /><span className="hidden sm:inline">Focus mode</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 min-w-10 px-2.5 sm:px-3.5 rounded-xl border border-[#B8D4CF] bg-white text-[#315B55] hover:bg-[#ECF7F5] inline-flex items-center justify-center gap-2 text-[10px] sm:text-[11px] font-semibold"
              aria-label="Back to Quizmoto"
            >
              <ArrowLeft size={14} /><span className="hidden md:inline">Back to Quizmoto</span><span className="hidden sm:inline md:hidden">Back</span>
            </button>
          </div>
        </div>
      )}

      {focusMode && (
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 flex items-center gap-1 sm:gap-2 rounded-xl border border-[#C8DDD9] bg-white/95 p-1 shadow-[0_8px_24px_rgba(30,72,66,.12)]">
          <button
            type="button"
            onClick={() => setFocusMode(false)}
            className="h-9 min-w-9 px-2 sm:px-3 rounded-lg text-[#315B55] hover:bg-[#ECF7F5] inline-flex items-center justify-center gap-2 text-[10px] font-semibold"
            title="Restore the game header"
            aria-label="Show game header"
          >
            <Minimize2 size={13} /><span className="hidden sm:inline">Show header</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-9 min-w-9 px-2 sm:px-3 rounded-lg bg-[#07111F] text-white hover:bg-[#102033] inline-flex items-center justify-center gap-2 text-[10px] font-semibold"
            aria-label="Back to Quizmoto"
          >
            <ArrowLeft size={13} /><span className="hidden sm:inline">Quizmoto</span>
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 bg-[#F4F8F7]">
        <iframe
          ref={iframeRef}
          src={GAME_SRC}
          title="Geometry Physics"
          className="block w-full h-full border-0 bg-[#F4F8F7]"
          style={{ filter: 'none', opacity: 1 }}
          allow="autoplay"
          onLoad={() => sendFocusState(focusMode)}
        />
      </div>
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
            <span className="scorm-button-primary w-full lg:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 lg:py-2.5 text-xs font-semibold whitespace-nowrap">{fullAccess ? 'Play game' : 'Play free'} <Play size={13} /></span>
          </div>
        </button>
      </div>
    </section>
  );
}
