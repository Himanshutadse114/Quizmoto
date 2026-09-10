import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  Eye,
  Flame,
  MousePointerClick,
  RefreshCw,
  UsersRound
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import './flipbooks.css';
import './flipbookAnalytics.css';

const API = '/api/scorm/flipbooks';
const RANGES = [7, 30, 90, 365];

function durationLabel(seconds) {
  const value = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(value / 60);
  const remainder = Math.round(value % 60);
  if (minutes) return `${minutes}m ${remainder}s`;
  return `${remainder}s`;
}

function dateLabel(value) {
  if (!value) return '—';
  try { return new Date(value).toLocaleString(); } catch (_) { return '—'; }
}

function Metric({ icon: Icon, label, value, help }) {
  return (
    <div className="flip-analytics-metric">
      <div className="flip-analytics-icon"><Icon size={16} /></div>
      <div className="min-w-0">
        <div className="flip-kicker">{label}</div>
        <div className="flip-analytics-value">{value}</div>
        {help && <div className="flip-analytics-help">{help}</div>}
      </div>
    </div>
  );
}

function EmptyAnalytics() {
  return <div className="flip-empty-inline flip-analytics-empty">No reader activity is available for this period yet.</div>;
}

function LibraryAnalytics({ analytics }) {
  const summary = analytics?.summary || {};
  const trending = analytics?.trending || [];
  const readers = analytics?.topReaders || [];

  return (
    <>
      <div className="flip-analytics-grid">
        <Metric icon={BookOpenCheck} label="Flipbooks" value={summary.flipbooks || 0} />
        <Metric icon={UsersRound} label="Unique readers" value={summary.uniqueReaders || 0} help="One reader per email" />
        <Metric icon={Eye} label="Reading sessions" value={summary.sessions || 0} />
        <Metric icon={MousePointerClick} label="Page turns" value={summary.totalFlips || 0} help="Duplicate callbacks removed" />
        <Metric icon={CheckCircle2} label="Reader completion" value={`${summary.completionRate || 0}%`} help={`${summary.completedReaders || 0} readers completed`} />
        <Metric icon={Clock3} label="Avg. active time" value={durationLabel(summary.averageDurationSeconds)} help="Per reader" />
      </div>

      <section className="flip-analytics-panel">
        <div className="flip-section-heading">
          <div>
            <div className="flip-kicker"><Flame size={12} /> Trending</div>
            <h2>Trending flipbooks</h2>
            <p>Ranking prioritises unique readers, reader completion and reading depth. Repeat opens from one email do not inflate the ranking.</p>
          </div>
        </div>
        {trending.length ? (
          <div className="flip-analytics-table-wrap">
            <table className="flip-analytics-table">
              <thead><tr><th>Flipbook</th><th>Readers</th><th>Sessions</th><th>Page turns</th><th>Completion</th><th>Avg. active time</th><th>Trend</th><th /></tr></thead>
              <tbody>{trending.map((book, index) => (
                <tr key={book.id}>
                  <td><strong>#{index + 1} {book.title}</strong><span>{book.pageCount} pages · {book.lifetimeViews} lifetime reader opens</span></td>
                  <td>{book.uniqueReaders}</td>
                  <td>{book.sessions}</td>
                  <td>{book.flips}</td>
                  <td>{book.completionRate}%</td>
                  <td>{durationLabel(book.averageDurationSeconds)}</td>
                  <td><strong>{book.trendingScore}</strong></td>
                  <td><Link to={`/scorm/flipbooks/${book.id}/analytics`} className="flip-button-secondary">Details</Link></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyAnalytics />}
      </section>

      <section className="flip-analytics-panel">
        <div className="flip-section-heading">
          <div>
            <div className="flip-kicker"><UsersRound size={12} /> Readers</div>
            <h2>Reader engagement</h2>
            <p>Each email address appears once. Repeat opens are counted as sessions under the same reader.</p>
          </div>
        </div>
        {readers.length ? (
          <div className="flip-analytics-table-wrap">
            <table className="flip-analytics-table">
              <thead><tr><th>Reader</th><th>Flipbooks read</th><th>Sessions</th><th>Pages reached</th><th>Page turns</th><th>Active time</th><th>Completed</th><th>Last active</th></tr></thead>
              <tbody>{readers.map((reader) => (
                <tr key={reader.email}>
                  <td><strong>{reader.name || reader.email}</strong><span>{reader.email}</span></td>
                  <td>{reader.flipbooksRead || 0}</td>
                  <td>{reader.sessions}</td>
                  <td>{reader.uniquePagesViewed}</td>
                  <td>{reader.flips}</td>
                  <td>{durationLabel(reader.durationSeconds)}</td>
                  <td>{reader.completed ? 'Yes' : 'No'}</td>
                  <td>{dateLabel(reader.lastSeenAt)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyAnalytics />}
      </section>
    </>
  );
}

function SingleAnalytics({ analytics }) {
  const summary = analytics?.summary || {};
  const book = analytics?.book || {};
  const pages = analytics?.pageAnalytics || [];
  const readers = analytics?.readers || [];

  return (
    <>
      <div className="flip-analytics-book-title">
        <div>
          <div className="flip-kicker">Single flipbook analytics</div>
          <h2>{book.title || 'Flipbook'}</h2>
          <p>{book.pageCount || 0} pages · {book.lifetimeViews || 0} lifetime reader opens</p>
        </div>
      </div>

      <div className="flip-analytics-grid">
        <Metric icon={UsersRound} label="Unique readers" value={summary.uniqueReaders || 0} help="One reader per email" />
        <Metric icon={Eye} label="Reading sessions" value={summary.sessions || 0} />
        <Metric icon={MousePointerClick} label="Page turns" value={summary.totalFlips || 0} help="De-duplicated turns" />
        <Metric icon={CheckCircle2} label="Reader completion" value={`${summary.completionRate || 0}%`} help={`${summary.completedReaders || 0} of ${summary.uniqueReaders || 0} readers`} />
        <Metric icon={Clock3} label="Avg. active time" value={durationLabel(summary.averageDurationSeconds)} help="Per reader" />
        <Metric icon={BarChart3} label="Avg. reading depth" value={`${summary.averageDepthPercent || 0}%`} help={`${summary.averagePagesViewed || 0} pages per reader`} />
      </div>

      <section className="flip-analytics-panel">
        <div className="flip-section-heading">
          <div>
            <div className="flip-kicker"><BarChart3 size={12} /> Page performance</div>
            <h2>Where readers reached and stopped</h2>
            <p>Reach uses unique email identities. A page is counted once per reading session even if the reader turns back to it repeatedly.</p>
          </div>
        </div>
        {pages.length ? (
          <div className="flip-page-analytics-list">
            {pages.map((page) => (
              <div className="flip-page-analytics-row" key={page.page}>
                <div className="flip-page-analytics-label">
                  <strong>{page.label}</strong>
                  <span>{page.uniqueReaders} readers · {page.views} sessions reached · {page.exitReaders ?? page.exits ?? 0} reader exits</span>
                </div>
                <div className="flip-page-analytics-bar"><span style={{ width: `${Math.min(100, page.reachRate || 0)}%` }} /></div>
                <div className="flip-page-analytics-rate">{page.reachRate || 0}%</div>
              </div>
            ))}
          </div>
        ) : <EmptyAnalytics />}
      </section>

      <section className="flip-analytics-panel">
        <div className="flip-section-heading">
          <div>
            <div className="flip-kicker"><UsersRound size={12} /> Reader detail</div>
            <h2>Individual reader tracking</h2>
            <p>Every normalised email appears once. All of that reader's sessions are consolidated into this row.</p>
          </div>
        </div>
        {readers.length ? (
          <div className="flip-analytics-table-wrap">
            <table className="flip-analytics-table">
              <thead><tr><th>Reader</th><th>Sessions</th><th>Pages reached</th><th>Furthest page</th><th>Page turns</th><th>Active time</th><th>Completed</th><th>Devices</th><th>Last active</th></tr></thead>
              <tbody>{readers.map((reader) => (
                <tr key={reader.email}>
                  <td><strong>{reader.name || reader.email}</strong><span>{reader.email}</span></td>
                  <td>{reader.sessions}</td>
                  <td>{reader.uniquePagesViewed}</td>
                  <td>{reader.maxPageReached}</td>
                  <td>{reader.flips}</td>
                  <td>{durationLabel(reader.durationSeconds)}</td>
                  <td>{reader.completed ? 'Yes' : 'No'}</td>
                  <td>{Array.isArray(reader.devices) && reader.devices.length ? reader.devices.join(', ') : '—'}</td>
                  <td>{dateLabel(reader.lastSeenAt)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyAnalytics />}
      </section>
    </>
  );
}

export default function FlipbookAnalytics() {
  const { id } = useParams();
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [days, setDays] = useState(30);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const endpoint = id ? `${API}/${id}/analytics` : `${API}/analytics/library`;
      const res = await axios.get(apiUrl(endpoint), { headers, params: { days } });
      setAnalytics(res.data?.analytics || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load flipbook analytics.');
    } finally { setLoading(false); }
  }, [days, headers, id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flipbooks-page flip-analytics-page">
      <div className="flipbooks-header flip-analytics-header">
        <div>
          <Link to="/scorm/flipbooks" className="flip-analytics-back"><ArrowLeft size={13} /> Back to Flipbooks</Link>
          <div className="flip-kicker">Reader intelligence</div>
          <h1>{id ? 'Flipbook Analytics' : 'Library Analytics'}</h1>
          <p>{id ? 'Accurate reader-level engagement, page reach, page turns, completion and active reading time.' : 'Reader-level performance across your library with de-duplicated identities and page turns.'}</p>
        </div>
        <div className="flip-analytics-toolbar">
          <div className="flip-range-tabs">{RANGES.map((range) => <button key={range} type="button" onClick={() => setDays(range)} className={days === range ? 'is-active' : ''}>{range}d</button>)}</div>
          <button type="button" onClick={load} className="flip-button-secondary" disabled={loading}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh</button>
        </div>
      </div>
      {error && <div className="flip-error">{error}</div>}
      {loading ? <div className="flip-loading"><RefreshCw size={18} className="animate-spin" /><span>Loading analytics…</span></div> : analytics ? (id ? <SingleAnalytics analytics={analytics} /> : <LibraryAnalytics analytics={analytics} />) : <EmptyAnalytics />}
    </div>
  );
}
