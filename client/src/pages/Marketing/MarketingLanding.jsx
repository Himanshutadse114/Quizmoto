import React, { useCallback, useRef } from 'react';
import { injectPlatformTeal } from './injectPlatformTeal';

const BRAND_RE = /SCORMs\.ai|SCORMs\s+AI|SCORMsAI|scorms\.ai/gi;

const PLATFORM_COPY = new Map([
  ['how it works', 'How Atelora works'],
  ['what you get', 'Platform features'],
  ['the studio', 'AI Course Studio'],
  ['origin', 'Why Atelora'],
  ['start a pilot', 'Explore Atelora'],
  ['trusted by leading l&d teams', 'BUILT FOR MODERN LEARNING TEAMS'],
  ['save 95% of time and budget on every custom scorm course.', 'Create, manage and track learning in one AI-powered platform.'],
  ['send your brief today, get your next-level scorm course in your lms tomorrow.', 'Generate SCORM-ready courses with AI, manage learners and deliver training from one workspace.'],
  ['ai-powered production at a fraction of the cost and resources.', 'AI course authoring, Quizmoto, learner tracking, reporting and analytics — all in Atelora.'],
  ['from €499 · pilot slots open', 'AI authoring · SCORM · Quizmoto · Analytics'],
  ['from €499 · pilot slots open.', 'AI authoring · SCORM · Quizmoto · Analytics'],
]);

const FOOTER_COPY = new Map([
  ['an ai-native production studio for branded scorm courses.', 'AI-powered learning platform for SCORM-ready courses, Quizmoto, learner tracking and analytics.'],
  ['an initiative by', ''],
  ['legit ↗', 'Atelora'],
  ['legit', 'Atelora'],
  ['hello@wearelegit.ai', 'Explore Atelora'],
  ['wearelegit.ai', 'AI Course Studio · Quizmoto'],
  ['© 2026 atelora · a legit initiative.', '© 2026 Atelora · AI-powered learning platform.'],
  ['© 2026 atelora · a legit initiative', '© 2026 Atelora · AI-powered learning platform.'],
  ['built in helsinki.', 'Built for modern learning teams.'],
  ['built in helsinki', 'Built for modern learning teams.'],
]);

function rewriteValue(value) {
  if (typeof value !== 'string') return value;

  const branded = value.replace(BRAND_RE, 'Atelora');
  const trimmed = branded.replace(/\s+/g, ' ').trim();
  const replacement = PLATFORM_COPY.get(trimmed.toLowerCase());
  if (!replacement) return branded;

  const leading = branded.match(/^\s*/)?.[0] || '';
  const trailing = branded.match(/\s*$/)?.[0] || '';
  return `${leading}${replacement}${trailing}`;
}

function rewriteFooterValue(value) {
  if (typeof value !== 'string') return value;

  const branded = rewriteValue(value);
  const normalized = branded.replace(/\s+/g, ' ').trim();
  const replacement = FOOTER_COPY.get(normalized.toLowerCase());
  if (replacement !== undefined) {
    const leading = branded.match(/^\s*/)?.[0] || '';
    const trailing = branded.match(/\s*$/)?.[0] || '';
    return `${leading}${replacement}${trailing}`;
  }

  return branded
    .replace(/hello@wearelegit\.ai/gi, 'Explore Atelora')
    .replace(/wearelegit\.ai/gi, 'AI Course Studio · Quizmoto')
    .replace(/An AI-native production studio for branded SCORM courses\./gi, 'AI-powered learning platform for SCORM-ready courses, Quizmoto, learner tracking and analytics.')
    .replace(/A Legit initiative\.?/gi, 'AI-powered learning platform.')
    .replace(/Built in Helsinki\.?/gi, 'Built for modern learning teams.');
}

function getMeta(element) {
  if (!element?.getAttribute) return '';
  return [
    element.getAttribute('alt'),
    element.getAttribute('title'),
    element.getAttribute('src'),
    element.getAttribute('srcset'),
    element.getAttribute('aria-label'),
    element.id,
    typeof element.className === 'string' ? element.className : '',
  ].filter(Boolean).join(' ');
}

