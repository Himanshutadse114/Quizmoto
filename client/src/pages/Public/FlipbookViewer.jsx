import React, { useMemo } from 'react';
import { apiUrl } from '../../config';

const API = '/api/scorm/flipbooks';

export default function FlipbookViewer({ shareToken: propToken }) {
  const shareToken = propToken || window.location.pathname.split('/flipbook/')[1]?.split('/')[0] || '';
  const source = new URLSearchParams(window.location.search).get('source') || 'share';

  const readerUrl = useMemo(() => {
    if (!shareToken) return '';
    return apiUrl(`${API}/public/${encodeURIComponent(shareToken)}/view?embedded=1&source=${encodeURIComponent(source)}`);
  }, [shareToken, source]);

  if (!shareToken) {
    return (
      <main style={{ width: '100vw', height: '100dvh', display: 'grid', placeItems: 'center', background: '#f4fbfa', color: '#17313a', fontFamily: 'Inter, Arial, sans-serif' }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 22 }}>Flipbook unavailable</h1>
          <p style={{ margin: 0, color: '#6a8588' }}>This Flipbook link is invalid.</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ width: '100vw', height: '100dvh', margin: 0, padding: 0, overflow: 'hidden', background: '#f4fbfa' }}>
      <iframe
        src={readerUrl}
        title="LMSGEN Flipbook"
        style={{ width: '100%', height: '100%', border: 0, display: 'block', background: '#f4fbfa' }}
        allow="fullscreen; clipboard-read; clipboard-write"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </main>
  );
}