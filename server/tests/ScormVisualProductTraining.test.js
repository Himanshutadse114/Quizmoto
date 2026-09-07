const { expect } = require('chai');
const JSZip = require('jszip');
const {
    currentCourseTemplateVersion,
    getCourseTemplate
} = require('../services/scorm/ScormTemplateCatalog');
const { createTemplateBinding } = require('../services/scorm/ScormTemplateBindingService');
const { resolveRebuildTemplateBinding } = require('../services/scorm/ScormTemplateRebuildMigration');
const { planExperienceForTemplate } = require('../services/scorm/ScormTemplateExperiencePlanner');
const {
    applyVisualProductRuntimeToZip,
    inject,
    script
} = require('../services/scorm/ScormVisualProductRuntime');
const {
    applyVisualProductPromptDirection
} = require('../services/scorm/ScormVisualProductPromptService');
const { templateInstruction } = require('../services/scorm/VertexPolicyAnalysisService');

function analysis() {
    return {
        title: 'Secure product walkthrough',
        summary: 'Learn the interface and its safe workflow.',
        coverImagePrompt: 'A polished software dashboard concept.',
        slides: [
            {
                title: 'Main dashboard features',
                content: 'The dashboard groups the controls learners need to inspect before beginning a task.',
                keyPoints: ['Navigation panel', 'Status area', 'Primary action', 'Safety control'],
                imagePrompt: 'A modern dashboard interface concept.'
            },
            {
                title: 'Setup process',
                content: 'Follow the setup process in order so that required checks happen before the product is used.',
                keyPoints: ['Open settings', 'Confirm status', 'Apply configuration', 'Start the task'],
                imagePrompt: 'A guided setup procedure concept.'
            },
            {
                title: 'Before and after comparison',
                content: 'Compare the initial state with the correctly configured state to see what changes.',
                keyPoints: ['Initial state', 'Configured state', 'Visible indicator', 'Ready state'],
                imagePrompt: 'A before and after product state.'
            },
            {
                title: 'One important visual',
                content: 'Study the central indicator and understand what it means before proceeding.',
                keyPoints: ['Central indicator', 'Current state', 'Required action'],
                imagePrompt: 'One dominant device indicator.'
            }
        ],
        quiz: []
    };
}

function oldVisualBinding() {
    return {
        templateEngineVersion: 1,
        templateBinding: {
            templateId: 'visual-product-training',
            templateVersion: '1.0.0',
            rendererVersion: 1,
            interactionLevel: 'high',
            locked: true
        }
    };
}

