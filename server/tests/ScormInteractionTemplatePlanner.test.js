const { expect } = require('chai');
const {
    RUNTIME_READY,
    applyInteractionTemplates
} = require('../services/scorm/ScormInteractionTemplatePlanner');

function course(slides) {
    return { title: 'Template planner test', slides };
}

describe('SCORM V7 interaction template planner', () => {
    it('leaves legacy courses untouched when no V7 experience profile is supplied', () => {
        const input = course([
            { title: 'Key points', layout: 'cards', interaction: { type: 'hotspot_explore' } }
        ]);
        const output = applyInteractionTemplates(input, {});

        expect(output).to.equal(input);
        expect(output).to.not.have.property('interactionEngineVersion');
        expect(output.slides[0].interaction).to.not.have.property('templateId');
    });

    it('keeps Classic Editorial on the existing flip-card runtime', () => {
        const input = course([
            { title: 'Key points', layout: 'cards', interaction: { type: 'hotspot_explore' } },
            { title: 'Response process', layout: 'process', interaction: { type: 'step_explore' } }
        ]);
        const output = applyInteractionTemplates(input, { experienceProfile: 'classic' });

        expect(output.interactionEngineVersion).to.equal(7);
        expect(output.experienceProfile).to.equal('classic');
        expect(output.slides.map((slide) => slide.interaction.templateId)).to.deep.equal([
            'flip_cards_classic',
            'flip_cards_classic'
        ]);
    });

    it('selects runtime-ready templates from slide semantics in Auto mode', () => {
        const input = course([
            { title: 'Response process', layout: 'process', screenType: 'process', interaction: { type: 'step_explore' } },
            { title: 'Attack progression', layout: 'timeline', screenType: 'timeline', interaction: { type: 'step_explore' } },
            { title: 'What would you do?', layout: 'spotlight', screenType: 'scenario', interaction: { type: 'decision_explore' } }
        ]);
        const output = applyInteractionTemplates(input, { experienceProfile: 'auto' });
        const templates = output.slides.map((slide) => slide.interaction.templateId);

        expect(templates[0]).to.equal('process_tabs');
        expect(templates[1]).to.equal('interactive_timeline');
        expect(templates[2]).to.equal('scenario_decision');
        templates.forEach((templateId) => expect(RUNTIME_READY.has(templateId)).to.equal(true));
    });

    it('preserves an explicit supported per-slide template override through planning', () => {
        const input = course([
            {
                title: 'Warning signs',
                layout: 'hub',
                screenType: 'hotspot',
                interaction: { type: 'hotspot_explore', templateId: 'accordion' }
            }
        ]);
        const output = applyInteractionTemplates(input, {
            experienceProfile: 'interactive',
            preferredTemplateId: 'interactive_tabs'
        });

        expect(output.slides[0].interaction.templateId).to.equal('accordion');
    });

    it('never assigns an unsupported preferred template to the learner runtime', () => {
        const input = course([
            { title: 'Response process', layout: 'process', interaction: { type: 'step_explore' } }
        ]);
        const output = applyInteractionTemplates(input, {
            experienceProfile: 'interactive',
            preferredTemplateId: 'not_a_real_template',
            interactionTemplateHints: ['not_a_real_template', 'process_tabs']
        });

        expect(output.slides[0].interaction.templateId).to.equal('process_tabs');
        expect(RUNTIME_READY.has(output.slides[0].interaction.templateId)).to.equal(true);
    });
});
