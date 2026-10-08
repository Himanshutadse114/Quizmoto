import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { apiUrl } from '../../config';

const API = '/api/scorm/flipbooks';

export default function FlipbookViewer({ shareToken: propToken }) {
  const { shareToken: routeToken } = useParams();
  const shareToken = propToken || routeToken || '';
  const source = new URLSearchParams(window.location.search).get('source') || 'share';

  const readerUrl = useMemo(() => {
    if (!shareToken) return '';
    return apiUrl(`${API}/public/${encodeURIComponent(shareToken)}/view?embedded=1&source=${encodeURIComponent(source)}`);
  }, [shareToken, source]);

  if (!shareToken) {
    return (
      <main style={{ position: 'fixed', inset: 0, width: '100%', height: '100dvh', display: 'grid', placeItems: 'center', background: '#080F18', color: '#F5F8FC', fontFamily: 'Inter, Arial, sans-serif' }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 22 }}>Publication unavailable</h1>
          <p style={{ margin: 0, color: '#B7C6D6' }}>This Publica link is invalid.</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ position: 'fixed', inset: 0, width: '100%', height: '100dvh', minWidth: 0, margin: 0, padding: 0, overflow: 'hidden', background: '#080F18' }}>
      <iframe
        src={readerUrl}
        title="LMSGEN Publica"
        style={{ width: '100%', height: '100%', border: 0, display: 'block', background: '#080F18' }}
        allow="fullscreen; clipboard-read; clipboard-write; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </main>
  );
}
