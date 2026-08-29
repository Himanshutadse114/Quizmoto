import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Renders one of the pre-built static marketing pages inside the SPA's own
// document. This avoids depending on server-level rewrite/fallback rules
// (which vary by host and are not reliably verifiable from here): every
// request loads the same index.html, React Router decides what to show
// based on the URL, and for a marketing route that's simply "load this real,
// already-built file into an iframe." No client-side redirect, no full page
// reload, no DOM-wide text/logo swapping needed - the static file is already
// correctly branded at build time.
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
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        border: 0,
      }}
    />
  );
}