describe('Visual Product Training v2', () => {
    it('publishes v1.1 as a high-interaction visual-first template without flip cards', () => {
        expect(currentCourseTemplateVersion('visual-product-training')).to.equal('1.1.0');
        const template = getCourseTemplate('visual-product-training');
        expect(template.rendererVersion).to.equal(2);
        expect(template.defaultInteractionLevel).to.equal('high');
        expect(template.allowedInteractions).to.include.members([
            'focus_reveal',
            'hotspot_explore',
            'step_explore',
            'compare_reveal'
        ]);
        expect(template.allowedInteractions).to.not.include('click_reveal');
    });

    it('plans hotspots, guided steps and comparisons without Professional flip-card interactions', () => {
        const binding = createTemplateBinding('visual-product-training', { interactionLevel: 'high' });
        const course = planExperienceForTemplate(analysis(), binding);
        const interactions = course.slides.map((slide) => slide.interaction.type);

        expect(interactions).to.include('hotspot_explore');
        expect(interactions).to.include('step_explore');
        expect(interactions).to.include('compare_reveal');
        expect(interactions).to.not.include('click_reveal');
        expect(course.slides.every((slide) => slide.layoutId.startsWith('visual-product-training.'))).to.equal(true);
    });

    it('adds premium composition direction only to the visual product template', () => {
        const binding = createTemplateBinding('visual-product-training', { interactionLevel: 'high' });
        const course = planExperienceForTemplate(analysis(), binding);
        const directed = applyVisualProductPromptDirection(course);

        expect(directed.visualExperience).to.equal('visual-product-v2');
        expect(directed.coverImagePrompt).to.include('VISUAL PRODUCT TRAINING COMPOSITION:');
        expect(directed.slides[0].imagePrompt).to.include('clearly separated focal regions');
        expect(directed.slides[1].imagePrompt).to.include('guided sequence');
        expect(directed.slides[2].imagePrompt).to.include('before-versus-after');

        const other = applyVisualProductPromptDirection({
            ...course,
            templateBinding: { ...course.templateBinding, templateId: 'highly-interactive' }
        });
        expect(other.visualExperience).to.equal(undefined);
    });

    it('injects true media-overlay callouts and an event-driven runtime only for visual v1.1', () => {
        const binding = createTemplateBinding('visual-product-training', { interactionLevel: 'high' });
        const course = planExperienceForTemplate(analysis(), binding);
        const html = '<!doctype html><html><head></head><body><main><section class="slide" data-qmx-template-stage="true" data-qmx-interaction="hotspot_explore"><div class="qmx-learning-shell has-image"><div class="qmx-copy"><div class="qmx-explore-grid"><button class="qmx-explore-option"><span class="qmx-explore-label">Feature</span></button></div></div><figure class="qmx-native-media"><img src="media.webp"></figure></div></section></main></body></html>';
        const patched = inject(html, course);

        expect(patched).to.include('quizmoto-visual-product-runtime-v2');
        expect(patched).to.include('qmx-visual-marker-layer');
        expect(patched).to.include('qmx-visual-marker');
        expect(patched).to.include('Open visual notes');
        expect(patched).to.not.include('MutationObserver');

        const scriptTag = script();
        const js = scriptTag.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
        expect(() => new Function(js)).not.to.throw();
    });

    it('injects the dedicated runtime into generated course ZIPs and no-ops for other templates', async () => {
        const binding = createTemplateBinding('visual-product-training', { interactionLevel: 'high' });
        const course = planExperienceForTemplate(analysis(), binding);
        const zip = new JSZip();
        zip.file('index.html', '<!doctype html><html><head></head><body></body></html>');
        const source = await zip.generateAsync({ type: 'nodebuffer' });
        const patchedBuffer = await applyVisualProductRuntimeToZip(source, course);
        const patchedZip = await JSZip.loadAsync(patchedBuffer);
        const patchedHtml = await patchedZip.file('index.html').async('string');
        expect(patchedHtml).to.include('quizmoto-visual-product-runtime-v2');

        const other = {
            ...course,
            templateBinding: { ...course.templateBinding, templateId: 'highly-interactive' }
        };
        const untouched = await applyVisualProductRuntimeToZip(source, other);
        expect(Buffer.compare(source, untouched)).to.equal(0);
    });

    it('upgrades existing visual v1.0 courses to v1.1 on Save & rebuild', () => {
        const migration = resolveRebuildTemplateBinding({ analysis: oldVisualBinding() });
        expect(migration.templateUpgraded).to.equal(true);
        expect(migration.upgradeKind).to.equal('visual-product');
        expect(migration.previousVersion).to.equal('1.0.0');
        expect(migration.currentVersion).to.equal('1.1.0');
        expect(migration.binding.templateId).to.equal('visual-product-training');
        expect(migration.binding.templateVersion).to.equal('1.1.0');
    });

    it('gives the content AI a visual-product-specific authoring contract', () => {
        const instruction = templateInstruction('visual-product-training', 'high');
        expect(instruction).to.include('VISUAL PRODUCT TRAINING');
        expect(instruction).to.include('visual-first product walkthrough');
        expect(instruction).to.include('numbered visual callouts');
        expect(instruction).to.include('guided visual step rail');
        expect(instruction).to.not.include('SCENARIO AUTHORING CONTRACT');
    });
});
