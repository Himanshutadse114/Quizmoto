import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const MARKETING_UI_STYLESHEETS = [
  {
    id: 'atelora-ui-system',
    href: '/landing/css/atelora-ui-system.css?v=20260904-1',
  },
];

const HOME_SECTION_SCALE_STYLESHEET = {
  id: 'atelora-home-section-scale',
  href: '/landing/css/atelora-home-section-scale.css?v=20260904-2',
};

function getMarketingPageClasses(src) {
  if (src === '/landing/index.html') return ['atelora-home-page'];
  if (src.includes('/landing/solutions/')) return ['atelora-solutions-page'];
  if (src.includes('/landing/about/')) return ['atelora-about-page'];
  if (src.includes('/landing/contact/')) return ['atelora-contact-page'];
  if (src === '/landing/blog/index.html') return ['atelora-blog-page'];
  if (src.includes('/landing/blog/')) return ['atelora-blog-post-page'];
  return [];
}

function getMarketingStylesheets(src) {
  if (src === '/landing/index.html') {
    return [...MARKETING_UI_STYLESHEETS, HOME_SECTION_SCALE_STYLESHEET];
  }
  return MARKETING_UI_STYLESHEETS;
}

function ensureStylesheet(doc, { id, href }) {
  const existing = doc.getElementById(id);
  if (existing) {
    if (existing.getAttribute('href') !== href) existing.setAttribute('href', href);
    return;
  }

  const stylesheet = doc.createElement('link');
  stylesheet.id = id;
  stylesheet.rel = 'stylesheet';
  stylesheet.href = href;
  doc.head.appendChild(stylesheet);
}

