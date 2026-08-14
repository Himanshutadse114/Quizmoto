const SCREEN_TYPES = ['concept', 'hotspot', 'process', 'scenario', 'comparison', 'reveal', 'timeline', 'takeaway'];
const BACKGROUNDS = ['mesh', 'glow', 'grid', 'orbit', 'waves', 'focus'];

function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalize(value) {
    return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function wordCount(value) {
    return clean(value).split(/\s+/).filter(Boolean).length;
}

function splitCopy(content) {
    const full = clean(content);
    if (!full) return { introText: '', revealText: '' };
    const sentences = full.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [full];
    const first = clean(sentences[0]);
    if (first && wordCount(first) <= 38 && sentences.length > 1) {
        return { introText: first, revealText: clean(sentences.slice(1).join(' ')) };
    }
    const words = full.split(/\s+/);
    if (words.length > 40) {
        return {
            introText: `${words.slice(0, 28).join(' ')}…`,
            revealText: words.slice(28).join(' ')
        };
    }
    return { introText: full, revealText: '' };
}

function metaphorFor(slide) {
    if (clean(slide.visualMetaphor)) return clean(slide.visualMetaphor).toLowerCase();
    const text = `${slide.title || ''} ${slide.content || ''}`.toLowerCase();

    // Prefer the most specific visual signal before broad attack-channel terms.
    // For example, "QR phishing" must remain a QR experience instead of being
    // downgraded to the generic email/phishing metaphor.
    if (/qr|quick response/.test(text)) return 'qr';
    if (/voice|deepfake|audio|synthetic|artificial intelligence|\bai\b/.test(text)) return 'ai-wave';
    if (/password|credential|login|authentication|mfa|passkey/.test(text)) return 'lock';
    if (/phone|sms|whatsapp|call|mobile/.test(text)) return 'phone';
    if (/ransom|file|attachment|document/.test(text)) return 'file';
    if (/cloud|share|drive/.test(text)) return 'cloud';
    if (/identity|account|employee|user|person/.test(text)) return 'identity';
    if (/browser|website|url|link/.test(text)) return 'browser';
    if (/email|phish|inbox|message/.test(text)) return 'email';
    if (/warning|incident|threat|malware|risk|attack/.test(text)) return 'warning';
    return 'shield';
}

function preferredType(slide, index) {
    const explicit = clean(slide.screenType).toLowerCase();
    if (SCREEN_TYPES.includes(explicit)) return explicit;
    const layout = clean(slide.layout).toLowerCase();
    const text = `${slide.title || ''} ${slide.content || ''}`.toLowerCase();

    if (/scenario|imagine|suppose|you receive|you notice|you are|if you|when you|example/.test(text) && index > 0) return 'scenario';
    if (/remember|critical|key takeaway|most important|always|never/.test(text) || layout === 'spotlight') return 'takeaway';
    if (layout === 'comparison' || layout === 'matrix') return 'comparison';
    if (layout === 'timeline') return 'timeline';
    if (layout === 'process' || layout === 'cycle') return 'process';
    if (layout === 'hub') return 'hotspot';
    if (layout === 'cards') return index % 2 ? 'reveal' : 'concept';
    return index % 4 === 1 ? 'hotspot' : 'concept';
}

function alternateType(type, slide, index) {
    const layout = clean(slide.layout).toLowerCase();
    if (type === 'concept') return layout === 'cards' ? 'reveal' : 'hotspot';
    if (type === 'hotspot') return 'reveal';
    if (type === 'process') return index % 2 ? 'timeline' : 'concept';
    if (type === 'timeline') return 'process';
    if (type === 'comparison') return 'scenario';
    if (type === 'scenario') return 'takeaway';
    if (type === 'reveal') return 'concept';
    return 'concept';
}

function backgroundFor(type, index, previous) {
    const preferred = {
        concept: ['mesh', 'grid'],
        hotspot: ['orbit', 'glow'],
        process: ['grid', 'mesh'],
        scenario: ['focus', 'glow'],
        comparison: ['mesh', 'grid'],
        reveal: ['waves', 'mesh'],
        timeline: ['grid', 'waves'],
        takeaway: ['glow', 'focus']
    }[type] || BACKGROUNDS;
    let choice = preferred[index % preferred.length];
    if (choice === previous) choice = preferred[(index + 1) % preferred.length] || BACKGROUNDS[(index + 1) % BACKGROUNDS.length];
    return choice;
}

function interactionFor(type, layout, existing) {
    const prompt = clean(existing?.prompt);
    if (existing?.type && prompt) return { ...existing, prompt };
    if (type === 'scenario') return { type: 'decision_explore', prompt: 'Consider the situation. Which signal or action would you examine first?' };
    if (type === 'reveal') return { type: 'click_reveal', prompt: 'Open each point to reveal the practical detail.' };
    if (type === 'hotspot') return { type: 'hotspot_explore', prompt: 'Explore the visual markers to uncover the important signals.' };
    if (type === 'comparison') return { type: 'compare_reveal', prompt: 'Compare the two patterns and identify what changes the decision.' };
    if (type === 'takeaway') return { type: 'focus_reveal', prompt: 'Reveal the key action you should remember.' };
    if (type === 'timeline' || layout === 'timeline') return { type: 'step_explore', prompt: 'Explore each stage to understand how the situation develops.' };
    if (type === 'process' || layout === 'process' || layout === 'cycle') return { type: 'step_explore', prompt: 'Explore each step to understand how the process works.' };
    return { type: 'hotspot_explore', prompt: 'Explore the learning points before continuing.' };
}

function concisePoints(points) {
    const seen = new Set();
    return (Array.isArray(points) ? points : [])
        .map(clean)
        .filter(Boolean)
        .filter((point) => {
            const key = normalize(point);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, 6);
}

function planExperienceV5(rawAnalysis) {
    const analysis = rawAnalysis && typeof rawAnalysis === 'object' ? rawAnalysis : {};
    const slides = Array.isArray(analysis.slides) ? analysis.slides : [];
    let previousType = '';
    let previousBackground = '';

    const planned = slides.map((rawSlide, index) => {
        const slide = rawSlide && typeof rawSlide === 'object' ? rawSlide : {};
        const explicitType = clean(slide.screenType).toLowerCase();
        const hasExplicitType = SCREEN_TYPES.includes(explicitType);
        let type = preferredType(slide, index);
        if (!hasExplicitType && type === previousType) type = alternateType(type, slide, index);
        const copy = splitCopy(slide.content);
        const explicitBackground = clean(slide.backgroundStyle).toLowerCase();
        const background = explicitBackground || backgroundFor(type, index, previousBackground);
        const result = {
            ...slide,
            screenType: type,
            backgroundStyle: BACKGROUNDS.includes(background) ? background : backgroundFor(type, index, previousBackground),
            visualMetaphor: metaphorFor(slide),
            introText: clean(slide.introText) || copy.introText,
            revealText: clean(slide.revealText) || copy.revealText,
            keyPoints: concisePoints(slide.keyPoints),
            interaction: interactionFor(type, slide.layout, slide.interaction)
        };
        previousType = result.screenType;
        previousBackground = result.backgroundStyle;
        return result;
    });

    return {
        ...analysis,
        experienceVersion: 5,
        experiencePlanner: 'content-aware-v5',
        slides: planned
    };
}

module.exports = {
    planExperienceV5,
    splitCopy,
    metaphorFor,
    preferredType,
    backgroundFor,
    SCREEN_TYPES,
    BACKGROUNDS
};
