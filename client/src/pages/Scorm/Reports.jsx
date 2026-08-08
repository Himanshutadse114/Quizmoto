import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

/**
 * SCORM World reports list — same structure as live-quiz Host/Reports:
 * list published/draft courses with summary stats + PDF / Excel download.
 */
export default function ScormReports() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingKey, setDownloadingKey] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    axios
      .get(apiUrl('/api/scorm/courses/reports/all'), {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((r) => setReports(r.data || []))
      .catch((err) => setMsg(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [token, navigate]);

  const downloadReport = async (course, format) => {
    if (!course?.id || downloadingKey) return;
    const key = `${course.id}-${format}`;
    setDownloadingKey(key);
    setMsg(null);
    try {
      const res = await axios.get(
        apiUrl(`/api/scorm/courses/${course.id}/report?format=${format}`),
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
          validateStatus: () => true
        }
      );
      if (res.status !== 200) {
        let message = 'Failed to generate report';
        try {
          const textBody = await res.data.text();
          const data = JSON.parse(textBody);
          if (data.message) message = data.message;
        } catch (_) {}
        setMsg(message);
        return;
      }
      const ext = format === 'pdf' ? 'pdf' : 'xlsx';
      const url = window.URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      const safe = String(course.title || 'SCORM_Course')
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .slice(0, 60);
      link.setAttribute('download', `Quizmoto_SCORM_${safe}.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setMsg(err.message || 'Report download failed');
    } finally {
      setDownloadingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8 relative z-10 text-white/50 text-sm font-medium">
        Loading SCORM reports…
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto relative z-10">
      <button
        onClick={() => navigate('/scorm')}
        className="text-sm text-white/60 hover:text-white mb-4"
      >
        ← SCORM World
      </button>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter">
            SCORM Reports
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Downloadable PDF and Excel for every published course — same structure as Live Quiz
            reports.
          </p>
        </div>
        <Link
          to="/reports"
          className="text-xs font-bold text-white/40 hover:text-white/70 underline"
        >
          Live quiz reports →
        </Link>
      </div>

      {msg && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-400/30 text-sm">
          {msg}
        </div>
      )}

      {reports.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
          <p className="text-white/40 font-bold">No SCORM courses yet</p>
          <p className="text-white/20 text-sm mt-1">
            Publish a course from SCORM World to see reports here.
          </p>
          <Link
            to="/scorm"
            className="inline-block mt-4 px-4 py-2 rounded-xl bg-quizmoto-yellow text-black text-xs font-black"
          >
            Open SCORM World
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <Link
                  to={`/scorm/courses/${c.id}`}
                  className="text-lg font-black hover:text-quizmoto-yellow break-words"
                >
                  {c.title}
                </Link>
                <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
                  <span
                    className={
                      c.status === 'published'
                        ? 'text-quizmoto-green'
                        : 'text-white/40'
                    }
                  >
                    {c.status}
                  </span>
                  {c.inviteCode && <span className="font-mono">code {c.inviteCode}</span>}
                  {c.packageTitle && <span>{c.packageTitle}</span>}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/60">
                  <span>
                    <strong className="text-white">{c.learnerCount ?? 0}</strong> learners
                  </span>
                  <span>
                    <strong className="text-white">{c.completedCount ?? 0}</strong> completed
                  </span>
                  {c.completionRate != null && (
                    <span>
                      <strong className="text-white">{c.completionRate}%</strong> completion
                    </span>
                  )}
                  {c.averageScore != null && (
                    <span>
                      avg score <strong className="text-white">{c.averageScore}</strong>
                    </span>
                  )}
                </div>
                {(c.publishedAt || c.updatedAt) && (
                  <div className="mt-1 text-[11px] text-white/30">
                    {c.publishedAt
                      ? `Published ${new Date(c.publishedAt).toLocaleString()}`
                      : `Updated ${new Date(c.updatedAt).toLocaleString()}`}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => downloadReport(c, 'pdf')}
                  disabled={!!downloadingKey}
                  className="px-4 py-2 rounded-xl bg-quizmoto-blue text-white text-xs font-black disabled:opacity-50 shadow-[0_3px_0_0_#0e4b94]"
                >
                  {downloadingKey === `${c.id}-pdf` ? '…' : 'PDF'}
                </button>
                <button
                  onClick={() => downloadReport(c, 'excel')}
                  disabled={!!downloadingKey}
                  className="px-4 py-2 rounded-xl bg-quizmoto-green text-white text-xs font-black disabled:opacity-50 shadow-[0_3px_0_0_#1a5e08]"
                >
                  {downloadingKey === `${c.id}-excel` ? '…' : 'Excel'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
