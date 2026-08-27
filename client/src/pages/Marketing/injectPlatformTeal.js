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

function isPageChrome(element) {
  if (!element?.matches) return false;
  return element.matches('header, nav, footer, [role="banner"], [class*="footer" i], [class*="navbar" i], [class*="navigation" i]');
}

function rgbValues(value) {
  const match = value?.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function isLightRgb(rgb) {
  if (!rgb) return false;
  const [r, g, b] = rgb;
  return r >= 224 && g >= 224 && b >= 224;
}

function isLightGradient(value) {
  if (!value || value === 'none' || !/gradient/i.test(value)) return false;
  const lower = value.toLowerCase();
  if (/#fff(?:fff)?\b|#f[0-9a-f]{2,5}\b/.test(lower)) return true;

  const matches = [...lower.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)];
  return matches.some((match) => Number(match[1]) >= 220 && Number(match[2]) >= 220 && Number(match[3]) >= 220);
}

function markRootSurfaces(doc) {
  Array.from(doc.body.children || []).forEach((element) => {
    if (!element?.dataset || element.matches?.('script, style, link, iframe')) return;
    element.dataset.ateloraRootSurface = '1';
  });
}

function markMajorSurfaces(doc) {
  const main = doc.querySelector('main') || doc.body;
  const frameWindow = doc.defaultView;
  const viewportWidth = frameWindow?.innerWidth || 1440;

  const semanticSections = Array.from(main.querySelectorAll('section, article'))
    .filter((section) => {
      if (isPageChrome(section)) return false;
      const rect = section.getBoundingClientRect?.();
      return rect && rect.width >= viewportWidth * 0.45 && rect.height >= 140;
    })
    .sort((a, b) => (a.getBoundingClientRect?.().top || 0) - (b.getBoundingClientRect?.().top || 0));

  semanticSections.forEach((section, index) => {
    section.dataset.ateloraSurface = index % 2 === 0 ? 'base' : 'raised';
  });

  if (!semanticSections.length) {
    const sectionLikeDivs = Array.from(main.querySelectorAll('div'))
      .filter((element) => {
        if (isPageChrome(element)) return false;
        const rect = element.getBoundingClientRect?.();
        if (!rect || rect.width < viewportWidth * 0.72 || rect.height < 220) return false;

        const style = frameWindow?.getComputedStyle?.(element);
        return isLightRgb(rgbValues(style?.backgroundColor)) || isLightGradient(style?.backgroundImage);
      })
      .sort((a, b) => (a.getBoundingClientRect?.().top || 0) - (b.getBoundingClientRect?.().top || 0));

    sectionLikeDivs.forEach((section, index) => {
      section.dataset.ateloraSurface = index % 2 === 0 ? 'base' : 'raised';
    });
  }

  const header = doc.querySelector('header, [role="banner"], nav, [class*="navbar" i], [class*="navigation" i]');
  if (header) header.dataset.ateloraHeader = '1';

  const footer = doc.querySelector('footer, [class*="footer" i], [id*="footer" i]');
  if (footer) footer.dataset.ateloraFooter = '1';
}

function markResidualLightSurfaces(doc) {
  const frameWindow = doc.defaultView;
  if (!frameWindow) return;

  const viewportWidth = frameWindow.innerWidth || 1440;
  const selectors = [
    'main', 'section', 'article', 'aside',
    'div',
    '[class*="section" i]', '[class*="content" i]', '[class*="band" i]', '[class*="block" i]',
    '[class*="comparison" i]', '[class*="compare" i]', '[class*="stack" i]', '[class*="feature" i]'
  ].join(',');

  const candidates = Array.from(doc.querySelectorAll(selectors));

  candidates.forEach((element) => {
    if (!element?.dataset || isPageChrome(element)) return;
    if (element.matches?.('button, a, input, textarea, select, option, picture, figure, img, video, svg')) return;

    const rect = element.getBoundingClientRect?.();
    if (!rect || rect.width < Math.min(viewportWidth * 0.46, 720) || rect.height < 80) return;

    const style = frameWindow.getComputedStyle(element);
    const lightBackground = isLightRgb(rgbValues(style.backgroundColor));
    const lightGradient = isLightGradient(style.backgroundImage);

    if (lightBackground || lightGradient) {
      element.dataset.ateloraResidualLightSurface = '1';
    }
  });
}

function findHeroContainer(doc, heroHeading) {
  if (!heroHeading) return null;

  const semantic = heroHeading.closest('section, [class*="hero" i], [id*="hero" i]');
  if (semantic) return semantic;

  const main = doc.querySelector('main');
  let current = heroHeading.parentElement;
  let best = null;

  while (current && current !== doc.body && current !== main) {
    const rect = current.getBoundingClientRect?.();
    if (rect && rect.height >= 260 && rect.height <= 1100 && rect.width >= 280) best = current;
    current = current.parentElement;
  }

  return best || doc.querySelector('main > section, main section, [class*="hero" i], [id*="hero" i]');
}

function markHero(doc) {
  const headings = Array.from(doc.querySelectorAll('h1, h2'));
  const heroHeading = headings.find((heading) => {
    const text = (heading.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    return text.includes('create, manage and track learning')
      || text.includes('save 95% of time and budget')
      || text.includes('custom scorm course');
  }) || headings.find((heading) => heading.tagName.toLowerCase() === 'h1');

  const hero = findHeroContainer(doc, heroHeading);
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
  const elements = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, label, small, a, span, div, td, th'));

  elements.forEach((element) => {
    if (element.matches?.(excluded) || element.closest?.(excluded)) return;
    if (!directText(element)) return;

    const style = doc.defaultView?.getComputedStyle?.(element);
    const rgb = rgbValues(style?.color);
    if (!rgb) return;

    const [r, g, b] = rgb;
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (luminance < 0.52) element.dataset.ateloraDarkText = '1';
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

  markRootSurfaces(doc);
  markMajorSurfaces(doc);
  markResidualLightSurfaces(doc);
  markHero(doc);
  markReadableText(doc);
  makeLogosDarkReady(doc);

  if (!doc.getElementById(THEME_ID)) {
    const link = doc.createElement('link');
    link.id = THEME_ID;
    link.rel = 'stylesheet';
    link.href = '/atelora-platform-teal.css';
    doc.head?.appendChild(link);
  }
}

export default injectPlatformTeal;
