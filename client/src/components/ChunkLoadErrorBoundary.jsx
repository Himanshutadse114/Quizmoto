import React from 'react';

const RELOAD_FLAG = 'chunkLoadErrorReloadedAt';
const RELOAD_COOLDOWN_MS = 15000;

function isChunkLoadError(error) {
  const message = String(error?.message || error || '');
  return /dynamically imported module|Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk \d+ failed/i.test(message);
}

// A deploy that lands between a page loading and a lazy route being clicked
// leaves the browser holding an index.html that references JS chunk hashes
// the server no longer has (the old build was replaced). That failed
// dynamic import() rejects inside Suspense, which has no built-in recovery,
// so the route hangs on its loading spinner forever with no visible error.
// Catch that specific failure and reload once to pick up the current build.
export default class ChunkLoadErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError(error) {
    return isChunkLoadError(error) ? { failed: true } : null;
  }

  componentDidCatch(error) {
    if (!isChunkLoadError(error)) throw error;

    const lastReload = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
    if (Date.now() - lastReload > RELOAD_COOLDOWN_MS) {
      sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
      window.location.reload();
    }
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
