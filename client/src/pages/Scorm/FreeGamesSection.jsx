import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, Gamepad2, LockKeyhole, Play, Shapes, Sparkles } from 'lucide-react';
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

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'lmsgen:geometry-close') onClose?.();
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onClose]);

  return (
    <div
      className="h-[calc(100vh-64px)] min-h-[620px] w-full overflow-hidden flex flex-col bg-[#F4F8F7]"
      style={{ isolation: 'isolate', filter: 'none', opacity: 1 }}
    >
      <div
        className="h-[68px] shrink-0 border-b border-[#D7E5E2] px-4 md:px-6 flex items-center justify-between gap-4 text-[#14201E]"
        style={{ backgroundColor: '#FFFFFF', backdropFilter: 'none', WebkitBackdropFilter: 'none', filter: 'none', opacity: 1 }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0 border border-[#B8E5DF] bg-[#E7F8F5] text-[#178C82]"><Shapes size={19} /></div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[.1em] font-semibold text-[#6F817E]">Quizmoto · Learning Games</div>
            <div className="mt-0.5 text-[15px] font-semibold text-[#14201E] truncate">Geometry Physics</div>
            <div className="mt-0.5 text-[10px] text-[#6F817E] truncate">
              {checking ? 'Checking access…' : fullAccess ? `All ${TOTAL_LEVELS} levels unlocked` : `Levels 1–${FREE_LEVELS} free`}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-10 px-3.5 rounded-xl border border-[#B8D4CF] bg-white text-[#315B55] hover:bg-[#ECF7F5] inline-flex items-center gap-2 text-[11px] font-semibold shrink-0"
        >
          <ArrowLeft size={14} /> Back to Quizmoto
        </button>
      </div>

      <div className="flex-1 min-h-0 bg-[#F4F8F7]">
        <iframe
          src={GAME_SRC}
          title="Geometry Physics"
          className="block w-full h-full border-0 bg-[#F4F8F7]"
          style={{ filter: 'none', opacity: 1 }}
          allow="autoplay"
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

      <div className="p-4 md:p-5">
        <button
          type="button"
          onClick={onLaunch}
          className="group block w-full text-left rounded-2xl border border-[var(--scorm-border,#D7E5E2)] bg-[var(--scorm-panel,#fff)] hover:border-[#4FC9BF] transition-colors overflow-hidden"
        >
          <div className="grid lg:grid-cols-[minmax(0,1fr)_auto] gap-5 items-center p-5 md:p-6">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl grid place-items-center shrink-0 border border-[#4FC9BF]/30 bg-[#4FC9BF]/10 text-[#238E85]"><Shapes size={23} /></div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-[17px] font-semibold">Geometry Physics</h4>
                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[9px] uppercase tracking-[.1em] font-bold text-emerald-500">Free game</span>
                  {!checking && fullAccess && <span className="rounded-full border border-[#4FC9BF]/30 bg-[#4FC9BF]/10 px-2.5 py-1 text-[9px] uppercase tracking-[.1em] font-bold text-[#238E85]">Full access</span>}
                </div>
                <p className="text-xs md:text-[13px] opacity-65 mt-2 leading-relaxed max-w-3xl">
                  Learn equations visually, construct 100 different shapes and turn formulas into physical ramps. The first {FREE_LEVELS} missions are included for every LMSGEN tenant.
                </p>
                <div className="flex flex-wrap gap-2 mt-3 text-[10px] opacity-70">
                  <span className="rounded-lg border px-2.5 py-1.5">100 Shape Academy missions</span>
                  <span className="rounded-lg border px-2.5 py-1.5">32 Gravity missions</span>
                  <span className="rounded-lg border px-2.5 py-1.5">Learn → Build → Test</span>
                  <span className="rounded-lg border px-2.5 py-1.5">{TOTAL_LEVELS} total levels</span>
                </div>
                <div className={`mt-4 rounded-xl border px-3.5 py-3 text-[10px] leading-relaxed ${fullAccess ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-amber-500/25 bg-amber-500/5'}`}>
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
            <span className="scorm-button-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap">{fullAccess ? 'Play game' : 'Play free'} <Play size={13} /></span>
          </div>
        </button>
      </div>
    </section>
  );
}
