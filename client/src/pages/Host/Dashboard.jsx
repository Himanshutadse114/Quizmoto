import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    BarChart3,
    BookOpenCheck,
    Download,
    Edit3,
    FileText,
    LayoutDashboard,
    LogOut,
    Menu,
    Plus,
    Play,
    Radio,
    Search,
    Trash2,
    X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import './quizmotoHostWorkbench.css';

const Dashboard = () => {
    const [quizzes, setQuizzes] = useState([]);
    const [activeSessions, setActiveSessions] = useState([]);
    const [actionMsg, setActionMsg] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { token, user, logout } = useAuth();
    const navigate = useNavigate();

    const API_BASE_URL = apiUrl('/api/quizzes');

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }
        fetchQuizzes();
        fetchActiveSessions();
    }, [token, navigate, API_BASE_URL]);

    const fetchQuizzes = async () => {
        try {
            const res = await axios.get(API_BASE_URL, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setQuizzes(res.data || []);
        } catch (err) {
            console.error(err);
            setActionMsg(err.response?.data?.message || 'Failed to load quizzes');
        }
    };

    const fetchActiveSessions = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/active-sessions`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setActiveSessions(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleStartGame = async (quizId) => {
        try {
            const res = await axios.post(`${API_BASE_URL}/${quizId}/start`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            navigate(`/host/lobby/${res.data.pin}`);
        } catch (err) {
            console.error(err);
            setActionMsg(err.response?.data?.message || 'Could not start game');
        }
    };

    const handleDelete = async (quizId) => {
        if (!window.confirm('Delete this quiz and all its game history? This cannot be undone.')) return;
        try {
            await axios.delete(`${API_BASE_URL}/${quizId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
            setActionMsg('Quiz deleted');
            fetchActiveSessions();
        } catch (err) {
            console.error(err);
            setActionMsg(err.response?.data?.message || 'Could not delete quiz. Try again after ending any active games.');
        }
    };

    const handleImportDefaults = async () => {
        try {
            await axios.post(`${API_BASE_URL}/import-defaults`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchQuizzes();
            setActionMsg('Cybersecurity quizzes imported successfully');
        } catch (err) {
            console.error(err);
            setActionMsg(err.response?.data?.message || 'Failed to import defaults');
        }
    };

    const totalQuestions = useMemo(
        () => quizzes.reduce((sum, quiz) => sum + (quiz.questions?.length || 0), 0),
        [quizzes]
    );

    const sortedQuizzes = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return [...quizzes]
            .filter((quiz) => !query || String(quiz.title || '').toLowerCase().includes(query))
            .sort((a, b) => {
                if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
                if (sortBy === 'az') return String(a.title || '').localeCompare(String(b.title || ''));
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
    }, [quizzes, searchQuery, sortBy]);

    const go = (path) => {
        setMobileMenuOpen(false);
        navigate(path);
    };

    const menuItems = [
        { label: 'Dashboard', icon: LayoutDashboard, active: true, action: () => setMobileMenuOpen(false) },
        { label: 'Create quiz', icon: Plus, action: () => go('/create-quiz') },
        { label: 'Reports', icon: FileText, action: () => go('/reports') },
        { label: 'SCORM AI', icon: BookOpenCheck, action: () => go('/scorm') },
        { label: 'Import defaults', icon: Download, action: handleImportDefaults }
    ];

    const navigation = (
        <>
            <div className="qh-nav-label">Host workspace</div>
            {menuItems.map(({ label, icon: Icon, active, action }) => (
                <button key={label} type="button" onClick={action} className={`qh-nav-button ${active ? 'is-active' : ''}`}>
                    <Icon size={16} /> {label}
                </button>
            ))}
        </>
    );

    return (
        <div className="quizmoto-host-workbench">
            <div className="qh-shell">
                <aside className="qh-sidebar">
                    <div className="qh-brand">
                        <div className="qh-brand-title">Quizmoto<span>!</span></div>
                        <div className="qh-brand-sub">Live quiz control desk</div>
                    </div>
                    <nav className="qh-nav">{navigation}</nav>
                    <div className="qh-sidebar-footer">
                        <div className="qh-host">
                            <div className="qh-host-name">{user?.username || user?.email || 'Host'}</div>
                            <div className="qh-host-label">Signed in as host</div>
                        </div>
                        <button type="button" onClick={logout} className="qh-nav-button" style={{ marginTop: 8 }}>
                            <LogOut size={16} /> Log out
                        </button>
                    </div>
                </aside>

                <div className="qh-mobilebar">
                    <div className="qh-mobile-brand">Quizmoto<span>!</span></div>
                    <button type="button" className="qh-mobile-menu-button" onClick={() => setMobileMenuOpen((open) => !open)} aria-label="Toggle host menu">
                        {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
                    </button>
                </div>
                {mobileMenuOpen && (
                    <div className="qh-mobile-drawer">
                        <nav className="qh-nav" style={{ paddingTop: 0 }}>{navigation}</nav>
                        <button type="button" onClick={logout} className="qh-nav-button" style={{ marginTop: 8 }}>
                            <LogOut size={16} /> Log out
                        </button>
                    </div>
                )}

                <main className="qh-main">
                    <section className="qh-hero">
                        <div>
                            <div className="qh-kicker">Live learning operations</div>
                            <h1 className="qh-title">Quizmoto Host</h1>
                            <p className="qh-subtitle">
                                Build quizzes, launch live sessions and move between Quizmoto and SCORM AI from one focused host workspace.
                            </p>
                        </div>
                        <button type="button" className="qh-primary" onClick={() => navigate('/create-quiz')}>
                            <Plus size={16} /> Create quiz
                        </button>
                    </section>

                    {actionMsg && (
                        <div className="qh-message">
                            <span>{actionMsg}</span>
                            <button type="button" onClick={() => setActionMsg(null)}>Dismiss</button>
                        </div>
                    )}

                    <section className="qh-metrics" aria-label="Quizmoto overview">
                        <div className="qh-metric">
                            <div><div className="qh-metric-value">{quizzes.length}</div><div className="qh-metric-label">Total quizzes</div></div>
                            <div className="qh-metric-icon"><BarChart3 size={16} /></div>
                        </div>
                        <div className="qh-metric">
                            <div><div className="qh-metric-value">{totalQuestions}</div><div className="qh-metric-label">Questions ready</div></div>
                            <div className="qh-metric-icon"><BookOpenCheck size={16} /></div>
                        </div>
                        <div className="qh-metric">
                            <div><div className="qh-metric-value">{activeSessions.length}</div><div className="qh-metric-label">Live sessions</div></div>
                            <div className="qh-metric-icon"><Radio size={16} /></div>
                        </div>
                    </section>

                    {activeSessions.length > 0 && (
                        <section className="qh-section">
                            <div className="qh-section-head">
                                <div>
                                    <div className="qh-section-kicker">Session operations</div>
                                    <div className="qh-section-title">Active sessions</div>
                                </div>
                                <span className="qh-live-dot" aria-label="Live" />
                            </div>
                            <div className="qh-session-list">
                                {activeSessions.map((session) => (
                                    <div className="qh-session" key={session.id}>
                                        <div>
                                            <div className="qh-session-title">{session.Quiz?.title || 'Live quiz'}</div>
                                            <div className="qh-meta" style={{ marginTop: 6 }}>Keep the host session open or rejoin after navigation.</div>
                                        </div>
                                        <div><div className="qh-row-label">Game PIN</div><div className="qh-row-value">{session.pin}</div></div>
                                        <div><div className="qh-row-label">Status</div><div className="qh-row-value">{session.status || 'live'}</div></div>
                                        <button
                                            type="button"
                                            className="qh-secondary"
                                            onClick={() => navigate(session.status === 'lobby' ? `/host/lobby/${session.pin}` : `/host/game/${session.pin}`)}
                                        >
                                            <Play size={13} /> Rejoin
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="qh-section">
                        <div className="qh-section-head">
                            <div>
                                <div className="qh-section-kicker">Quiz management</div>
                                <div className="qh-section-title">Quiz library</div>
                            </div>
                            <div className="qh-meta">{sortedQuizzes.length} shown</div>
                        </div>
                        <div className="qh-toolbar">
                            <div className="qh-search-wrap">
                                <Search size={15} />
                                <input
                                    className="qh-search"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder="Search quizzes by title"
                                />
                            </div>
                            <select className="qh-select" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                                <option value="newest">Newest first</option>
                                <option value="oldest">Oldest first</option>
                                <option value="az">A–Z title</option>
                            </select>
                        </div>

                        {sortedQuizzes.length > 0 ? (
                            <div className="qh-quiz-list">
                                {sortedQuizzes.map((quiz) => {
                                    const date = quiz.createdAt ? new Date(quiz.createdAt).toLocaleDateString() : '—';
                                    return (
                                        <article className="qh-quiz-row" key={quiz.id}>
                                            <div>
                                                <div className="qh-quiz-title">{quiz.title}</div>
                                                <div className="qh-status">Ready to host</div>
                                                <div className="qh-meta" style={{ marginTop: 8 }}>Created {date}</div>
                                            </div>
                                            <div><div className="qh-row-label">Questions</div><div className="qh-row-value">{quiz.questions?.length || 0}</div></div>
                                            <div><div className="qh-row-label">Mode</div><div className="qh-row-value">Live</div></div>
                                            <div className="qh-actions">
                                                <button type="button" className="qh-start" onClick={() => handleStartGame(quiz.id)}>
                                                    <Play size={12} fill="currentColor" /> Start
                                                </button>
                                                <button type="button" className="qh-icon-btn" onClick={() => navigate(`/edit-quiz/${quiz.id}`)} title="Edit quiz" aria-label={`Edit ${quiz.title}`}>
                                                    <Edit3 size={15} />
                                                </button>
                                                <button type="button" className="qh-icon-btn danger" onClick={() => handleDelete(quiz.id)} title="Delete quiz" aria-label={`Delete ${quiz.title}`}>
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="qh-empty">
                                <BookOpenCheck size={26} />
                                <div className="qh-empty-title">{quizzes.length ? 'No matching quizzes' : 'No quizzes yet'}</div>
                                <div className="qh-meta" style={{ marginTop: 10 }}>
                                    {quizzes.length ? 'Try another search.' : 'Create a quiz or import the starter cybersecurity set.'}
                                </div>
                                {!quizzes.length && (
                                    <button type="button" className="qh-primary" style={{ marginTop: 22 }} onClick={() => navigate('/create-quiz')}>
                                        <Plus size={15} /> Create first quiz
                                    </button>
                                )}
                            </div>
                        )}
                    </section>
                </main>
            </div>
        </div>
    );
};

export default Dashboard;
