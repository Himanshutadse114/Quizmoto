'use strict';

const DESIGN_FIELDS = Object.freeze([
    'layout',
    'layoutId',
    'layoutVersion',
    'screenType',
    'backgroundStyle',
    'visualMetaphor',
    'interaction',
    'interactionId',
    'interactionVersion'
]);

function hasPlannedSlideDesign(analysis) {
    const slides = Array.isArray(analysis?.slides) ? analysis.slides : [];
    return slides.length > 0 && slides.every((slide) => Boolean(slide?.layout && slide?.screenType));
}

function slideKey(slide, index) {
    const stable = String(slide?.slideId || slide?.id || '').trim();
    return stable ? `id:${stable}` : `index:${index}`;
}

function preserveCourseDesign(editedAnalysis, storedAnalysis) {
    const edited = editedAnalysis && typeof editedAnalysis === 'object' ? editedAnalysis : {};
    const stored = storedAnalysis && typeof storedAnalysis === 'object' ? storedAnalysis : {};
    const storedSlides = Array.isArray(stored.slides) ? stored.slides : [];
    const byKey = new Map(storedSlides.map((slide, index) => [slideKey(slide, index), slide]));

    return {
        ...edited,
        slides: (Array.isArray(edited.slides) ? edited.slides : []).map((slide, index) => {
            const current = slide && typeof slide === 'object' ? slide : {};
            const previous = byKey.get(slideKey(current, index)) || storedSlides[index];
            if (!previous) return current;

            const next = { ...current };
            DESIGN_FIELDS.forEach((field) => {
                if (previous[field] !== undefined) {
                    next[field] = previous[field] && typeof previous[field] === 'object'
                        ? JSON.parse(JSON.stringify(previous[field]))
                        : previous[field];
                }
            });
            return next;
        })
    };
}

module.exports = {
    DESIGN_FIELDS,
    hasPlannedSlideDesign,
    preserveCourseDesign
};
