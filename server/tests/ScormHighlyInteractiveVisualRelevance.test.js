const { expect } = require('chai');
const {
    highlyInteractiveTopicPrompt,
    anchorHighlyInteractivePrompt,
    highlyInteractiveCoverPrompt,
    anchorHighlyInteractiveCoverPrompt
} = require('../services/scorm/OpenAiCourseMediaService');

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
            { prompt: 'A clean 3D scene.', model: 'gpt-image-test' },
            slide,
            { templateBinding: { templateId: 'highly-interactive' } }
        );
        expect(anchored.model).to.equal('gpt-image-test');
        expect(anchored.prompt).to.include(slide.title);
    });

    it('grounds the opening image in the complete course rather than a generic hero graphic', () => {
        const analysis = {
            title: 'Phishing Awareness for Finance Teams',
            summary: 'Finance staff learn to inspect payment requests, verify senders independently and report suspicious messages before transferring money.',
            templateBinding: { templateId: 'highly-interactive' },
            slides: [
                slide,
                {
                    title: 'Verify payment requests independently',
                    keyPoints: ['Use a trusted contact channel']
                }
            ]
        };
        const prompt = highlyInteractiveCoverPrompt(
            'A premium modern 3D course cover with cinematic lighting, no text and no logos.',
            analysis
        );

        expect(prompt).to.include(analysis.title);
        expect(prompt).to.include('verify senders independently');
        expect(prompt).to.include('Recognizing common email phishing');
        expect(prompt).to.include('Verify payment requests independently');
        expect(prompt).to.include('not merely create atmosphere');
        expect(prompt).to.include('Reject generic abstract shapes');
    });

    it('keeps other course-template cover prompts unchanged', () => {
        const original = 'A professional course cover.';
        const analysis = {
            title: 'A course',
            templateBinding: { templateId: 'professional-classic' }
        };
        expect(highlyInteractiveCoverPrompt(original, analysis)).to.equal(original);
    });

    it('preserves cover prompt metadata while applying course-level topic fidelity', () => {
        const analysis = {
            title: 'Safe equipment isolation',
            summary: 'Operators identify energy sources before maintenance.',
            templateBinding: { templateId: 'highly-interactive' },
            slides: [{ title: 'Identify every energy source', keyPoints: ['Inspect before isolation'] }]
        };
        const anchored = anchorHighlyInteractiveCoverPrompt(
            { prompt: 'A clean 3D hero scene.', model: 'gpt-image-test' },
            analysis
        );
        expect(anchored.model).to.equal('gpt-image-test');
        expect(anchored.prompt).to.include(analysis.title);
        expect(anchored.prompt).to.include('Identify every energy source');
    });
});
