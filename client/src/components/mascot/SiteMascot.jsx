import { useEffect, useRef } from 'react';
import { createAvatar } from '@bible-strong/avatar-web';
import definition from './genny.avatar.json';
import { mountGenny } from './genny-runtime.js';
import './mascot.css';

export default function SiteMascot({ frameRef, pageSrc }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const mascot = mountGenny({ document, container: containerRef.current, createAvatar, definition });
    const frame = frameRef?.current;
    let boundDocument = null;
    const wireFrame = () => {
      try {
        const doc = frame?.contentDocument;
        // A requested URL may still expose about:blank or the previous Document.
        if (!doc || doc.URL === 'about:blank' || doc === boundDocument) return;
        boundDocument = doc;
        mascot.bindDocument(doc);
      } catch { /* cross-origin frame: Genny still works outside it */ }
    };
    frame?.addEventListener('load', wireFrame);
    wireFrame();
    return () => { frame?.removeEventListener('load', wireFrame); mascot.destroy(); };
  }, [frameRef, pageSrc]);

  return <div ref={containerRef} />;
}
