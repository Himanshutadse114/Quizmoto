(() => {
  'use strict';

  const FREE_LEVELS = 25;
  const TOTAL_LEVELS = 132;
  const ACCESS_KEY = 'geometryPhysicsFullAccess';
  let fullAccess = false;
  let checked = false;

  function getToken() {
    try { return localStorage.getItem('token') || ''; } catch { return ''; }
  }

  function readSavedProgress() {
    try { return JSON.parse(localStorage.getItem('quizmoto.geometry.physics.v2') || '{}'); } catch { return {}; }
  }

  function writeSavedProgress(value) {
    try { localStorage.setItem('quizmoto.geometry.physics.v2', JSON.stringify(value || {})); } catch {}
  }

  function currentLevelNumber() {
    const text = document.getElementById('levelCounter')?.textContent || '1';
    const match = String(text).match(/\d+/);
    return match ? Number(match[0]) : 1;
  }

  function isSuperAdminUser() {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return Boolean(user?.isSuperAdmin || user?.role === 'super_admin');
    } catch {
      return false;
    }
  }

  function ensureModal() {
    if (document.getElementById('geometryAccessModal')) return;
    const style = document.createElement('style');
    style.textContent = `
      .mission-item.access-locked{opacity:.56;position:relative;cursor:pointer}
      .mission-item.access-locked .mission-state{color:#8B9A97}
      .mission-item.access-locked:hover{opacity:.8}
      .geometry-access-modal{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:20px;background:rgba(18,32,30,.36);backdrop-filter:blur(8px)}
      .geometry-access-modal.hidden{display:none}
      .geometry-access-card{width:min(520px,100%);border:1px solid #D7E5E2;border-radius:22px;background:#fff;color:#14201E;box-shadow:0 28px 80px rgba(27,56,51,.18);padding:28px;font-family:"Plus Jakarta Sans",system-ui,sans-serif}
      .geometry-access-icon{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:#FFF7E7;color:#B7791F;font-size:22px}
      .geometry-access-card h2{margin:18px 0 8px;font-size:25px;line-height:1.12;letter-spacing:-.03em}
      .geometry-access-card p{margin:0;color:#5D706C;font-size:13px;line-height:1.65}
      .geometry-access-note{margin-top:16px!important;padding:13px 14px;border:1px solid #F0D9A7;border-radius:12px;background:#FFF9ED;color:#6C5420!important}
      .geometry-access-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:22px}
      .geometry-access-actions button{border-radius:10px;min-height:40px;padding:0 14px;font:700 12px "Plus Jakarta Sans",system-ui,sans-serif;cursor:pointer}
      .geometry-access-secondary{border:1px solid #D7E5E2;background:#fff;color:#324943}
      .geometry-access-primary{border:1px solid #4FC9BF;background:#4FC9BF;color:#102B27}
    `;
    document.head.appendChild(style);

    const modal = document.createElement('div');
    modal.id = 'geometryAccessModal';
    modal.className = 'geometry-access-modal hidden';
    modal.innerHTML = `
      <div class="geometry-access-card" role="dialog" aria-modal="true" aria-labelledby="geometryAccessTitle">
        <div class="geometry-access-icon">🔒</div>
        <h2 id="geometryAccessTitle">More levels require Super Admin access</h2>
        <p>You can play Levels 1–${FREE_LEVELS} free inside LMSGEN. Levels ${FREE_LEVELS + 1}–${TOTAL_LEVELS} are part of the full Geometry Physics curriculum.</p>
        <p class="geometry-access-note"><strong>To unlock the rest:</strong> ask your LMSGEN Super Admin to enable <strong>Geometry Physics full access</strong> for your tenant in <strong>Tenant Management → Limits & features</strong>.</p>
        <div class="geometry-access-actions">
          <button type="button" class="geometry-access-secondary" data-close>Continue free levels</button>
          <button type="button" class="geometry-access-primary" data-home>Back to LMSGEN</button>
        </div>
      </div>`;
    modal.querySelector('[data-close]').addEventListener('click', () => modal.classList.add('hidden'));
    modal.querySelector('[data-home]').addEventListener('click', () => { location.href = '/scorm'; });
    modal.addEventListener('click', (event) => { if (event.target === modal) modal.classList.add('hidden'); });
    document.body.appendChild(modal);
  }

  function showLock() {
    ensureModal();
    document.getElementById('geometryAccessModal')?.classList.remove('hidden');
  }

  function markMissionLocks() {
    if (fullAccess) return;
    document.querySelectorAll('#missionList .mission-item').forEach((button) => {
      const number = Number(button.querySelector('.mission-num')?.textContent || 0);
      const locked = number > FREE_LEVELS;
      button.classList.toggle('access-locked', locked);
      if (locked) {
        button.setAttribute('aria-disabled', 'true');
        button.title = 'Ask the LMSGEN Super Admin to unlock full Geometry Physics access.';
        const state = button.querySelector('.mission-state');
        if (state) state.textContent = '🔒';
      } else {
        button.removeAttribute('aria-disabled');
      }
    });
  }

  function allFreeLevelsCompleted() {
    const completed = readSavedProgress().completed || {};
    for (let i = 1; i <= FREE_LEVELS; i += 1) if (!completed[i]) return false;
    return true;
  }

  function enforceInitialLevel() {
    if (fullAccess) return;
    const saved = readSavedProgress();
    const savedIndex = Number(saved.lastIndex || 0);
    if (savedIndex >= FREE_LEVELS || currentLevelNumber() > FREE_LEVELS) {
      saved.lastIndex = FREE_LEVELS - 1;
      writeSavedProgress(saved);
      location.reload();
    }
  }

  function interceptLockedNavigation(event) {
    if (fullAccess) return;

    const back = event.target.closest('#backToQuizmoto');
    if (back) {
      event.preventDefault();
      event.stopImmediatePropagation();
      location.href = '/scorm';
      return;
    }

    const mission = event.target.closest('#missionList .mission-item');
    if (mission) {
      const number = Number(mission.querySelector('.mission-num')?.textContent || 0);
      if (number > FREE_LEVELS) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showLock();
        return;
      }
    }

    const phase = event.target.closest('#phaseTabs .phase-tab');
    if (phase) {
      const label = String(phase.textContent || '').toLowerCase();
      if (label.includes('gravity') || (label.includes('shape') && allFreeLevelsCompleted())) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showLock();
        return;
      }
    }

    const next = event.target.closest('#nextBtn');
    if (next && currentLevelNumber() >= FREE_LEVELS) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showLock();
    }
  }

  function updateBranding() {
    document.title = 'Geometry Physics | LMSGEN Free Games';
    const back = document.getElementById('backToQuizmoto');
    const label = back?.querySelector('span');
    if (label) label.textContent = 'LMSGEN';
  }

  async function resolveAccess() {
    updateBranding();
    ensureModal();
    if (isSuperAdminUser()) {
      fullAccess = true;
      checked = true;
      window.GeometryGameAccess = { freeLevels: FREE_LEVELS, totalLevels: TOTAL_LEVELS, fullAccess, checked };
      return;
    }

    const token = getToken();
    if (token) {
      try {
        const response = await fetch('/api/scorm/access/me', {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'same-origin'
        });
        if (response.ok) {
          const data = await response.json();
          fullAccess = Boolean(data?.isSuperAdmin || data?.entitlement?.permissions?.[ACCESS_KEY]);
        }
      } catch {
        fullAccess = false;
      }
    }
    checked = true;
    window.GeometryGameAccess = { freeLevels: FREE_LEVELS, totalLevels: TOTAL_LEVELS, fullAccess, checked };
    enforceInitialLevel();
    markMissionLocks();
  }

  document.addEventListener('click', interceptLockedNavigation, true);
  const observer = new MutationObserver(() => markMissionLocks());
  const missionList = document.getElementById('missionList');
  if (missionList) observer.observe(missionList, { childList: true, subtree: true });

  resolveAccess();
})();