export default function MarketingLanding() {
  const iframeRef = useRef(null);

  const patchLanding = useCallback(() => {
    const frame = iframeRef.current;
    const doc = frame?.contentDocument;
    const frameWindow = frame?.contentWindow;
    if (!doc?.body || !frameWindow) return;

    const patchText = () => {
      const walker = doc.createTreeWalker(doc.body, frameWindow.NodeFilter.SHOW_TEXT);
      const textNodes = [];
      let node;
      while ((node = walker.nextNode())) textNodes.push(node);

      textNodes.forEach((textNode) => {
        const next = rewriteValue(textNode.nodeValue || '');
        if (next !== textNode.nodeValue) textNode.nodeValue = next;
      });

      doc.querySelectorAll('*').forEach((element) => {
        ['alt', 'title', 'aria-label', 'data-label'].forEach((attribute) => {
          if (!element.hasAttribute?.(attribute)) return;
          const current = element.getAttribute(attribute);
          const next = rewriteValue(current);
          if (next !== current) element.setAttribute(attribute, next);
        });
      });

      if (doc.title) doc.title = rewriteValue(doc.title);
    };

    const patchNavbarLogo = () => {
      const logoUrl = '/atelora-landing-logo.svg';
      const viewportWidth = frameWindow.innerWidth || 1440;
      const visualCandidates = Array.from(doc.querySelectorAll('img, svg, picture, [role="img"]'))
        .map((element) => ({ element, rect: element.getBoundingClientRect?.() }))
        .filter(({ rect }) => rect
          && rect.top >= 0
          && rect.top < 125
          && rect.left >= 0
          && rect.left < viewportWidth * 0.46
          && rect.width >= 70
          && rect.width <= 270
          && rect.height >= 14
          && rect.height <= 90);

      visualCandidates.sort((a, b) => {
        const explicitA = /scorms?\.?ai|brand|logo/i.test(getMeta(a.element)) ? -1000 : 0;
        const explicitB = /scorms?\.?ai|brand|logo/i.test(getMeta(b.element)) ? -1000 : 0;
        const scoreA = explicitA + a.rect.left + Math.abs(a.rect.width - 145) * 0.3;
        const scoreB = explicitB + b.rect.left + Math.abs(b.rect.width - 145) * 0.3;
        return scoreA - scoreB;
      });

      const candidate = visualCandidates[0]?.element || null;
      const candidateRect = visualCandidates[0]?.rect || null;
      let brandHost = candidate?.closest?.('a') || candidate?.parentElement || null;

      if (!brandHost) {
        const topLinks = Array.from(doc.querySelectorAll('a'))
          .map((element) => ({ element, rect: element.getBoundingClientRect?.() }))
          .filter(({ rect }) => rect
            && rect.top >= 0
            && rect.top < 125
            && rect.left < viewportWidth * 0.46
            && rect.width >= 80
            && rect.width <= 280
            && rect.height >= 20
            && rect.height <= 90)
          .sort((a, b) => a.rect.left - b.rect.left);
        brandHost = topLinks[0]?.element || null;
      }

      if (candidate?.tagName?.toLowerCase() === 'img') {
        if (candidate.src !== new URL(logoUrl, frameWindow.location.origin).href) {
          candidate.src = logoUrl;
          candidate.removeAttribute('srcset');
          candidate.alt = 'Atelora';
          candidate.dataset.ateloraLogo = '1';
          candidate.style.objectFit = 'contain';
          candidate.style.width = `${Math.max(125, Math.min(candidateRect?.width || 145, 165))}px`;
          candidate.style.height = 'auto';
        }
      } else if (candidate && !candidate.dataset?.ateloraLogoReplaced) {
        const img = doc.createElement('img');
        img.src = logoUrl;
        img.alt = 'Atelora';
        img.dataset.ateloraLogo = '1';
        img.style.display = 'block';
        img.style.width = `${Math.max(125, Math.min(candidateRect?.width || 145, 165))}px`;
        img.style.height = 'auto';
        img.style.objectFit = 'contain';
        candidate.replaceWith(img);
        brandHost = img.closest('a') || img.parentElement || brandHost;
      }

      if (brandHost && !brandHost.querySelector?.('[data-atelora-navbar-guard="1"]')) {
        const hostRect = brandHost.getBoundingClientRect?.();
        if (hostRect && hostRect.top < 125 && hostRect.width >= 70 && hostRect.width <= 300) {
          const computed = frameWindow.getComputedStyle(brandHost);
          if (computed.position === 'static') brandHost.style.position = 'relative';

          const guard = doc.createElement('span');
          guard.dataset.ateloraNavbarGuard = '1';
          guard.setAttribute('aria-label', 'Atelora');
          guard.style.position = 'absolute';
          guard.style.zIndex = '999999';
          guard.style.left = '-6px';
          guard.style.top = '-5px';
          guard.style.width = `${Math.max(145, Math.min(hostRect.width + 12, 185))}px`;
          guard.style.height = `${Math.max(38, Math.min(hostRect.height + 10, 58))}px`;
          guard.style.display = 'flex';
          guard.style.alignItems = 'center';
          guard.style.background = '#f6fafb';
          guard.style.pointerEvents = 'none';

          const logo = doc.createElement('img');
          logo.src = logoUrl;
          logo.alt = 'Atelora';
          logo.style.display = 'block';
          logo.style.width = '145px';
          logo.style.maxWidth = '100%';
          logo.style.height = 'auto';
          guard.appendChild(logo);
          brandHost.appendChild(guard);
        }
      }
    };

    const findFooter = () => {
      const semantic = doc.querySelector('footer, [class*="footer" i], [id*="footer" i]');
      if (semantic) return semantic;

      const marker = Array.from(doc.querySelectorAll('body *')).find((element) => {
        const label = (element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return label === 'get in touch';
      });

      if (!marker) return null;
      let current = marker;
      while (current?.parentElement && current !== doc.body) {
        const text = (current.textContent || '').toLowerCase();
        if (text.includes('privacy policy') && (text.includes('wearelegit') || text.includes('scorms.ai') || text.includes('atelora'))) {
          return current;
        }
        current = current.parentElement;
      }
      return marker.parentElement?.parentElement || null;
    };

    const patchFooter = () => {
      const footer = findFooter();
      if (!footer) return;

      const footerWalker = doc.createTreeWalker(footer, frameWindow.NodeFilter.SHOW_TEXT);
      const footerTextNodes = [];
      let footerNode;
      while ((footerNode = footerWalker.nextNode())) footerTextNodes.push(footerNode);

      footerTextNodes.forEach((textNode) => {
        const next = rewriteFooterValue(textNode.nodeValue || '');
        if (next !== textNode.nodeValue) textNode.nodeValue = next;
      });

      footer.querySelectorAll('a').forEach((link) => {
        const href = link.getAttribute('href') || '';
        const label = (link.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();

        if (/wearelegit\.ai|mailto:hello@wearelegit\.ai|legit/i.test(href) || label === 'explore atelora' || label === 'atelora') {
          link.setAttribute('href', '/login');
          link.setAttribute('target', '_top');
          link.dataset.ateloraLoginCta = '1';
        }
      });

      const logoUrl = '/atelora-landing-logo.svg';
      const footerRect = footer.getBoundingClientRect?.();
      const footerVisuals = Array.from(footer.querySelectorAll('img, svg, picture, [role="img"]'))
        .map((element) => ({ element, rect: element.getBoundingClientRect?.() }))
        .filter(({ rect }) => rect
          && footerRect
          && rect.top >= footerRect.top - 8
          && rect.left < (frameWindow.innerWidth || 1440) * 0.45
          && rect.width >= 65
          && rect.width <= 280
          && rect.height >= 14
          && rect.height <= 100)
        .sort((a, b) => {
          const explicitA = /scorms?\.?ai|brand|logo/i.test(getMeta(a.element)) ? -1000 : 0;
          const explicitB = /scorms?\.?ai|brand|logo/i.test(getMeta(b.element)) ? -1000 : 0;
          return explicitA - explicitB || a.rect.left - b.rect.left || a.rect.top - b.rect.top;
        });

      const candidate = footerVisuals[0]?.element || null;
      const candidateRect = footerVisuals[0]?.rect || null;
      if (candidate?.tagName?.toLowerCase() === 'img') {
        candidate.src = logoUrl;
        candidate.removeAttribute('srcset');
        candidate.alt = 'Atelora';
        candidate.dataset.ateloraFooterLogo = '1';
        candidate.style.objectFit = 'contain';
        candidate.style.width = `${Math.max(125, Math.min(candidateRect?.width || 145, 165))}px`;
        candidate.style.height = 'auto';
      } else if (candidate && !candidate.dataset?.ateloraFooterLogo) {
        const img = doc.createElement('img');
        img.src = logoUrl;
        img.alt = 'Atelora';
        img.dataset.ateloraFooterLogo = '1';
        img.style.display = 'block';
        img.style.width = `${Math.max(125, Math.min(candidateRect?.width || 145, 165))}px`;
        img.style.height = 'auto';
        img.style.objectFit = 'contain';
        candidate.replaceWith(img);
      }
    };

    const patchLinks = () => {
      doc.querySelectorAll('a, button').forEach((element) => {
        const label = (element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (label === 'explore atelora' || label.includes('explore atelora')) {
          if (element.tagName.toLowerCase() === 'a') {
            element.setAttribute('href', '/login');
            element.setAttribute('target', '_top');
          }
          element.dataset.ateloraLoginCta = '1';
        }
      });
    };

    const patchAll = () => {
      injectPlatformTeal(doc);
      patchText();
      patchNavbarLogo();
      patchFooter();
      patchLinks();
    };

    patchAll();

    if (!doc.documentElement.dataset.ateloraParentBridge) {
      doc.documentElement.dataset.ateloraParentBridge = '1';

      doc.addEventListener('click', (event) => {
        const cta = event.target?.closest?.('[data-atelora-login-cta="1"]');
        if (!cta) return;
        event.preventDefault();
        window.location.assign('/login');
      });

      let timer;
      const observer = new frameWindow.MutationObserver(() => {
        frameWindow.clearTimeout(timer);
        timer = frameWindow.setTimeout(patchAll, 80);
      });
      observer.observe(doc.documentElement, { childList: true, subtree: true });
      frameWindow.__ateloraParentObserver = observer;

      frameWindow.setTimeout(patchAll, 250);
      frameWindow.setTimeout(patchAll, 900);
      frameWindow.setTimeout(patchAll, 1800);
    }
  }, []);

  return (
    <iframe
      ref={iframeRef}
      title="Atelora"
      src="/landing/index.html"
      onLoad={patchLanding}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'block',
        width: '100vw',
        height: '100vh',
        border: 0,
        background: '#fff',
      }}
    />
  );
}
