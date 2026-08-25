const { expect } = require('chai');
const {
    normalizeVisualPrompt,
    enforceVisualPromptRequirements,
    recoverPromptFromBrokenJson,
    sharedVisualRules,
    slideInstruction,
    batchInstruction,
    parseBatchPrompts
} = require('../services/scorm/GeminiSlideVisualPromptService');

describe('Gemini slide visual prompt service', () => {
    it('uses plain-text prompt output instead of requiring JSON', () => {
        const rules = sharedVisualRules();
        expect(rules).to.include('plain text');
        expect(rules).to.include('Do not return JSON');
    });

    it('requires premium topic-specific 3D visuals without text', () => {
        const rules = sharedVisualRules();
        expect(rules).to.include('semi-realistic 3D render');
        expect(rules).to.include('TOPIC SPECIFICITY');
        expect(rules).to.include('ABSOLUTELY NO TEXT IN THE IMAGE');
        expect(rules).to.include('NON-HUMAN VISUAL ONLY');
        expect(rules).to.include('16:9');
    });

    it('accepts a normal plain-text image prompt', () => {
        const prompt = 'Wide 16:9 non-human course illustration showing balanced abstract shapes and connected coloured objects representing emotional awareness and empathy, with clean premium lighting, generous negative space, no text, no logos and no watermark.';
        expect(normalizeVisualPrompt(prompt)).to.equal(prompt);
    });

    it('still accepts the old valid JSON wrapper for backward compatibility', () => {
        const wrapped = JSON.stringify({
            prompt: 'Wide 16:9 non-human course illustration showing calm layered shapes representing emotional awareness and thoughtful reflection, no text, no logos and no watermark.'
        });
        expect(normalizeVisualPrompt(wrapped)).to.include('emotional awareness');
    });

    it('recovers a usable prompt from a truncated JSON string instead of throwing', () => {
        const broken = '{"prompt":"Wide 16:9 non-human illustration showing connected abstract forms, balanced colour relationships and a calm central focal object representing emotional understanding, empathy and self-awareness, no text, no logos and no watermark';
        const recovered = recoverPromptFromBrokenJson(broken);
        expect(recovered).to.include('emotional understanding');
        expect(normalizeVisualPrompt(broken)).to.equal(recovered);
    });

    it('enforces 3D and text-free requirements when the generated prompt omits them', () => {
        const prompt = enforceVisualPromptRequirements('A secure office desk with a laptop and document tray representing careful data handling.');
        expect(prompt).to.match(/3D/i);
        expect(prompt).to.include('Wide 16:9 composition');
        expect(prompt).to.include('Non-human scene');
        expect(prompt).to.include('Absolutely no text');
        expect(prompt).to.include('No logos');
        expect(prompt).to.include('No watermark');
    });

    it('grounds an emotions slide in its actual lesson and forbids unrelated cyber imagery', () => {
        const instruction = slideInstruction({
            title: 'Why Emotional Understanding Matters',
            content: 'Understanding emotions improves self-awareness, empathy, relationships and thoughtful decision-making.',
            keyPoints: ['Self-awareness', 'Empathy', 'Better relationships']
        }, {
            title: 'Navigating Our Inner World: Understanding Emotions'
        }, 0);

        expect(instruction).to.include('Why Emotional Understanding Matters');
        expect(instruction).to.include('self-awareness');
        expect(instruction).to.include('empathy');
        expect(instruction).to.include('concrete topic-specific 3D scene');
        expect(instruction).to.include('Do not introduce cybersecurity objects');
        expect(instruction).to.include('Do not return JSON');
    });

    it('plans cover and every slide prompt in one Gemini batch response', () => {
        const course = {
            title: 'Understanding Emotions',
            summary: 'Learn emotional awareness and thoughtful responses.',
            slides: [
                { title: 'Why Emotions Matter', content: 'Emotions shape decisions and relationships.', keyPoints: ['Awareness', 'Empathy'] },
                { title: 'Valence and Arousal', content: 'Emotions can be described by pleasantness and activation.', keyPoints: ['Valence', 'Arousal'] }
            ]
        };
        const instruction = batchInstruction(course);
        expect(instruction).to.include('Create the complete visual plan for the course in ONE response');
        expect(instruction).to.include('meaningfully different in subject, object arrangement and camera composition');
        expect(instruction).to.include('premium modern 3D art direction');
        expect(instruction).to.include('COVER|||<cover prompt>');
        expect(instruction).to.include('SLIDE 1|||<slide 1 prompt>');
        expect(instruction).to.include('SLIDE 2|||<slide 2 prompt>');

        const parsed = parseBatchPrompts([
            'COVER|||Wide 16:9 non-human abstract illustration of layered coloured forms representing a broad emotional spectrum and self-awareness, premium soft lighting, no text, no logos and no watermark.',
            'SLIDE 1|||Wide 16:9 non-human illustration of balanced interconnected shapes representing emotional awareness, empathy and thoughtful decision-making, clean corporate composition, no text, no logos and no watermark.',
            'SLIDE 2|||Wide 16:9 non-human illustration using a calm two-axis composition of abstract objects representing pleasantness and activation without labels, clean premium lighting, no text, no logos and no watermark.'
        ].join('\n'), 2);
        expect(parsed.missing).to.deep.equal([]);
        expect(parsed.coverPrompt).to.include('emotional spectrum');
        expect(parsed.slidePrompts[0]).to.include('empathy');
        expect(parsed.slidePrompts[1]).to.include('pleasantness');
        expect(parsed.coverPrompt).to.match(/3D/i);
        expect(parsed.slidePrompts[0]).to.match(/3D/i);
        expect(parsed.slidePrompts[1]).to.match(/3D/i);
    });
});
