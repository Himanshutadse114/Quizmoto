const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const { generateLearnerExcel } = require('../utils/scormLearnerReportGenerator');

describe('scormLearnerReportGenerator', () => {
    it('creates an individual workbook with course results and question answers', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scorm-learner-report-'));
        const output = path.join(dir, 'learner.xlsx');
        try {
            await generateLearnerExcel({
                learnerName: 'Alice Example',
                learnerEmail: 'alice@example.com',
                summary: {
                    courseCount: 1,
                    completedCount: 1,
                    averageScore: 100,
                    questionsCaptured: 1,
                    correctAnswers: 1,
                    answerAccuracy: 100
                },
                attempts: [{
                    courseTitle: 'Phishing Awareness',
                    result: 'Passed',
                    status: 'completed',
                    lessonStatus: 'passed',
                    score: 100,
                    progressPercent: 100,
                    totalTime: '00:05:00',
                    lastActivity: new Date('2026-08-15T05:00:00Z'),
                    answerSummary: { captured: 1, correct: 1, accuracy: 100 },
                    interactions: [{
                        question: 'What should you do?',
                        selectedAnswer: 'Report it',
                        correctAnswer: 'Report it',
                        result: 'Correct',
                        explanation: 'Reporting protects other users.'
                    }]
                }]
            }, output);

            expect(fs.existsSync(output)).to.equal(true);
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(output);
            expect(workbook.getWorksheet('Learner Overview')).to.exist;
            expect(workbook.getWorksheet('Course Results')).to.exist;
            const answers = workbook.getWorksheet('Question Answers');
            expect(answers).to.exist;
            expect(answers.getCell('C2').value).to.equal('What should you do?');
            expect(answers.getCell('D2').value).to.equal('Report it');
            expect(answers.getCell('F2').value).to.equal('Correct');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
