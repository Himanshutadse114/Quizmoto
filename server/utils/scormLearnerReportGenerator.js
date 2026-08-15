const fs = require('fs');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

function safe(value, fallback = '') {
    return value == null || value === '' ? fallback : String(value);
}

function dateText(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function resultColor(result) {
    const key = String(result || '').toLowerCase();
    if (key === 'passed' || key === 'completed') return '#26890c';
    if (key === 'failed') return '#e21b3c';
    if (key === 'in progress') return '#d89e00';
    return '#777777';
}

function generateLearnerPdf(report, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 46, bufferPages: true });
            const stream = fs.createWriteStream(outputPath);
            doc.pipe(stream);

            doc.fillColor('#ff8a1f').fontSize(10).font('Helvetica-Bold').text('SCORM AI · INDIVIDUAL LEARNER REPORT');
            doc.moveDown(0.35);
            doc.fillColor('#1f1f1f').fontSize(25).text(safe(report.learnerName, 'Learner'));
            doc.fillColor('#666666').fontSize(11).text(safe(report.learnerEmail, 'No email'));
            doc.moveDown(0.7);

            const summary = report.summary || {};
            doc.fillColor('#1f1f1f').fontSize(11);
            doc.text(`Courses: ${summary.courseCount || 0}   Completed: ${summary.completedCount || 0}   Average score: ${summary.averageScore == null ? '—' : summary.averageScore}`);
            doc.text(`Questions captured: ${summary.questionsCaptured || 0}   Correct: ${summary.correctAnswers || 0}   Accuracy: ${summary.answerAccuracy == null ? '—' : `${summary.answerAccuracy}%`}`);
            doc.fillColor('#888888').fontSize(8).text(`Generated: ${new Date().toLocaleString()}`);
            doc.moveDown(1.2);

            (report.attempts || []).forEach((attempt, attemptIndex) => {
                if (doc.y > 650) doc.addPage();
                doc.fillColor('#ff8a1f').fontSize(9).font('Helvetica-Bold').text(`COURSE ${attemptIndex + 1}`);
                doc.fillColor('#1f1f1f').fontSize(16).text(safe(attempt.courseTitle, 'Untitled course'));
                doc.fillColor(resultColor(attempt.result)).fontSize(10).text(safe(attempt.result, 'Not Attempted'));
                doc.fillColor('#555555').fontSize(9).font('Helvetica');
                doc.text(`Score: ${attempt.score == null ? '—' : attempt.score}   Progress: ${attempt.progressPercent == null ? '—' : `${attempt.progressPercent}%`}   Time: ${safe(attempt.totalTime, '—')}`);
                doc.text(`Last activity: ${dateText(attempt.lastActivity)}`);
                doc.moveDown(0.55);

                const interactions = attempt.interactions || [];
                if (!interactions.length) {
                    doc.fillColor('#888888').fontSize(8.5).text('Question-level answers were not captured for this attempt. Older attempts may only contain overall score/status data.');
                } else {
                    doc.fillColor('#333333').fontSize(9).font('Helvetica-Bold').text(`Knowledge checks (${interactions.length})`);
                    doc.moveDown(0.25);
                    interactions.forEach((item, index) => {
                        if (doc.y > 720) doc.addPage();
                        doc.fillColor('#222222').fontSize(9).font('Helvetica-Bold').text(`${index + 1}. ${safe(item.question, `Question ${index + 1}`)}`);
                        doc.fillColor(item.result === 'Correct' ? '#26890c' : item.result === 'Incorrect' ? '#e21b3c' : '#666666').fontSize(8.5).font('Helvetica').text(`Learner answer: ${safe(item.selectedAnswer, '—')}  ·  ${safe(item.result, 'Recorded')}`);
                        doc.fillColor('#555555').text(`Correct answer: ${safe(item.correctAnswer, '—')}`);
                        if (item.explanation) doc.fillColor('#777777').text(`Explanation: ${item.explanation}`);
                        doc.moveDown(0.45);
                    });
                }
                doc.moveDown(0.9);
            });

            const pages = doc.bufferedPageRange();
            for (let i = pages.start; i < pages.start + pages.count; i += 1) {
                doc.switchToPage(i);
                doc.fillColor('#999999').fontSize(7).text(`SCORM AI · CONFIDENTIAL · PAGE ${i + 1}`, 46, 806, { align: 'right', width: 500 });
            }

            doc.end();
            stream.on('finish', () => resolve(outputPath));
            stream.on('error', reject);
        } catch (err) {
            reject(err);
        }
    });
}

