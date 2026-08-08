import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { apiUrl } from '../../config';
import { useAuth } from '../../context/AuthContext';

export default function VoicePreview() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const urlsRef = useRef({});
  const [voices, setVoices] = useState([]);
  const [text, setText] = useState('');
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyVoice, setBusyVoice] = useState(null);
  const [audioUrls, setAudioUrls] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    let active = true;
    axios
      .get(apiUrl('/api/scorm/author/voice-preview/voices'), { headers })
      .then((res) => {
        if (!active) return;
        setVoices(res.data?.voices || []);
        setText(res.data?.sampleText || '');
      })
      .catch((err) => {
        if (!active) return;
        setError(err.response?.data?.message || err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, headers, navigate]);

  useEffect(() => {
    return () => {
      Object.values(urlsRef.current).forEach((url) => {
        try {
          window.URL.revokeObjectURL(url);
        } catch (_) {
          // ignore
        }
      });
    };
  }, []);

  const preview = async (voice) => {
    setBusyVoice(voice.id);
    setError(null);
    try {
      const res = await axios.post(
        apiUrl('/api/scorm/author/voice-preview'),
        { voiceId: voice.id, text, speed },
        { headers, responseType: 'blob', timeout: 180000 }
      );
      const old = urlsRef.current[voice.id];
      if (old) window.URL.revokeObjectURL(old);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'audio/wav' }));
      urlsRef.current = { ...urlsRef.current, [voice.id]: url };
      setAudioUrls((prev) => ({ ...prev, [voice.id]: url }));
    } catch (err) {
      let message = err.message || 'Voice preview failed';
      if (err.response?.data instanceof Blob) {
        try {
          const body = JSON.parse(await err.response.data.text());
          message = body.message || message;
        } catch (_) {
          // ignore
        }
      } else if (err.response?.data?.message) {
        message = err.response.data.message;
      }
      setError(message);
    } finally {
      setBusyVoice(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen p-8 text-white/60">Loading local voice engines…</div>;
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto relative z-10 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <Link to="/scorm" className="text-sm text-white/50 hover:text-white font-bold">
            ← SCORM World
          </Link>
          <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter mt-2">Voice Lab</h1>
          <p className="text-white/50 text-sm mt-1">
            Compare local Indian-English narration engines using identical text. No cloud TTS request is made.
          </p>
        </div>
        <Link
          to="/scorm/author"
          className="px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-sm font-bold hover:bg-white/15"
        >
          Open AI Author
        </Link>
      </div>

      {error && (
        <div className="mb-5 rounded-xl bg-red-500/15 border border-red-400/30 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <div className="rounded-3xl bg-white/5 border border-white/10 p-5 md:p-6 mb-5">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">
              Narration sample
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 3000))}
              rows={6}
              className="w-full bg-white/10 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white/90 leading-relaxed"
            />
            <p className="text-[10px] text-white/30 mt-1 text-right">{text.length}/3000</p>
          </div>
          <div className="md:w-44">
            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">
              Speed
            </label>
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full bg-white/10 border border-white/10 rounded-xl py-3 px-3 text-sm text-white"
            >
              <option value={0.9} className="text-black">0.9×</option>
              <option value={1} className="text-black">1.0×</option>
              <option value={1.1} className="text-black">1.1×</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {voices.map((voice) => (
          <div key={voice.id} className="rounded-3xl bg-white/5 border border-white/10 p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-black">{voice.label}</div>
                <div className="text-xs text-white/40 mt-1">{voice.engine} · {voice.language} · offline</div>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                voice.available ? 'bg-green-500/15 text-green-300' : 'bg-amber-500/15 text-amber-200'
              }`}>
                {voice.available ? 'Available' : 'Not installed'}
              </span>
            </div>

            {!voice.available && (
              <div className="text-xs text-white/50 leading-relaxed rounded-xl bg-black/20 border border-white/10 p-3">
                {voice.reason || 'Local model is not installed on this backend yet.'}
              </div>
            )}

            <button
              type="button"
              disabled={!voice.available || busyVoice !== null || !text.trim()}
              onClick={() => preview(voice)}
              className="w-full py-3 rounded-xl bg-quizmoto-blue text-white font-black text-sm disabled:opacity-35 disabled:cursor-not-allowed"
            >
              {busyVoice === voice.id ? 'Generating locally…' : 'Generate preview'}
            </button>

            {audioUrls[voice.id] && (
              <audio controls src={audioUrls[voice.id]} className="w-full" preload="metadata">
                Your browser does not support audio playback.
              </audio>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-4 text-xs text-white/45 leading-relaxed">
        This is intentionally a prototype. Voice generation is local and cached. Once one narrator is selected, the next phase will generate per-screen narration during SCORM package creation and bundle the audio inside the ZIP.
      </div>
    </div>
  );
}
