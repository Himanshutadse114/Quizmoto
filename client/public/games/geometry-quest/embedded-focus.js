(() => {
  'use strict';

  if (window.top === window.self) return;

  let focusRequested = false;
  let fullscreenActive = false;
  let fullscreenBar = null;

  const style = document.createElement('style');
  style.id = 'geometryEmbeddedFocusStyles';
  style.textContent = `
    body.geometry-focus .topbar{display:none!important}

    .fullscreen-game-bar{display:none}
    body.geometry-fullscreen .fullscreen-game-bar{
      min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:12px;
      padding:6px max(10px,env(safe-area-inset-right)) 6px max(10px,env(safe-area-inset-left));
      border-bottom:1px solid #D7E5E2;background:#fff;color:#14201E;position:sticky;top:0;z-index:45
    }
    .fullscreen-game-bar-copy{min-width:0;display:flex;align-items:center;gap:9px}
    .fullscreen-game-bar-mark{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:#E7F8F5;border:1px solid #B8E5DF;color:#178C82;font-weight:800}
    .fullscreen-game-bar-copy strong{display:block;font-size:12px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .fullscreen-game-bar-copy span{display:block;margin-top:2px;color:#6F817E;font-size:8px;line-height:1.1}
    .fullscreen-game-exit{height:32px;min-width:32px;border:1px solid #C8DAD6;border-radius:9px;background:#F8FBFA;color:#31534E;padding:0 10px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:10px;font-weight:750;white-space:nowrap}
    .fullscreen-game-exit:hover{background:#EAF7F5;border-color:#9ED7D0;color:#176F67}

    body.geometry-focus .phase-tabs{top:0!important}
    body.geometry-fullscreen.geometry-focus .phase-tabs{top:44px!important}
    body.geometry-focus .game-layout{min-height:calc(100vh - 56px)!important}
    body.geometry-fullscreen.geometry-focus .game-layout{min-height:calc(100vh - 100px)!important}
    body.geometry-focus .mission-sidebar,
    body.geometry-focus .formula-panel{top:56px!important;max-height:calc(100vh - 56px)!important}
    body.geometry-fullscreen.geometry-focus .mission-sidebar,
    body.geometry-fullscreen.geometry-focus .formula-panel{top:100px!important;max-height:calc(100vh - 100px)!important}

    @media(max-width:1120px){
      body.geometry-focus .mission-sidebar,
      body.geometry-focus .formula-panel,
      body.geometry-fullscreen.geometry-focus .mission-sidebar,
      body.geometry-fullscreen.geometry-focus .formula-panel{max-height:none!important}
    }

    @media(max-width:600px){
      body.geometry-fullscreen .fullscreen-game-bar{min-height:40px;padding-top:5px;padding-bottom:5px}
      .fullscreen-game-bar-copy span{display:none}
      .fullscreen-game-bar-mark{width:28px;height:28px}
      .fullscreen-game-exit{height:30px;padding:0 9px}
      body.geometry-fullscreen.geometry-focus .phase-tabs{top:40px!important}
    }
  `;
  document.head.appendChild(style);

  function parentExitButton() {
    try { return window.parent.document.querySelector('[title="Exit Geometry Physics"]'); }
    catch { return null; }
  }

  function hideParentExit() {
    const button = parentExitButton();
    if (button) button.style.display = fullscreenActive ? 'none' : '';
  }

  function exitGame() {
    const button = parentExitButton();
    if (button) {
      button.click();
      return;
    }

    try {
      const doc = window.parent.document;
      const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
      if (exit && (doc.fullscreenElement || doc.webkitFullscreenElement)) {
        const result = exit.call(doc);
        if (result?.finally) result.finally(() => window.parent.postMessage({ type: 'lmsgen:geometry-close' }, window.location.origin));
        else window.setTimeout(() => window.parent.postMessage({ type: 'lmsgen:geometry-close' }, window.location.origin), 80);
        return;
      }
    } catch {}
    window.parent.postMessage({ type: 'lmsgen:geometry-close' }, window.location.origin);
  }

  function ensureFullscreenBar() {
    if (fullscreenBar) return fullscreenBar;
    fullscreenBar = document.createElement('div');
    fullscreenBar.className = 'fullscreen-game-bar';
    fullscreenBar.setAttribute('role', 'banner');
    fullscreenBar.innerHTML = `
      <div class="fullscreen-game-bar-copy">
        <div class="fullscreen-game-bar-mark">∑</div>
        <div><strong>Geometry Physics</strong><span>Learn · Build · Test</span></div>
      </div>
      <button type="button" class="fullscreen-game-exit" aria-label="Exit Geometry Physics">✕ <span>Exit</span></button>`;
    fullscreenBar.querySelector('.fullscreen-game-exit').addEventListener('click', exitGame);
    const shell = document.querySelector('.app-shell');
    if (shell) shell.insertBefore(fullscreenBar, shell.firstChild);
    else document.body.prepend(fullscreenBar);
    return fullscreenBar;
  }

  function applyFocus() {
    const active = focusRequested || fullscreenActive;
    document.body.classList.toggle('geometry-focus', active);
    document.body.classList.toggle('geometry-fullscreen', fullscreenActive);
    ensureFullscreenBar();
    hideParentExit();
    window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }

  function pauseRunningGame() {
    const action = document.getElementById('actionBtn');
    const label = String(action?.textContent || '').trim().toLowerCase();
    if (action && label.includes('pause')) {
      try { action.click(); } catch {}
    }

    document.querySelectorAll('audio, video').forEach((media) => {
      try { media.pause(); } catch {}
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

  ensureFullscreenBar();
  window.setTimeout(hideParentExit, 0);
})();