async function generateLearnerExcel(report, outputPath) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SCORM AI';
    workbook.created = new Date();

    const overview = workbook.addWorksheet('Learner Overview');
    overview.addRows([
        ['SCORM AI Individual Learner Report'],
        ['Learner', report.learnerName || 'Learner'],
        ['Email', report.learnerEmail || ''],
        ['Generated', new Date().toISOString()],
        [],
        ['Courses', report.summary?.courseCount || 0],
        ['Completed', report.summary?.completedCount || 0],
        ['Average score', report.summary?.averageScore ?? ''],
        ['Questions captured', report.summary?.questionsCaptured || 0],
        ['Correct answers', report.summary?.correctAnswers || 0],
        ['Answer accuracy %', report.summary?.answerAccuracy ?? '']
    ]);
    overview.columns = [{ width: 24 }, { width: 55 }];
    overview.getRow(1).font = { bold: true, size: 18 };

    const courses = workbook.addWorksheet('Course Results');
    courses.addRow(['Course', 'Result', 'Registration Status', 'Lesson Status', 'Score', 'Progress %', 'Total Time', 'Last Activity', 'Questions Captured', 'Correct', 'Accuracy %']);
    courses.getRow(1).font = { bold: true };
    courses.columns = [
        { width: 34 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 10 }, { width: 12 }, { width: 16 }, { width: 23 }, { width: 18 }, { width: 10 }, { width: 12 }
    ];
    (report.attempts || []).forEach((attempt) => {
        courses.addRow([
            attempt.courseTitle || '', attempt.result || '', attempt.status || '', attempt.lessonStatus || '',
            attempt.score ?? '', attempt.progressPercent ?? '', attempt.totalTime || '', attempt.lastActivity ? new Date(attempt.lastActivity).toISOString() : '',
            attempt.answerSummary?.captured || 0, attempt.answerSummary?.correct || 0, attempt.answerSummary?.accuracy ?? ''
        ]);
    });
    courses.autoFilter = { from: 'A1', to: 'K1' };
    courses.views = [{ state: 'frozen', ySplit: 1 }];

    const answers = workbook.addWorksheet('Question Answers');
    answers.addRow(['Course', 'Question #', 'Question', 'Learner Answer', 'Correct Answer', 'Result', 'Explanation']);
    answers.getRow(1).font = { bold: true };
    answers.columns = [
        { width: 30 }, { width: 10 }, { width: 55 }, { width: 35 }, { width: 35 }, { width: 14 }, { width: 55 }
    ];
    (report.attempts || []).forEach((attempt) => {
        (attempt.interactions || []).forEach((item, index) => {
            answers.addRow([
                attempt.courseTitle || '', index + 1, item.question || '', item.selectedAnswer || '', item.correctAnswer || '', item.result || '', item.explanation || ''
            ]);
        });
    });
    answers.autoFilter = { from: 'A1', to: 'G1' };
    answers.views = [{ state: 'frozen', ySplit: 1 }];

    await workbook.xlsx.writeFile(outputPath);
    return outputPath;
}

async function generateScormLearnerReport(report, outputPath, format) {
    if (format === 'pdf') return generateLearnerPdf(report, outputPath);
    if (format === 'excel') return generateLearnerExcel(report, outputPath);
    const err = new Error('Invalid format');
    err.code = 'INVALID_FORMAT';
    throw err;
}

module.exports = {
    generateScormLearnerReport,
    generateLearnerPdf,
    generateLearnerExcel
};
