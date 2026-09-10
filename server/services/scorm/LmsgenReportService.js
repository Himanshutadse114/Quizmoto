const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { Op } = require('sequelize');
const Flipbook = require('../../models/Flipbook');
const FlipbookTenantLink = require('../../models/FlipbookTenantLink');
const FlipbookReaderSession = require('../../models/FlipbookReaderSession');
const FlipbookReaderContext = require('../../models/FlipbookReaderContext');
const {
    ScormCourse,
    ScormRegistration,
    ScormCampaign,
    ScormWorkspace,
    ScormWorkspaceMember
} = require('../../models/scorm');
const ScormReportService = require('../ScormReportService');
const { listCampaigns } = require('./ScormCampaignListService');
const { listTenants } = require('./ScormTenantService');
const {
    ensureFlipbookAssignmentSchema,
    campaignFlipbooks,
    listAssignmentAnalytics
} = require('./ScormFlipbookAssignmentService');
const { ensureFlipbookTenantSchema } = require('../FlipbookTenantService');

const execFileAsync = promisify(execFile);
const REPORT_TYPES = Object.freeze(['overview', 'courses', 'learners', 'campaigns', 'flipbooks', 'assignments', 'tenants']);

function normaliseEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function safeType(value) {
    const type = String(value || 'overview').trim().toLowerCase();
    return REPORT_TYPES.includes(type) ? type : 'overview';
}

function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function percent(value, total) {
    return total > 0 ? Math.round((number(value) / number(total)) * 1000) / 10 : 0;
}

function durationLabel(seconds) {
    const total = Math.max(0, Math.round(number(seconds)));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours) return `${hours}h ${minutes}m`;
    if (minutes) return `${minutes}m ${secs}s`;
    return `${secs}s`;
}

