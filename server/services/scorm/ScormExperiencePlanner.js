const SCREEN_TYPES = ['concept', 'hotspot', 'process', 'scenario', 'comparison', 'reveal', 'timeline', 'takeaway'];
const BACKGROUNDS = ['mesh', 'glow', 'grid', 'orbit', 'waves', 'focus'];
const RENDER_LAYOUTS = ['process', 'cards', 'timeline', 'comparison', 'hub', 'spotlight'];

function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalize(value) {
    return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function wordCount(value) {
    return clean(value).split(/\s+/).filter(Boolean).length;
}

/**
 * Detailed course copy must stay learner-visible. Interactions may reinforce a
 * lesson, but they must never hide the main teaching passage.
 */
function splitCopy(content) {
    const full = clean(content);
    return { introText: full, revealText: '' };
}

/**
 * Repair legacy planned slides when they are rebuilt. Older generated analyses
 * can contain only the first sentence in content/introText and the remaining
 * teaching copy in revealText. Merge those fields back into one visible passage.
 */
function canonicalLearningCopy(slide) {
    const content = clean(slide?.content);
    const intro = clean(slide?.introText);
    const reveal = clean(slide?.revealText);

    if (reveal) {
        const visible = intro || content;
        const contentLooksTruncated = wordCount(content) < 70;
        const introLooksTruncated = wordCount(intro) < 70;
        if (contentLooksTruncated || introLooksTruncated) {
            const prefix = visible || content;
            if (!prefix) return reveal;
            if (normalize(reveal).startsWith(normalize(prefix))) return reveal;
            return clean(`${prefix} ${reveal}`);
        }
    }

    if (!reveal && intro && content && normalize(intro) !== normalize(content)) {
        return intro;
    }

    return content || intro || reveal;
}

function metaphorFor(slide) {
    if (clean(slide.visualMetaphor)) return clean(slide.visualMetaphor).toLowerCase();
    const text = `${slide.title || ''} ${slide.content || ''} ${(Array.isArray(slide.keyPoints) ? slide.keyPoints.join(' ') : '')}`.toLowerCase();
    if (/qr|quick response|quishing/.test(text)) return 'qr';
    if (/deepfake|voice clone|audio clone|synthetic voice|synthetic video|artificial intelligence|\bai\b/.test(text)) return 'ai-wave';
    if (/smish|sms|text message|whatsapp|messaging app/.test(text)) return 'phone';
    if (/vish|phone call|caller|callback|pretext|pretexting/.test(text)) return 'phone';
    if (/phish|fraudulent email|suspicious email|inbox|sender address|email message/.test(text)) return 'email';
    if (/bait|usb|removable media|malicious attachment|attachment/.test(text)) return 'file';
    if (/tailgat|physical access|restricted area|badge|impersonat|identity/.test(text)) return 'identity';
    if (/browser|website|url|domain|sign-in page|login page/.test(text)) return 'browser';
    if (/password|credential|login|authentication|mfa|passkey/.test(text)) return 'lock';
    if (/ransom|encrypt(s|ed)? file|malware payload/.test(text)) return 'file';
    if (/cloud|share|drive|saas/.test(text)) return 'cloud';
    if (/warning|incident|threat|malware|risk|attack/.test(text)) return 'warning';
    return 'shield';
}

function semanticLayout(slide) {
    const title = String(slide?.title || '').toLowerCase();
    const points = (Array.isArray(slide?.keyPoints) ? slide.keyPoints.join(' ') : '').toLowerCase();
    const structureText = `${title} ${points}`;

    if (/timeline|history|phase|sequence|journey|before.*after|from .* to /.test(structureText)) return 'timeline';
    if (/step|process|workflow|how .* works|lifecycle|flow|reporting process|response process|verification process/.test(structureText)) return 'process';
    if (/versus|\bvs\b|difference between|compare|comparison|safe .* unsafe|recommended .* avoid|do .* don.?t|smishing and vishing|vishing and smishing/.test(structureText)) return 'comparison';
    if (/types of|categories|channels|pillars|components|warning signs|red flags|indicators|signals|checklist/.test(structureText)) return 'hub';
    if (/tips|rules|principles|things to|actions to|ways to|key behaviours|key behaviors/.test(title)) return 'cards';
    return 'spotlight';
}

function chooseBalancedLayouts(slides) {
    const total = slides.length;
    const maxCards = Math.max(1, Math.min(2, Math.ceil(total * 0.18)));
    const maxHubs = Math.max(1, Math.min(2, Math.ceil(total * 0.18)));
    const counts = Object.create(null);
    let previous = '';
    let sameRun = 0;

    return slides.map((slide) => {
        const explicit = clean(slide?.layout).toLowerCase();
        const semantic = semanticLayout(slide);
        let layout = semantic;

        if (RENDER_LAYOUTS.includes(explicit) && !['cards', 'hub'].includes(explicit)) {
            layout = explicit;
        }

        if (layout === 'cards' && (counts.cards || 0) >= maxCards) layout = 'spotlight';
        if (layout === 'hub' && (counts.hub || 0) >= maxHubs) layout = 'spotlight';

        if (['cards', 'hub'].includes(layout) && ['cards', 'hub'].includes(previous)) {
            layout = 'spotlight';
        }

        const prospectiveRun = layout === previous ? sameRun + 1 : 1;
        if (prospectiveRun > 2) {
            if (layout !== 'spotlight') {
                layout = 'spotlight';
            } else if ((counts.cards || 0) < maxCards && previous !== 'cards') {
                layout = 'cards';
            } else if ((counts.hub || 0) < maxHubs && previous !== 'hub') {
                layout = 'hub';
            }
        }

        if (layout === previous) sameRun += 1;
        else {
            previous = layout;
            sameRun = 1;
        }
        counts[layout] = (counts[layout] || 0) + 1;
        return layout;
    });
}

function preferredType(slide, layout, index, interactiveUsed) {
    const text = `${slide.title || ''} ${slide.content || ''}`.toLowerCase();
    if (layout === 'comparison') return 'comparison';
    if (layout === 'timeline') return 'timeline';
    if (layout === 'process') return 'process';

    if (layout === 'cards' && interactiveUsed < 2) return 'reveal';
    if (layout === 'hub' && interactiveUsed < 2) return 'hotspot';
    if (/scenario|imagine|suppose|you receive|you notice|you are|if you|when you|example|case study/.test(text) && index > 0) return 'scenario';
    if (/remember|critical|key takeaway|most important|always|never/.test(text)) return 'takeaway';
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

function interactionFor(type, layout) {
    if (type === 'scenario') return { type: 'decision_explore', prompt: 'Consider the situation and identify the safest response.' };
    if (type === 'reveal') return { type: 'click_reveal', prompt: 'Open each point to explore the practical detail.' };
    if (type === 'hotspot') return { type: 'hotspot_explore', prompt: 'Explore the key signals and what they mean.' };
    if (type === 'comparison') return { type: 'compare_reveal', prompt: 'Compare the patterns and identify what changes the decision.' };
    if (type === 'timeline' || layout === 'timeline') return { type: 'step_explore', prompt: 'Follow the sequence to understand how the situation develops.' };
    if (type === 'process' || layout === 'process') return { type: 'step_explore', prompt: 'Follow the steps to understand the process.' };
    return { type: 'focus_reveal', prompt: 'Review the lesson and the action to remember.' };
}

function preserveInteractionTemplate(slide, plannedInteraction) {
    const existing = slide?.interaction && typeof slide.interaction === 'object' ? slide.interaction : {};
    const templateId = clean(existing.templateId);
    return {
        ...plannedInteraction,
        ...(templateId ? { templateId } : {}),
        ...(Array.isArray(existing.items) ? { items: existing.items } : {}),
        ...(Array.isArray(existing.choices) ? { choices: existing.choices } : {}),
        ...(existing.completion && typeof existing.completion === 'object' ? { completion: existing.completion } : {})
    };
}

function pointLimitFor(slide, type) {
    const layout = clean(slide?.layout).toLowerCase();
    if (layout === 'cards' || layout === 'hub' || type === 'reveal') return 4;
    if (layout === 'process' || layout === 'timeline' || layout === 'spotlight') return 4;
    return 6;
}

function concisePoints(points, limit = 6) {
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
        .slice(0, limit);
}

function planExperienceV5(rawAnalysis) {
    const analysis = rawAnalysis && typeof rawAnalysis === 'object' ? rawAnalysis : {};
    const rawSlides = Array.isArray(analysis.slides) ? analysis.slides : [];
    const canonicalSlides = rawSlides.map((rawSlide) => {
        const slide = rawSlide && typeof rawSlide === 'object' ? rawSlide : {};
        const canonicalContent = canonicalLearningCopy(slide);
        return { ...slide, content: canonicalContent };
    });
    const layouts = chooseBalancedLayouts(canonicalSlides);
    let previousBackground = '';
    let interactiveUsed = 0;

    const planned = canonicalSlides.map((slide, index) => {
        const layout = layouts[index] || 'spotlight';
        const type = preferredType(slide, layout, index, interactiveUsed);
        if (type === 'reveal' || type === 'hotspot') interactiveUsed += 1;
        const background = backgroundFor(type, index, previousBackground);
        const result = {
            ...slide,
            layout,
            content: slide.content,
            screenType: SCREEN_TYPES.includes(type) ? type : 'concept',
            backgroundStyle: background,
            visualMetaphor: metaphorFor({ ...slide, visualMetaphor: '' }),
            introText: slide.content,
            revealText: '',
            keyPoints: concisePoints(slide.keyPoints, pointLimitFor({ ...slide, layout }, type)),
            interaction: preserveInteractionTemplate(slide, interactionFor(type, layout))
        };
        previousBackground = result.backgroundStyle;
        return result;
    });

    return {
        ...analysis,
        experienceVersion: 5,
        experiencePlanner: 'balanced-visual-v8',
        slides: planned
    };
}

module.exports = {
    planExperienceV5,
    splitCopy,
    canonicalLearningCopy,
    metaphorFor,
    semanticLayout,
    chooseBalancedLayouts,
    backgroundFor,
    pointLimitFor,
    preserveInteractionTemplate,
    SCREEN_TYPES,
    BACKGROUNDS,
    RENDER_LAYOUTS
};