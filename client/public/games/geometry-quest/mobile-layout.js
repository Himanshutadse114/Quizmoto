(() => {
  'use strict';

  const widthMq = window.matchMedia('(max-width: 1100px)');
  const coarseMq = window.matchMedia('(hover: none) and (pointer: coarse)');
  const views = ['board', 'formula', 'missions'];
  let currentView = 'board';
  let nav = null;
  let boardFormulaButton = null;

  const icons = {
    board: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 17V9m4 8V6m4 11v-5"/></svg>',
    formula: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h10M4 12h7M4 19h10"/><path d="M17 8l3 4-3 4"/></svg>',
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
    nav.innerHTML = views.map((view) => `
      <button type="button" data-mobile-view="${view}" aria-selected="${view === 'board'}">
        ${icons[view]}<span>${view === 'board' ? 'Board' : view === 'formula' ? 'Formula' : 'Missions'}</span>
      </button>`).join('');
    document.body.appendChild(nav);
    nav.addEventListener('click', (event) => {
      const button = event.target.closest('[data-mobile-view]');
      if (!button) return;
      setView(button.dataset.mobileView, true);
    });
    return nav;
  }

  function ensureBoardFormulaButton() {
    if (boardFormulaButton) return boardFormulaButton;
    boardFormulaButton = document.createElement('button');
    boardFormulaButton.type = 'button';
    boardFormulaButton.id = 'mobileBoardFormulaButton';
    boardFormulaButton.className = 'mobile-board-formula-button';
    boardFormulaButton.innerHTML = `${icons.formula}<span>Open Formula Lab</span>`;
    boardFormulaButton.addEventListener('click', () => {
      setView('formula', true);
      window.setTimeout(() => document.getElementById('formulaInput')?.focus({ preventScroll: true }), 80);
    });
    document.body.appendChild(boardFormulaButton);
    return boardFormulaButton;
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
    document.body.classList.remove(...views.map((item) => `mobile-view-${item}`));
    document.body.classList.add(`mobile-view-${view}`);
    if (nav) {
      nav.querySelectorAll('[data-mobile-view]').forEach((button) => {
        const active = button.dataset.mobileView === view;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
      });
    }
    if (boardFormulaButton) boardFormulaButton.hidden = view !== 'board';
    if (scrollTop) {
      try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch { window.scrollTo(0, 0); }
    }
    if (view === 'board') redrawBoard();
  }

  function syncMode() {
    const mobile = isMobile();
    document.body.classList.toggle('geometry-mobile', mobile);
    if (mobile) {
      ensureNav();
      ensureBoardFormulaButton();
      if (!document.body.classList.contains('mobile-keyboard-open')) nav.hidden = false;
      boardFormulaButton.hidden = currentView !== 'board';
      setView(currentView || 'board');
    } else {
      document.body.classList.remove(...views.map((item) => `mobile-view-${item}`));
      document.body.classList.remove('mobile-keyboard-open');
      if (nav) nav.hidden = true;
      if (boardFormulaButton) boardFormulaButton.hidden = true;
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
      window.setTimeout(() => {
        setView('formula', true);
        window.setTimeout(() => document.getElementById('formulaInput')?.focus({ preventScroll: true }), 80);
      }, 0);
      return;
    }

    if (event.target.closest('#actionBtn')) {
      window.setTimeout(() => setView('board', true), 0);
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
    if (!lessonOpen && !resultOpen && currentView !== 'board') setView('board', true);
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
    openFormula: () => setView('formula', true),
    openMissions: () => setView('missions', true),
    get currentView() { return currentView; }
  };

  syncMode();
})();