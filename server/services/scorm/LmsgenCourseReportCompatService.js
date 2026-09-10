const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const ScormReportService = require('../ScormReportService');
const { ScormWorkspace } = require('../../models/scorm');

const execFileAsync = promisify(execFile);

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function artifactDir() {
    const dir = process.env.REPORT_ARTIFACTS_DIR || path.join(__dirname, '../../data/artifacts');
    ensureDir(dir);
    return dir;
}

function safeFilePart(value, fallback = 'Course') {
    return String(value || fallback)
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 100) || fallback;
}

function normaliseFormat(value) {
    const format = String(value || 'pdf').toLowerCase();
    if (!['pdf', 'excel'].includes(format)) {
        const err = new Error('Choose PDF or Excel.');
        err.status = 400;
        err.code = 'LMSGEN_REPORT_FORMAT_INVALID';
        throw err;
    }
    return format;
}

function percent(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? `${Math.max(0, Math.min(100, parsed))}%` : '—';
}

function displayScore(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : '—';
}

function learnerRows(course) {
    return (course.learners || []).map((learner) => ({
        learner: learner.learnerName || 'Learner',
        email: learner.learnerEmail || '',
        result: learner.result || learner.lessonStatus || learner.status || 'Not attempted',
        progress: learner.progressAvailable === false ? 'Unavailable' : percent(learner.progressPercent),
        score: displayScore(learner.score),
        learningTime: learner.totalTime || '—',
        questions: Number(learner.answerSummary?.captured || 0),
        correct: Number(learner.answerSummary?.correct || 0),
        lastActivity: learner.lastActivity || ''
    }));
}

async function workspaceMeta(workspaceId) {
    if (!workspaceId) return null;
    const workspace = await ScormWorkspace.findByPk(workspaceId, { attributes: ['id', 'name', 'status'] });
    if (!workspace) return null;
    return { id: workspace.id, name: workspace.name, status: workspace.status };
}

async function buildCourseReport({ courseId, hostId, workspaceId }) {
    const reports = await ScormReportService.listCourseReports(hostId);
    const course = reports.find((row) => String(row.id) === String(courseId));
    if (!course) {
        const err = new Error('Course not found.');
        err.status = 404;
        err.code = 'COURSE_NOT_FOUND';
        throw err;
    }

    const rows = learnerRows(course);
    const tenant = await workspaceMeta(workspaceId);
    return {
        schemaVersion: 'lmsgen-report-v2',
        reportType: 'course',
        generatedAt: new Date().toISOString(),
        tenant,
        title: `${course.title} — Course Report`,
        subtitle: `LMSGEN learning evidence · ${course.scormStandard || 'SCORM'} · ${String(course.status || '').replace(/_/g, ' ')}`,
        summary: [
            { label: 'Learners', value: Number(course.learnerCount || rows.length || 0) },
            { label: 'Completed', value: Number(course.completedCount || 0) },
            { label: 'In progress', value: Number(course.inProgressCount || 0) },
            { label: 'Completion', value: course.completionRate == null ? '—' : `${course.completionRate}%` },
            { label: 'Average score', value: course.averageScore == null ? '—' : course.averageScore }
        ],
        columns: [
            { key: 'learner', label: 'Learner' },
            { key: 'email', label: 'Email' },
            { key: 'result', label: 'Result' },
            { key: 'progress', label: 'Progress' },
            { key: 'score', label: 'Score' },
            { key: 'learningTime', label: 'Learning time' },
            { key: 'questions', label: 'Questions' },
            { key: 'correct', label: 'Correct' },
            { key: 'lastActivity', label: 'Last activity' }
        ],
        rows,
        emptyMessage: 'No learner activity has been recorded for this course yet.'
    };
}

async function runGenerator(report, format) {
    const kind = normaliseFormat(format);
    const dir = artifactDir();
    const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const jsonPath = path.join(dir, `lmsgen-course-${stamp}.json`);
    const extension = kind === 'pdf' ? 'pdf' : 'xlsx';
    const outputPath = path.join(dir, `lmsgen-course-${stamp}.${extension}`);
    const scriptPath = path.join(__dirname, '../../utils/generate_lmsgen_report.py');
    const candidates = [process.env.REPORT_PYTHON_CMD, '/usr/bin/python3', 'python3', 'python'].filter(Boolean);
    const env = { ...process.env, PYTHONUNBUFFERED: '1', HOME: process.env.HOME || dir };
    let lastError = null;

    fs.writeFileSync(jsonPath, JSON.stringify(report), 'utf8');
    try {
        for (const python of candidates) {
            try {
                await execFileAsync(python, [scriptPath, jsonPath, outputPath, kind], {
                    timeout: Number(process.env.REPORT_GEN_TIMEOUT_MS) || 60000,
                    windowsHide: true,
                    killSignal: 'SIGTERM',
                    env,
                    maxBuffer: 8 * 1024 * 1024
                });
                if (fs.existsSync(outputPath)) {
                    return {
                        outputPath,
                        downloadName: `LMSGEN_${safeFilePart(report.title.replace(/\s+[—-]\s+Course Report$/i, ''))}.${extension}`,
                        report
                    };
                }
                throw new Error('LMSGEN report generator did not create an output file.');
            } catch (err) {
                lastError = err;
                try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (_) {}
                if (err?.code === 'ENOENT') continue;
                break;
            }
        }
        const err = new Error(`LMSGEN report generation failed${lastError?.message ? `: ${lastError.message}` : '.'}`);
        err.status = 500;
        err.code = 'LMSGEN_REPORT_GENERATION_FAILED';
        throw err;
    } finally {
        try { if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath); } catch (_) {}
    }
}

async function generateCourseReportFile(options) {
    const report = await buildCourseReport(options);
    return runGenerator(report, options.format);
}

function safeUnlink(filePath) {
    try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
}

module.exports = {
    buildCourseReport,
    generateCourseReportFile,
    safeUnlink
};
