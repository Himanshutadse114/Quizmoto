import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Renders one of the pre-built static marketing pages inside the SPA's own
// document. This avoids depending on server-level rewrite/fallback rules
// (which vary by host and are not reliably verifiable from here): every
// request loads the same index.html, React Router decides what to show
// based on the URL, and for a marketing route that's simply "load this real,
// already-built file into an iframe."
//
// The iframe stays on the page-background color until its document fires
// load, so visitors never see the raw Webflow template before LMSGEN assets
// and copy are in place.
export default function MarketingSite({ src, title, tabTitle }) {
  const { hash } = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const fallback = window.setTimeout(() => setReady(true), 1200);
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
      onLoad={() => setReady(true)}
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
