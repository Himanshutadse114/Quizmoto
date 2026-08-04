/**
 * Pure Node.js report generator (no Python).
 * Primary path for PDF/Excel exports — reliable on Alpine/Render.
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

function safeStr(v, fallback = '') {
    if (v === null || v === undefined) return fallback;
    return String(v);
}

function sessionMeta(session) {
    const quiz = session.Quiz || session.quiz || {};
    const players = Array.isArray(session.players) ? [...session.players] : [];
    players.sort((a, b) => (b.score || 0) - (a.score || 0));
    const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
    const analytics = typeof session.analytics === 'string'
        ? (() => { try { return JSON.parse(session.analytics); } catch { return {}; } })()
        : (session.analytics || {});
    return {
        title: safeStr(quiz.title, 'Unknown Quiz'),
        players,
        questions,
        analytics,
        pin: safeStr(session.pin),
        createdAt: session.createdAt || session.updatedAt || new Date().toISOString(),
        hostId: session.hostId
    };
}

function optionText(opts, idx) {
    if (!Array.isArray(opts)) {
        if (typeof opts === 'string') {
            try { opts = JSON.parse(opts); } catch { opts = []; }
        } else {
            opts = [];
        }
    }
    if (idx == null || idx < 0 || idx >= opts.length) return 'N/A';
    const o = opts[idx];
    return typeof o === 'string' ? o : (o && o.text) || String(o);
}

/**
 * Generate a PDF report to outputPath.
 */
function generatePdf(session, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const meta = sessionMeta(session);
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const stream = fs.createWriteStream(outputPath);
            doc.pipe(stream);

            // Cover
            doc.fillColor('#46178f').fontSize(22).text('Quizmoto Report', { align: 'left' });
            doc.moveDown(0.3);
            doc.fillColor('#333333').fontSize(14).text(`Quiz: ${meta.title}`);
            doc.fontSize(10).fillColor('#666666')
                .text(`PIN: ${meta.pin}`)
                .text(`Date: ${new Date(meta.createdAt).toLocaleString()}`)
                .text(`Players: ${meta.players.length}`);
            doc.moveDown();

            // Class analytics
            const ca = meta.analytics.classAnalytics || {};
            if (ca && (ca.averageAccuracy != null || ca.participationRate != null || ca.averageParticipation != null)) {
                doc.fillColor('#46178f').fontSize(14).text('Class Analytics');
                doc.moveDown(0.3);
                doc.fillColor('#333333').fontSize(11);
                if (ca.averageAccuracy != null) doc.text(`Average accuracy: ${ca.averageAccuracy}%`);
                const part = ca.participationRate != null ? ca.participationRate : ca.averageParticipation;
                if (part != null) doc.text(`Participation: ${part}%`);
                if (ca.questionsNeedingReview != null) doc.text(`Questions needing review: ${ca.questionsNeedingReview}`);
                if (ca.studentsNeedingAttention != null) doc.text(`Students needing attention: ${ca.studentsNeedingAttention}`);
                doc.moveDown();
            }

            // Leaderboard
            doc.fillColor('#46178f').fontSize(14).text('Leaderboard');
            doc.moveDown(0.3);
            doc.fillColor('#333333').fontSize(10);
            if (meta.players.length === 0) {
                doc.text('No players recorded for this session.');
            } else {
                meta.players.forEach((p, i) => {
                    doc.text(`${i + 1}. ${safeStr(p.nickname, 'Player')} — ${p.score || 0} pts`);
                });
            }
            doc.moveDown();

            // Per-player breakdown
            doc.fillColor('#46178f').fontSize(14).text('Player Details');
            doc.moveDown(0.3);

            meta.players.forEach((p, pi) => {
                if (doc.y > 700) doc.addPage();
                doc.fillColor('#46178f').fontSize(12).text(`${pi + 1}. ${safeStr(p.nickname, 'Player')} (${p.score || 0} pts)`);
                doc.fillColor('#333333').fontSize(9);
                const answers = Array.isArray(p.answers) ? p.answers : [];
                if (meta.questions.length === 0) {
                    doc.text('  No question data.');
                } else {
                    meta.questions.forEach((q, qi) => {
                        const ans = answers.find(a => a.questionIndex === qi);
                        const opts = q.options;
                        const correct = optionText(opts, q.correctIndex);
                        if (!ans) {
                            doc.text(`  Q${qi + 1}: Not answered (correct: ${correct})`);
                        } else {
                            const selected = optionText(opts, ans.answerIndex);
                            const mark = ans.isCorrect ? 'Correct' : 'Wrong';
                            const t = ans.timeTaken != null ? ` ${ans.timeTaken}s` : '';
                            doc.text(`  Q${qi + 1}: ${mark} — selected "${selected}"${t} (correct: ${correct})`);
                        }
                    });
                }
                doc.moveDown(0.5);
            });

            doc.end();
            stream.on('finish', () => resolve(outputPath));
            stream.on('error', reject);
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Generate an Excel (.xlsx) report to outputPath.
 */
async function generateExcel(session, outputPath) {
    const meta = sessionMeta(session);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Quizmoto';
    workbook.created = new Date();

    // Overview
    const ws1 = workbook.addWorksheet('Overview');
    ws1.addRow(['Quizmoto Report']);
    ws1.addRow(['Quiz', meta.title]);
    ws1.addRow(['PIN', meta.pin]);
    ws1.addRow(['Date', new Date(meta.createdAt).toISOString()]);
    ws1.addRow(['Players', meta.players.length]);
    const ca = meta.analytics.classAnalytics || {};
    if (ca.averageAccuracy != null) ws1.addRow(['Average accuracy %', ca.averageAccuracy]);
    const part = ca.participationRate != null ? ca.participationRate : ca.averageParticipation;
    if (part != null) ws1.addRow(['Participation %', part]);

    // Leaderboard
    const ws2 = workbook.addWorksheet('Leaderboard');
    ws2.addRow(['Rank', 'Nickname', 'Score', 'Team']);
    meta.players.forEach((p, i) => {
        ws2.addRow([i + 1, p.nickname || '', p.score || 0, p.teamName || '']);
    });

    // Detailed answers
    const ws3 = workbook.addWorksheet('Detailed Answers');
    const header = ['Nickname', 'Score'];
    meta.questions.forEach((_, i) => header.push(`Q${i + 1}`));
    ws3.addRow(header);
    meta.players.forEach((p) => {
        const answers = Array.isArray(p.answers) ? p.answers : [];
        const row = [p.nickname || '', p.score || 0];
        meta.questions.forEach((q, qi) => {
            const ans = answers.find(a => a.questionIndex === qi);
            if (!ans) {
                row.push('No Answer');
            } else {
                const selected = optionText(q.options, ans.answerIndex);
                const mark = ans.isCorrect ? 'Yes' : 'No';
                row.push(`Ans: ${selected} | Correct: ${mark} | Time: ${ans.timeTaken || 0}s`);
            }
        });
        ws3.addRow(row);
    });

    await workbook.xlsx.writeFile(outputPath);
    return outputPath;
}

async function generateReportNode(session, outputPath, format) {
    if (format === 'pdf') {
        return generatePdf(session, outputPath);
    }
    if (format === 'excel') {
        return generateExcel(session, outputPath);
    }
    const err = new Error('Invalid format');
    err.code = 'INVALID_FORMAT';
    throw err;
}

module.exports = {
    generateReportNode,
    generatePdf,
    generateExcel
};
