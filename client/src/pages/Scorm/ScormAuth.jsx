import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers3, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

export default function ScormAuth() {
  const navigate = useNavigate();
  const { loginScorm, registerScorm, prepareScormLogin, token } = useAuth();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    prepareScormLogin();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') {
        await loginScorm({ identifier: identifier.trim(), password });
      } else {
        await registerScorm({ username: username.trim(), email: email.trim(), password });
      }
      navigate('/scorm');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#11100e] text-[#f3ead5] relative overflow-hidden flex items-center justify-center p-5 sm:p-8">
      <div className="absolute inset-0 opacity-70 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,.012)_0,rgba(255,255,255,.012)_1px,transparent_1px,transparent_4px)]" />
      <div className="absolute top-[-12rem] right-[-8rem] w-[34rem] h-[34rem] rounded-full bg-[#ff8a1f]/5 blur-3xl" />

      <motion.main initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full max-w-md">
        <button
          type="button"
          onClick={() => navigate(token ? '/host' : '/')}
          className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-[#b79c77] hover:text-[#f3ead5]"
        >
          <ArrowLeft size={15} /> Back to Quizmoto
        </button>

        <section className="border border-[#4a3e32] border-t-2 border-t-[#ff8a1f] bg-[#1a1815] rounded-lg shadow-2xl overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-[#3b342c]">
            <div className="w-12 h-12 rounded-md bg-[#ff8a1f] text-[#17110b] grid place-items-center"><Layers3 size={23} /></div>
            <div className="mt-5 text-[10px] uppercase tracking-[.17em] text-[#ff8a1f] font-semibold">AI course creation workspace</div>
            <h1 className="mt-2 text-5xl sm:text-6xl font-black tracking-[-.045em] leading-none">SCORM <span className="text-[#ff8a1f]">AI</span></h1>
            <p className="mt-4 text-sm text-[#b79c77] leading-relaxed">
              SCORM AI is separately protected from your Quizmoto host workspace. Sign in again or create an account to continue.
            </p>
          </div>

          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#11100e] border border-[#3b342c] rounded-md mb-6">
              <button type="button" onClick={() => { setMode('login'); setError(''); }} className={`min-h-10 rounded px-3 text-xs font-semibold ${mode === 'login' ? 'bg-[#ff8a1f] text-[#17110b]' : 'text-[#b79c77] hover:text-[#f3ead5]'}`}>Log in</button>
              <button type="button" onClick={() => { setMode('register'); setError(''); }} className={`min-h-10 rounded px-3 text-xs font-semibold ${mode === 'register' ? 'bg-[#ff8a1f] text-[#17110b]' : 'text-[#b79c77] hover:text-[#f3ead5]'}`}>Create account</button>
            </div>

            {error && <div className="mb-4 p-3 rounded border border-[#e76858]/40 bg-[#e76858]/10 text-[#f3b0a7] text-xs">{error}</div>}

            <form onSubmit={submit} className="space-y-4">
              {mode === 'register' && (
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-[.12em] text-[#9b825f] mb-2">Name</span>
                  <div className="relative"><UserRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#826f56]" /><input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={2} placeholder="Your name" className="w-full bg-[#11100e] border border-[#4a3e32] rounded-md py-3 pl-10 pr-3 text-sm text-[#f3ead5] outline-none focus:border-[#ff8a1f]" /></div>
                </label>
              )}

              <label className="block">
                <span className="block text-[10px] uppercase tracking-[.12em] text-[#9b825f] mb-2">{mode === 'login' ? 'Email or username' : 'Email'}</span>
                <div className="relative"><Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#826f56]" /><input type={mode === 'register' ? 'email' : 'text'} value={mode === 'login' ? identifier : email} onChange={(e) => mode === 'login' ? setIdentifier(e.target.value) : setEmail(e.target.value)} required placeholder={mode === 'login' ? 'you@company.com or username' : 'you@company.com'} className="w-full bg-[#11100e] border border-[#4a3e32] rounded-md py-3 pl-10 pr-3 text-sm text-[#f3ead5] outline-none focus:border-[#ff8a1f]" /></div>
              </label>

              <label className="block">
                <span className="block text-[10px] uppercase tracking-[.12em] text-[#9b825f] mb-2">Password</span>
                <div className="relative"><LockKeyhole size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#826f56]" /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="Minimum 8 characters" className="w-full bg-[#11100e] border border-[#4a3e32] rounded-md py-3 pl-10 pr-3 text-sm text-[#f3ead5] outline-none focus:border-[#ff8a1f]" /></div>
              </label>

              <button disabled={busy} className="w-full min-h-12 rounded-md bg-[#ff8a1f] text-[#17110b] font-bold text-sm hover:bg-[#ff9f43] disabled:opacity-50 transition-colors">
                {busy ? 'Please wait…' : mode === 'login' ? 'Log in to SCORM AI' : 'Create SCORM AI account'}
              </button>
            </form>
          </div>
        </section>
      </motion.main>
    </div>
  );
}
