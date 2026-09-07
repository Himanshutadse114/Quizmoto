'use strict';

function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function isVisualProductTraining(analysis) {
    return String(analysis?.templateBinding?.templateId || '').trim() === 'visual-product-training'
        && String(analysis?.templateBinding?.templateVersion || '').trim() === '1.1.0';
}

function compositionForSlide(slide = {}) {
    const interaction = clean(slide?.interaction?.type).toLowerCase();
    const layout = clean(slide?.layout).toLowerCase();
    if (interaction === 'hotspot_explore' || layout === 'hub') {
        return 'Compose one dominant product, interface, device or process scene with 3 to 4 clearly separated focal regions. Keep those regions visually distinct and leave clean breathing room around them so numbered interactive callouts can be overlaid later.';
    }
    if (interaction === 'step_explore' || layout === 'process' || layout === 'timeline') {
        return 'Show a clear guided sequence or procedure state with strong directional flow, a dominant main subject and visibly separated stages. Avoid a collage of unrelated objects.';
    }
    if (interaction === 'compare_reveal' || layout === 'comparison') {
        return 'Use a deliberate before-versus-after, state-versus-state or side-by-side visual composition with an obvious shared subject and balanced halves for comparison.';
    }
    return 'Use a premium product-demo composition with one dominant visual subject occupying most of the frame, cinematic depth, clean negative space and a small number of supporting details.';
}

function appendDirection(prompt, direction) {
    const base = clean(prompt);
    if (!base) return base;
    const marker = 'VISUAL PRODUCT TRAINING COMPOSITION:';
    if (base.includes(marker)) return base;
    return `${base}\n\n${marker} ${direction} Keep the image free of text, labels, logos, captions and watermarks. The learner interface will add callouts separately.`;
}

function applyVisualProductPromptDirection(rawAnalysis) {
    const analysis = rawAnalysis && typeof rawAnalysis === 'object' ? rawAnalysis : {};
    if (!isVisualProductTraining(analysis)) return analysis;

    return {
        ...analysis,
        visualExperience: 'visual-product-v2',
        coverImagePrompt: appendDirection(
            analysis.coverImagePrompt,
            'Create a striking hero visual with one clear subject, premium lighting, generous depth and a composition suitable for a modern interactive product walkthrough.'
        ),
        slides: (Array.isArray(analysis.slides) ? analysis.slides : []).map((slide) => ({
            ...(slide || {}),
            imagePrompt: appendDirection(slide?.imagePrompt, compositionForSlide(slide))
        }))
    };
}

module.exports = {
    applyVisualProductPromptDirection,
    compositionForSlide,
    isVisualProductTraining
};
