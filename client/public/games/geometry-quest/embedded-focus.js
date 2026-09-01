(() => {
  'use strict';

  if (window.top === window.self) return;

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

  function setFocus(active) {
    document.body.classList.toggle('geometry-focus', Boolean(active));
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
  }

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== 'lmsgen:geometry-focus') return;
    setFocus(event.data.active);
  });
})();
