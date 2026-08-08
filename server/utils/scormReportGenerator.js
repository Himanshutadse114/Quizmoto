/**
 * SCORM World report generator (PDF + Excel).
 * Mirrors live-quiz Quizmoto report structure for published courses.
 */

const fs = require('fs');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

function safeStr(v, fallback = '') {
    if (v === null || v === undefined) return fallback;
    return String(v);
}

function isCompletedStatus(lessonStatus) {
    const s = String(lessonStatus || '').toLowerCase();
    return s === 'completed' || s === 'passed' || s === 'failed';
}

function courseMeta(course) {
    const regs = Array.isArray(course.registrations) ? [...course.registrations] : [];
    const learners = regs
        .filter((r) => !r.isPreview)
        .sort((a, b) => {
            const sa = a.lastScoreRaw != null ? Number(a.lastScoreRaw) : -1;
            const sb = b.lastScoreRaw != null ? Number(b.lastScoreRaw) : -1;
            return sb - sa;
        });
    const previews = regs.filter((r) => r.isPreview);
    const withScore = learners.filter((r) => r.lastScoreRaw != null && !Number.isNaN(Number(r.lastScoreRaw)));
    const completed = learners.filter((r) => isCompletedStatus(r.lastLessonStatus));
    const avgScore =
        withScore.length > 0
            ? withScore.reduce((sum, r) => sum + Number(r.lastScoreRaw), 0) / withScore.length
            : null;

    return {
        title: safeStr(course.title, 'Untitled course'),
        description: safeStr(course.description, ''),
        inviteCode: safeStr(course.inviteCode, ''),
        status: safeStr(course.status, ''),
        publishedAt: course.publishedAt || course.createdAt || null,
        createdAt: course.createdAt || null,
        packageTitle: course.package ? safeStr(course.package.title, '') : '',
        packageVersion: course.package ? safeStr(course.package.version, '') : '',
        learners,
        previews,
        stats: {
            totalLearners: learners.length,
            completed: completed.length,
            inProgress: learners.filter((r) => {
                const s = String(r.lastLessonStatus || '').toLowerCase();
                return s === 'incomplete' || s === 'browsed' || s === 'not attempted' || !s;
            }).length,
            averageScore: avgScore != null ? Math.round(avgScore * 100) / 100 : null,
            completionRate:
                learners.length > 0
                    ? Math.round((completed.length / learners.length) * 1000) / 10
                    : null
        }
    };
}

function generatePdf(course, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const meta = courseMeta(course);
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const stream = fs.createWriteStream(outputPath);
            doc.pipe(stream);

            doc.fillColor('#46178f').fontSize(22).text('Quizmoto SCORM Report', { align: 'left' });
            doc.moveDown(0.3);
            doc.fillColor('#333333').fontSize(14).text(`Course: ${meta.title}`);
            doc.fontSize(10).fillColor('#666666');
            if (meta.packageTitle) doc.text(`Package: ${meta.packageTitle}`);
            doc.text(`Invite code: ${meta.inviteCode}`);
            doc.text(`Status: ${meta.status}`);
            if (meta.publishedAt) {
                doc.text(`Published: ${new Date(meta.publishedAt).toLocaleString()}`);
            }
            doc.text(`Generated: ${new Date().toLocaleString()}`);
            doc.moveDown();

            doc.fillColor('#46178f').fontSize(14).text('Summary');
            doc.moveDown(0.3);
            doc.fillColor('#333333').fontSize(11);
            doc.text(`Learners: ${meta.stats.totalLearners}`);
            doc.text(`Completed: ${meta.stats.completed}`);
            if (meta.stats.completionRate != null) {
                doc.text(`Completion rate: ${meta.stats.completionRate}%`);
            }
            if (meta.stats.averageScore != null) {
                doc.text(`Average score: ${meta.stats.averageScore}`);
            }
            doc.moveDown();

            doc.fillColor('#46178f').fontSize(14).text('Learner roster');
            doc.moveDown(0.4);
            doc.fillColor('#333333').fontSize(9);

            if (meta.learners.length === 0) {
                doc.text('No learners registered yet.');
            } else {
                meta.learners.forEach((r, i) => {
                    const name = safeStr(r.learnerName, 'Learner');
                    const email = r.learnerEmail ? ` <${r.learnerEmail}>` : '';
                    const score = r.lastScoreRaw != null ? String(r.lastScoreRaw) : '—';
                    const lesson = safeStr(r.lastLessonStatus, '—');
                    const time = safeStr(r.lastTotalTime, '—');
                    const updated = r.lastCommitAt
                        ? new Date(r.lastCommitAt).toLocaleString()
                        : r.updatedAt
                          ? new Date(r.updatedAt).toLocaleString()
                          : '—';
                    doc
                        .fillColor('#111111')
                        .fontSize(10)
                        .text(`${i + 1}. ${name}${email}`, { continued: false });
                    doc
                        .fillColor('#555555')
                        .fontSize(9)
                        .text(
                            `   Status: ${safeStr(r.status, '—')}  |  Lesson: ${lesson}  |  Score: ${score}  |  Time: ${time}`
                        );
                    doc.fillColor('#888888').fontSize(8).text(`   Last update: ${updated}`);
                    doc.moveDown(0.35);
                    if (doc.y > 750) doc.addPage();
                });
            }

            if (meta.previews.length > 0) {
                doc.moveDown(0.5);
                doc.fillColor('#46178f').fontSize(12).text('Host previews (excluded from averages)');
                doc.moveDown(0.2);
                doc.fillColor('#666666').fontSize(9);
                meta.previews.forEach((r) => {
                    doc.text(
                        `- ${safeStr(r.learnerName, 'Preview')} | Lesson: ${safeStr(r.lastLessonStatus, '—')} | Score: ${
                            r.lastScoreRaw != null ? r.lastScoreRaw : '—'
                        }`
                    );
                });
            }

            doc.end();
            stream.on('finish', () => resolve(outputPath));
            stream.on('error', reject);
        } catch (err) {
            reject(err);
        }
    });
}

