(() => {
  'use strict';

  const widthMq = window.matchMedia('(max-width: 1100px)');
  const coarseMq = window.matchMedia('(hover: none) and (pointer: coarse)');
  const views = ['board', 'missions'];
  let currentView = 'board';
  let nav = null;

  const icons = {
    board: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 8h10M7 12h6M7 16h8"/></svg>',
    missions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>'
  };

  function isMobile() {
    return widthMq.matches || coarseMq.matches;
  }

  function ensureNav() {
    if (nav) return nav;
    nav = document.createElement('nav');
    nav.id = 'mobileGameNav';
    nav.className = 'mobile-game-nav';
    nav.setAttribute('aria-label', 'Geometry Physics mobile sections');
    nav.innerHTML = `
      <button type="button" data-mobile-view="board" aria-selected="true">
        ${icons.board}<span>Play</span>
      </button>
      <button type="button" data-mobile-view="missions" aria-selected="false">
        ${icons.missions}<span>Missions</span>
      </button>`;
    document.body.appendChild(nav);
    nav.addEventListener('click', (event) => {
      const button = event.target.closest('[data-mobile-view]');
      if (!button) return;
      setView(button.dataset.mobileView, true);
    });
    return nav;
  }

  function redrawBoard() {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    });
  }

  function setKeyboardOpen(open) {
    document.body.classList.toggle('mobile-keyboard-open', Boolean(open));
    if (!nav) return;
    if (open) nav.hidden = true;
    else if (isMobile()) nav.hidden = false;
  }

  function setView(view, scrollTop = false) {
    if (!views.includes(view)) return;
    currentView = view;
    document.body.classList.remove('mobile-view-board', 'mobile-view-formula', 'mobile-view-missions');
    document.body.classList.add(`mobile-view-${view}`);

    if (nav) {
      nav.querySelectorAll('[data-mobile-view]').forEach((button) => {
        const active = button.dataset.mobileView === view;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
      });
    }

    if (scrollTop) {
      try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch { window.scrollTo(0, 0); }
    }
    if (view === 'board') redrawBoard();
  }

  function focusFormula() {
    setView('board', false);
    window.setTimeout(() => {
      const input = document.getElementById('formulaInput');
      input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => input?.focus({ preventScroll: true }), 220);
    }, 40);
  }

  function showBoardResult() {
    setKeyboardOpen(false);
    document.getElementById('formulaInput')?.blur();
    setView('board', false);
    window.setTimeout(() => {
      document.querySelector('.canvas-shell')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      redrawBoard();
    }, 40);
  }

  function syncMode() {
    const mobile = isMobile();
    document.body.classList.toggle('geometry-mobile', mobile);
    if (mobile) {
      ensureNav();
      if (!document.body.classList.contains('mobile-keyboard-open')) nav.hidden = false;
      setView(currentView || 'board');
    } else {
      document.body.classList.remove('mobile-view-board', 'mobile-view-formula', 'mobile-view-missions', 'mobile-keyboard-open');
      if (nav) nav.hidden = true;
      redrawBoard();
    }
  }

  document.addEventListener('click', (event) => {
    if (!isMobile()) return;

    const mission = event.target.closest('#missionList .mission-item');
    if (mission && !mission.classList.contains('access-locked')) {
      window.setTimeout(() => setView('board', true), 0);
      return;
    }

    if (event.target.closest('#startChallengeBtn')) {
      window.setTimeout(focusFormula, 0);
      return;
    }

    if (event.target.closest('#actionBtn')) {
      window.setTimeout(showBoardResult, 0);
      return;
    }

    if (event.target.closest('#replayBtn') || event.target.closest('#nextBtn')) {
      window.setTimeout(() => setView('board', true), 0);
    }
  });

  document.addEventListener('focusin', (event) => {
    if (!isMobile()) return;
    if (event.target?.matches?.('#formulaInput')) setKeyboardOpen(true);
  });

  document.addEventListener('focusout', (event) => {
    if (!isMobile() || !event.target?.matches?.('#formulaInput')) return;
    window.setTimeout(() => {
      if (!document.activeElement?.matches?.('#formulaInput')) setKeyboardOpen(false);
    }, 120);
  });

  document.addEventListener('keydown', (event) => {
    if (!isMobile() || event.key !== 'Escape') return;
    const lessonOpen = !document.getElementById('lessonOverlay')?.classList.contains('hidden');
    const resultOpen = !document.getElementById('resultModal')?.classList.contains('hidden');
    if (!lessonOpen && !resultOpen && currentView === 'missions') setView('board', true);
  });

  const listen = (mq) => {
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', syncMode);
    else mq.addListener(syncMode);
  };
  listen(widthMq);
  listen(coarseMq);

  window.GeometryMobileUI = {
    isMobile,
    setView,
    openBoard: () => setView('board', true),
    openFormula: focusFormula,
    openMissions: () => setView('missions', true),
    get currentView() { return currentView; }
  };

  syncMode();
})();