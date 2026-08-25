import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BookOpen,
  Package,
  Users,
  Activity,
  ArrowUpRight,
  Sparkles,
  Palette,
  BarChart3,
  CheckCircle2,
  Clock3,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import { fetchScormData, peekScormData } from '../../services/scormDataCache';

const StatCard = ({ label, value, icon: Icon, tone = 'neutral', loading = false }) => (
  <div className={`scorm-metric-card scorm-metric-${tone}`}>
    <div className="flex items-start justify-between gap-4">
      <div>
        {loading ? (
          <div className="h-8 w-14 rounded-md bg-current/10 animate-pulse" aria-label={`Loading ${label}`} />
        ) : (
          <div className="scorm-metric-value">{value}</div>
        )}
        <div className="scorm-metric-label">{label}</div>
      </div>
      <div className="scorm-metric-icon">
        <Icon size={17} strokeWidth={2} />
      </div>
    </div>
  </div>
);

const ListSkeleton = () => (
  <div className="scorm-course-row grid grid-cols-[1fr_auto] md:grid-cols-[1fr_90px_155px_auto] gap-4 items-center animate-pulse" aria-hidden="true">
    <div>
      <div className="h-3.5 w-2/3 rounded bg-current/10" />
      <div className="h-2.5 w-1/3 rounded bg-current/10 mt-2" />
    </div>
    <div className="hidden md:block h-4 w-8 rounded bg-current/10" />
    <div className="hidden md:block h-2 w-full rounded bg-current/10" />
    <div className="h-4 w-4 rounded bg-current/10" />
  </div>
);

