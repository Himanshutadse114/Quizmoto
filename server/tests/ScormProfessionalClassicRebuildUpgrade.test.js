const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { resolveRebuildTemplateBinding } = require('../services/scorm/ScormTemplateRebuildMigration');

function analysisWithBinding(templateId, templateVersion, interactionLevel = 'balanced') {
    return {
        templateEngineVersion: 1,
        templateBinding: {
            templateId,
            templateVersion,
            rendererVersion: 1,
            interactionLevel,
            locked: true
        }
    };
}

describe('Professional classic rebuild upgrade', () => {
    it('upgrades an existing Professional 1.0 course to the current flip-card template on rebuild', () => {
        const migration = resolveRebuildTemplateBinding({
            analysis: analysisWithBinding('professional-classic', '1.0.0')
        });

        expect(migration.templateUpgraded).to.equal(true);
        expect(migration.previousVersion).to.equal('1.0.0');
        expect(migration.currentVersion).to.equal('1.1.0');
        expect(migration.binding.templateId).to.equal('professional-classic');
        expect(migration.binding.templateVersion).to.equal('1.1.0');
        expect(migration.binding.interactionLevel).to.equal('balanced');
    });

    it('does not repeatedly migrate a Professional course already on the current version', () => {
        const migration = resolveRebuildTemplateBinding({
            analysis: analysisWithBinding('professional-classic', '1.1.0')
        });

        expect(migration.templateUpgraded).to.equal(false);
        expect(migration.binding.templateVersion).to.equal('1.1.0');
    });

    it('does not change the version of other course styles during rebuild', () => {
        const migration = resolveRebuildTemplateBinding({
            analysis: analysisWithBinding('scenario-learning', '1.0.0', 'high')
        });

        expect(migration.templateUpgraded).to.equal(false);
        expect(migration.binding.templateId).to.equal('scenario-learning');
        expect(migration.binding.templateVersion).to.equal('1.0.0');
    });

    it('replans an upgraded Professional rebuild instead of preserving the generic old design', () => {
        const routeSource = fs.readFileSync(
            path.join(__dirname, '../routes/scorm/authorRebuild.js'),
            'utf8'
        );

        expect(routeSource).to.include('if (migration.templateUpgraded)');
        expect(routeSource).to.include('analysis = planExperienceForTemplate(analysis, binding);');
        expect(routeSource).to.include('templateEngineVersion = 1;');
        expect(routeSource).to.include('zipBuf = await applyCourseChromeRuntimeToZip(zipBuf, analysis);');
    });
});