async function generateExcel(course, outputPath) {
    const meta = courseMeta(course);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Quizmoto';
    workbook.created = new Date();

    const ws1 = workbook.addWorksheet('Overview');
    ws1.addRow(['Quizmoto SCORM Report']);
    ws1.addRow(['Course', meta.title]);
    ws1.addRow(['Description', meta.description]);
    ws1.addRow(['Invite code', meta.inviteCode]);
    ws1.addRow(['Status', meta.status]);
    ws1.addRow(['Package', meta.packageTitle || '']);
    ws1.addRow([
        'Published',
        meta.publishedAt ? new Date(meta.publishedAt).toISOString() : ''
    ]);
    ws1.addRow(['Generated', new Date().toISOString()]);
    ws1.addRow([]);
    ws1.addRow(['Learners', meta.stats.totalLearners]);
    ws1.addRow(['Completed', meta.stats.completed]);
    if (meta.stats.completionRate != null) {
        ws1.addRow(['Completion rate %', meta.stats.completionRate]);
    }
    if (meta.stats.averageScore != null) {
        ws1.addRow(['Average score', meta.stats.averageScore]);
    }

    const ws2 = workbook.addWorksheet('Learners');
    ws2.addRow([
        'Rank',
        'Name',
        'Email',
        'Registration status',
        'Lesson status',
        'Score',
        'Total time',
        'Last update',
        'Preview'
    ]);
    meta.learners.forEach((r, i) => {
        ws2.addRow([
            i + 1,
            r.learnerName || '',
            r.learnerEmail || '',
            r.status || '',
            r.lastLessonStatus || '',
            r.lastScoreRaw != null ? r.lastScoreRaw : '',
            r.lastTotalTime || '',
            r.lastCommitAt
                ? new Date(r.lastCommitAt).toISOString()
                : r.updatedAt
                  ? new Date(r.updatedAt).toISOString()
                  : '',
            false
        ]);
    });
    meta.previews.forEach((r) => {
        ws2.addRow([
            '',
            r.learnerName || 'Preview',
            r.learnerEmail || '',
            r.status || '',
            r.lastLessonStatus || '',
            r.lastScoreRaw != null ? r.lastScoreRaw : '',
            r.lastTotalTime || '',
            r.lastCommitAt
                ? new Date(r.lastCommitAt).toISOString()
                : r.updatedAt
                  ? new Date(r.updatedAt).toISOString()
                  : '',
            true
        ]);
    });

    const ws3 = workbook.addWorksheet('Completions');
    ws3.addRow(['Name', 'Email', 'Lesson status', 'Score', 'Total time', 'Completed']);
    meta.learners.forEach((r) => {
        ws3.addRow([
            r.learnerName || '',
            r.learnerEmail || '',
            r.lastLessonStatus || '',
            r.lastScoreRaw != null ? r.lastScoreRaw : '',
            r.lastTotalTime || '',
            isCompletedStatus(r.lastLessonStatus) ? 'Yes' : 'No'
        ]);
    });

    await workbook.xlsx.writeFile(outputPath);
    return outputPath;
}

async function generateScormReportNode(course, outputPath, format) {
    if (format === 'pdf') {
        return generatePdf(course, outputPath);
    }
    if (format === 'excel') {
        return generateExcel(course, outputPath);
    }
    const err = new Error('Invalid format');
    err.code = 'INVALID_FORMAT';
    throw err;
}

module.exports = {
    generateScormReportNode,
    generatePdf,
    generateExcel,
    courseMeta
};
