(() => {
  'use strict';

  const { levels, phases } = window.GeometryGameData;
  const E = window.GeometryEngine;
  const $ = (s) => document.querySelector(s);
  const STORAGE_KEY = 'quizmoto.geometry.physics.v2';

  let saved = loadSaved();
  let currentIndex = clamp(saved.lastIndex || 0, 0, levels.length - 1);
  let userSurfaces = [];
  let preview = null;
  let physics = null;
  let raf = 0;
  let lastTs = 0;
  let accumulator = 0;
  let hintUsed = false;
  let attempts = 0;
  let starBeepIndex = 0;
  const renderer = new E.Renderer($('#gameCanvas'));

  function loadSaved() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { completed: data.completed || {}, lastIndex: data.lastIndex || 0 };
    } catch {
      return { completed: {}, lastIndex: 0 };
    }
  }

  function persist() {
    saved.lastIndex = currentIndex;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch {}
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function current() { return levels[currentIndex]; }
  function phaseLevels(phaseId) { return levels.filter((l) => l.phase === phaseId); }
  function completedCount(phaseId) { return phaseLevels(phaseId).filter((l) => saved.completed[l.id]).length; }

  function init() {
    bind();
    renderPhaseTabs();
    loadLevel(currentIndex);
    requestAnimationFrame(() => { renderer.resize(); draw(); });
    window.addEventListener('resize', () => { renderer.resize(); draw(); });
  }

  function bind() {
    $('#backToQuizmoto').addEventListener('click', () => { location.href = '/scorm/quizmoto'; });
    $('#addFormulaBtn').addEventListener('click', addFormula);
    $('#formulaForm').addEventListener('submit', (e) => { e.preventDefault(); addFormula(); });
    $('#formulaInput').addEventListener('input', onFormulaInput);
    $('#clearEquationsBtn').addEventListener('click', () => {
      if (physics?.running) return;
      userSurfaces = [];
      preview = null;
      $('#formulaInput').value = '';
      $('#formulaError').textContent = '';
      renderEquationList(); draw(); updateBudget();
      status('Equations cleared. Build the mission again.', 'info');
    });
    $('.math-keys').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-key]'); if (!btn) return;
      insertAtCursor($('#formulaInput'), btn.dataset.key);
      onFormulaInput();
    });
    $('#hintBtn').addEventListener('click', toggleHint);
    $('#actionBtn').addEventListener('click', runAction);
    $('#resetBtn').addEventListener('click', resetRun);
    $('#closeResultBtn').addEventListener('click', closeModal);
    $('#replayBtn').addEventListener('click', () => { closeModal(); loadLevel(currentIndex); });
    $('#nextBtn').addEventListener('click', nextMission);
    $('#resultModal').addEventListener('click', (e) => { if (e.target.id === 'resultModal') closeModal(); });
  }

  function renderPhaseTabs() {
    const wrap = $('#phaseTabs'); wrap.innerHTML = '';
    for (const phase of phases) {
      const list = phaseLevels(phase.id);
      const done = completedCount(phase.id);
      const active = current().phase === phase.id;
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = `phase-tab${active ? ' active' : ''}`;
      btn.innerHTML = `<span>${phase.name.toUpperCase()}</span><small>${phase.subtitle}</small><b>${done}/${list.length}</b>`;
      btn.addEventListener('click', () => {
        const firstIncomplete = list.find((l) => !saved.completed[l.id]) || list[0];
        loadLevel(levels.indexOf(firstIncomplete));
      });
      wrap.appendChild(btn);
    }
  }

  function renderMissionList() {
    const phase = current().phase;
    const list = phaseLevels(phase);
    const wrap = $('#missionList'); wrap.innerHTML = '';
    list.forEach((level) => {
      const idx = levels.indexOf(level);
      const done = saved.completed[level.id];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `mission-item${idx === currentIndex ? ' active' : ''}${done ? ' complete' : ''}`;
      btn.innerHTML = `<span class="mission-num">${String(level.id).padStart(2, '0')}</span><span class="mission-copy"><strong>${level.title}</strong><small>${level.family}</small></span><span class="mission-state">${done ? '★'.repeat(done.stars || 1) : '○'}</span>`;
      btn.addEventListener('click', () => loadLevel(idx));
      wrap.appendChild(btn);
    });
  }

  function loadLevel(index) {
    stopAnimation();
    currentIndex = clamp(index, 0, levels.length - 1);
    const level = current();
    userSurfaces = []; preview = null; physics = null; hintUsed = false; attempts = 0;
    $('#formulaInput').value = ''; $('#formulaError').textContent = '';
    $('#hintPanel').classList.add('hidden'); $('#hintBtn').classList.remove('active');
    $('#missionPhase').textContent = level.phase === 'shape' ? 'SHAPE ACADEMY' : 'GRAVITY CAMPAIGN';
    $('#missionFamily').textContent = level.family;
    $('#missionTitle').textContent = level.title;
    $('#missionDescription').textContent = level.description;
    $('#modeBadge').textContent = level.phase === 'shape' ? 'CONSTRUCTION MODE' : 'PHYSICS MODE';
    $('#objectiveText').textContent = level.phase === 'shape'
      ? 'Recreate the glowing hologram by entering the required equation or equations. The shape must match in both form and domain.'
      : `Create up to ${level.budget} formula ramp${level.budget > 1 ? 's' : ''}. Press DROP BALL and use gravity to collect every star before reaching the basket.`;
    $('#formulaHelp').textContent = level.phase === 'shape'
      ? 'Examples: 2*x + 1 · x = 2 · 1; [-5,3] · x^2 + y^2 = 9'
      : 'Every equation you add becomes a solid ramp. Add ; [min, max] to restrict a curve to part of the board.';
    $('#hintText').textContent = level.hint || '';
    $('#hintFormula').innerHTML = (level.target || level.solution || []).map((f) => `<code>${escapeHtml(f)}</code>`).join('');
    $('#physicsHud').classList.toggle('hidden', level.phase !== 'gravity');
    $('#actionBtn').classList.toggle('physics-action', level.phase === 'gravity');
    setAction(level.phase === 'shape' ? '✓ CHECK SHAPE' : '● DROP BALL');
    $('#resetBtn').textContent = level.phase === 'shape' ? 'RESET CONSTRUCTION' : 'RESET BALL / VIEW';
    renderMissionList(); renderPhaseTabs(); renderEquationList(); updateBudget(); updateTopStats(); updatePhysicsHud();
    status(level.phase === 'shape'
      ? 'Match the glowing target using equations you type yourself.'
      : 'Write your ramp formula(s), then drop the ball. Gravity and curve collisions are live.', 'info');
    persist(); draw();
  }

  function onFormulaInput() {
    const raw = $('#formulaInput').value.trim();
    if (!raw) { preview = null; $('#formulaError').textContent = ''; draw(); return; }
    try {
      preview = E.parseEquation(raw, true);
      $('#formulaError').textContent = '';
    } catch (err) {
      preview = null;
      $('#formulaError').textContent = err.message || 'Invalid equation';
    }
    draw();
  }

  function addFormula() {
    if (physics?.running) return;
    const level = current();
    if (userSurfaces.length >= level.budget) { status(`This mission allows ${level.budget} equation${level.budget === 1 ? '' : 's'}. Remove one before adding another.`, 'warn'); return; }
    const raw = $('#formulaInput').value.trim();
    if (!raw) { $('#formulaError').textContent = 'Type an equation first.'; return; }
    try {
      const eq = E.parseEquation(raw);
      userSurfaces.push(eq);
      preview = null; $('#formulaInput').value = ''; $('#formulaError').textContent = '';
      renderEquationList(); updateBudget(); draw(); beep(420, .035);
      status(current().phase === 'gravity' ? 'Ramp added. Add another if needed, then drop the ball.' : 'Equation added. Keep building until the hologram is matched.', 'info');
    } catch (err) { $('#formulaError').textContent = err.message || 'Invalid equation'; }
  }

  function renderEquationList() {
    const wrap = $('#equationList'); wrap.innerHTML = '';
    if (!userSurfaces.length) { wrap.innerHTML = '<div class="empty-equations">No equations added yet.</div>'; return; }
    userSurfaces.forEach((eq, i) => {
      const row = document.createElement('div'); row.className = 'equation-row';
      row.innerHTML = `<span class="equation-index">${i + 1}</span><code>${escapeHtml(eq.raw)}</code><button type="button" aria-label="Remove equation">×</button>`;
      row.querySelector('button').addEventListener('click', () => {
        if (physics?.running) return;
        userSurfaces.splice(i, 1); renderEquationList(); updateBudget(); draw();
      });
      wrap.appendChild(row);
    });
  }

  function updateBudget() { $('#budgetValue').textContent = `${userSurfaces.length} / ${current().budget}`; }

  function toggleHint() {
    const panel = $('#hintPanel');
    const opening = panel.classList.contains('hidden');
    panel.classList.toggle('hidden'); $('#hintBtn').classList.toggle('active', opening);
    if (opening) hintUsed = true;
  }

  function runAction() {
    const level = current();
    if (level.phase === 'shape') checkShape();
    else if (physics?.running) stopRun();
    else startGravity();
  }

  function checkShape() {
    attempts++;
    if (!userSurfaces.length) { status('Add at least one equation before checking the construction.', 'warn'); return; }
    const targets = levelEquations(current().target);
    const result = E.compareGeometry(userSurfaces, targets);
    if (result.pass) {
      const stars = hintUsed ? 2 : attempts === 1 ? 3 : 2;
      status(`Shape match ${(result.score * 100).toFixed(0)}% — construction accepted.`, 'success');
      completeLevel(stars, `You recreated the target using ${userSurfaces.length} manually written equation${userSurfaces.length === 1 ? '' : 's'}.`);
    } else {
      status(`Shape match ${(result.score * 100).toFixed(0)}%. Check the formula, signs and domain limits, then try again.`, 'warn');
      beep(150, .06);
    }
  }

  function startGravity() {
    const level = current();
    if (!userSurfaces.length) { status('Add at least one formula ramp before dropping the ball.', 'warn'); return; }
    stopAnimation(); attempts++;
    physics = new E.PhysicsRun(level, userSurfaces, () => {
      starBeepIndex++; beep(600 + starBeepIndex * 80, .04); updatePhysicsHud();
    });
    starBeepIndex = 0; lastTs = 0; accumulator = 0;
    setAction('Ⅱ PAUSE RUN');
    status('Ball released. Gravity is active — the cyan equations are now physical ramps.', 'info');
    draw(); raf = requestAnimationFrame(frame);
  }

  function frame(ts) {
    if (!physics?.running) return;
    if (!lastTs) lastTs = ts;
    let elapsed = Math.min(.05, (ts - lastTs) / 1000); lastTs = ts; accumulator += elapsed;
    let result = null;
    while (accumulator >= 1 / 120 && !result) { result = physics.step(1 / 120); accumulator -= 1 / 120; }
    updatePhysicsHud(); draw();
    if (result) {
      setAction('↻ TRY AGAIN');
      if (result.won) {
        beep(880, .08); setTimeout(() => beep(1100, .08), 90);
        const ratio = Math.max(0, 1 - physics.time / current().timeLimit);
        const stars = hintUsed ? 2 : ratio > .55 ? 3 : ratio > .25 ? 2 : 1;
        status(`Success — ${result.collected}/${physics.stars.length} stars collected and the ball reached the basket.`, 'success');
        completeLevel(stars, `Your formula ramps carried the ball through all ${physics.stars.length} stars and into the basket under free gravity.`);
      } else {
        status(`Run ended with ${result.collected}/${physics.stars.length} stars. Adjust the equation or domain and try again.`, 'warn');
        beep(140, .06);
      }
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function stopRun() {
    if (!physics) return;
    physics.running = false;
    cancelAnimationFrame(raf); raf = 0;
    setAction('▶ RESUME');
    status('Physics paused. Reset the ball to edit equations, or press Resume to continue this run.', 'info');
  }

  function resetRun() {
    stopAnimation();
    if (current().phase === 'shape') {
      userSurfaces = []; preview = null; $('#formulaInput').value = ''; renderEquationList(); updateBudget();
      status('Construction cleared. The hologram remains as your target.', 'info');
    } else {
      physics = null;
      status('Ball reset. Your formula ramps are still available for editing.', 'info');
    }
    setAction(current().phase === 'shape' ? '✓ CHECK SHAPE' : '● DROP BALL');
    updatePhysicsHud(); draw();
  }

  function completeLevel(stars, text) {
    const level = current();
    const prev = saved.completed[level.id]?.stars || 0;
    saved.completed[level.id] = { stars: Math.max(prev, stars) };
    persist(); updateTopStats(); renderMissionList(); renderPhaseTabs();
    $('#resultPhase').textContent = level.phase === 'shape' ? 'SHAPE MASTERED' : 'GRAVITY RUN COMPLETE';
    $('#resultTitle').textContent = level.title;
    $('#resultStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    $('#resultText').textContent = text;
    $('#nextBtn').textContent = currentIndex === levels.length - 1 ? 'Finish' : 'Next Mission';
    $('#resultModal').classList.remove('hidden');
  }

  function nextMission() {
    closeModal();
    if (currentIndex < levels.length - 1) loadLevel(currentIndex + 1);
    else status('All Geometry Physics missions completed. Replay any mission to improve your stars.', 'success');
  }

  function closeModal() { $('#resultModal').classList.add('hidden'); }

  function updateTopStats() {
    const done = Object.keys(saved.completed).filter((id) => saved.completed[id]).length;
    $('#totalProgress').textContent = `${done}/${levels.length}`;
    $('#levelCounter').textContent = `${currentIndex + 1} / ${levels.length}`;
    const best = saved.completed[current().id]?.stars || 0;
    $('#savedStars').textContent = '★'.repeat(best) + '☆'.repeat(3 - best);
  }

  function updatePhysicsHud() {
    const level = current(); if (level.phase !== 'gravity') return;
    const count = physics ? physics.stars.filter((s) => s.collected).length : 0;
    $('#starHud').textContent = `${count} / ${level.stars.length}`;
    const remain = physics ? Math.max(0, level.timeLimit - physics.time) : level.timeLimit;
    $('#timeHud').textContent = `${remain.toFixed(remain < 10 ? 1 : 0)}s`;
  }

  function draw() { renderer.render(current(), userSurfaces, preview, physics); }
  function levelEquations(items) { return (items || []).map((raw) => E.parseEquation(raw)); }
  function setAction(text) { $('#actionBtn').textContent = text; }
  function status(message, type = 'info') { const el = $('#statusMessage'); el.textContent = message; el.dataset.type = type; }
  function stopAnimation() { if (raf) cancelAnimationFrame(raf); raf = 0; if (physics) physics.running = false; lastTs = 0; accumulator = 0; }

  function insertAtCursor(input, text) {
    const start = input.selectionStart ?? input.value.length, end = input.selectionEnd ?? start;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    const pos = start + text.length; input.focus(); input.setSelectionRange(pos, pos);
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  let audioCtx;
  function beep(freq, duration) {
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = freq; o.type = 'sine'; g.gain.setValueAtTime(.035, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration);
      o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + duration);
    } catch {}
  }

  init();
})();