function installMarketingMobileNavigation(frame) {
  const doc = frame?.contentDocument || frame?.contentWindow?.document;
  const frameWindow = frame?.contentWindow;
  if (!doc?.head || !doc?.body || !frameWindow) return;

  const navbar = doc.querySelector('.global-header-c.w-nav') || doc.querySelector('.w-nav');
  const button = doc.getElementById('global-nav-button')
    || doc.querySelector('.global-nav-menu-btn.w-nav-button')
    || doc.querySelector('.w-nav-button');
  const menu = doc.querySelector('.global-header-nav-w.w-nav-menu')
    || doc.querySelector('.w-nav-menu');

  if (!navbar || !button || !menu) return;
  if (button.dataset.lmsgenMobileNavBound === 'true') return;
  button.dataset.lmsgenMobileNavBound = 'true';
  menu.dataset.lmsgenMobileMenu = 'true';
  menu.dataset.lmsgenOpen = 'false';

  const styleId = 'lmsgen-mobile-dropdown-fix';
  if (!doc.getElementById(styleId)) {
    const style = doc.createElement('style');
    style.id = styleId;
    style.textContent = `
      @media screen and (max-width: 991px) {
        .global-header-c.w-nav {
          z-index: 2147483000 !important;
          overflow: visible !important;
        }
        .global-header-c .global-header-w,
        .global-header-c .container-large {
          position: relative !important;
          z-index: 2147483001 !important;
        }
        .global-nav-menu-btn.w-nav-button {
          position: relative !important;
          z-index: 2147483004 !important;
          cursor: pointer !important;
          pointer-events: auto !important;
        }
        [data-lmsgen-mobile-menu="true"] {
          position: fixed !important;
          top: var(--lmsgen-mobile-nav-top, 74px) !important;
          left: 0 !important;
          right: 0 !important;
          bottom: auto !important;
          width: 100vw !important;
          max-width: none !important;
          max-height: calc(100dvh - var(--lmsgen-mobile-nav-top, 74px)) !important;
          margin: 0 !important;
          padding: 1.6rem 2rem 2.4rem !important;
          box-sizing: border-box !important;
          overflow-y: auto !important;
          background: #ffffff !important;
          color: #003f3a !important;
          border-top: 1px solid rgba(0, 63, 58, 0.12) !important;
          box-shadow: 0 18px 40px rgba(0, 63, 58, 0.16) !important;
          z-index: 2147483003 !important;
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 0 !important;
          transform: translateY(-14px) !important;
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
          transition: transform 180ms ease, opacity 180ms ease, visibility 180ms ease !important;
        }
        .w-nav[data-collapse="medium"] [data-lmsgen-mobile-menu="true"],
        [data-lmsgen-mobile-menu="true"] {
          display: flex !important;
        }
        [data-lmsgen-mobile-menu="true"][data-lmsgen-open="true"] {
          transform: translateY(0) !important;
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
        }
        [data-lmsgen-mobile-menu="true"] .global-nav-link,
        [data-lmsgen-mobile-menu="true"] .w-nav-link {
          width: 100% !important;
          min-height: 5.4rem !important;
          margin: 0 !important;
          padding: 1.5rem 0 !important;
          display: flex !important;
          align-items: center !important;
          border-bottom: 1px solid rgba(0, 63, 58, 0.12) !important;
          color: #003f3a !important;
          font-size: 1.7rem !important;
          line-height: 1.35 !important;
          font-weight: 500 !important;
          text-transform: none !important;
          text-decoration: none !important;
        }
        [data-lmsgen-mobile-menu="true"] .mobile-local-wrapper {
          margin-top: 1.2rem !important;
        }
        [data-lmsgen-mobile-menu="true"] .mobile-btn-c {
          display: block !important;
          width: 100% !important;
          margin-top: 1.8rem !important;
        }
        [data-lmsgen-mobile-menu="true"] .mobile-btn-c .btn-primary {
          width: 100% !important;
          min-height: 5.2rem !important;
          justify-content: center !important;
        }
      }
    `;
    doc.head.appendChild(style);
  }

  const isMobileViewport = () => frameWindow.matchMedia('(max-width: 991px)').matches;

  const syncDropdownTop = () => {
    const rect = navbar.getBoundingClientRect();
    const top = Math.max(0, Math.round(rect.bottom || rect.height || 74));
    doc.documentElement.style.setProperty('--lmsgen-mobile-nav-top', `${top}px`);
  };

  const setOpen = (shouldOpen) => {
    const open = Boolean(shouldOpen && isMobileViewport());
    syncDropdownTop();
    menu.dataset.lmsgenOpen = open ? 'true' : 'false';
    navbar.dataset.lmsgenMobileOpen = open ? 'true' : 'false';
    button.classList.toggle('w--open', open);
    button.setAttribute('aria-expanded', open ? 'true' : 'false');

    if (open) {
      doc.body.classList.add('lmsgen-mobile-nav-open');
      doc.body.style.overflow = 'hidden';
    } else {
      doc.body.classList.remove('lmsgen-mobile-nav-open');
      doc.body.style.removeProperty('overflow');
    }
  };

  button.setAttribute('role', 'button');
  button.setAttribute('tabindex', '0');
  button.setAttribute('aria-label', button.getAttribute('aria-label') || 'Toggle navigation menu');
  button.setAttribute('aria-expanded', 'false');

  const toggleMenu = (event) => {
    if (!isMobileViewport()) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    setOpen(menu.dataset.lmsgenOpen !== 'true');
  };

  button.addEventListener('click', toggleMenu, true);
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    toggleMenu(event);
  }, true);

  menu.addEventListener('click', (event) => {
    if (event.target.closest('a[href]')) setOpen(false);
  });

  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });

  frameWindow.addEventListener('resize', () => {
    syncDropdownTop();
    if (!isMobileViewport()) setOpen(false);
  }, { passive: true });

  syncDropdownTop();
  setOpen(false);
}

