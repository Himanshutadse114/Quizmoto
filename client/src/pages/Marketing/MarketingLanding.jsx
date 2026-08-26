import React from 'react';

export default function MarketingLanding() {
  return (
    <iframe
      title="Atelora"
      src="/landing/index.html"
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
