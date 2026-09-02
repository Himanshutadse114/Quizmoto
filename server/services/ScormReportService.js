/**
 * SCORM AI course and learner reports (PDF / Excel).
 * Course reports keep the branded Python-first execution model with a Node fallback.
 * Individual learner reports are generated in Node so they can aggregate many courses.
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
const { extractInteractions, answerSummary } = require('./scorm/ScormInteractionReportService');
const { generateScormReportNode } = require('../utils/scormReportGenerator');
const { generateScormLearnerReport } = require('../utils/scormLearnerReportGenerator');

const execFileAsync = promisify(execFile);

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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
        if (['launched', 'active', 'started', 'in_progress'].includes(status)) return 'In Progress';
        return 'Not Attempted';
    }
    return String(registration.lastLessonStatus || registration.lessonStatus || 'In Progress')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function registrationState(registration) {
    if (!registration) return null;
    if (typeof registration.getDataValue === 'function') {
        return registration.getDataValue('learningStateV2') || registration.learningStateV2 || null;
    }
    return registration.learningStateV2 || null;
}

function enrichedRegistration(registration, course) {
    const serialized = serializeRegistration(registration, course);
    const interactions = extractInteractions({
        state: registrationState(registration),
        packageRow: course?.package || null
    });
    return {
        ...serialized,
        interactions,
        answerSummary: answerSummary(interactions)
    };
}

async function attachLearningState(courseOrCourses) {
    const courses = Array.isArray(courseOrCourses) ? courseOrCourses : [courseOrCourses].filter(Boolean);
    const registrations = courses.flatMap((course) => (
        Array.isArray(course?.registrations) ? course.registrations.filter((r) => !r.isPreview && !r.campaignId) : []
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
            .filter((r) => !r.isPreview && !r.campaignId)
            .map((r) => enrichedRegistration(r, course));
    } else {
        courseJson.registrations = (courseJson.registrations || []).filter((r) => !r.isPreview && !r.campaignId);
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
                // Course reports are direct-learning reports. Campaign reporting
                // is intentionally handled by Campaign Analytics instead.
                where: { isPreview: false, campaignId: null }
            }
        ]
    });
    if (course) await attachLearningState(course);
    return course;
}

/**
 * List host courses with direct-learning summary stats, learner rows and captured answers.
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
                where: { isPreview: false, campaignId: null },
                attributes: [
                    'id',
                    'campaignId',
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
                .filter((r) => !r.isPreview && !r.campaignId)
                .map((r) => enrichedRegistration(r, c));
            const completed = regs.filter((r) => isCompletedStatus(r.lastLessonStatus));
            const inProgress = regs.filter((r) => learnerResult(r) === 'In Progress');
            const notAttempted = regs.filter((r) => learnerResult(r) === 'Not Attempted');
            const withScore = regs.filter((r) => r.lastScoreRaw != null && !Number.isNaN(Number(r.lastScoreRaw)));
            const avgScore = withScore.length > 0
                ? Math.round((withScore.reduce((s, r) => s + Number(r.lastScoreRaw), 0) / withScore.length) * 100) / 100
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
                    lastActivity: r.lastCommitAt || r.updatedAt,
                    interactions: r.interactions || [],
                    answerSummary: r.answerSummary || answerSummary([])
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
                scope: 'direct_learning',
                learnerCount: regs.length,
                completedCount: completed.length,
                inProgressCount: inProgress.length,
                notAttemptedCount: notAttempted.length,
                averageScore: avgScore,
                completionRate: regs.length > 0 ? Math.round((completed.length / regs.length) * 1000) / 10 : null,
                learners
            };
        });
}

async function listLearners(hostId, query = '') {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    const reports = await listCourseReports(hostId);
    const byEmail = new Map();

    reports.forEach((course) => {
        (course.learners || []).forEach((learner) => {
            const email = String(learner.learnerEmail || '').trim();
            if (!email) return;
            const key = email.toLowerCase();
            const current = byEmail.get(key) || {
                email,
                name: learner.learnerName || 'Learner',
                courseIds: new Set(),
                latestActivity: null
            };
            current.courseIds.add(course.id);
            if ((!current.name || current.name === 'Learner') && learner.learnerName) current.name = learner.learnerName;
            const nextTime = learner.lastActivity ? new Date(learner.lastActivity).getTime() : 0;
            const currentTime = current.latestActivity ? new Date(current.latestActivity).getTime() : 0;
            if (nextTime > currentTime) current.latestActivity = learner.lastActivity;
            byEmail.set(key, current);
        });
    });

    return Array.from(byEmail.values())
        .filter((row) => !normalizedQuery || row.email.toLowerCase().includes(normalizedQuery) || String(row.name || '').toLowerCase().includes(normalizedQuery))
        .sort((a, b) => String(a.email).localeCompare(String(b.email)))
        .slice(0, 50)
        .map((row) => ({
            email: row.email,
            name: row.name,
            courseCount: row.courseIds.size,
            latestActivity: row.latestActivity
        }));
}

async function buildLearnerReport({ hostId, email }) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
        const err = new Error('Learner email is required');
        err.code = 'LEARNER_EMAIL_REQUIRED';
        throw err;
    }

    const courseReports = await listCourseReports(hostId);
    const attempts = [];
    let learnerName = null;

    courseReports.forEach((course) => {
        (course.learners || []).forEach((learner) => {
            if (String(learner.learnerEmail || '').trim().toLowerCase() !== normalizedEmail) return;
            if (!learnerName && learner.learnerName) learnerName = learner.learnerName;
            attempts.push({
                registrationId: learner.id,
                courseId: course.id,
                courseTitle: course.title,
                packageTitle: course.packageTitle,
                scormStandard: course.scormStandard,
                status: learner.status,
                lessonStatus: learner.lessonStatus,
                result: learner.result,
                score: learner.score,
                totalTime: learner.totalTime,
                progressPercent: learner.progressPercent,
                lastLocation: learner.lastLocation,
                lastActivity: learner.lastActivity,
                interactions: learner.interactions || [],
                answerSummary: learner.answerSummary || answerSummary([])
            });
        });
    });

    if (!attempts.length) {
        const err = new Error('Learner not found');
        err.code = 'LEARNER_NOT_FOUND';
        throw err;
    }

    attempts.sort((a, b) => new Date(b.lastActivity || 0).getTime() - new Date(a.lastActivity || 0).getTime());
    const scores = attempts.map((a) => Number(a.score)).filter(Number.isFinite);
    const questionsCaptured = attempts.reduce((sum, a) => sum + Number(a.answerSummary?.captured || 0), 0);
    const graded = attempts.reduce((sum, a) => sum + Number(a.answerSummary?.graded || 0), 0);
    const correctAnswers = attempts.reduce((sum, a) => sum + Number(a.answerSummary?.correct || 0), 0);

    return {
        learnerEmail: attempts[0] ? String(email).trim() : normalizedEmail,
        learnerName: learnerName || 'Learner',
        generatedAt: new Date().toISOString(),
        scope: 'direct_learning',
        summary: {
            courseCount: attempts.length,
            completedCount: attempts.filter((a) => isCompletedStatus(a.lessonStatus)).length,
            averageScore: scores.length ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100 : null,
            questionsCaptured,
            gradedQuestions: graded,
            correctAnswers,
            answerAccuracy: graded ? Math.round((correctAnswers / graded) * 1000) / 10 : null
        },
        attempts
    };
}

async function tryPythonGenerate(jsonPath, outputPath, format, dir, courseId) {
    const scriptPath = path.join(__dirname, '../utils/generate_scorm_report_clean.py');
    if (!fs.existsSync(scriptPath)) throw new Error('SCORM Python report script missing: ' + scriptPath);

    const candidates = [process.env.REPORT_PYTHON_CMD, '/usr/bin/python3', 'python3', 'python'].filter(Boolean);
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
            const { stdout, stderr } = await execFileAsync(pyCmd, [scriptPath, jsonPath, outputPath, format], {
                timeout: timeoutMs,
                windowsHide: true,
                killSignal: 'SIGTERM',
                env,
                maxBuffer: 8 * 1024 * 1024
            });
            if (stderr && String(stderr).trim()) console.error('[scorm-report] python stderr:', String(stderr).slice(0, 3000));
            if (stdout && String(stdout).trim()) console.log('[scorm-report] python stdout:', String(stdout).slice(0, 500));
            if (!fs.existsSync(outputPath)) throw new Error('SCORM Python generator did not create output file');
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
    const courseJson = learnerOnlyCourseJson(course);
    fs.writeFileSync(jsonPath, JSON.stringify(courseJson));

    const forceNode = ['1', 'true', 'yes', 'on'].includes(String(process.env.REPORT_FORCE_NODE || '').toLowerCase());
    const skipPython = forceNode || ['1', 'true', 'yes', 'on'].includes(String(process.env.REPORT_SKIP_PYTHON || '').toLowerCase());

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
            if (!fs.existsSync(outputPath)) throw new Error('SCORM Node generator did not create output file');
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

    const safeTitle = String(course.title || 'SCORM_Course').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 60);
    return {
        outputPath,
        format,
        contentType: contentTypeFor(format),
        downloadName: `SCORM_AI_${safeTitle}${ext}`,
        engine
    };
}

async function generateLearnerReportFile({ hostId, email, format = 'pdf' }) {
    if (!['pdf', 'excel'].includes(format)) {
        const err = new Error('Invalid format');
        err.code = 'INVALID_FORMAT';
        throw err;
    }

    const report = await buildLearnerReport({ hostId, email });
    const dir = artifactsDir();
    const timestamp = Date.now();
    const safeEmail = String(report.learnerEmail || 'learner').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 70);
    const ext = format === 'pdf' ? '.pdf' : '.xlsx';
    const outputPath = path.join(dir, `scorm_learner_${safeEmail}_${timestamp}${ext}`);
    await generateScormLearnerReport(report, outputPath, format);
    if (!fs.existsSync(outputPath)) {
        const err = new Error('Learner report generator did not create output file');
        err.code = 'REPORT_GEN_FAILED';
        throw err;
    }
    return {
        outputPath,
        format,
        contentType: contentTypeFor(format),
        downloadName: `SCORM_AI_Learner_${safeEmail}${ext}`,
        engine: 'node'
    };
}

module.exports = {
    listCourseReports,
    listLearners,
    buildLearnerReport,
    generateReportFile,
    generateLearnerReportFile,
    loadCourseForExport,
    learnerOnlyCourseJson,
    enrichedRegistration,
    attachLearningState,
    safeUnlink,
    contentTypeFor,
    learnerResult
};