function installEfficientPlatformHeadlineTracking(frame) {
  const doc = frame?.contentDocument || frame?.contentWindow?.document;
  const frameWindow = frame?.contentWindow;
  if (!doc || !frameWindow || frameWindow.__lmsgenHeadlineTrackingInstalled) return;

  const container = doc.querySelector('.hp-plaf-stats-title-c');
  const heads = Array.from(doc.querySelectorAll('.platform-h2'));
  if (!container || heads.length < 2) return;

  frameWindow.__lmsgenHeadlineTrackingInstalled = true;

  // The exported homepage contains an always-running requestAnimationFrame loop
  // that reads and writes layout every frame. Block only that named callback and
  // replace it with a scroll/resize-throttled equivalent. Other animation frames
  // (Webflow, GSAP, Swiper, etc.) continue to use the native scheduler.
  const nativeRequestAnimationFrame = frameWindow.requestAnimationFrame.bind(frameWindow);
  const currentRequestAnimationFrame = frameWindow.requestAnimationFrame.bind(frameWindow);
  frameWindow.requestAnimationFrame = (callback) => {
    if (callback?.name === 'updatePlatformHeadlineVisibility') return 0;
    return currentRequestAnimationFrame(callback);
  };

  const update = () => {
    const cRect = container.getBoundingClientRect();
    if (!cRect.height) return;

    let bestIndex = 0;
    let bestFraction = -1;

    heads.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      const overlap = Math.min(rect.bottom, cRect.bottom) - Math.max(rect.top, cRect.top);
      const fraction = Math.max(0, Math.min(1, overlap / Math.max(rect.height, 1)));
      if (fraction > bestFraction) {
        bestFraction = fraction;
        bestIndex = index;
      }
    });

    heads.forEach((el, index) => {
      const active = index === bestIndex;
      el.style.opacity = active ? '1' : '0';
      el.style.visibility = active ? 'visible' : 'hidden';
    });
  };

  let scheduled = false;
  const scheduleUpdate = () => {
    if (scheduled) return;
    scheduled = true;
    nativeRequestAnimationFrame(() => {
      scheduled = false;
      update();
    });
  };

  frameWindow.addEventListener('scroll', scheduleUpdate, { passive: true });
  frameWindow.addEventListener('resize', scheduleUpdate, { passive: true });
  scheduleUpdate();
}

function tuneImageLoading(frame) {
  const doc = frame?.contentDocument || frame?.contentWindow?.document;
  const frameWindow = frame?.contentWindow;
  if (!doc || !frameWindow) return;

  const viewportHeight = frameWindow.innerHeight || 900;
  doc.querySelectorAll('img').forEach((image) => {
    image.decoding = 'async';
    const rect = image.getBoundingClientRect();
    const isBelowInitialViewport = rect.top > viewportHeight * 1.25;
    const isBrandLogo = image.classList.contains('nav-logo');

    if (isBrandLogo) {
      image.setAttribute('fetchpriority', 'high');
      return;
    }

    if (isBelowInitialViewport) {
      image.loading = 'lazy';
      image.setAttribute('fetchpriority', 'low');
    }
  });
}

function applySharedMarketingUi(frame, src) {
  try {
    const doc = frame?.contentDocument || frame?.contentWindow?.document;
    if (!doc?.head || !doc?.body) return;

    doc.documentElement.classList.add('atelora-ui-root');
    doc.body.classList.add('atelora-public-site', ...getMarketingPageClasses(src));

    getMarketingStylesheets(src).forEach((stylesheet) => ensureStylesheet(doc, stylesheet));
    installMarketingMobileNavigation(frame);
    installEfficientPlatformHeadlineTracking(frame);
    tuneImageLoading(frame);
  } catch {
    // Same-origin marketing frames should be accessible. If a deployment
    // temporarily serves a cross-origin frame, keep the page visible instead
    // of blocking rendering on enhancement code.
  }
}

export default function MarketingSite({ src, title, tabTitle }) {
  const { hash } = useLocation();

  useEffect(() => {
    if (!tabTitle) return;
    const previous = document.title;
    document.title = tabTitle;
    return () => { document.title = previous; };
  }, [tabTitle]);

  return (
    <iframe
      src={hash ? `${src}${hash}` : src}
      title={title}
      loading="eager"
      onLoad={(event) => applySharedMarketingUi(event.currentTarget, src)}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        border: 0,
        background: '#0A0F0E',
        opacity: 1,
      }}
    />
  );
}
