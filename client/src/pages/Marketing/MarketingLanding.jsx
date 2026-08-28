import React from 'react';

export default function MarketingLanding({ src = '/landing/index.html' }) {
  return (
    <iframe
      title="Primary website"
      src={src}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        border: 0,
        display: 'block',
        background: '#ffffff',
      }}
    />
  );
}