export default function ScormHome() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [courses, setCourses] = useState([]);
  const [tracking, setTracking] = useState({ overview: {}, courses: [], learners: [] });
  const [error, setError] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return navigate('/login');
    let mounted = true;
    const headers = { Authorization: `Bearer ${token}` };

    const cachedPackages = peekScormData('packages', token);
    const cachedCourses = peekScormData('courses', token);
    const cachedTracking = peekScormData('tracking-summary', token);
    const cachedFeatures = peekScormData('features', token);

    if (cachedPackages) setPackages(Array.isArray(cachedPackages) ? cachedPackages : []);
    if (cachedCourses) setCourses(Array.isArray(cachedCourses) ? cachedCourses : []);
    if (cachedTracking) setTracking(cachedTracking || { overview: {}, courses: [], learners: [] });
    if (cachedFeatures) setAiEnabled(!!cachedFeatures?.scormAiAuthor);
    if (cachedPackages && cachedCourses && cachedTracking) setLoading(false);

    Promise.all([
      fetchScormData('packages', token, () => axios.get(apiUrl('/api/scorm/packages'), { headers }).then((res) => res.data || [])),
      fetchScormData('courses', token, () => axios.get(apiUrl('/api/scorm/courses'), { headers }).then((res) => res.data || [])),
      fetchScormData('tracking-summary', token, () => axios.get(apiUrl('/api/scorm/tracking/summary'), { headers }).then((res) => res.data || { overview: {}, courses: [], learners: [] }))
        .catch(() => peekScormData('tracking-summary', token) || { overview: {}, courses: [], learners: [] }),
      fetchScormData('features', token, () => axios.get(apiUrl('/api/scorm/features')).then((res) => res.data || {}))
        .catch(() => peekScormData('features', token) || {})
    ])
      .then(([packageData, courseData, trackingData, featureData]) => {
        if (!mounted) return;
        setPackages(Array.isArray(packageData) ? packageData : []);
        setCourses(Array.isArray(courseData) ? courseData : []);
        setTracking(trackingData || { overview: {}, courses: [], learners: [] });
        setAiEnabled(!!featureData?.scormAiAuthor);
        setError(null);
      })
      .catch((err) => mounted && setError(err.response?.data?.message || err.message))
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, [token, navigate]);

  const overview = tracking.overview || {};
  const recentLearners = (tracking.learners || []).slice(0, 5);
  const averageProgress = Number(overview.averageProgress || 0);

  return (
    <div className="p-4 md:p-7 lg:p-8 max-w-[1440px] mx-auto">
      <section className="scorm-page-hero mb-6 md:mb-7">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="scorm-eyebrow">Create · manage · track · improve</span>
              <span className={`scorm-health-pill ${!loading && aiEnabled ? 'is-online' : ''}`}>
                <span className="scorm-health-dot" /> {loading ? 'Loading workspace' : aiEnabled ? 'AI author online' : 'Core LMS online'}
              </span>
            </div>
            <h2 className="scorm-display"><span>Learning</span> <span className="wb-accent">Workbench</span></h2>
            <p className="mt-3 text-sm md:text-[15px] max-w-2xl">
              Create courses, publish SCORM learning and see learner progress from one operating view.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link to="/scorm/tracking" className="scorm-button-secondary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold">
              <Activity size={15} /> Learner progress
            </Link>
            <Link to="/scorm/author" className="scorm-button-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold">
              <Sparkles size={15} /> Create course
            </Link>
          </div>
        </div>
      </section>

      {error && <div className="scorm-alert scorm-alert-danger mb-5">{error}</div>}
      {!loading && !aiEnabled && !error && (
        <div className="scorm-alert scorm-alert-info mb-5">
          AI Author is currently unavailable. Package upload, delivery and learner tracking remain available.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        <StatCard label="Courses" value={courses.length} icon={BookOpen} tone="violet" loading={loading} />
        <StatCard label="Packages" value={packages.length} icon={Package} tone="cyan" loading={loading} />
        <StatCard label="Learners" value={overview.learners || 0} icon={Users} tone="neutral" loading={loading} />
        <StatCard label="In progress" value={overview.inProgress || 0} icon={Clock3} tone="amber" loading={loading} />
        <StatCard label="Completed" value={overview.completed || 0} icon={CheckCircle2} tone="green" loading={loading} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_.85fr] gap-5">
        <section className="scorm-panel overflow-hidden">
          <div className="scorm-panel-header flex items-center justify-between gap-4">
            <div>
              <div className="scorm-eyebrow">Course portfolio</div>
              <h3 className="text-[18px] mt-1">Recent courses</h3>
            </div>
            <Link to="/scorm/courses" className="scorm-text-link flex items-center gap-1.5">View all <ArrowUpRight size={13} /></Link>
          </div>

          <div className="scorm-list">
            {loading && [0, 1, 2, 3].map((item) => <ListSkeleton key={item} />)}
            {!loading && courses.length === 0 && (
              <div className="p-10 text-center">
                <div className="scorm-empty-icon mx-auto mb-3"><BookOpen size={20} /></div>
                <div className="text-sm font-semibold">No courses yet</div>
                <div className="text-xs text-[#667085] mt-1">Create your first course when you are ready.</div>
              </div>
            )}
            {!loading && courses.slice(0, 6).map((course) => {
              const stats = (tracking.courses || []).find((row) => String(row.id) === String(course.id)) || {};
              const progress = Number(stats.averageProgress || 0);
              return (
                <Link key={course.id} to={`/scorm/courses/${course.id}`} className="scorm-course-row grid grid-cols-[1fr_auto] md:grid-cols-[1fr_90px_155px_auto] gap-4 items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="font-semibold text-[13px] truncate">{course.title}</div>
                      <span className={`scorm-status-pill ${course.status === 'published' ? 'is-published' : 'is-draft'}`}>{course.status || 'draft'}</span>
                    </div>
                    <div className="scorm-meta mt-1">{course.inviteCode || 'No invite code'}</div>
                  </div>
                  <div className="hidden md:block"><div className="font-semibold text-sm">{stats.learners || 0}</div><div className="scorm-meta mt-1">Learners</div></div>
                  <div className="hidden md:block">
                    <div className="flex items-center justify-between gap-2 text-[10px] text-[#667085] mb-1.5"><span>Progress</span><span className="font-semibold text-[#344054]">{progress.toFixed(0)}%</span></div>
                    <div className="scorm-progress-track"><div className="scorm-progress-fill" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>
                  </div>
                  <ChevronRight size={15} className="text-[#98A2B3]" />
                </Link>
              );
            })}
          </div>
        </section>

        <div className="space-y-5">
          <section className="scorm-progress-hero min-h-[270px] flex flex-col justify-between">
            <div className="flex items-start justify-between gap-4">
              <div><div className="scorm-progress-kicker">Learner pulse</div><h3 className="text-[22px] mt-1">Overall progress</h3></div>
              <div className="scorm-progress-icon"><Activity size={18} /></div>
            </div>
            <div>
              {loading ? <div className="h-14 w-28 rounded-lg bg-white/10 animate-pulse" /> : <div className="scorm-progress-number">{averageProgress.toFixed(0)}%</div>}
              <div className="mt-2 text-xs text-white/70">Average completion across active learner sessions.</div>
              <div className="scorm-progress-track is-dark mt-5"><div className="scorm-progress-fill is-light" style={{ width: loading ? '0%' : `${Math.max(0, Math.min(100, averageProgress))}%` }} /></div>
            </div>
          </section>

          <section className="scorm-panel overflow-hidden">
            <div className="scorm-panel-header flex items-center justify-between gap-3">
              <div className="font-semibold text-sm">Recent learner activity</div>
              <Link to="/scorm/tracking" className="scorm-text-link">Open tracking</Link>
            </div>
            <div className="scorm-list">
              {loading && [0, 1, 2].map((item) => <div key={item} className="scorm-activity-row animate-pulse"><div className="h-3.5 w-2/3 rounded bg-current/10" /><div className="h-2.5 w-1/2 rounded bg-current/10 mt-2" /></div>)}
              {!loading && recentLearners.length === 0 && <div className="p-6 text-center text-[#667085] text-xs">No learner activity yet.</div>}
              {!loading && recentLearners.map((row) => (
                <div key={row.id} className="scorm-activity-row">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-[12px] truncate">{row.learnerName || 'Learner'}</div>
                      <div className="text-[10px] text-[#667085] mt-0.5 truncate">{row.courseTitle || 'Course'} · {row.lastLocation || 'Not started'}</div>
                    </div>
                    <div className="scorm-activity-progress">{Number(row.progressPercent || 0).toFixed(0)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Link to="/scorm/author" className="scorm-action-card scorm-action-violet">
          <div className="scorm-action-icon"><Sparkles size={17} /></div><div className="font-semibold text-[15px] mt-5">AI Author</div><div className="text-xs text-[#667085] mt-1.5 leading-relaxed">Turn policy documents into structured learning while keeping editorial control.</div><div className="scorm-action-arrow"><ArrowUpRight size={15} /></div>
        </Link>
        <Link to="/scorm/visual-studio" className="scorm-action-card scorm-action-cyan">
          <div className="scorm-action-icon"><Palette size={17} /></div><div className="font-semibold text-[15px] mt-5">Content Editor</div><div className="text-xs text-[#667085] mt-1.5 leading-relaxed">Review and refine learner-visible course content before rebuilding and publishing.</div><div className="scorm-action-arrow"><ArrowUpRight size={15} /></div>
        </Link>
        <Link to="/scorm/reports" className="scorm-action-card scorm-action-green">
          <div className="scorm-action-icon"><BarChart3 size={17} /></div><div className="font-semibold text-[15px] mt-5">Reports</div><div className="text-xs text-[#667085] mt-1.5 leading-relaxed">Review completion, progress and learner performance without raw-data digging.</div><div className="scorm-action-arrow"><ArrowUpRight size={15} /></div>
        </Link>
      </div>
    </div>
  );
}
