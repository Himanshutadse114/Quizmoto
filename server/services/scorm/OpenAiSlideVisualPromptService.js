'use strict';

const { textModel } = require('../openai/OpenAiClient');

function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function excerpt(value, maxChars = 900) {
    const text = clean(value);
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars).replace(/\s+\S*$/, '').trim()}…`;
}

function sharedVisualRules() {
    return [
        'Wide 16:9 professional course illustration.',
        'Modern polished semi-realistic 3D render with believable depth, materials, soft shadows and premium studio lighting.',
        'One clear focal concept with two to five supporting objects and generous negative space.',
        'Use concrete topic-specific objects and relationships from the lesson; avoid generic decoration.',
        'Non-human scene: no people, faces, hands, bodies, silhouettes or avatars.',
        'No text, letters, numbers, labels, logos, brands, watermarks or readable interfaces.',
        'No unrelated locks, shields, warning signs, devices or cybersecurity symbols unless the lesson specifically requires them.'
    ].join(' ');
}

function coverInstruction(analysis) {
    const lessons = (Array.isArray(analysis?.slides) ? analysis.slides : [])
        .slice(0, 4)
        .map((slide) => clean(slide?.title))
        .filter(Boolean)
        .join('; ');
    return clean([
        `Create the opening visual for a professional course titled “${clean(analysis?.title) || 'Learning course'}”.`,
        `Course purpose: ${excerpt(analysis?.summary, 700)}.`,
        lessons ? `Core lessons represented by the scene: ${lessons}.` : '',
        'Choose one recognisable hero scene that represents the complete course subject, not a generic atmosphere.',
        sharedVisualRules()
    ].filter(Boolean).join(' '));
}

function slideInstruction(slide, analysis, slideIndex) {
    const points = (Array.isArray(slide?.keyPoints) ? slide.keyPoints : [])
        .map(clean)
        .filter(Boolean)
        .slice(0, 4)
        .join('; ');
    return clean([
        `Create a visual for lesson ${Number(slideIndex) + 1} of “${clean(analysis?.title) || 'Learning course'}”.`,
        `Exact lesson topic: ${clean(slide?.title) || `Section ${Number(slideIndex) + 1}`}.`,
        `What the learner must understand: ${excerpt(slide?.content || slide?.introText || slide?.revealText, 800)}.`,
        points ? `Concrete key ideas: ${points}.` : '',
        clean(slide?.visualTitle) ? `Visual emphasis: ${clean(slide.visualTitle)}.` : '',
        'Translate this exact lesson into one concrete object arrangement or environment. The concept must be understandable from the visual relationships alone.',
        sharedVisualRules()
    ].filter(Boolean).join(' '));
}

async function generateCoverVisualPrompt(analysis) {
    return {
        prompt: clean(analysis?.coverImagePrompt) || coverInstruction(analysis),
        model: 'deterministic-course-grounded-v1',
        cached: Boolean(clean(analysis?.coverImagePrompt))
    };
}

async function generateSlideVisualPrompt(slide, analysis, slideIndex) {
    return {
        prompt: clean(slide?.imagePrompt) || slideInstruction(slide, analysis, slideIndex),
        model: 'deterministic-course-grounded-v1',
        cached: Boolean(clean(slide?.imagePrompt))
    };
}

async function generateCourseVisualPrompts(analysis) {
    const slides = Array.isArray(analysis?.slides) ? analysis.slides : [];
    return {
        coverPrompt: (await generateCoverVisualPrompt(analysis)).prompt,
        slidePrompts: slides.map((slide, index) => slideInstruction(slide, analysis, index)),
        model: 'deterministic-course-grounded-v1',
        cached: false
    };
}

function modelCandidates() {
    return [textModel()];
}

module.exports = {
    clean,
    excerpt,
    sharedVisualRules,
    coverInstruction,
    slideInstruction,
    generateCoverVisualPrompt,
    generateSlideVisualPrompt,
    generateCourseVisualPrompts,
    modelCandidates
};
