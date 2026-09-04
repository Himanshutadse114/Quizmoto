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

function applySharedMarketingUi(frame, src, onReady) {
  try {
    const doc = frame?.contentDocument || frame?.contentWindow?.document;
    if (!doc?.head || !doc?.body) {
      onReady();
      return;
    }

    doc.documentElement.classList.add('atelora-ui-root');
    doc.body.classList.add('atelora-public-site', ...getMarketingPageClasses(src));

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
    // Marketing files are same-origin in production. If a host changes that
    // assumption, keep the page usable instead of leaving the iframe hidden.
    onReady();
  }
}

// Renders one of the pre-built static marketing pages inside the SPA's own
// document. React owns routing while the exported marketing HTML stays editable
// as static files under public/landing. Post-load UI stylesheets are injected
// here so public pages share one typography/layout system while the homepage
// can also receive tightly scoped section-level corrections.
export default function MarketingSite({ src, title, tabTitle }) {
  const { hash } = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const fallback = window.setTimeout(() => setReady(true), 1400);
    return () => window.clearTimeout(fallback);
  }, [src]);

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
      }}
    />
  );
}
