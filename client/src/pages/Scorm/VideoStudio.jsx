import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { apiUrl } from '../../config';
import { useAuth } from '../../context/AuthContext';

const BASE = '/api/scorm/video-studio';
const LAYOUT_META = {
  linkedin: { name: 'LinkedIn Learning', desc: 'Light navy/teal, hero image right' },
  innvikta: { name: 'Innvikta Security', desc: 'Charcoal/orange security-awareness look' },
  course: { name: 'Compliance Course', desc: 'Clean white/navy/teal course format' },
  kinetic: { name: 'Kinetic Type', desc: 'Giant animated typography, no images needed' },
  cinematic: { name: 'Cinematic', desc: 'Full-bleed imagery with lower-third text' }
};
const VOICES = ['onyx', 'alloy', 'echo', 'fable', 'nova', 'shimmer'];

function errText(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

export default function VideoStudio() {
  const { token } = useAuth();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const [step, setStep] = useState('setup'); // setup | review | images | build | done
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [layout, setLayout] = useState('linkedin');
  const [seconds, setSeconds] = useState(60);
  const [voice, setVoice] = useState('onyx');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [scriptJob, setScriptJob] = useState(null);
  const [blueprint, setBlueprint] = useState(null);
  const [imageKeys, setImageKeys] = useState({});
  const [imageNames, setImageNames] = useState({});
  const [buildJob, setBuildJob] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [buildEstimate, setBuildEstimate] = useState(null);
  const pollRef = useRef(null);

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  useEffect(() => stopPoll, []);

  // Poll helper that updates a state setter with the latest job snapshot.
  const pollInto = useCallback((progressId, setJob, onComplete) => {
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await axios.get(apiUrl(`${BASE}/jobs/${progressId}`), { headers });
        const job = data.job;
        setJob(job);
        if (['complete', 'error', 'failed', 'cancelled'].includes(job.status)) {
          stopPoll();
          if (onComplete) onComplete(job);
        }
      } catch (e) { /* transient: keep polling */ }
    }, 3000);
  }, [token]);

  const startScript = async () => {
    setError('');
    if (!topic.trim()) { setError('Give your video a topic first.'); return; }
    setBusy(true);
    try {
      const { data } = await axios.post(apiUrl(`${BASE}/script`),
        { topic: topic.trim(), description: description.trim(), layout, seconds }, { headers });
      setScriptJob({ progressId: data.progressId, status: 'queued', percent: 1 });
      pollInto(data.progressId, setScriptJob, (job) => {
        setBusy(false);
        if (job.status === 'complete' && job.result?.blueprint) {
          const bp = { ...job.result.blueprint, layout };
          setBlueprint(bp);
          setStep('review');
        } else {
          setError(job.errorMessage || job.detail || 'Script generation failed.');
        }
      });
    } catch (e) { setBusy(false); setError(errText(e, 'Could not start script generation.')); }
  };

  const updateScene = (idx, field, value) => {
    setBlueprint((bp) => {
      const scenes = bp.scenes.map((s, i) => (i === idx ? { ...s, [field]: value } : s));
      return { ...bp, scenes };
    });
  };

  // Client-side cost preview (server re-computes and enforces the budget).
  const costPreview = () => {
    if (!blueprint) return null;
    let chars = 0, aiImages = 0;
    blueprint.scenes.forEach((s, i) => {
      chars += String(s.narration || '').length;
      if (!imageKeys[i] && !imageKeys[String(i)]) aiImages += 1;
    });
    const usd = (chars / 1e6) * 15 + aiImages * 0.0065;
    return { usd, inr: Math.round(usd * 95) };
  };

  const startBuild = async () => {
    setError('');
    setBusy(true);
    try {
      const { data } = await axios.post(apiUrl(`${BASE}/build`),
        { blueprint, imageKeys, voice }, { headers });
      setBuildEstimate(data.estimatedCostUsd != null
        ? { usd: data.estimatedCostUsd, inr: data.estimatedCostInr, budgetInr: data.budgetInr }
        : null);
      setBuildJob({ progressId: data.progressId, status: 'queued', percent: 1 });
      setStep('build');
      pollInto(data.progressId, setBuildJob, (job) => {
        setBusy(false);
        if (job.status === 'complete') {
          setVideoUrl(apiUrl(`${BASE}/jobs/${data.progressId}/download`));
          setStep('done');
        } else {
          setError(job.errorMessage || job.detail || 'Video build failed.');
        }
      });
    } catch (e) { setBusy(false); setError(errText(e, 'Could not start the video build.')); }
  };

  const uploadSceneImage = async (idx, file) => {
    if (!file) return;
    setError('');
    try {
      const ticket = await axios.post(apiUrl(`${BASE}/upload-ticket`),
        { sceneIndex: idx, mimeType: file.type, byteSize: file.size }, { headers });
      const { direct, uploadUrl, storageKey, headers: putHeaders } = ticket.data;
      if (direct && uploadUrl) {
        await axios.put(uploadUrl, file, { headers: { 'Content-Type': file.type, ...(putHeaders || {}) } });
      } else {
        const dataUrl = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result || ''));
          r.onerror = () => reject(new Error('Could not read the image file.'));
          r.readAsDataURL(file);
        });
        await axios.post(apiUrl(`${BASE}/upload`), { storageKey, dataUrl }, { headers });
      }
      setImageKeys((m) => ({ ...m, [idx]: storageKey }));
      setImageNames((m) => ({ ...m, [idx]: file.name }));
    } catch (e) { setError(errText(e, 'Image upload failed.')); }
  };

  const removeSceneImage = (idx) => {
    setImageKeys((m) => { const n = { ...m }; delete n[idx]; return n; });
    setImageNames((m) => { const n = { ...m }; delete n[idx]; return n; });
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">Video Studio</h1>
      <p className="text-gray-500 mb-6">AI writes the script, you approve it, then it voices, illustrates and renders your video.</p>

      {error && <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200">{error}</div>}

      {step === 'setup' && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Topic</label>
            <input className="w-full border rounded px-3 py-2" value={topic}
              onChange={(e) => setTopic(e.target.value)} placeholder="e.g. The DPDP Act 2023 in 60 seconds" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description <span className="text-gray-400">(facts, figures, tone)</span></label>
            <textarea className="w-full border rounded px-3 py-2" rows={3} value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What must the video cover? Any facts or numbers it must use (it never invents statistics)." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Layout</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(LAYOUT_META).map(([key, meta]) => (
                <button key={key} type="button" onClick={() => setLayout(key)}
                  className={`text-left border rounded-lg p-3 ${layout === key ? 'border-blue-600 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="font-medium">{meta.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{meta.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-6">
            <div>
              <label className="block text-sm font-medium mb-1">Length: {seconds}s (~${(0.0008 * seconds).toFixed(2)} AI cost)</label>
              <input type="range" min={20} max={180} step={10} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Voice</label>
              <select className="border rounded px-3 py-2" value={voice} onChange={(e) => setVoice(e.target.value)}>
                {VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <button disabled={busy} onClick={startScript}
            className="px-6 py-2.5 rounded bg-blue-600 text-white font-medium disabled:opacity-50">
            {busy ? `Writing script… ${scriptJob?.percent || 1}%` : 'Write my script'}
          </button>
          {scriptJob && scriptJob.status !== 'complete' && (
            <p className="text-sm text-gray-500">{scriptJob.stage || 'Working…'} — {scriptJob.detail || ''}</p>
          )}
        </div>
      )}

      {step === 'review' && blueprint && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Review the script <span className="text-sm font-normal text-gray-500">(nothing is spent until you approve the build)</span></h2>
            <button onClick={() => { setStep('setup'); setBlueprint(null); }} className="text-sm text-blue-600 underline">Regenerate</button>
          </div>
          {blueprint.scenes.map((s, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-2">
              <div className="text-xs font-semibold text-gray-400">SCENE {i + 1} · {s.kind}</div>
              <input className="w-full border rounded px-2 py-1.5 font-medium" value={s.headline}
                onChange={(e) => updateScene(i, 'headline', e.target.value)} placeholder="Headline" />
              <div className="grid grid-cols-2 gap-2">
                <input className="border rounded px-2 py-1.5 text-sm" value={s.highlight || ''}
                  onChange={(e) => updateScene(i, 'highlight', e.target.value)} placeholder="Highlight keyword" />
                <input className="border rounded px-2 py-1.5 text-sm" value={s.sub || ''}
                  onChange={(e) => updateScene(i, 'sub', e.target.value)} placeholder="Sub-headline" />
              </div>
              <label className="block text-xs font-medium text-gray-500 pt-1">Voiceover</label>
              <textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={3} value={s.narration}
                onChange={(e) => updateScene(i, 'narration', e.target.value)} />
              <div className="text-xs text-gray-400">Image plan: {s.image_prompt}</div>
            </div>
          ))}
          <button onClick={() => setStep('images')} className="px-6 py-2.5 rounded bg-blue-600 text-white font-medium">
            Approve script &amp; choose images
          </button>
        </div>
      )}

      {step === 'images' && blueprint && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Scene images <span className="text-sm font-normal text-gray-500">(upload your own, or leave for AI art)</span></h2>
          {blueprint.scenes.map((s, i) => (
            <div key={i} className="border rounded-lg p-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="text-xs font-semibold text-gray-400">SCENE {i + 1}</div>
                <div className="font-medium">{s.headline}</div>
                <div className="text-xs text-gray-400 mt-0.5">AI plan: {s.image_prompt?.slice(0, 90)}</div>
              </div>
              {imageNames[i]
                ? <span className="text-sm text-green-700">✓ {imageNames[i]} <button onClick={() => removeSceneImage(i)} className="text-red-500 underline ml-2">remove</button></span>
                : <label className="cursor-pointer px-4 py-2 border rounded text-sm hover:bg-gray-50">
                    Upload image
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                      onChange={(e) => uploadSceneImage(i, e.target.files?.[0])} />
                  </label>}
            </div>
          ))}
          <div className="flex gap-3 items-center">
            <button onClick={() => setStep('review')} className="px-5 py-2.5 rounded border">Back</button>
            <button disabled={busy} onClick={startBuild} className="px-6 py-2.5 rounded bg-green-600 text-white font-medium disabled:opacity-50">
              {busy ? 'Starting build…' : `Approve & build video${costPreview() ? ` (~$${costPreview().usd.toFixed(2)})` : ''}`}
            </button>
          </div>
          {costPreview() && (
            <p className="text-xs text-gray-400">
              Estimated AI cost ~${costPreview().usd.toFixed(2)} (≈₹{costPreview().inr}). Uploading your own scene images lowers it.
            </p>
          )}
        </div>
      )}

      {step === 'build' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Building your video</h2>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div className="bg-blue-600 h-3 rounded-full transition-all" style={{ width: `${buildJob?.percent || 1}%` }} />
          </div>
          <p className="text-sm text-gray-500">{buildJob?.stage || 'Queued…'} — {buildJob?.detail || ''}</p>
          {buildEstimate && (
            <p className="text-xs text-gray-400">
              Estimated AI cost ${buildEstimate.usd.toFixed(3)} (≈₹{buildEstimate.inr}) · per-video budget ₹{buildEstimate.budgetInr}
            </p>
          )}
          <p className="text-xs text-gray-400">Voiceover → artwork → render → final encode. A 60-second video takes a few minutes.</p>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Your video is ready</h2>
          {videoUrl && <video src={videoUrl} controls className="w-full rounded-lg border" />}
          <div>
            {videoUrl && <a href={videoUrl} download className="px-6 py-2.5 rounded bg-blue-600 text-white font-medium inline-block">Download MP4</a>}
            <button onClick={() => { setStep('setup'); setBlueprint(null); setImageKeys({}); setImageNames({}); setVideoUrl(''); }}
              className="ml-3 px-5 py-2.5 rounded border">Make another</button>
          </div>
        </div>
      )}
    </div>
  );
}
