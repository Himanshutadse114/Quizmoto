/**
 * SCORM World course reports (PDF / Excel).
 * Same download pattern as live-quiz ReportGenerationService.
 */

const fs = require('fs');
const path = require('path');
const {
    ScormCourse,
    ScormPackage,
    ScormRegistration
} = require('../models/scorm');
const { generateScormReportNode } = require('../utils/scormReportGenerator');

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

async function loadCourseForExport(courseId, hostId) {
    const course = await ScormCourse.findOne({
        where: { id: courseId, hostId },
        include: [
            {
                model: ScormPackage,
                as: 'package',
                attributes: ['id', 'title', 'status', 'entryHref', 'standard', 'source']
            },
            {
                model: ScormRegistration,
                as: 'registrations'
            }
        ]
    });
    return course;
}

/**
 * List host courses with summary stats for Reports page.
 */
async function listCourseReports(hostId) {
    const courses = await ScormCourse.findAll({
        where: { hostId },
        include: [
            {
                model: ScormPackage,
                as: 'package',
                attributes: ['id', 'title', 'status']
            },
            {
                model: ScormRegistration,
                as: 'registrations',
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

    return courses
        .filter((c) => c.status !== 'archived')
        .filter((c) => !c.package || c.package.status !== 'deleted')
        .map((c) => {
            const regs = (c.registrations || []).filter((r) => !r.isPreview);
            const completed = regs.filter((r) => isCompletedStatus(r.lastLessonStatus));
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
                learnerCount: regs.length,
                completedCount: completed.length,
                averageScore: avgScore,
                completionRate:
                    regs.length > 0
                        ? Math.round((completed.length / regs.length) * 1000) / 10
                        : null
            };
        });
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
    const outputPath = path.join(dir, `scorm_report_${safeId}_${timestamp}${ext}`);
    const courseJson = course.toJSON();

    await generateScormReportNode(courseJson, outputPath, format);

    const safeTitle = String(course.title || 'SCORM_Course')
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .slice(0, 60);

    return {
        outputPath,
        format,
        contentType: contentTypeFor(format),
        downloadName: `Quizmoto_SCORM_${safeTitle}${ext}`
    };
}

module.exports = {
    listCourseReports,
    generateReportFile,
    loadCourseForExport,
    safeUnlink,
    contentTypeFor
};
