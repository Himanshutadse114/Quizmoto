const { expect } = require('chai');
const {
    highlyInteractiveTopicPrompt,
    anchorHighlyInteractivePrompt
} = require('../services/scorm/GeminiCourseMediaService');

describe('Highly Interactive visual topic relevance', () => {
    const slide = {
        title: 'Recognizing common email phishing',
        content: 'Inspect the sender domain, unexpected urgency and suspicious links before taking action.',
        keyPoints: ['Check the sender domain', 'Question unexpected urgency', 'Inspect suspicious links']
    };

    it('anchors a generic generated prompt to the exact Highly Interactive lesson', () => {
        const prompt = highlyInteractiveTopicPrompt(
            'A polished modern 3D educational illustration with soft studio lighting, no text and no logos.',
            slide,
            { templateBinding: { templateId: 'highly-interactive' } }
        );
        expect(prompt).to.include('Recognizing common email phishing');
        expect(prompt).to.include('Check the sender domain');
        expect(prompt).to.include('Question unexpected urgency');
        expect(prompt).to.include('Do not substitute a generic decorative, abstract or unrelated illustration.');
    });

    it('does not change prompts belonging to another course template', () => {
        const original = 'A polished modern 3D illustration for an existing professional course.';
        expect(highlyInteractiveTopicPrompt(
            original,
            slide,
            { templateBinding: { templateId: 'professional-classic' } }
        )).to.equal(original);
    });

    it('preserves prompt metadata while adding the topic anchor', () => {
        const anchored = anchorHighlyInteractivePrompt(
            { prompt: 'A clean 3D scene.', model: 'gemini-test' },
            slide,
            { templateBinding: { templateId: 'highly-interactive' } }
        );
        expect(anchored.model).to.equal('gemini-test');
        expect(anchored.prompt).to.include(slide.title);
    });
});
