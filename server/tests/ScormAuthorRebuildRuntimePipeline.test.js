const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

describe('SCORM author rebuild runtime pipeline', () => {
    it('reapplies template, scenario, branching and shared course chrome runtimes on rebuild', () => {
        const routePath = path.join(__dirname, '../routes/scorm/authorRebuild.js');
        const source = fs.readFileSync(routePath, 'utf8');

        expect(source).to.include("require('../../services/scorm/ScormTemplateRuntime')");
        expect(source).to.include("require('../../services/scorm/ScormScenarioLearningRuntime')");
        expect(source).to.include("require('../../services/scorm/ScormScenarioBranchingRuntime')");
        expect(source).to.include("require('../../services/scorm/ScormCourseChromeRuntime')");

        const templateCall = source.indexOf('zipBuf = await applyTemplateRuntimeToZip(zipBuf, analysis);');
        const scenarioCall = source.indexOf('zipBuf = await applyScenarioLearningRuntimeToZip(zipBuf, analysis);');
        const branchingCall = source.indexOf('zipBuf = await applyScenarioBranchingRuntimeToZip(zipBuf, analysis);');
        const chromeCall = source.indexOf('zipBuf = await applyCourseChromeRuntimeToZip(zipBuf, analysis);');

        expect(templateCall).to.be.greaterThan(-1);
        expect(scenarioCall).to.be.greaterThan(templateCall);
        expect(branchingCall).to.be.greaterThan(scenarioCall);
        expect(chromeCall).to.be.greaterThan(branchingCall);
    });
});
