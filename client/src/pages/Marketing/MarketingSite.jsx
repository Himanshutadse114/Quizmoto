import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const MARKETING_UI_STYLESHEET = '/landing/css/atelora-ui-system.css?v=20260904-1';
const MARKETING_UI_LINK_ID = 'atelora-ui-system';

function getMarketingPageClasses(src) {
  if (src === '/landing/index.html') return ['atelora-home-page'];
  if (src.includes('/landing/solutions/')) return ['atelora-solutions-page'];
  if (src.includes('/landing/about/')) return ['atelora-about-page'];
  if (src.includes('/landing/contact/')) return ['atelora-contact-page'];
  if (src === '/landing/blog/index.html') return ['atelora-blog-page'];
  if (src.includes('/landing/blog/')) return ['atelora-blog-post-page'];
  return [];
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

    const existing = doc.getElementById(MARKETING_UI_LINK_ID);
    if (existing) {
      if (existing.getAttribute('href') !== MARKETING_UI_STYLESHEET) {
        existing.setAttribute('href', MARKETING_UI_STYLESHEET);
      }
      window.requestAnimationFrame(onReady);
      return;
    }

    const stylesheet = doc.createElement('link');
    stylesheet.id = MARKETING_UI_LINK_ID;
    stylesheet.rel = 'stylesheet';
    stylesheet.href = MARKETING_UI_STYLESHEET;

    const finish = () => window.requestAnimationFrame(onReady);
    stylesheet.addEventListener('load', finish, { once: true });
    stylesheet.addEventListener('error', finish, { once: true });
    doc.head.appendChild(stylesheet);
  } catch {
    // Marketing files are same-origin in production. If a host changes that
    // assumption, keep the page usable instead of leaving the iframe hidden.
    onReady();
  }
}

// Renders one of the pre-built static marketing pages inside the SPA's own
// document. React owns routing while the exported marketing HTML stays editable
// as static files under public/landing. A single post-load UI stylesheet is
// injected here so all public pages share one typography and layout system.
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
