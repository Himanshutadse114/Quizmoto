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
  Layers3,
  MousePointerClick,
  RefreshCw,
  UsersRound
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import './flipbooks.css';

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
      <div className="flip-analytics-icon"><Icon size={17} /></div>
      <div><div className="flip-kicker">{label}</div><div className="flip-analytics-value">{value}</div>{help && <div className="flip-analytics-help">{help}</div>}</div>
    </div>
  );
}

function EmptyAnalytics() {
  return <div className="flip-empty-inline" style={{ padding: '36px 18px' }}>No reader activity is available for this period yet.</div>;
}

function LibraryAnalytics({ analytics }) {
  const summary = analytics?.summary || {};
  const trending = analytics?.trending || [];
  const readers = analytics?.topReaders || [];
  const activity = analytics?.recentActivity || [];
  return (
    <>
      <div className="flip-analytics-grid">
        <Metric icon={BookOpenCheck} label="Flipbooks" value={summary.flipbooks || 0} />
        <Metric icon={UsersRound} label="Unique readers" value={summary.uniqueReaders || 0} />
        <Metric icon={Eye} label="Reader sessions" value={summary.sessions || 0} />
        <Metric icon={MousePointerClick} label="Page flips" value={summary.totalFlips || 0} />
        <Metric icon={CheckCircle2} label="Completion rate" value={`${summary.completionRate || 0}%`} />
        <Metric icon={Clock3} label="Average read time" value={durationLabel(summary.averageDurationSeconds)} />
      </div>

      <section className="flip-analytics-panel">
        <div className="flip-section-heading"><div><div className="flip-kicker"><Flame size={13} /> Trending</div><h2>Trending flipbooks</h2><p>Ranking combines unique readers, sessions, flips, completions and reading time in the selected period.</p></div></div>
        {trending.length ? <div className="flip-analytics-table-wrap"><table className="flip-analytics-table"><thead><tr><th>Flipbook</th><th>Readers</th><th>Sessions</th><th>Flips</th><th>Completion</th><th>Avg. time</th><th>Trend</th><th /></tr></thead><tbody>{trending.map((book, index) => <tr key={book.id}><td><strong>#{index + 1} {book.title}</strong><span>{book.pageCount} pages · {book.lifetimeViews} lifetime views</span></td><td>{book.uniqueReaders}</td><td>{book.sessions}</td><td>{book.flips}</td><td>{book.completionRate}%</td><td>{durationLabel(book.averageDurationSeconds)}</td><td><strong>{book.trendingScore}</strong></td><td><Link to={`/scorm/flipbooks/${book.id}/analytics`} className="flip-button-secondary">Details</Link></td></tr>)}</tbody></table></div> : <EmptyAnalytics />}
      </section>

      <section className="flip-analytics-panel">
        <div className="flip-section-heading"><div><div className="flip-kicker"><UsersRound size={13} /> Readers</div><h2>Reader engagement across your library</h2><p>See who returned, how far they read and whether they reached the end of any flipbook.</p></div></div>
        {readers.length ? <div className="flip-analytics-table-wrap"><table className="flip-analytics-table"><thead><tr><th>Reader</th><th>Sessions</th><th>Pages viewed</th><th>Max page</th><th>Flips</th><th>Time</th><th>Completed</th><th>Last active</th></tr></thead><tbody>{readers.map((reader) => <tr key={reader.email}><td><strong>{reader.name || reader.email}</strong><span>{reader.email}</span></td><td>{reader.sessions}</td><td>{reader.uniquePagesViewed}</td><td>{reader.maxPageReached}</td><td>{reader.flips}</td><td>{durationLabel(reader.durationSeconds)}</td><td>{reader.completed ? 'Yes' : 'No'}</td><td>{dateLabel(reader.lastSeenAt)}</td></tr>)}</tbody></table></div> : <EmptyAnalytics />}
      </section>

      <section className="flip-analytics-panel">
        <div className="flip-section-heading"><div><div className="flip-kicker"><Layers3 size={13} /> Activity</div><h2>Recent reading sessions</h2></div></div>
        {activity.length ? <div className="flip-analytics-table-wrap"><table className="flip-analytics-table"><thead><tr><th>Reader</th><th>Flipbook</th><th>Pages</th><th>Max page</th><th>Flips</th><th>Time</th><th>Device</th><th>Started</th></tr></thead><tbody>{activity.map((row) => <tr key={row.id}><td><strong>{row.name || row.email}</strong><span>{row.email}</span></td><td>{row.flipbookTitle}</td><td>{row.uniquePagesViewed}</td><td>{row.maxPageReached}</td><td>{row.flips}</td><td>{durationLabel(row.durationSeconds)}</td><td>{row.deviceType}</td><td>{dateLabel(row.startedAt)}</td></tr>)}</tbody></table></div> : <EmptyAnalytics />}
      </section>
    </>
  );
}

function SingleAnalytics({ analytics }) {
  const summary = analytics?.summary || {};
  const book = analytics?.book || {};
  const pages = analytics?.pageAnalytics || [];
  const readers = analytics?.readers || [];
  const sessions = analytics?.recentSessions || [];
  return (
    <>
      <div className="flip-analytics-book-title"><div><div className="flip-kicker">Single flipbook analytics</div><h2>{book.title || 'Flipbook'}</h2><p>{book.pageCount || 0} pages · {book.lifetimeViews || 0} lifetime reader opens</p></div></div>
      <div className="flip-analytics-grid">
        <Metric icon={UsersRound} label="Unique readers" value={summary.uniqueReaders || 0} />
        <Metric icon={Eye} label="Sessions" value={summary.sessions || 0} />
        <Metric icon={MousePointerClick} label="Page flips" value={summary.totalFlips || 0} />
        <Metric icon={CheckCircle2} label="Completion rate" value={`${summary.completionRate || 0}%`} help={`${summary.completedSessions || 0} completed sessions`} />
        <Metric icon={Clock3} label="Average read time" value={durationLabel(summary.averageDurationSeconds)} />
        <Metric icon={BarChart3} label="Average depth" value={`${summary.averageDepthPercent || 0}%`} help={`${summary.averagePagesViewed || 0} pages per session`} />
      </div>

      <section className="flip-analytics-panel">
        <div className="flip-section-heading"><div><div className="flip-kicker"><BarChart3 size={13} /> Page performance</div><h2>Where readers reached and stopped</h2><p>Reach shows the percentage of unique readers who opened each page. Exits show sessions whose last recorded page was that page.</p></div></div>
        {pages.length ? <div className="flip-page-analytics-list">{pages.map((page) => <div className="flip-page-analytics-row" key={page.page}><div className="flip-page-analytics-label"><strong>{page.label}</strong><span>{page.uniqueReaders} readers · {page.views} views · {page.exits} exits</span></div><div className="flip-page-analytics-bar"><span style={{ width: `${Math.min(100, page.reachRate || 0)}%` }} /></div><div className="flip-page-analytics-rate">{page.reachRate || 0}%</div></div>)}</div> : <EmptyAnalytics />}
      </section>

      <section className="flip-analytics-panel">
        <div className="flip-section-heading"><div><div className="flip-kicker"><UsersRound size={13} /> Reader detail</div><h2>Individual reader tracking</h2><p>Email is captured before the reader opens the publication, allowing engagement to be tied to a specific person.</p></div></div>
        {readers.length ? <div className="flip-analytics-table-wrap"><table className="flip-analytics-table"><thead><tr><th>Reader</th><th>Sessions</th><th>Unique pages</th><th>Max page</th><th>Flips</th><th>Total time</th><th>Completed</th><th>Last active</th></tr></thead><tbody>{readers.map((reader) => <tr key={reader.email}><td><strong>{reader.name || reader.email}</strong><span>{reader.email}</span></td><td>{reader.sessions}</td><td>{reader.uniquePagesViewed}</td><td>{reader.maxPageReached}</td><td>{reader.flips}</td><td>{durationLabel(reader.durationSeconds)}</td><td>{reader.completed ? 'Yes' : 'No'}</td><td>{dateLabel(reader.lastSeenAt)}</td></tr>)}</tbody></table></div> : <EmptyAnalytics />}
      </section>

      <section className="flip-analytics-panel">
        <div className="flip-section-heading"><div><div className="flip-kicker"><Layers3 size={13} /> Sessions</div><h2>Recent sessions</h2></div></div>
        {sessions.length ? <div className="flip-analytics-table-wrap"><table className="flip-analytics-table"><thead><tr><th>Reader</th><th>Pages viewed</th><th>Last page</th><th>Max page</th><th>Flips</th><th>Time</th><th>Device</th><th>Status</th></tr></thead><tbody>{sessions.map((session) => <tr key={session.id}><td><strong>{session.name || session.email}</strong><span>{session.email}<br />{dateLabel(session.startedAt)}</span></td><td>{session.uniquePagesViewed}</td><td>{session.lastPageReached}</td><td>{session.maxPageReached}</td><td>{session.flips}</td><td>{durationLabel(session.durationSeconds)}</td><td>{session.deviceType}</td><td>{session.completed ? 'Completed' : 'In progress / exited'}</td></tr>)}</tbody></table></div> : <EmptyAnalytics />}
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
      <div className="flipbooks-header">
        <div>
          <Link to="/scorm/flipbooks" className="flip-analytics-back"><ArrowLeft size={14} /> Back to Flipbooks</Link>
          <div className="flip-kicker">Reader intelligence</div>
          <h1>{id ? 'Flipbook Analytics' : 'Library Analytics'}</h1>
          <p>{id ? 'Track identified readers, page depth, flips, completion and reading time for this publication.' : 'See performance across every flipbook, identify trending publications and follow reader engagement across your library.'}</p>
        </div>
        <div className="flip-analytics-toolbar"><div className="flip-range-tabs">{RANGES.map((range) => <button key={range} type="button" onClick={() => setDays(range)} className={days === range ? 'is-active' : ''}>{range}d</button>)}</div><button type="button" onClick={load} className="flip-button-secondary" disabled={loading}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button></div>
      </div>
      {error && <div className="flip-error">{error}</div>}
      {loading ? <div className="flip-loading"><RefreshCw size={20} className="animate-spin" /><span>Loading analytics…</span></div> : analytics ? (id ? <SingleAnalytics analytics={analytics} /> : <LibraryAnalytics analytics={analytics} />) : <EmptyAnalytics />}
    </div>
  );
}
