import React, { useEffect, useState } from 'react';
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

const MOBILE_NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Solutions', href: '/solutions' },
  { label: 'About', href: '/about' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: '/contact' },
  { label: 'Sign In', href: '/login' },
];

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

function ensureStylesheet(doc, { id, href }, onSettled) {
  const existing = doc.getElementById(id);
  if (existing) {
    if (existing.getAttribute('href') !== href) {
      existing.setAttribute('href', href);
    }
    onSettled();
    return;
  }

  const stylesheet = doc.createElement('link');
  stylesheet.id = id;
  stylesheet.rel = 'stylesheet';
  stylesheet.href = href;

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    onSettled();
  };

  stylesheet.addEventListener('load', finish, { once: true });
  stylesheet.addEventListener('error', finish, { once: true });
  doc.head.appendChild(stylesheet);
}

function installMarketingMobileNavigation(frame) {
  const doc = frame?.contentDocument || frame?.contentWindow?.document;
  const frameWindow = frame?.contentWindow;
  if (!doc?.body || !frameWindow) return;

  const isMobileViewport = () => frameWindow.matchMedia('(max-width: 991px)').matches;

  doc.querySelectorAll('.w-nav').forEach((navbar, index) => {
    const button = navbar.querySelector('.w-nav-button');
    const menu = navbar.querySelector('.w-nav-menu');
    if (!button || !menu || button.dataset.ateloraMobileNavBound === 'true') return;

    button.dataset.ateloraMobileNavBound = 'true';

    if (!menu.id) menu.id = `atelora-mobile-nav-${index + 1}`;
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.setAttribute('aria-label', button.getAttribute('aria-label') || 'Toggle navigation menu');
    button.setAttribute('aria-controls', menu.id);
    button.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');

    const setOpen = (shouldOpen) => {
      const open = Boolean(shouldOpen && isMobileViewport());

      button.classList.toggle('w--open', open);
      menu.classList.toggle('w--open', open);
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');

      if (open) {
        menu.setAttribute('data-nav-menu-open', '');
        menu.style.display = 'block';
        doc.body.classList.add('atelora-mobile-nav-open');
        doc.body.style.overflow = 'hidden';
      } else {
        menu.removeAttribute('data-nav-menu-open');
        menu.style.removeProperty('display');
        doc.body.classList.remove('atelora-mobile-nav-open');
        doc.body.style.removeProperty('overflow');
      }
    };

    const toggleMenu = (event) => {
      if (!isMobileViewport()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(!button.classList.contains('w--open'));
    };

    button.addEventListener('click', toggleMenu, true);
    button.addEventListener('keydown', (event) => {
      if (!isMobileViewport() || (event.key !== 'Enter' && event.key !== ' ')) return;
      toggleMenu(event);
    }, true);

    menu.addEventListener('click', (event) => {
      if (event.target.closest('a[href]')) setOpen(false);
    });

    doc.addEventListener('click', (event) => {
      if (
        isMobileViewport()
        && button.classList.contains('w--open')
        && !navbar.contains(event.target)
      ) {
        setOpen(false);
      }
    });

    frameWindow.addEventListener('resize', () => {
      if (!isMobileViewport()) setOpen(false);
    }, { passive: true });
  });
}

function applySharedMarketingUi(frame, src, onReady) {
  try {
    const doc = frame?.contentDocument || frame?.contentWindow?.document;
    if (!doc?.head || !doc?.body) {
      onReady();
      return;
    }

    doc.documentElement.classList.add('atelora-ui-root');
    doc.body.classList.add('atelora-public-site', ...getMarketingPageClasses(src));
    installMarketingMobileNavigation(frame);

    const stylesheets = getMarketingStylesheets(src);
    let remaining = stylesheets.length;

    if (!remaining) {
      window.requestAnimationFrame(onReady);
      return;
    }

    const markSettled = () => {
      remaining -= 1;
      if (remaining <= 0) {
        window.requestAnimationFrame(onReady);
      }
    };

    stylesheets.forEach((stylesheet) => ensureStylesheet(doc, stylesheet, markSettled));
  } catch {
    onReady();
  }
}

export default function MarketingSite({ src, title, tabTitle }) {
  const { hash } = useLocation();
  const [ready, setReady] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth <= 991 : false
  ));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setReady(false);
    setMobileMenuOpen(false);
    const fallback = window.setTimeout(() => setReady(true), 1400);
    return () => window.clearTimeout(fallback);
  }, [src]);

  useEffect(() => {
    if (!tabTitle) return;
    const previous = document.title;
    document.title = tabTitle;
    return () => { document.title = previous; };
  }, [tabTitle]);

  useEffect(() => {
    const updateViewport = () => {
      const mobile = window.innerWidth <= 991;
      setIsMobile(mobile);
      if (!mobile) setMobileMenuOpen(false);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport, { passive: true });
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    if (!isMobile || !mobileMenuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile, mobileMenuOpen]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <iframe
        src={hash ? `${src}${hash}` : src}
        title={title}
        onLoad={(event) => applySharedMarketingUi(event.currentTarget, src, () => setReady(true))}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 0,
          background: '#0A0F0E',
          opacity: ready ? 1 : 0,
          transition: 'opacity 160ms ease',
          pointerEvents: mobileMenuOpen ? 'none' : 'auto',
        }}
      />

      {isMobile && (
        <>
          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: 88,
              height: 74,
              zIndex: 10002,
              border: 0,
              padding: 0,
              margin: 0,
              background: 'transparent',
              cursor: 'pointer',
              color: '#003f3a',
              fontSize: 36,
              lineHeight: 1,
              display: 'grid',
              placeItems: 'center',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {mobileMenuOpen ? '×' : ''}
          </button>

          {mobileMenuOpen && (
            <nav
              aria-label="Mobile navigation"
              style={{
                position: 'fixed',
                top: 74,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 10001,
                overflowY: 'auto',
                background: '#ffffff',
                borderTop: '1px solid rgba(0, 63, 58, 0.12)',
                boxShadow: '0 18px 40px rgba(0, 63, 58, 0.12)',
                padding: '22px 22px 30px',
                fontFamily: '"Open Sauce One", Arial, sans-serif',
              }}
            >
              <div style={{ display: 'grid', gap: 0 }}>
                {MOBILE_NAV_LINKS.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={closeMobileMenu}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      minHeight: 58,
                      padding: '0 4px',
                      borderBottom: '1px solid rgba(0, 63, 58, 0.12)',
                      color: '#003f3a',
                      fontSize: 18,
                      fontWeight: 500,
                      lineHeight: 1.3,
                      textDecoration: 'none',
                    }}
                  >
                    {item.label}
                  </a>
                ))}
              </div>

              <a
                href="/login"
                onClick={closeMobileMenu}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 52,
                  marginTop: 24,
                  borderRadius: 999,
                  background: '#003f3a',
                  color: '#ffffff',
                  fontSize: 16,
                  fontWeight: 600,
                  lineHeight: 1.2,
                  textDecoration: 'none',
                }}
              >
                Explore LMSGEN
              </a>
            </nav>
          )}
        </>
      )}
    </>
  );
}
