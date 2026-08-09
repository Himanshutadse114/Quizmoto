/**
 * SCORM World course reports (PDF / Excel).
 * Mirrors the live-quiz ReportGenerationService execution model:
 * primary branded Python report with a Node fallback.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const {
    ScormCourse,
    ScormPackage,
    ScormRegistration
} = require('../models/scorm');
const LearningState = require('./scorm/ScormLearningStateService');
const { serializeRegistration } = require('./scorm/ScormProgressService');
const { generateScormReportNode } = require('../utils/scormReportGenerator');

const execFileAsync = promisify(execFile);

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function artifactsDir() {
    if (process.env.REPORT_ARTIFACTS_DIR) {
        ensureDir(process.env.REPORT_ARTIFACTS_DIR);
        return process.env.REPORT_ARTIFACTS_DIR;
    }
    const dir = path.join(__dirname, '../data/artifacts');
    ensureDir(dir);
    return dir;
}

function contentTypeFor(format) {
    return format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

function safeUnlink(p) {
    if (!p) return;
    try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (_) {
        /* ignore */
    }
}

function isCompletedStatus(lessonStatus) {
    const s = String(lessonStatus || '').toLowerCase();
    return s === 'completed' || s === 'passed' || s === 'failed';
}

function learnerResult(registration) {
    const lesson = String(registration.lastLessonStatus || registration.lessonStatus || '').toLowerCase();
    const status = String(registration.status || '').toLowerCase();
    if (lesson === 'passed') return 'Passed';
    if (lesson === 'failed') return 'Failed';
    if (lesson === 'completed') return 'Completed';
    if (lesson === 'incomplete' || lesson === 'browsed') return 'In Progress';
    if (!lesson || lesson === 'not attempted' || lesson === 'not_attempted') {
        if (['launched', 'active', 'started', 'in_progress'].includes(status)) {
            return 'In Progress';
        }
        return 'Not Attempted';
    }
    return String(registration.lastLessonStatus || registration.lessonStatus || 'In Progress')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

async function attachLearningState(courseOrCourses) {
    const courses = Array.isArray(courseOrCourses) ? courseOrCourses : [courseOrCourses].filter(Boolean);
    const registrations = courses.flatMap((course) => (
        Array.isArray(course?.registrations) ? course.registrations.filter((r) => !r.isPreview) : []
    ));
    if (!registrations.length) return courseOrCourses;

    const states = await LearningState.listByRegistrationIds(registrations.map((r) => r.id));
    for (const reg of registrations) {
        const state = states.get(String(reg.id)) || null;
        if (typeof reg.setDataValue === 'function') reg.setDataValue('learningStateV2', state);
        else reg.learningStateV2 = state;
    }
    return courseOrCourses;
}

function learnerOnlyCourseJson(course) {
    const courseJson = course && typeof course.toJSON === 'function' ? course.toJSON() : { ...(course || {}) };
    const modelRegs = Array.isArray(course?.registrations) ? course.registrations : [];
    if (modelRegs.length) {
        courseJson.registrations = modelRegs
            .filter((r) => !r.isPreview)
            .map((r) => serializeRegistration(r, course));
    } else {
        courseJson.registrations = (courseJson.registrations || []).filter((r) => !r.isPreview);
    }
    return courseJson;
}

async function loadCourseForExport(courseId, hostId) {
    const course = await ScormCourse.findOne({
        where: { id: courseId, hostId },
        include: [
            {
                model: ScormPackage,
                as: 'package',
                attributes: ['id', 'title', 'status', 'entryHref', 'standard', 'source', 'analysisJson']
            },
            {
                model: ScormRegistration,
                as: 'registrations',
                required: false,
                where: { isPreview: false }
            }
        ]
    });
    if (course) await attachLearningState(course);
    return course;
}

/**
 * List host courses with summary stats and learner rows for the reports UI.
 */
async function listCourseReports(hostId) {
    const courses = await ScormCourse.findAll({
        where: { hostId },
        include: [
            {
                model: ScormPackage,
                as: 'package',
                attributes: ['id', 'title', 'status', 'standard', 'analysisJson']
            },
            {
                model: ScormRegistration,
                as: 'registrations',
                required: false,
                where: { isPreview: false },
                attributes: [
                    'id',
                    'learnerName',
                    'learnerEmail',
                    'status',
                    'isPreview',
                    'lastLessonStatus',
                    'lastScoreRaw',
                    'lastTotalTime',
                    'lastCommitAt',
                    'updatedAt'
                ]
            }
        ],
        order: [['updatedAt', 'DESC']]
    });

    await attachLearningState(courses);

    return courses
        .filter((c) => c.status !== 'archived')
        .filter((c) => !c.package || c.package.status !== 'deleted')
        .map((c) => {
            const regs = (c.registrations || [])
                .filter((r) => !r.isPreview)
                .map((r) => serializeRegistration(r, c));
            const completed = regs.filter((r) => isCompletedStatus(r.lastLessonStatus));
            const inProgress = regs.filter((r) => learnerResult(r) === 'In Progress');
            const notAttempted = regs.filter((r) => learnerResult(r) === 'Not Attempted');
            const withScore = regs.filter(
                (r) => r.lastScoreRaw != null && !Number.isNaN(Number(r.lastScoreRaw))
            );
            const avgScore =
                withScore.length > 0
                    ? Math.round(
                          (withScore.reduce((s, r) => s + Number(r.lastScoreRaw), 0) /
                              withScore.length) *
                              100
                      ) / 100
                    : null;
            const learners = regs
                .map((r) => ({
                    id: r.id,
                    learnerName: r.learnerName,
                    learnerEmail: r.learnerEmail,
                    status: r.status,
                    lessonStatus: r.lastLessonStatus,
                    result: learnerResult(r),
                    score: r.lastScoreRaw,
                    totalTime: r.lastTotalTime,
                    progressPercent: r.progressPercent,
                    progressAvailable: r.progressAvailable,
                    lastLocation: r.lastLocation,
                    lastActivity: r.lastCommitAt || r.updatedAt
                }))
                .sort((a, b) => {
                    const scoreA = a.score != null ? Number(a.score) : -1;
                    const scoreB = b.score != null ? Number(b.score) : -1;
                    return scoreB - scoreA;
                });

            return {
                id: c.id,
                title: c.title,
                description: c.description,
                inviteCode: c.inviteCode,
                status: c.status,
                publishedAt: c.publishedAt,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
                packageTitle: c.package ? c.package.title : null,
                scormStandard: c.package ? c.package.standard : null,
                learnerCount: regs.length,
                completedCount: completed.length,
                inProgressCount: inProgress.length,
                notAttemptedCount: notAttempted.length,
                averageScore: avgScore,
                completionRate:
                    regs.length > 0
                        ? Math.round((completed.length / regs.length) * 1000) / 10
                        : null,
                learners
            };
        });
}

async function tryPythonGenerate(jsonPath, outputPath, format, dir, courseId) {
    // Compact ReportLab performance panel avoids Matplotlib chart spacing/zero-bar issues.
    const scriptPath = path.join(__dirname, '../utils/generate_scorm_report_clean.py');
    if (!fs.existsSync(scriptPath)) {
        throw new Error('SCORM Python report script missing: ' + scriptPath);
    }

    const candidates = [
        process.env.REPORT_PYTHON_CMD,
        '/usr/bin/python3',
        'python3',
        'python'
    ].filter(Boolean);
    const timeoutMs = Number(process.env.REPORT_GEN_TIMEOUT_MS) || 60000;
    const env = {
        ...process.env,
        MPLCONFIGDIR: process.env.MPLCONFIGDIR || path.join(dir, '.mplconfig'),
        PYTHONUNBUFFERED: '1',
        HOME: process.env.HOME || dir,
        REPORT_CHART_DIR: process.env.REPORT_CHART_DIR || '/tmp/report_charts'
    };

    try {
        ensureDir(env.MPLCONFIGDIR);
        ensureDir(env.REPORT_CHART_DIR);
    } catch (_) {
        /* ignore */
    }

    let lastErr = null;
    for (const pyCmd of candidates) {
        try {
            const { stdout, stderr } = await execFileAsync(
                pyCmd,
                [scriptPath, jsonPath, outputPath, format],
                {
                    timeout: timeoutMs,
                    windowsHide: true,
                    killSignal: 'SIGTERM',
                    env,
                    maxBuffer: 8 * 1024 * 1024
                }
            );
            if (stderr && String(stderr).trim()) {
                console.error('[scorm-report] python stderr:', String(stderr).slice(0, 3000));
            }
            if (stdout && String(stdout).trim()) {
                console.log('[scorm-report] python stdout:', String(stdout).slice(0, 500));
            }
            if (!fs.existsSync(outputPath)) {
                throw new Error('SCORM Python generator did not create output file');
            }
            return;
        } catch (err) {
            lastErr = err;
            const msg = (err && (err.stderr || err.message)) || '';
            console.error('[scorm-report] python attempt failed', {
                courseId,
                pyCmd,
                message: err && err.message,
                code: err && err.code,
                stderr: msg ? String(msg).slice(0, 2000) : null
            });
            safeUnlink(outputPath);
            if (err && err.code === 'ENOENT') continue;
            break;
        }
    }

    throw lastErr || new Error('SCORM Python report generation failed');
}

async function generateReportFile({ courseId, hostId, format = 'pdf' }) {
    if (!['pdf', 'excel'].includes(format)) {
        const err = new Error('Invalid format');
        err.code = 'INVALID_FORMAT';
        throw err;
    }

    const course = await loadCourseForExport(courseId, hostId);
    if (!course) {
        const err = new Error('Course not found');
        err.code = 'COURSE_NOT_FOUND';
        throw err;
    }

    const dir = artifactsDir();
    const timestamp = Date.now();
    const safeId = String(course.id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 36);
    const ext = format === 'pdf' ? '.pdf' : '.xlsx';
    const jsonPath = path.join(dir, `scorm_report_${safeId}_${timestamp}.json`);
    const outputPath = path.join(dir, `scorm_report_${safeId}_${timestamp}${ext}`);
    // Defense in depth: even if an association/filter changes later, admin QA
    // registrations must never reach either report engine.
    const courseJson = learnerOnlyCourseJson(course);
    fs.writeFileSync(jsonPath, JSON.stringify(courseJson));

    const forceNode = ['1', 'true', 'yes', 'on'].includes(
        String(process.env.REPORT_FORCE_NODE || '').toLowerCase()
    );
    const skipPython = forceNode || ['1', 'true', 'yes', 'on'].includes(
        String(process.env.REPORT_SKIP_PYTHON || '').toLowerCase()
    );

    let generated = false;
    let engine = null;
    let lastErr = null;

    if (!skipPython) {
        try {
            await tryPythonGenerate(jsonPath, outputPath, format, dir, course.id);
            generated = true;
            engine = 'python';
            console.log('[scorm-report] used branded Python report', { courseId, format });
        } catch (err) {
            lastErr = err;
            console.error('[scorm-report] Python failed, falling back to Node', {
                courseId,
                format,
                message: err && err.message,
                stderr: err && err.stderr ? String(err.stderr).slice(0, 2000) : null
            });
            safeUnlink(outputPath);
        }
    }

    if (!generated) {
        try {
            await generateScormReportNode(courseJson, outputPath, format);
            if (!fs.existsSync(outputPath)) {
                throw new Error('SCORM Node generator did not create output file');
            }
            generated = true;
            engine = 'node';
            console.log('[scorm-report] used Node fallback report', { courseId, format });
        } catch (err) {
            lastErr = err;
            console.error('[scorm-report] Node fallback failed', {
                courseId,
                format,
                message: err && err.message,
                stack: err && err.stack ? String(err.stack).slice(0, 1500) : null
            });
        }
    }

    safeUnlink(jsonPath);

    if (!generated) {
        const wrapped = new Error('SCORM report generation failed');
        wrapped.code = 'REPORT_GEN_FAILED';
        wrapped.cause = lastErr;
        throw wrapped;
    }

    const safeTitle = String(course.title || 'SCORM_Course')
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .slice(0, 60);

    return {
        outputPath,
        format,
        contentType: contentTypeFor(format),
        downloadName: `Quizmoto_SCORM_${safeTitle}${ext}`,
        engine
    };
}

module.exports = {
    listCourseReports,
    generateReportFile,
    loadCourseForExport,
    learnerOnlyCourseJson,
    attachLearningState,
    safeUnlink,
    contentTypeFor
};
