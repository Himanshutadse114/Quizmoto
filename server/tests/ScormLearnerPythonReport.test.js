const { expect } = require('chai');
const { spawnSync } = require('child_process');
const path = require('path');

describe('SCORM AI Python individual learner report', () => {
    it('has valid Python syntax and includes question-answer reporting sections', function () {
        const scriptPath = path.join(__dirname, '../utils/generate_scorm_learner_report_clean.py');
        const probe = spawnSync('python3', ['--version'], { encoding: 'utf8' });
        if (probe.error || probe.status !== 0) this.skip();

        const check = spawnSync('python3', [
            '-c',
            'import ast,pathlib,sys; ast.parse(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))',
            scriptPath
        ], { encoding: 'utf8' });

        expect(check.status, check.stderr || check.stdout).to.equal(0);

        const fs = require('fs');
        const source = fs.readFileSync(scriptPath, 'utf8');
        expect(source).to.include('SCORM AI · INDIVIDUAL LEARNER REPORT');
        expect(source).to.include('Question & Answer Evidence');
        expect(source).to.include("add_worksheet('Question Answers')");
    });
});