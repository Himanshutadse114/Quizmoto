(() => {
  'use strict';

  const mq = window.matchMedia('(max-width: 900px)');
  const views = ['board', 'formula', 'missions'];
  let currentView = 'board';
  let nav = null;

  const icons = {
    board: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 17V9m4 8V6m4 11v-5"/></svg>',
    formula: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h10M4 12h7M4 19h10"/><path d="M17 8l3 4-3 4"/></svg>',
    missions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>'
  };

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

  function redrawBoard() {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    });
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
    if (scrollTop) {
      try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch { window.scrollTo(0, 0); }
    }
    if (view === 'board') redrawBoard();
  }

  function syncMode() {
    const mobile = mq.matches;
    document.body.classList.toggle('geometry-mobile', mobile);
    if (mobile) {
      ensureNav();
      nav.hidden = false;
      setView(currentView || 'board');
    } else {
      document.body.classList.remove(...views.map((item) => `mobile-view-${item}`));
      if (nav) nav.hidden = true;
      redrawBoard();
    }
  }

  document.addEventListener('click', (event) => {
    if (!mq.matches) return;
    const mission = event.target.closest('#missionList .mission-item');
    if (!mission || mission.classList.contains('access-locked')) return;
    window.setTimeout(() => setView('board', true), 0);
  });

  document.addEventListener('keydown', (event) => {
    if (!mq.matches || event.key !== 'Escape') return;
    if (currentView !== 'board') setView('board', true);
  });

  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', syncMode);
  else mq.addListener(syncMode);

  syncMode();
})();
