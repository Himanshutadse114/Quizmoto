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

const VISUAL_DIVERSITY_PROFILES = [
    'Causal chain composition with one clear trigger, intermediate mechanism and visible consequence; oblique three-quarter camera.',
    'Split-scene contrast showing the safe and unsafe states through different objects and spatial relationships; straight-on editorial camera.',
    'Macro evidence-inspection composition focused on small topic-specific clues; shallow depth of field and asymmetric framing.',
    'Decision-checkpoint environment with two visibly different paths and one verification barrier; elevated isometric camera.',
    'Sequential process environment with three distinct physical stages; wide lateral composition and strong directional flow.',
    'Layered system cutaway showing how the mechanism moves between levels; centred architectural composition.',
    'Consequence-first scene where a single failed control changes the surrounding environment; low-angle dramatic composition.',
    'Prevention workflow built from topic-specific tools arranged around one protected outcome; top-down radial composition.'
];

function visualDiversityInstruction(slide, analysis, slideIndex) {
    const index = Math.max(0, Number(slideIndex) || 0);
    const profile = VISUAL_DIVERSITY_PROFILES[index % VISUAL_DIVERSITY_PROFILES.length];
    const authoredDirection = excerpt(slide?.visualDirection, 420);
    const otherTopics = (Array.isArray(analysis?.slides) ? analysis.slides : [])
        .filter((_, candidateIndex) => candidateIndex !== index)
        .map((candidate) => clean(candidate?.title))
        .filter(Boolean)
        .slice(0, 8)
        .join('; ');
    return clean([
        `UNIQUE ART DIRECTION FOR THIS LESSON: ${authoredDirection || profile}`,
        authoredDirection ? `COMPOSITION PROFILE: ${profile}` : '',
        otherTopics ? `Do not illustrate the other course lessons or borrow their focal concepts: ${otherTopics}.` : '',
        'COURSE-WIDE DIVERSITY: use a different environment, main object family, camera angle and spatial arrangement from every other course image.',
        'Never repeat a staged desk containing combinations of laptop, phone, notebook, mug, pen or plant. A digital device may appear only when indispensable to this exact lesson, and it must not become generic office decoration.'
    ].filter(Boolean).join(' '));
}

function sharedVisualRules() {
    return [
        'Wide 16:9 professional course illustration.',
        'Modern polished semi-realistic 3D render with believable depth, materials, soft shadows and premium studio lighting.',
        'One clear focal concept with two to five supporting objects and generous negative space.',
        'Use concrete topic-specific objects and relationships from the lesson; avoid generic decoration.',
        'Keep the course visually consistent through palette, materials and lighting, not by repeating the same setting or props.',
        'Non-human scene: no people, faces, hands, bodies, silhouettes or avatars.',
        'No text, letters, numbers, labels, logos, brands, watermarks or readable interfaces.',
        'No unrelated locks, shields, warning signs, devices or cybersecurity symbols unless the lesson specifically requires them.',
        'Avoid generic office stock imagery and staged desk arrangements.'
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
        'The cover must use a bold course-level environment that will not be reused for lesson images. Do not use a laptop-on-desk, phone-on-desk, notebook, mug or plant arrangement.',
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
        clean(slide?.learningPurpose) ? `Unique learning purpose: ${clean(slide.learningPurpose)}.` : '',
        `What the learner must understand: ${excerpt(slide?.content || slide?.introText || slide?.revealText, 800)}.`,
        points ? `Concrete key ideas: ${points}.` : '',
        clean(slide?.visualTitle) ? `Visual emphasis: ${clean(slide.visualTitle)}.` : '',
        visualDiversityInstruction(slide, analysis, slideIndex),
        'Translate this exact lesson into one concrete object arrangement or environment. The concept must be understandable from the visual relationships alone.',
        sharedVisualRules()
    ].filter(Boolean).join(' '));
}

async function generateCoverVisualPrompt(analysis) {
    const cachedPrompt = clean(analysis?.coverImagePrompt);
    return {
        prompt: cachedPrompt
            ? clean([
                cachedPrompt,
                'COURSE-WIDE DIVERSITY: make this cover a unique course-level environment that is not reused by any lesson image.',
                'Do not use a generic staged desk, laptop, phone, notebook, mug or plant arrangement.',
                sharedVisualRules()
            ].join(' '))
            : coverInstruction(analysis),
        model: 'deterministic-course-grounded-v1',
        cached: Boolean(cachedPrompt)
    };
}

async function generateSlideVisualPrompt(slide, analysis, slideIndex) {
    const cachedPrompt = clean(slide?.imagePrompt);
    return {
        prompt: cachedPrompt
            ? clean([cachedPrompt, visualDiversityInstruction(slide, analysis, slideIndex), sharedVisualRules()].join(' '))
            : slideInstruction(slide, analysis, slideIndex),
        model: 'deterministic-course-grounded-v1',
        cached: Boolean(cachedPrompt)
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
    VISUAL_DIVERSITY_PROFILES,
    visualDiversityInstruction,
    coverInstruction,
    slideInstruction,
    generateCoverVisualPrompt,
    generateSlideVisualPrompt,
    generateCourseVisualPrompts,
    modelCandidates
};