function dateLabel(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

async function workspaceMeta(workspaceId) {
    if (!workspaceId) return null;
    const workspace = await ScormWorkspace.findByPk(workspaceId);
    if (!workspace) return null;
    const members = await ScormWorkspaceMember.count({ where: { workspaceId } });
    return {
        id: workspace.id,
        name: workspace.name,
        status: workspace.status,
        staff: members
    };
}

async function tenantFlipbooks(workspaceId) {
    await ensureFlipbookTenantSchema();
    if (!workspaceId) return [];
    const links = await FlipbookTenantLink.findAll({ where: { workspaceId }, attributes: ['flipbookId'], raw: true });
    const ids = links.map((row) => row.flipbookId);
    if (!ids.length) return [];
    return Flipbook.findAll({ where: { id: { [Op.in]: ids } }, order: [['updatedAt', 'DESC']] });
}

async function flipbookStats(books) {
    const ids = books.map((book) => book.id);
    const sessions = ids.length ? await FlipbookReaderSession.findAll({
        where: { flipbookId: { [Op.in]: ids } },
        attributes: ['flipbookId', 'readerEmail', 'durationSeconds', 'uniquePages', 'completedAt', 'lastSeenAt'],
        raw: true
    }) : [];
    const map = new Map();
    books.forEach((book) => map.set(String(book.id), []));
    sessions.forEach((session) => {
        const key = String(session.flipbookId);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(session);
    });
    return books.map((book) => {
        const rows = map.get(String(book.id)) || [];
        const readers = new Set(rows.map((row) => normaliseEmail(row.readerEmail)).filter(Boolean));
        const completedReaders = new Set(rows.filter((row) => row.completedAt).map((row) => normaliseEmail(row.readerEmail)).filter(Boolean));
        const activeSeconds = rows.reduce((sum, row) => sum + number(row.durationSeconds), 0);
        const pagesReached = rows.reduce((sum, row) => sum + (Array.isArray(row.uniquePages) ? row.uniquePages.length : 0), 0);
        return {
            id: book.id,
            title: book.title,
            status: book.status,
            pages: number(book.pageCount),
            readers: readers.size,
            sessions: rows.length,
            completion: percent(completedReaders.size, readers.size),
            activeTime: durationLabel(activeSeconds),
            averagePagesPerSession: rows.length ? Math.round((pagesReached / rows.length) * 10) / 10 : 0,
            lifetimeOpens: number(book.viewCount),
            lastViewedAt: dateLabel(book.lastViewedAt)
        };
    });
}

function learnerMapFromCourses(courseReports) {
    const map = new Map();
    for (const course of courseReports || []) {
        for (const learner of course.learners || []) {
            const email = normaliseEmail(learner.learnerEmail);
            if (!email) continue;
            if (!map.has(email)) map.set(email, {
                email,
                name: learner.learnerName || 'Learner',
                courses: new Set(),
                completedCourses: new Set(),
                scores: [],
                flipbooks: new Set(),
                completedFlipbooks: new Set(),
                flipbookActiveSeconds: 0,
                lastActivityAt: null
            });
            const row = map.get(email);
            row.courses.add(String(course.id));
            if (['completed', 'passed', 'failed'].includes(String(learner.lessonStatus || '').toLowerCase())) row.completedCourses.add(String(course.id));
            if (learner.score !== null && learner.score !== undefined && Number.isFinite(Number(learner.score))) row.scores.push(Number(learner.score));
            const activity = learner.lastActivity ? new Date(learner.lastActivity) : null;
            if (activity && !Number.isNaN(activity.getTime()) && (!row.lastActivityAt || activity > row.lastActivityAt)) row.lastActivityAt = activity;
        }
    }
    return map;
}

function addFlipbookLearners(map, assignments) {
    for (const assignment of assignments || []) {
        const email = normaliseEmail(assignment.learnerEmail);
        if (!email) continue;
        if (!map.has(email)) map.set(email, {
            email,
            name: assignment.learnerName || 'Learner',
            courses: new Set(), completedCourses: new Set(), scores: [], flipbooks: new Set(), completedFlipbooks: new Set(), flipbookActiveSeconds: 0, lastActivityAt: null
        });
        const row = map.get(email);
        row.name = row.name === 'Learner' && assignment.learnerName ? assignment.learnerName : row.name;
        row.flipbooks.add(String(assignment.flipbookId));
        if (assignment.status === 'completed') row.completedFlipbooks.add(String(assignment.flipbookId));
        row.flipbookActiveSeconds += number(assignment.activeSeconds);
        const activity = assignment.lastActivityAt ? new Date(assignment.lastActivityAt) : null;
        if (activity && !Number.isNaN(activity.getTime()) && (!row.lastActivityAt || activity > row.lastActivityAt)) row.lastActivityAt = activity;
    }
}

function serialiseLearners(map) {
    return [...map.values()].map((row) => ({
        name: row.name,
        email: row.email,
        courses: row.courses.size,
        coursesCompleted: row.completedCourses.size,
        averageScore: row.scores.length ? Math.round((row.scores.reduce((sum, score) => sum + score, 0) / row.scores.length) * 10) / 10 : '',
        flipbooks: row.flipbooks.size,
        flipbooksCompleted: row.completedFlipbooks.size,
        flipbookActiveTime: durationLabel(row.flipbookActiveSeconds),
        lastActivity: row.lastActivityAt ? row.lastActivityAt.toISOString() : ''
    })).sort((a, b) => a.email.localeCompare(b.email));
}

async function buildWorkspaceData({ hostId, workspaceId }) {
    await ensureFlipbookAssignmentSchema();
    const [tenant, courseReports, campaignsResult, books, flipbookAssignments] = await Promise.all([
        workspaceMeta(workspaceId),
        ScormReportService.listCourseReports(hostId),
        workspaceId ? listCampaigns({ hostId, workspaceId }) : Promise.resolve({ campaigns: [] }),
        tenantFlipbooks(workspaceId),
        workspaceId ? listAssignmentAnalytics({ workspaceId }) : Promise.resolve([])
    ]);
    const bookStats = await flipbookStats(books);
    const campaigns = [];
    for (const campaign of campaignsResult.campaigns || []) {
        const linkedBooks = await campaignFlipbooks(campaign.id);
        const assignedFlipbooks = flipbookAssignments.filter((row) => String(row.campaignId) === String(campaign.id));
        campaigns.push({
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            learners: number(campaign.learnerCount),
            courses: number(campaign.courseCount),
            flipbooks: linkedBooks.length,
            learningItems: number(campaign.courseCount) + linkedBooks.length,
            courseCompletion: `${number(campaign.completionPercent)}%`,
            flipbookCompletion: `${percent(assignedFlipbooks.filter((row) => row.status === 'completed').length, assignedFlipbooks.length)}%`,
            dueAt: dateLabel(campaign.dueAt),
            startedAt: dateLabel(campaign.startedAt)
        });
    }
    const learners = learnerMapFromCourses(courseReports);
    addFlipbookLearners(learners, flipbookAssignments);
    return { tenant, courseReports, campaigns, books, bookStats, flipbookAssignments, learners: serialiseLearners(learners) };
}

function reportDefinition(type) {
    const definitions = {
        overview: {
            title: 'LMSGEN Learning Overview',
            subtitle: 'Current tenant learning, campaign and Flipbook performance',
            columns: [
                { key: 'area', label: 'Area' }, { key: 'items', label: 'Items' }, { key: 'learners', label: 'Learners' }, { key: 'completed', label: 'Completed' }, { key: 'engagement', label: 'Engagement' }
            ]
        },
        courses: {
            title: 'Course Performance Report',
            subtitle: 'Published and assigned course learning outcomes',
            columns: [
                { key: 'course', label: 'Course' }, { key: 'status', label: 'Status' }, { key: 'learners', label: 'Learners' }, { key: 'completed', label: 'Completed' }, { key: 'completion', label: 'Completion' }, { key: 'averageScore', label: 'Avg. score' }
            ]
        },
        learners: {
            title: 'Learner Learning Record',
            subtitle: 'Consolidated learner activity across courses and Flipbooks',
            columns: [
                { key: 'name', label: 'Learner' }, { key: 'email', label: 'Email' }, { key: 'courses', label: 'Courses' }, { key: 'coursesCompleted', label: 'Courses completed' }, { key: 'averageScore', label: 'Avg. score' }, { key: 'flipbooks', label: 'Flipbooks' }, { key: 'flipbooksCompleted', label: 'Flipbooks completed' }, { key: 'flipbookActiveTime', label: 'Flipbook time' }
            ]
        },
        campaigns: {
            title: 'Campaign Performance Report',
            subtitle: 'Campaign delivery across courses and Flipbooks',
            columns: [
                { key: 'name', label: 'Campaign' }, { key: 'status', label: 'Status' }, { key: 'learners', label: 'Learners' }, { key: 'courses', label: 'Courses' }, { key: 'flipbooks', label: 'Flipbooks' }, { key: 'courseCompletion', label: 'Course completion' }, { key: 'flipbookCompletion', label: 'Flipbook completion' }, { key: 'dueAt', label: 'Due' }
            ]
        },
        flipbooks: {
            title: 'Flipbook Engagement Report',
            subtitle: 'Reader reach, completion and active reading engagement',
            columns: [
                { key: 'title', label: 'Flipbook' }, { key: 'status', label: 'Status' }, { key: 'pages', label: 'Pages' }, { key: 'readers', label: 'Readers' }, { key: 'sessions', label: 'Sessions' }, { key: 'completion', label: 'Completion %' }, { key: 'activeTime', label: 'Active time' }, { key: 'lifetimeOpens', label: 'Lifetime opens' }
            ]
        },
        assignments: {
            title: 'Assignment Completion Report',
            subtitle: 'Course and Flipbook learner assignment evidence',
            columns: [
                { key: 'type', label: 'Type' }, { key: 'item', label: 'Learning item' }, { key: 'learner', label: 'Learner' }, { key: 'email', label: 'Email' }, { key: 'status', label: 'Status' }, { key: 'progress', label: 'Progress' }, { key: 'score', label: 'Score' }, { key: 'activeTime', label: 'Active time' }, { key: 'context', label: 'Context' }
            ]
        },
        tenants: {
            title: 'Tenant Platform Report',
            subtitle: 'Tenant capacity, learning usage and Flipbook controls',
            columns: [
                { key: 'name', label: 'Tenant' }, { key: 'status', label: 'Status' }, { key: 'admin', label: 'Admin' }, { key: 'courses', label: 'Courses' }, { key: 'learners', label: 'Learners' }, { key: 'staff', label: 'Staff' }, { key: 'campaigns', label: 'Campaigns' }, { key: 'assignments', label: 'Assignments' }, { key: 'flipbooks', label: 'Flipbooks' }
            ]
        }
    };
    return definitions[type] || definitions.overview;
}

function workspaceRows(type, data) {
    if (type === 'courses') return (data.courseReports || []).map((course) => ({
        course: course.title,
        status: course.status,
        learners: number(course.learnerCount),
        completed: number(course.completedCount),
        completion: course.completionRate === null || course.completionRate === undefined ? '' : `${course.completionRate}%`,
        averageScore: course.averageScore === null || course.averageScore === undefined ? '' : course.averageScore
    }));
    if (type === 'learners') return data.learners;
    if (type === 'campaigns') return data.campaigns;
    if (type === 'flipbooks') return data.bookStats;
    if (type === 'assignments') {
        const courseRows = (data.courseReports || []).flatMap((course) => (course.learners || []).map((learner) => ({
            type: 'Course', item: course.title, learner: learner.learnerName || 'Learner', email: learner.learnerEmail || '', status: learner.result || learner.lessonStatus || '', progress: learner.progressAvailable === false ? '' : `${number(learner.progressPercent)}%`, score: learner.score ?? '', activeTime: learner.totalTime || '', context: 'Direct learning'
        })));
        const flipbookRows = (data.flipbookAssignments || []).map((row) => ({
            type: 'Flipbook', item: row.flipbookTitle, learner: row.learnerName || 'Learner', email: row.learnerEmail, status: row.status, progress: `${row.progressPercent}%`, score: '', activeTime: durationLabel(row.activeSeconds), context: row.courseId ? 'Course-linked campaign' : row.campaignId ? 'Campaign' : 'Direct'
        }));
        return [...courseRows, ...flipbookRows];
    }
    if (type === 'overview') {
        const courseAssignments = (data.courseReports || []).reduce((sum, course) => sum + number(course.learnerCount), 0);
        const completedCourses = (data.courseReports || []).reduce((sum, course) => sum + number(course.completedCount), 0);
        const completedFlipbooks = (data.flipbookAssignments || []).filter((row) => row.status === 'completed').length;
        return [
            { area: 'Courses', items: data.courseReports.length, learners: data.learners.length, completed: completedCourses, engagement: `${percent(completedCourses, courseAssignments)}% completion` },
            { area: 'Campaigns', items: data.campaigns.length, learners: data.learners.length, completed: '', engagement: `${data.campaigns.filter((row) => row.status === 'active').length} active` },
            { area: 'Flipbooks', items: data.books.length, learners: new Set((data.flipbookAssignments || []).map((row) => normaliseEmail(row.learnerEmail)).filter(Boolean)).size, completed: completedFlipbooks, engagement: `${percent(completedFlipbooks, data.flipbookAssignments.length)}% assignment completion` }
        ];
    }
    return [];
}

function summaryFor(type, data, rows) {
    if (type === 'overview') return [
        { label: 'Courses', value: data.courseReports.length },
        { label: 'Learners', value: data.learners.length },
        { label: 'Campaigns', value: data.campaigns.length },
        { label: 'Flipbooks', value: data.books.length },
        { label: 'Flipbook assignments', value: data.flipbookAssignments.length }
    ];
    if (type === 'courses') return [{ label: 'Courses', value: rows.length }, { label: 'Learners', value: data.learners.length }];
    if (type === 'learners') return [{ label: 'Learners', value: rows.length }, { label: 'Courses', value: data.courseReports.length }, { label: 'Flipbooks', value: data.books.length }];
    if (type === 'campaigns') return [{ label: 'Campaigns', value: rows.length }, { label: 'Active', value: rows.filter((row) => row.status === 'active').length }];
    if (type === 'flipbooks') return [{ label: 'Flipbooks', value: rows.length }, { label: 'Readers', value: new Set(data.flipbookAssignments.map((row) => normaliseEmail(row.learnerEmail)).filter(Boolean)).size }];
    if (type === 'assignments') return [{ label: 'Assignments', value: rows.length }, { label: 'Flipbook assignments', value: data.flipbookAssignments.length }];
    return [];
}

async function tenantReportRows() {
    const tenants = await listTenants();
    const rows = [];
    for (const tenant of tenants) {
        const books = await tenantFlipbooks(tenant.id);
        rows.push({
            name: tenant.name,
            status: tenant.status,
            admin: tenant.admin?.email || '',
            courses: number(tenant.usage?.courses),
            learners: number(tenant.usage?.learners),
            staff: number(tenant.usage?.staff),
            campaigns: number(tenant.usage?.campaigns),
            assignments: number(tenant.usage?.assignments),
            flipbooks: books.length
        });
    }
    return rows;
}

async function buildReport({ type, hostId, workspaceId, isSuperAdmin = false }) {
    const reportType = safeType(type);
    if (reportType === 'tenants') {
        if (!isSuperAdmin) {
            const err = new Error('Super administrator access is required for the Tenant Platform Report.');
            err.status = 403;
            err.code = 'LMSGEN_REPORT_SUPER_ADMIN_REQUIRED';
            throw err;
        }
        const rows = await tenantReportRows();
        const definition = reportDefinition(reportType);
        return {
            schemaVersion: 'lmsgen-report-v2', reportType, generatedAt: new Date().toISOString(), tenant: null,
            ...definition,
            summary: [{ label: 'Tenants', value: rows.length }, { label: 'Active tenants', value: rows.filter((row) => row.status === 'active').length }],
            rows
        };
    }
    const data = await buildWorkspaceData({ hostId, workspaceId });
    const rows = workspaceRows(reportType, data);
    const definition = reportDefinition(reportType);
    return {
        schemaVersion: 'lmsgen-report-v2',
        reportType,
        generatedAt: new Date().toISOString(),
        tenant: data.tenant,
        ...definition,
        summary: summaryFor(reportType, data, rows),
        rows
    };
}

function artifactDir() {
    const dir = process.env.REPORT_ARTIFACTS_DIR || path.join(__dirname, '../../data/artifacts');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function safeFilePart(value) {
    return String(value || 'LMSGEN').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'LMSGEN';
}

async function generateReportFile({ type, format, hostId, workspaceId, isSuperAdmin = false }) {
    const kind = String(format || 'pdf').toLowerCase();
    if (!['pdf', 'excel'].includes(kind)) {
        const err = new Error('Choose PDF or Excel.');
        err.status = 400;
        err.code = 'LMSGEN_REPORT_FORMAT_INVALID';
        throw err;
    }
    const report = await buildReport({ type, hostId, workspaceId, isSuperAdmin });
    const dir = artifactDir();
    const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const jsonPath = path.join(dir, `lmsgen-report-${stamp}.json`);
    const extension = kind === 'pdf' ? 'pdf' : 'xlsx';
    const outputPath = path.join(dir, `lmsgen-report-${stamp}.${extension}`);
    fs.writeFileSync(jsonPath, JSON.stringify(report), 'utf8');
    const scriptPath = path.join(__dirname, '../../utils/generate_lmsgen_report.py');
    const candidates = [process.env.REPORT_PYTHON_CMD, '/usr/bin/python3', 'python3', 'python'].filter(Boolean);
    let lastError = null;
    try {
        for (const python of candidates) {
            try {
                await execFileAsync(python, [scriptPath, jsonPath, outputPath, kind], {
                    timeout: Number(process.env.REPORT_GEN_TIMEOUT_MS) || 60000,
                    windowsHide: true,
                    maxBuffer: 8 * 1024 * 1024,
                    env: { ...process.env, PYTHONUNBUFFERED: '1' }
                });
                if (!fs.existsSync(outputPath)) throw new Error('Report generator did not create an output file.');
                lastError = null;
                break;
            } catch (err) {
                lastError = err;
                if (err.code === 'ENOENT') continue;
                break;
            }
        }
        if (lastError || !fs.existsSync(outputPath)) throw lastError || new Error('No Python runtime is available for report generation.');
        return {
            outputPath,
            downloadName: `LMSGEN_${safeFilePart(report.reportType)}_${safeFilePart(report.tenant?.name || 'Platform')}.${extension}`,
            report
        };
    } finally {
        try { if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath); } catch (_) {}
    }
}

module.exports = {
    REPORT_TYPES,
    buildReport,
    generateReportFile
};
