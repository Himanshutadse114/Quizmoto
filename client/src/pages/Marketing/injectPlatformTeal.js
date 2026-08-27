const THEME_ID = 'atelora-platform-dark-theme';
const THEME_ATTR = 'data-atelora-theme';

function directText(element) {
  return Array.from(element?.childNodes || [])
    .filter((node) => node.nodeType === 3)
    .map((node) => node.nodeValue || '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function markMajorSurfaces(doc) {
  const candidates = Array.from(doc.querySelectorAll('main section, body > section, main > div > section'));
  const sections = candidates.filter((section, index, list) => {
    if (list.some((other) => other !== section && other.contains(section))) return false;
    return true;
  });

  sections.forEach((section, index) => {
    section.dataset.ateloraSurface = index % 2 === 0 ? 'base' : 'raised';
  });

  const header = doc.querySelector('header, [role="banner"], nav, [class*="navbar" i], [class*="navigation" i]');
  if (header) header.dataset.ateloraHeader = '1';

  const footer = doc.querySelector('footer, [class*="footer" i], [id*="footer" i]');
  if (footer) footer.dataset.ateloraFooter = '1';
}

function markHero(doc) {
  const headings = Array.from(doc.querySelectorAll('h1, h2'));
  const heroHeading = headings.find((heading) => {
    const text = (heading.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    return text.includes('create, manage and track learning')
      || text.includes('save 95% of time and budget')
      || text.includes('custom scorm course');
  }) || headings.find((heading) => heading.tagName.toLowerCase() === 'h1');

  const hero = heroHeading?.closest('section, [class*="hero" i], main > div')
    || doc.querySelector('main > section, main section, [class*="hero" i]');

  if (!hero) return;
  hero.dataset.ateloraHero = '1';

  const visualCandidates = Array.from(hero.querySelectorAll('picture, figure, video, img, [class*="hero-image" i], [class*="mockup" i], [class*="visual" i]'));
  const candidates = visualCandidates.map((element) => {
    const rect = element.getBoundingClientRect?.();
    const meta = [
      element.getAttribute?.('src'),
      element.getAttribute?.('alt'),
      element.getAttribute?.('class'),
      element.getAttribute?.('id'),
    ].filter(Boolean).join(' ');
    const isLogo = /logo|brand|mark/i.test(meta);
    const isLikelyHeroAsset = /hero|dashboard|interface|mockup|product|studio|platform/i.test(meta);
    const area = rect ? rect.width * rect.height : 0;
    return { element, rect, isLogo, isLikelyHeroAsset, area };
  }).filter(({ isLogo }) => !isLogo);

  candidates.sort((a, b) => {
    const likelyDelta = Number(b.isLikelyHeroAsset) - Number(a.isLikelyHeroAsset);
    return likelyDelta || b.area - a.area;
  });

  const target = candidates.find(({ rect, isLikelyHeroAsset }) => isLikelyHeroAsset || (rect && rect.width >= 280 && rect.height >= 150));
  if (!target) return;

  let visual = target.element;
  if (visual.tagName?.toLowerCase() === 'img') {
    const wrapper = visual.closest('picture, figure');
    if (wrapper && hero.contains(wrapper)) visual = wrapper;
  }

  visual.dataset.ateloraHeroVisual = '1';
  visual.setAttribute('aria-hidden', 'true');
}

function markReadableText(doc) {
  const excluded = 'button, [role="button"], input, textarea, select, option, [class*="badge" i], [class*="pill" i], [class*="chip" i], [class*="tag" i]';
  const elements = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, label, small, a, span, div'));

  elements.forEach((element) => {
    if (element.matches?.(excluded) || element.closest?.(excluded)) return;
    if (!directText(element)) return;

    const style = doc.defaultView?.getComputedStyle?.(element);
    const match = style?.color?.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return;

    const [, r, g, b] = match.map(Number);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (luminance < 0.44) element.dataset.ateloraDarkText = '1';
  });
}

function makeLogosDarkReady(doc) {
  doc.querySelectorAll('[data-atelora-navbar-guard="1"], [data-atelora-footer-logo="1"]').forEach((element) => {
    element.dataset.ateloraDarkLogo = '1';
  });
}

export function injectPlatformTeal(doc) {
  if (!doc?.documentElement || !doc?.body) return;

  doc.documentElement.setAttribute(THEME_ATTR, 'dark');
  doc.body.setAttribute(THEME_ATTR, 'dark');

  if (!doc.getElementById(THEME_ID)) {
    const link = doc.createElement('link');
    link.id = THEME_ID;
    link.rel = 'stylesheet';
    link.href = '/atelora-platform-teal.css';
    doc.head?.appendChild(link);
  }

  markMajorSurfaces(doc);
  markHero(doc);
  markReadableText(doc);
  makeLogosDarkReady(doc);
}

export default injectPlatformTeal;
