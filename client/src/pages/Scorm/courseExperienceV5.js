export const COURSE_THEMES = [
  {
    id: 1,
    slug: 'editorial',
    name: 'Editorial',
    description: 'Neutral paper · charcoal · editorial',
    primary: '#282824',
    dark: '#171715',
    accent: '#CBC5B8',
    bg: '#E7E7E4',
    bg2: '#E5DFD2',
    surface: '#E7E7E4',
    visual: '#282824'
  }
];

export const COURSE_LAYOUTS = [
  ['cards', 'Cards'],
  ['process', 'Process'],
  ['timeline', 'Timeline'],
  ['comparison', 'Comparison'],
  ['hub', 'Hub'],
  ['spotlight', 'Spotlight'],
  ['matrix', 'Risk matrix'],
  ['cycle', 'Cycle']
];

export const SCREEN_TYPES = [
  ['concept', 'Concept story'],
  ['hotspot', 'Interactive hotspot'],
  ['process', 'Process journey'],
  ['scenario', 'Scenario / decision'],
  ['comparison', 'Compare / spot risk'],
  ['reveal', 'Click to reveal'],
  ['timeline', 'Timeline journey'],
  ['takeaway', 'Key takeaway']
];

export const BACKGROUND_STYLES = [
  ['mesh', 'Mesh'],
  ['glow', 'Glow'],
  ['grid', 'Grid'],
  ['orbit', 'Orbit'],
  ['waves', 'Waves'],
  ['focus', 'Focus']
];

export const METAPHORS = [
  ['shield', 'Shield'],
  ['email', 'Email'],
  ['lock', 'Lock / login'],
  ['phone', 'Phone / message'],
  ['browser', 'Browser / URL'],
  ['identity', 'Identity'],
  ['file', 'File / ransomware'],
  ['cloud', 'Cloud'],
  ['qr', 'QR'],
  ['warning', 'Warning'],
  ['ai-wave', 'AI / voice']
];

export const POINT_WORD_LIMITS = {
  process: 8,
  timeline: 8,
  cycle: 8,
  matrix: 8,
  hub: 10,
  cards: 11,
  comparison: 12,
  spotlight: 12
};

export function courseTheme(id) {
  // Platform exposes one learner-course theme.
  return COURSE_THEMES[0];
}

export function wordCount(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

export function normalizeCourseSlide(slide, index) {
  const s = slide || {};
  return {
    ...s,
    title: s.title || `Section ${index + 1}`,
    content: s.content || '',
    introText: s.introText || '',
    revealText: s.revealText || '',
    keyPoints: Array.isArray(s.keyPoints) ? s.keyPoints : [],
    layout: s.layout || 'cards',
    screenType: s.screenType || 'concept',
    backgroundStyle: s.backgroundStyle || 'mesh',
    visualMetaphor: s.visualMetaphor || 'shield',
    visualTitle: s.visualTitle || s.title || `Section ${index + 1}`,
    interaction: {
      type: s.interaction?.type || 'hotspot_explore',
      prompt: s.interaction?.prompt || 'Explore the learning visual before continuing.'
    }
  };
}

export function visualFitIssues(slide) {
  if (!slide) return [];
  const issues = [];
  const limit = POINT_WORD_LIMITS[slide.layout] || 11;
  const longPoints = (slide.keyPoints || []).filter((point) => wordCount(point) > limit).length;
  if (longPoints) issues.push(`${longPoints} visual ${longPoints === 1 ? 'label is' : 'labels are'} longer than the recommended ${limit} words.`);
  if (wordCount(slide.visualTitle) > 5) issues.push('Visual title is longer than five words.');
  if (wordCount(slide.introText || slide.content) > 45) issues.push('The initial on-screen explanation is dense. Keep the first reveal concise.');
  if ((slide.keyPoints || []).length > 6) issues.push('Use no more than six visual interaction points.');
  if (slide.screenType === 'scenario' && (slide.keyPoints || []).length < 2) issues.push('Scenario screens work best with at least two choices or signals.');
  return issues;
}
