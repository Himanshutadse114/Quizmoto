import React, { useEffect } from 'react';

export default function MarketingLanding({ src = '/landing/index.html' }) {
  useEffect(() => {
    const target = new URL(src, window.location.origin);
    target.search = window.location.search;
    target.hash = window.location.hash;

    if (window.location.pathname !== target.pathname) {
      window.location.replace(`${target.pathname}${target.search}${target.hash}`);
    }
  }, [src]);

  // This component is now only a compatibility bridge for hosts that first
  // route a friendly marketing URL through the React SPA. Production nginx
  // serves marketing pages directly, so users normally never see this surface.
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0d3b37',
      }}
    />
  );
}
