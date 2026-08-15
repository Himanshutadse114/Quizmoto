const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const { ScormRegistration, ScormCourse, ScormPackage } = require('../../models/scorm');
const LearningState = require('./ScormLearningStateService');
const { serializeRegistration } = require('./ScormProgressService');
const { extractInteractions, answerSummary } = require('./ScormInteractionReportService');
const { generateScormLearnerReport } = require('../../utils/scormLearnerReportGenerator');

const execFileAsync = promisify(execFile);

function operatorForTextSearch() {
    return sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;
}

function contentTypeFor(format) {
    return format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

function artifactsDir() {
    const dir = process.env.REPORT_ARTIFACTS_DIR || path.join(__dirname, '../../data/artifacts');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function safeUnlink(filePath) {
    if (!filePath) return;
    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (_) {}
}

function isCompletedStatus(value) {
    return ['completed', 'passed', 'failed'].includes(String(value || '').toLowerCase());
}

function learnerResult(registration) {
    const lesson = String(registration.lastLessonStatus || '').toLowerCase();
    const status = String(registration.status || '').toLowerCase();
    if (lesson === 'passed') return 'Passed';
    if (lesson === 'failed') return 'Failed';
    if (lesson === 'completed') return 'Completed';
    if (lesson === 'incomplete' || lesson === 'browsed') return 'In Progress';
    if (!lesson || lesson === 'not attempted' || lesson === 'not_attempted') {
        return ['launched', 'active', 'started', 'in_progress'].includes(status) ? 'In Progress' : 'Not Attempted';
    }
    return String(registration.lastLessonStatus || 'In Progress').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function searchLearners(hostId, query = '') {
    const q = String(query || '').trim().slice(0, 160);
    const textOp = operatorForTextSearch();
    const where = { isPreview: false };
    if (q) {
        where[Op.or] = [
            { learnerEmail: { [textOp]: `%${q}%` } },
            { learnerName: { [textOp]: `%${q}%` } }
        ];
    }

    const rows = await ScormRegistration.findAll({
        where,
        include: [{
            model: ScormCourse,
            as: 'course',
            required: true,
            where: { hostId, status: { [Op.ne]: 'archived' } },
            attributes: ['id']
        }],
        attributes: ['id', 'learnerEmail', 'learnerName', 'lastCommitAt', 'updatedAt', 'courseId'],
        order: [['updatedAt', 'DESC']],
        limit: q ? 250 : 100
    });

    const byEmail = new Map();
    rows.forEach((row) => {
        const email = String(row.learnerEmail || '').trim();
        if (!email) return;
        const key = email.toLowerCase();
        const current = byEmail.get(key) || {
            email,
            name: row.learnerName || 'Learner',
            courseIds: new Set(),
            latestActivity: null
        };
        current.courseIds.add(String(row.courseId));
        if ((!current.name || current.name === 'Learner') && row.learnerName) current.name = row.learnerName;
        const activity = row.lastCommitAt || row.updatedAt || null;
        const nextMs = activity ? new Date(activity).getTime() : 0;
        const prevMs = current.latestActivity ? new Date(current.latestActivity).getTime() : 0;
        if (nextMs > prevMs) current.latestActivity = activity;
        byEmail.set(key, current);
    });

    return Array.from(byEmail.values()).slice(0, 50).map((row) => ({
        email: row.email,
        name: row.name,
        courseCount: row.courseIds.size,
        latestActivity: row.latestActivity
    }));
}

async function loadLearnerRegistrations(hostId, email) {
    const normalized = String(email || '').trim();
    if (!normalized) {
        const err = new Error('Learner email is required');
        err.code = 'LEARNER_EMAIL_REQUIRED';
        throw err;
    }
    const textOp = operatorForTextSearch();
    const registrations = await ScormRegistration.findAll({
        where: {
            isPreview: false,
            learnerEmail: { [textOp]: normalized }
        },
        include: [{
            model: ScormCourse,
            as: 'course',
            required: true,
            where: { hostId, status: { [Op.ne]: 'archived' } },
            include: [{
                model: ScormPackage,
                as: 'package',
                required: false,
                attributes: ['id', 'title', 'status', 'standard', 'analysisJson']
            }]
        }],
        order: [['updatedAt', 'DESC']]
    });

    if (!registrations.length) {
        const err = new Error('Learner not found');
        err.code = 'LEARNER_NOT_FOUND';
        throw err;
    }

    const states = await LearningState.listByRegistrationIds(registrations.map((row) => row.id));
    registrations.forEach((row) => {
        const state = states.get(String(row.id)) || null;
        if (typeof row.setDataValue === 'function') row.setDataValue('learningStateV2', state);
        else row.learningStateV2 = state;
    });
    return registrations;
}

async function buildLearnerReport({ hostId, email }) {
    const registrations = await loadLearnerRegistrations(hostId, email);
    let learnerName = null;
    const attempts = registrations.map((registration) => {
        const course = registration.course;
        const state = typeof registration.getDataValue === 'function'
            ? registration.getDataValue('learningStateV2')
            : registration.learningStateV2;
        const serialized = serializeRegistration(registration, course);
        const interactions = extractInteractions({ state, packageRow: course?.package || null });
        const summary = answerSummary(interactions);
        if (!learnerName && registration.learnerName) learnerName = registration.learnerName;
        return {
            registrationId: registration.id,
            courseId: course?.id || registration.courseId,
            courseTitle: course?.title || 'Untitled course',
            packageTitle: course?.package?.title || null,
            scormStandard: course?.package?.standard || null,
            status: serialized.status,
            lessonStatus: serialized.lastLessonStatus,
            result: learnerResult(serialized),
            score: serialized.lastScoreRaw,
            totalTime: serialized.lastTotalTime,
            progressPercent: serialized.progressPercent,
            lastLocation: serialized.lastLocation,
            lastActivity: serialized.lastCommitAt || serialized.updatedAt,
            interactions,
            answerSummary: summary
        };
    });

    const scores = attempts
        .map((a) => a.score)
        .filter((value) => value !== null && value !== undefined && value !== '')
        .map(Number)
        .filter(Number.isFinite);
    const questionsCaptured = attempts.reduce((sum, a) => sum + Number(a.answerSummary.captured || 0), 0);
    const gradedQuestions = attempts.reduce((sum, a) => sum + Number(a.answerSummary.graded || 0), 0);
    const correctAnswers = attempts.reduce((sum, a) => sum + Number(a.answerSummary.correct || 0), 0);

    return {
        learnerEmail: String(registrations[0].learnerEmail || email).trim(),
        learnerName: learnerName || 'Learner',
        generatedAt: new Date().toISOString(),
        summary: {
            courseCount: attempts.length,
            completedCount: attempts.filter((a) => isCompletedStatus(a.lessonStatus)).length,
            averageScore: scores.length ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100 : null,
            questionsCaptured,
            gradedQuestions,
            correctAnswers,
            answerAccuracy: gradedQuestions ? Math.round((correctAnswers / gradedQuestions) * 1000) / 10 : null
        },
        attempts
    };
}

async function tryPythonLearnerReport({ report, jsonPath, outputPath, format, dir }) {
    const scriptPath = path.join(__dirname, '../../utils/generate_scorm_learner_report_clean.py');
    if (!fs.existsSync(scriptPath)) throw new Error(`SCORM learner Python report script missing: ${scriptPath}`);

    fs.writeFileSync(jsonPath, JSON.stringify(report));
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
        if (!fs.existsSync(env.MPLCONFIGDIR)) fs.mkdirSync(env.MPLCONFIGDIR, { recursive: true });
        if (!fs.existsSync(env.REPORT_CHART_DIR)) fs.mkdirSync(env.REPORT_CHART_DIR, { recursive: true });
    } catch (_) {}

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
            if (stderr && String(stderr).trim()) console.error('[scorm-learner-report] python stderr:', String(stderr).slice(0, 3000));
            if (stdout && String(stdout).trim()) console.log('[scorm-learner-report] python stdout:', String(stdout).slice(0, 500));
            if (!fs.existsSync(outputPath)) throw new Error('SCORM learner Python generator did not create output file');
            return;
        } catch (err) {
            lastErr = err;
            safeUnlink(outputPath);
            console.error('[scorm-learner-report] python attempt failed', {
                pyCmd,
                message: err?.message,
                code: err?.code,
                stderr: err?.stderr ? String(err.stderr).slice(0, 2000) : null
            });
            if (err && err.code === 'ENOENT') continue;
            break;
        }
    }
    throw lastErr || new Error('SCORM learner Python report generation failed');
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
    const jsonPath = path.join(dir, `scorm_learner_${safeEmail}_${timestamp}.json`);

    const forceNode = ['1', 'true', 'yes', 'on'].includes(String(process.env.REPORT_FORCE_NODE || '').toLowerCase());
    const skipPython = forceNode || ['1', 'true', 'yes', 'on'].includes(String(process.env.REPORT_SKIP_PYTHON || '').toLowerCase());
    let engine = null;
    let lastErr = null;

    if (!skipPython) {
        try {
            await tryPythonLearnerReport({ report, jsonPath, outputPath, format, dir });
            engine = 'python';
            console.log('[scorm-learner-report] used branded Python report', { email: safeEmail, format });
        } catch (err) {
            lastErr = err;
            safeUnlink(outputPath);
            console.error('[scorm-learner-report] Python failed, falling back to Node', {
                email: safeEmail,
                format,
                message: err?.message
            });
        }
    }

    if (!engine) {
        try {
            await generateScormLearnerReport(report, outputPath, format);
            if (!fs.existsSync(outputPath)) throw new Error('Learner Node fallback did not create output file');
            engine = 'node';
            console.log('[scorm-learner-report] used Node fallback report', { email: safeEmail, format });
        } catch (err) {
            lastErr = err;
        }
    }

    safeUnlink(jsonPath);
    if (!engine || !fs.existsSync(outputPath)) {
        const err = new Error('Learner report generation failed');
        err.code = 'REPORT_GEN_FAILED';
        err.cause = lastErr;
        throw err;
    }

    return {
        outputPath,
        format,
        contentType: contentTypeFor(format),
        downloadName: `SCORM_AI_Learner_${safeEmail}${ext}`,
        engine
    };
}

module.exports = {
    searchLearners,
    loadLearnerRegistrations,
    buildLearnerReport,
    tryPythonLearnerReport,
    generateLearnerReportFile,
    safeUnlink
};