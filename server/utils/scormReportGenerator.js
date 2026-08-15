/**
 * SCORM AI report generator (PDF + Excel).
 * Admin QA previews are intentionally excluded from all report output.
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
    const withScore = learners.filter((r) => r.lastScoreRaw != null && !Number.isNaN(Number(r.lastScoreRaw)));
    const completed = learners.filter((r) => isCompletedStatus(r.lastLessonStatus));
    const avgScore = withScore.length > 0
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
        stats: {
            totalLearners: learners.length,
            completed: completed.length,
            inProgress: learners.filter((r) => {
                const s = String(r.lastLessonStatus || '').toLowerCase();
                return s === 'incomplete' || s === 'browsed' || s === 'not attempted' || !s;
            }).length,
            averageScore: avgScore != null ? Math.round(avgScore * 100) / 100 : null,
            completionRate: learners.length > 0 ? Math.round((completed.length / learners.length) * 1000) / 10 : null
        }
    };
}

function writeInteractionsPdf(doc, learner) {
    const interactions = Array.isArray(learner.interactions) ? learner.interactions : [];
    if (!interactions.length) {
        doc.fillColor('#888888').fontSize(8).text('   Question-level answers were not captured for this attempt.');
        return;
    }

    doc.fillColor('#46178f').fontSize(9).font('Helvetica-Bold').text(`   Knowledge checks (${interactions.length})`);
    interactions.forEach((item, index) => {
        if (doc.y > 720) doc.addPage();
        doc.fillColor('#222222').fontSize(8.5).font('Helvetica-Bold').text(`   Q${index + 1}. ${safeStr(item.question, `Question ${index + 1}`)}`);
        doc.fillColor(item.result === 'Correct' ? '#26890c' : item.result === 'Incorrect' ? '#e21b3c' : '#666666')
            .fontSize(8).font('Helvetica').text(`      Learner answer: ${safeStr(item.selectedAnswer, '—')} · ${safeStr(item.result, 'Recorded')}`);
        doc.fillColor('#555555').text(`      Correct answer: ${safeStr(item.correctAnswer, '—')}`);
        if (item.explanation) doc.fillColor('#777777').text(`      Explanation: ${item.explanation}`);
        doc.moveDown(0.25);
    });
}

function generatePdf(course, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const meta = courseMeta(course);
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const stream = fs.createWriteStream(outputPath);
            doc.pipe(stream);

            doc.fillColor('#46178f').fontSize(22).font('Helvetica-Bold').text('SCORM AI Learning Report', { align: 'left' });
            doc.moveDown(0.3);
            doc.fillColor('#333333').fontSize(14).text(`Course: ${meta.title}`);
            doc.fontSize(10).fillColor('#666666').font('Helvetica');
            if (meta.packageTitle) doc.text(`Package: ${meta.packageTitle}`);
            doc.text(`Invite code: ${meta.inviteCode}`);
            doc.text(`Status: ${meta.status}`);
            if (meta.publishedAt) doc.text(`Published: ${new Date(meta.publishedAt).toLocaleString()}`);
            doc.text(`Generated: ${new Date().toLocaleString()}`);
            doc.moveDown();

            doc.fillColor('#46178f').fontSize(14).font('Helvetica-Bold').text('Summary');
            doc.moveDown(0.3);
            doc.fillColor('#333333').fontSize(11).font('Helvetica');
            doc.text(`Learners: ${meta.stats.totalLearners}`);
            doc.text(`Completed: ${meta.stats.completed}`);
            if (meta.stats.completionRate != null) doc.text(`Completion rate: ${meta.stats.completionRate}%`);
            if (meta.stats.averageScore != null) doc.text(`Average score: ${meta.stats.averageScore}`);
            doc.moveDown();

            doc.fillColor('#46178f').fontSize(14).font('Helvetica-Bold').text('Learner audit and answers');
            doc.moveDown(0.4);

            if (meta.learners.length === 0) {
                doc.fillColor('#333333').fontSize(9).font('Helvetica').text('No learners registered yet.');
            } else {
                meta.learners.forEach((r, i) => {
                    if (doc.y > 680) doc.addPage();
                    const name = safeStr(r.learnerName, 'Learner');
                    const email = r.learnerEmail ? ` <${r.learnerEmail}>` : '';
                    const score = r.lastScoreRaw != null ? String(r.lastScoreRaw) : '—';
                    const lesson = safeStr(r.lastLessonStatus, '—');
                    const time = safeStr(r.lastTotalTime, '—');
                    const updated = r.lastCommitAt
                        ? new Date(r.lastCommitAt).toLocaleString()
                        : r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—';
                    doc.fillColor('#111111').fontSize(10).font('Helvetica-Bold').text(`${i + 1}. ${name}${email}`);
                    doc.fillColor('#555555').fontSize(9).font('Helvetica').text(`   Status: ${safeStr(r.status, '—')}  |  Lesson: ${lesson}  |  Score: ${score}  |  Time: ${time}`);
                    doc.fillColor('#888888').fontSize(8).text(`   Last update: ${updated}`);
                    writeInteractionsPdf(doc, r);
                    doc.moveDown(0.5);
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
    workbook.creator = 'SCORM AI';
    workbook.created = new Date();

    const ws1 = workbook.addWorksheet('Overview');
    ws1.addRow(['SCORM AI Learning Report']);
    ws1.addRow(['Course', meta.title]);
    ws1.addRow(['Description', meta.description]);
    ws1.addRow(['Invite code', meta.inviteCode]);
    ws1.addRow(['Status', meta.status]);
    ws1.addRow(['Package', meta.packageTitle || '']);
    ws1.addRow(['Published', meta.publishedAt ? new Date(meta.publishedAt).toISOString() : '']);
    ws1.addRow(['Generated', new Date().toISOString()]);
    ws1.addRow([]);
    ws1.addRow(['Learners', meta.stats.totalLearners]);
    ws1.addRow(['Completed', meta.stats.completed]);
    if (meta.stats.completionRate != null) ws1.addRow(['Completion rate %', meta.stats.completionRate]);
    if (meta.stats.averageScore != null) ws1.addRow(['Average score', meta.stats.averageScore]);
    ws1.columns = [{ width: 24 }, { width: 55 }];
    ws1.getRow(1).font = { bold: true, size: 18 };

    const ws2 = workbook.addWorksheet('Learners');
    ws2.addRow(['Rank', 'Name', 'Email', 'Registration status', 'Lesson status', 'Score', 'Total time', 'Last update', 'Questions captured', 'Correct answers', 'Answer accuracy %']);
    ws2.getRow(1).font = { bold: true };
    ws2.columns = [
        { width: 7 }, { width: 24 }, { width: 32 }, { width: 20 }, { width: 18 }, { width: 10 }, { width: 16 }, { width: 24 }, { width: 18 }, { width: 15 }, { width: 16 }
    ];
    meta.learners.forEach((r, i) => {
        const summary = r.answerSummary || {};
        ws2.addRow([
            i + 1, r.learnerName || '', r.learnerEmail || '', r.status || '', r.lastLessonStatus || '',
            r.lastScoreRaw != null ? r.lastScoreRaw : '', r.lastTotalTime || '',
            r.lastCommitAt ? new Date(r.lastCommitAt).toISOString() : r.updatedAt ? new Date(r.updatedAt).toISOString() : '',
            summary.captured || 0, summary.correct || 0, summary.accuracy ?? ''
        ]);
    });
    ws2.autoFilter = { from: 'A1', to: 'K1' };
    ws2.views = [{ state: 'frozen', ySplit: 1 }];

    const ws3 = workbook.addWorksheet('Question Answers');
    ws3.addRow(['Learner', 'Email', 'Question #', 'Question', 'Learner Answer', 'Correct Answer', 'Result', 'Explanation']);
    ws3.getRow(1).font = { bold: true };
    ws3.columns = [
        { width: 24 }, { width: 30 }, { width: 10 }, { width: 55 }, { width: 35 }, { width: 35 }, { width: 14 }, { width: 55 }
    ];
    meta.learners.forEach((r) => {
        (r.interactions || []).forEach((item, index) => {
            ws3.addRow([
                r.learnerName || '', r.learnerEmail || '', index + 1, item.question || '', item.selectedAnswer || '', item.correctAnswer || '', item.result || '', item.explanation || ''
            ]);
        });
    });
    ws3.autoFilter = { from: 'A1', to: 'H1' };
    ws3.views = [{ state: 'frozen', ySplit: 1 }];

    const ws4 = workbook.addWorksheet('Completions');
    ws4.addRow(['Name', 'Email', 'Lesson status', 'Score', 'Total time', 'Completed']);
    ws4.getRow(1).font = { bold: true };
    meta.learners.forEach((r) => {
        ws4.addRow([
            r.learnerName || '', r.learnerEmail || '', r.lastLessonStatus || '',
            r.lastScoreRaw != null ? r.lastScoreRaw : '', r.lastTotalTime || '',
            isCompletedStatus(r.lastLessonStatus) ? 'Yes' : 'No'
        ]);
    });

    await workbook.xlsx.writeFile(outputPath);
    return outputPath;
}

async function generateScormReportNode(course, outputPath, format) {
    if (format === 'pdf') return generatePdf(course, outputPath);
    if (format === 'excel') return generateExcel(course, outputPath);
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
