(() => {
  'use strict';

  if (window.top === window.self) return;

  let focusRequested = false;
  let fullscreenActive = false;

  const style = document.createElement('style');
  style.id = 'geometryEmbeddedFocusStyles';
  style.textContent = `
    body.geometry-focus .topbar {
      display: none !important;
    }

    body.geometry-focus .phase-tabs {
      top: 0 !important;
    }

    body.geometry-focus .game-layout {
      min-height: calc(100vh - 56px) !important;
    }

    body.geometry-focus .mission-sidebar,
    body.geometry-focus .formula-panel {
      top: 56px !important;
      max-height: calc(100vh - 56px) !important;
    }

    @media (max-width: 1120px) {
      body.geometry-focus .mission-sidebar,
      body.geometry-focus .formula-panel {
        max-height: none !important;
      }
    }
  `;
  document.head.appendChild(style);

  function applyFocus() {
    const active = focusRequested || fullscreenActive;
    document.body.classList.toggle('geometry-focus', active);
    window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }

  function pauseRunningGame() {
    const action = document.getElementById('actionBtn');
    const label = String(action?.textContent || '').trim().toLowerCase();
    if (action && label.includes('pause')) {
      try { action.click(); } catch (_) {}
    }

    document.querySelectorAll('audio, video').forEach((media) => {
      try { media.pause(); } catch (_) {}
    });
  }

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;

    if (event.data?.type === 'lmsgen:geometry-focus') {
      focusRequested = Boolean(event.data.active);
      applyFocus();
      return;
    }

    if (event.data?.type === 'lmsgen:geometry-fullscreen') {
      fullscreenActive = Boolean(event.data.active);
      if (!fullscreenActive) pauseRunningGame();
      applyFocus();
    }
  });
})();
