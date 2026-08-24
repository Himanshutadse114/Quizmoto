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

/**
 * Detailed course copy must stay learner-visible.
 *
 * Older planner versions split a 120-170 word teaching passage into a one-line
 * intro plus a hidden revealText field. The base learner renderer displays
 * `content`, so a second planning pass could collapse a detailed slide down to
 * its first sentence. Keep the complete instructional passage in introText and
 * content instead; interactions are supplied by key points/cards, not by hiding
 * the lesson itself.
 */
function splitCopy(content) {
    const full = clean(content);
    return { introText: full, revealText: '' };
}

/**
 * Repair legacy planned slides when they are rebuilt. Old generated analyses
 * can contain only the first sentence in content/introText and the remaining
 * teaching copy in revealText. Merge those fields back into one canonical,
 * visible passage so Save & rebuild can repair an existing thin-looking course.
 *
 * In the new planner content and introText initially match. If the Content
 * Editor later changes introText, the mismatch is intentional learner editing,
 * so the edited visible text becomes canonical on rebuild.
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

    // Prefer the attack/channel being taught before secondary words such as
    // "credential" or "file". This prevents a phishing lesson from receiving
    // a password/MFA illustration simply because the consequence mentions a
    // stolen login.
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

function pointLimitFor(slide, type) {
    const layout = clean(slide?.layout).toLowerCase();
    // Cards and HUB items become flip/reveal cards in the learner runtime.
    // Four items fit as a 2x2 learning block without forcing page scrolling.
    if (layout === 'cards' || layout === 'hub' || type === 'reveal') return 4;
    if (layout === 'process' || layout === 'timeline' || layout === 'cycle' || layout === 'spotlight') return 4;
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
    const slides = Array.isArray(analysis.slides) ? analysis.slides : [];
    let previousType = '';
    let previousBackground = '';

    const planned = slides.map((rawSlide, index) => {
        const slide = rawSlide && typeof rawSlide === 'object' ? rawSlide : {};
        const canonicalContent = canonicalLearningCopy(slide);
        const planningSlide = { ...slide, content: canonicalContent };
        const explicitType = clean(planningSlide.screenType).toLowerCase();
        const hasExplicitType = SCREEN_TYPES.includes(explicitType);
        let type = preferredType(planningSlide, index);
        if (!hasExplicitType && type === previousType) type = alternateType(type, planningSlide, index);
        const explicitBackground = clean(planningSlide.backgroundStyle).toLowerCase();
        const background = explicitBackground || backgroundFor(type, index, previousBackground);
        const result = {
            ...planningSlide,
            content: canonicalContent,
            screenType: type,
            backgroundStyle: BACKGROUNDS.includes(background) ? background : backgroundFor(type, index, previousBackground),
            visualMetaphor: metaphorFor({ ...planningSlide, visualMetaphor: '' }),
            // Keep the complete teaching passage visible. revealText is reserved
            // for future per-card detail, never for hiding the main lesson.
            introText: canonicalContent,
            revealText: '',
            keyPoints: concisePoints(slide.keyPoints, pointLimitFor(planningSlide, type)),
            interaction: interactionFor(type, planningSlide.layout, planningSlide.interaction)
        };
        previousType = result.screenType;
        previousBackground = result.backgroundStyle;
        return result;
    });

    return {
        ...analysis,
        experienceVersion: 5,
        experiencePlanner: 'content-visible-v6',
        slides: planned
    };
}

module.exports = {
    planExperienceV5,
    splitCopy,
    canonicalLearningCopy,
    metaphorFor,
    preferredType,
    backgroundFor,
    pointLimitFor,
    SCREEN_TYPES,
    BACKGROUNDS
};
