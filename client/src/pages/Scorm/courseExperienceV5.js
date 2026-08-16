export const COURSE_THEMES = [
  { id: 1, slug: 'gamma-editorial', name: 'Gamma Editorial', description: 'Warm paper · charcoal · editorial', primary: '#282824', dark: '#171715', accent: '#CBC5B8', bg: '#E7E7E4', bg2: '#E5DFD2', surface: '#E7E7E4', visual: '#282824' },
  { id: 2, slug: 'violet-future', name: 'Violet Future', description: 'Deep violet · purple · lilac', primary: '#8B5CF6', dark: '#6D28D9', accent: '#C084FC', bg: '#090517', bg2: '#160A2B', surface: '#160E27', visual: '#29154A' },
  { id: 4, slug: 'emerald-atlas', name: 'Emerald Atlas', description: 'Forest · emerald · mint', primary: '#10B981', dark: '#047857', accent: '#5EEAD4', bg: '#03100D', bg2: '#071E18', surface: '#092019', visual: '#0D382C' },
  { id: 6, slug: 'arctic-cyan', name: 'Arctic Cyan', description: 'Slate · cyan · ice', primary: '#06B6D4', dark: '#0E7490', accent: '#67E8F9', bg: '#020B12', bg2: '#061B27', surface: '#08202B', visual: '#0A3848' },
  { id: 8, slug: 'indigo-aurora', name: 'Indigo Aurora', description: 'Indigo · teal · violet', primary: '#6366F1', dark: '#4338CA', accent: '#2DD4BF', bg: '#050617', bg2: '#0A1230', surface: '#0C1230', visual: '#14205A' },
  { id: 3, slug: 'amber-signal', name: 'Amber Signal', description: 'Charcoal · amber · gold', primary: '#F59E0B', dark: '#B45309', accent: '#FCD34D', bg: '#0C0905', bg2: '#1B1207', surface: '#191208', visual: '#34200A' },
  { id: 5, slug: 'modern-rose', name: 'Modern Rose', description: 'Aubergine · rose · coral', primary: '#EC4899', dark: '#BE185D', accent: '#FB7185', bg: '#12050C', bg2: '#270918', surface: '#240D19', visual: '#451126' },
  { id: 7, slug: 'crimson-guard', name: 'Crimson Guard', description: 'Burgundy · crimson · coral', primary: '#EF4444', dark: '#B91C1C', accent: '#FB7185', bg: '#100405', bg2: '#250708', surface: '#210B0D', visual: '#451015' }
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
  return COURSE_THEMES.find((theme) => theme.id === Number(id)) || COURSE_THEMES[0];
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
