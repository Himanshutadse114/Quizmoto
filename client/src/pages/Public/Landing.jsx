import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gamepad2, LogIn, Play, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Landing() {
  const navigate = useNavigate();
  const { token } = useAuth();

  return (
    <div className="min-h-screen bg-quizmoto-purple text-white relative overflow-hidden flex items-center justify-center p-5 sm:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,.13),transparent_22rem),radial-gradient(circle_at_85%_82%,rgba(19,104,206,.32),transparent_28rem)]" />
      <div className="absolute -top-16 -right-16 w-60 h-60 rounded-full border-[34px] border-quizmoto-yellow/20 rotate-12" />
      <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-[64px] border-[40px] border-white/8 -rotate-12" />

      <motion.main
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-5xl"
      >
        <div className="grid lg:grid-cols-[1.05fr_.95fr] gap-5 lg:gap-8 items-stretch">
          <section className="rounded-[32px] bg-white text-[#3c3c3c] border-b-[8px] border-[#d9d9d9] p-7 sm:p-10 lg:p-12 flex flex-col justify-between min-h-[470px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-2xl bg-[#f0f7ff] text-quizmoto-blue px-3 py-2 text-xs font-black uppercase tracking-wider border-2 border-[#dbeaff]">
                <Gamepad2 size={16} /> Live learning games
              </div>
              <h1 className="mt-7 text-6xl sm:text-7xl lg:text-8xl leading-[.86] tracking-[-.06em] font-black text-quizmoto-purple">
                Quizmoto<span className="text-quizmoto-yellow">!</span>
              </h1>
              <p className="mt-6 text-lg sm:text-xl font-bold text-gray-500 max-w-xl leading-relaxed">
                Join a live game in seconds or sign in as a host to build, launch and run interactive quizzes.
              </p>
            </div>

            <div className="mt-9 flex flex-wrap gap-3 text-sm font-bold text-gray-500">
              <span className="inline-flex items-center gap-2"><Users size={17} className="text-quizmoto-green" /> Fast player join</span>
              <span className="inline-flex items-center gap-2"><ShieldCheck size={17} className="text-quizmoto-blue" /> Secure host access</span>
              <span className="inline-flex items-center gap-2"><Sparkles size={17} className="text-quizmoto-yellow" /> AI quiz creation</span>
            </div>
          </section>

          <section className="grid gap-4">
            <button
              type="button"
              onClick={() => navigate('/join')}
              className="group text-left rounded-[28px] bg-quizmoto-green text-white p-6 sm:p-8 border-b-[8px] border-[#1a5e08] hover:translate-y-1 hover:border-b-[4px] transition-all min-h-[218px]"
            >
              <div className="w-14 h-14 rounded-2xl bg-white/15 grid place-items-center border-2 border-white/15"><Play size={27} fill="currentColor" /></div>
              <div className="mt-6 text-3xl font-black tracking-tight">Join a game</div>
              <div className="mt-2 text-white/75 font-bold">Enter the PIN from your host or scan the QR code shown in the lobby.</div>
            </button>

            <button
              type="button"
              onClick={() => navigate(token ? '/host' : '/login')}
              className="group text-left rounded-[28px] bg-quizmoto-blue text-white p-6 sm:p-8 border-b-[8px] border-[#0e4b94] hover:translate-y-1 hover:border-b-[4px] transition-all min-h-[218px]"
            >
              <div className="w-14 h-14 rounded-2xl bg-white/15 grid place-items-center border-2 border-white/15"><LogIn size={27} /></div>
              <div className="mt-6 text-3xl font-black tracking-tight">Host a quiz</div>
              <div className="mt-2 text-white/75 font-bold">Open your Quizmoto host workspace, create quizzes and launch live sessions.</div>
            </button>
          </section>
        </div>
      </motion.main>
    </div>
  );
}
