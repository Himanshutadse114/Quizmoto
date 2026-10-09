// One behavior implementation for static pages and the React marketing iframe.
// Inject the renderer to allow deterministic lifecycle/timing regression tests.
// Art/animation engine: Bible Strong Avatar Lab, Stephane Montlouis-Calixte
// (AGPL-3.0, https://github.com/smontlouis/bible-strong-avatar-lab).
import { GENNY_TOPICS, topicForElement, actionTipForElement } from './genny-knowledge.js';
import { GENNY_PERSONAS } from './genny-personas.js';
const DISMISS_KEY = 'lmsgen-mascot-dismissed';
const GREETED_KEY = 'lmsgen-mascot-greeted';
const TIP_GAP = 9000;
const TIP_DWELL = 1200;

export const GENNY_TIPS = [
  { sel: '.lmsgen-pain-section', text: 'Create, deliver and track learning from one workspace.', anim: 'happy' },
  { sel: '.hp-platform-s', text: 'Start with a topic or source material, then review your AI-generated course.', anim: 'happy' },
  { sel: '.lmsgen-pdf-course-section', text: 'Publica turns PDFs into shareable flipbooks with reading analytics.', anim: 'playful' },
  { sel: '.hp-trust-s', text: 'Explore tools for course creation, delivery and reporting.', anim: 'happy' },
  { sel: '.hp-advg-s', text: 'Courses, learner campaigns and reports work together in LMSGEN.', anim: 'happy' },
  { sel: '.hp-insights-s', text: 'Explore the platform modules to find the right tools for your team.', anim: 'happy' },
  { sel: '.lmsgen-faq-section', text: 'These answers cover common questions about the platform.', anim: 'thinking' },
  { sel: '.sl-hero-s', text: 'Create, deliver and track training in one workspace.', anim: 'happy' },
  { sel: '.sl-feat-templ-s', text: 'Build a course, then assign it to your learners.', anim: 'happy' },
  { sel: '.nsl-local-s', text: 'Organise learners for your training programmes.', anim: 'happy' },
  { sel: '.nsol-manage-s', text: 'See learner completions, scores and progress in reports.', anim: 'happy' },
  { sel: '.ct-main-s', text: 'Tell the team about your training needs and learner count.', anim: 'happy' },
  { sel: '.book-demo-s', text: 'Explore LMSGEN to see the platform for yourself.', anim: 'excited' },
  { sel: '#quizmoto', text: 'Host a live Quizmoto quiz. Players join with a code or link.', anim: 'excited' },
];

// Preserve the artwork, but give reactions a real end and a short wake sequence.
export function prepareGennyDefinition(source, { platform = false } = {}) {
  const animations = Object.fromEntries(Object.entries(source.animations).map(([name, animation]) => {
    const looping = name === 'idle' || name === 'sleeping';
    let steps = animation.steps.map((step, index) => ({
      ...step,
      holdMs: looping ? (name === 'idle' ? 1100 + index * 300 : step.holdMs) : 320,
      transitionMs: looping ? 450 : 200,
    }));
    if (name === 'waking') steps = [
      { expression: 'eyes-closed', holdMs: 100, transitionMs: 150, transition: 'smooth' },
      { expression: 'neutral', holdMs: 450, transitionMs: 250, transition: 'smooth' },
    ];
    return [name, {
      ...animation, steps, playbackMode: looping ? 'loop' : 'once',
      blink: name === 'idle' ? { ...animation.blink, initialDelayMs: 1400, minIntervalMs: 2200, maxIntervalMs: 4000 } : animation.blink,
    }];
  }));
  const expressions = { ...source.expressions };
  // 32 avatar units remain visible at the phone's 72px mascot size. Coordinates
  // are relative to the neutral pose, not an accidental replacement of its y.
  for (const [direction, x, y] of [['up', 0, -32], ['down', 0, 32], ['left', -32, 0], ['right', 32, 0]]) {
    const neutral = source.expressions.neutral;
    expressions[`genny-look-${direction}`] = {
      ...neutral, head: { ...neutral.head, x: -y / 4, y: x / 4 },
      eyes: { ...neutral.eyes,
        left: { ...neutral.eyes.left, x: neutral.eyes.left.x + x, y: neutral.eyes.left.y + y },
        right: { ...neutral.eyes.right, x: neutral.eyes.right.x + x, y: neutral.eyes.right.y + y } },
    };
    animations[`look-${direction}`] = {
      playbackMode: 'once', steps: [{ expression: `genny-look-${direction}`, holdMs: 700, transitionMs: 180, transition: 'smooth' }],
      blink: { ...source.animations.idle.blink, enabled: false },
    };
  }
  // Idle eye motion must work without hover, including touch-only devices.
  // The website explorer is curious; the workspace coach is calmer and focused.
  animations.idle.steps = (platform
    ? ['neutral', 'genny-look-left', 'neutral', 'genny-look-right']
    : ['neutral', 'genny-look-up', 'genny-look-left', 'neutral', 'genny-look-right'])
    .map((expression) => ({ expression, holdMs: platform ? 1500 : 1100, transitionMs: 450, transition: 'smooth' }));
  const directions = ['up', 'down', 'left', 'right'];
  const persona = GENNY_PERSONAS[platform ? 'platform' : 'website'];
  return { ...source, colors: { ...source.colors, body: persona.body, eyes: persona.eyes }, expressions,
    expressionOrder: [...source.expressionOrder, ...directions.map((direction) => `genny-look-${direction}`)],
    animations, animationOrder: [...source.animationOrder, ...directions.map((direction) => `look-${direction}`)] };
}

export function mountGenny({ document: doc, createAvatar, definition, container = doc.body, onActivate, onTopic, onDismiss, topics = GENNY_TOPICS, currentTopic, platform = false, hoverEnabled = true }) {
  const win = doc.defaultView;
  const media = win.matchMedia('(prefers-reduced-motion: reduce)');
  const greetKey = platform ? 'lmsgen-genny-platform-welcomed-v2' : GREETED_KEY;
  const readFlag = (key) => { try { return win.sessionStorage.getItem(key) === '1'; } catch { return false; } };
  const writeFlag = (key) => { try { win.sessionStorage.setItem(key, '1'); } catch { /* optional storage */ } };
  if (!platform && readFlag(DISMISS_KEY)) return { bindDocument: () => {}, destroy: () => {}, explain: () => {} };

  const persona = GENNY_PERSONAS[platform ? 'platform' : 'website'];
  const avatarDefinition = prepareGennyDefinition(definition, { platform });
  const root = doc.createElement('div');
  root.className = 'lmsgen-mascot';
  root.dataset.persona = platform ? 'platform' : 'website';
  if (platform) root.className += ' lmsgen-mascot-platform';
  root.innerHTML = '<button type="button" class="lmsgen-mascot-bubble" aria-live="polite" aria-atomic="true" hidden></button>' +
    '<button type="button" class="lmsgen-mascot-btn" title="Genny"><span class="lmsgen-mascot-mount"></span></button>' +
    '<button type="button" class="lmsgen-mascot-dismiss" aria-label="Hide Genny the mascot for this visit" title="Hide"><span class="lmsgen-mascot-dismiss-icon" aria-hidden="true"></span></button>';
  container.appendChild(root);
  const button = root.querySelector('.lmsgen-mascot-btn');
  button.setAttribute('title', persona.title);
  const bubble = root.querySelector('.lmsgen-mascot-bubble');
  const cleanups = [];
  const timers = new Set();
  let destroyed = false;
  let controller;
  let mode = 'idle';
  let pending = null;
  let queued = null;
  let reactionTimer;
  let idleTimer;
  let bubbleTimer;
  let greetingTimer;
  let unbindGuide = () => {};
  let retryTip = () => {};
  let lastTipAt = -Infinity;
  let gazeUntil = 0;

  function later(fn, ms) {
    const id = win.setTimeout(() => { timers.delete(id); if (!destroyed) fn(); }, ms);
    timers.add(id);
    return id;
  }
  function cancel(id) { win.clearTimeout(id); timers.delete(id); }
  function listen(target, event, fn, options) {
    target.addEventListener(event, fn, options);
    return () => target.removeEventListener(event, fn, options);
  }
  function setMode(next) { mode = next; root.dataset.mode = next; }
  function play(name) {
    if (destroyed) return false;
    try { return Boolean(controller?.play(name)?.ok); } catch { return false; }
  }
  function hideBubble() { cancel(bubbleTimer); bubble.hidden = true; }
  function showBubble(text, persistent = false) {
    cancel(greetingTimer);
    hideBubble();
    bubble.textContent = text;
    bubble.hidden = false;
    if (!persistent) bubbleTimer = later(() => { hideBubble(); retryTip(); }, 6500);
  }
  function settle() {
    if (!pending || destroyed) return;
    if (pending.name.startsWith('look-') && Date.now() < gazeUntil) {
      // The renderer holds the final pose. Keep that gaze through an ongoing
      // swipe rather than snapping back to idle halfway through the gesture.
      cancel(reactionTimer);
      reactionTimer = later(settle, gazeUntil - Date.now());
      return;
    }
    const { next } = pending;
    pending = null;
    cancel(reactionTimer);
    setMode(next === 'sleeping' ? 'asleep' : 'idle');
    play(next);
    delete root.dataset.look;
    if (queued) {
      const reaction = queued;
      queued = null;
      react(reaction.name, reaction.priority);
    }
    retryTip();
  }
  function react(name, priority = 1, next = 'idle') {
    if (destroyed || media.matches || doc.hidden) return false;
    if (pending && priority < pending.priority) {
      if (!queued || priority >= queued.priority) queued = { name, priority };
      return false;
    }
    if (pending?.name === name && priority < 4) return true;
    cancel(reactionTimer);
    pending = { name, next, priority };
    setMode('busy');
    if (!play(name)) { settle(); return false; }
    const duration = avatarDefinition.animations[name].steps.reduce((sum, step) => sum + step.holdMs + step.transitionMs, 0);
    // Safety only: once animations normally return via onAnimationEnd.
    reactionTimer = later(settle, duration + 250);
    return true;
  }
  function look(direction) {
    if (media.matches || doc.hidden || (pending && pending.priority > 2)) return;
    gazeUntil = Date.now() + 1100;
    root.dataset.look = direction;
    react(`look-${direction}`, 2);
  }
  function armIdle() {
    cancel(idleTimer);
    if (destroyed || media.matches || doc.hidden) return;
    idleTimer = later(() => {
      if (pending) armIdle();
      else react('drowsy', 0, 'sleeping');
    }, 30000);
  }
  function activity() {
    if (destroyed || media.matches || doc.hidden) return;
    if (mode === 'asleep') react('waking', 0);
    else if (pending?.next === 'sleeping') {
      pending = null;
      cancel(reactionTimer);
      setMode('idle');
      play('idle');
    }
    armIdle();
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    unbindGuide();
    cleanups.splice(0).forEach((cleanup) => cleanup());
    timers.forEach((id) => win.clearTimeout(id));
    timers.clear();
    pending = queued = null;
    controller?.destroy();
    root.remove();
  }
  function motionChanged() {
    cancel(reactionTimer);
    cancel(idleTimer);
    cancel(greetingTimer);
    hideBubble();
    pending = queued = null;
    setMode('idle');
    gazeUntil = 0;
    delete root.dataset.look;
    button.setAttribute('aria-label', onActivate ? persona.title : media.matches ? 'Genny, the LMSGEN mascot' : 'Genny, the LMSGEN mascot. Select to make Genny laugh.');
    controller?.stop();
    if (media.matches) controller?.setExpression('neutral');
    else { play('idle'); armIdle(); retryTip(); }
  }

  try {
    controller = createAvatar(root.querySelector('.lmsgen-mascot-mount'), {
      definition: avatarDefinition,
      defaultAnimation: media.matches ? undefined : 'idle',
      defaultExpression: media.matches ? 'neutral' : undefined,
      size: '100%', ariaLabel: 'Genny, the LMSGEN mascot',
      onAnimationEnd: (name) => {
        if (pending?.name !== name) return;
        // Leave the renderer's RAF callback before starting the next animation.
        // Starting synchronously can schedule two render loops on every reaction.
        cancel(reactionTimer);
        reactionTimer = later(() => { if (pending?.name === name) settle(); }, 0);
      },
      onExpressionChange: (name) => { root.dataset.expression = name; },
    });
  } catch { destroy(); return { bindDocument: () => {}, destroy }; }

  cleanups.push(listen(button, 'click', () => { hideBubble(); cancel(greetingTimer); queued = null; react('laughing', 4); armIdle(); onActivate?.(); }));
  cleanups.push(listen(bubble, 'click', () => { hideBubble(); retryTip(); }));
  cleanups.push(listen(root.querySelector('.lmsgen-mascot-dismiss'), 'click', () => { if (!platform) writeFlag(DISMISS_KEY); destroy(); onDismiss?.(); }));
  cleanups.push(listen(media, 'change', motionChanged));
  cleanups.push(listen(doc, 'keydown', (event) => { if (event.key === 'Escape') { hideBubble(); retryTip(); } }));
  for (const event of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'touchmove', 'scroll']) {
    cleanups.push(listen(win, event, activity, { passive: true }));
  }
  cleanups.push(listen(doc, 'visibilitychange', () => {
    if (doc.hidden) { cancel(reactionTimer); cancel(idleTimer); hideBubble(); pending = queued = null; controller.pause(); }
    else motionChanged();
  }));
  motionChanged();
  if (!media.matches) {
    react('waking', 0);
    if (!readFlag(greetKey)) greetingTimer = later(() => {
      if (media.matches || doc.hidden) return;
      writeFlag(greetKey);
      showBubble(persona.greeting);
    }, 1500);
  }

  function bindDocument(guideDoc) {
    unbindGuide();
    retryTip = () => {};
    if (!guideDoc || destroyed) return;
    const guideWin = guideDoc.defaultView;
    const bindings = [];
    const shown = new Set();
    const targets = (platform ? [] : GENNY_TIPS).flatMap((tip, index) => [...guideDoc.querySelectorAll(tip.sel)].map((el) => ({ el, tip, index })));
    let candidate = null;
    let dwellUntil = 0;
    let tipTimer;
    let lastY = guideWin.scrollY;
    let lastScrollAt = win.performance.now();
    const scrollPositions = new WeakMap();
    let hoverTimer;
    let hoverTarget = null;
    let hoverIdentity = null;
    let hoverDismissed = false;
    let touch = null;
    let lastTouchAt = -Infinity;

    // Passive touch listeners survive browsers cancelling pointer streams for
    // native pan/zoom. Never preventDefault: page scrolling remains untouched.
    const ignored = (target) => Boolean(target?.closest?.('.genny-guide, .lmsgen-mascot'));
    const touchStart = (event) => {
      touch = null;
      if (event.touches?.length !== 1 || ignored(event.target)) return;
      const point = event.touches[0];
      touch = { x: point.clientX, y: point.clientY, id: point.identifier };
      activity();
      const width = guideWin.innerWidth || 375;
      look(point.clientX < width / 2 ? 'left' : 'up');
    };
    const touchMove = (event) => {
      if (!touch || event.touches?.length !== 1) { touch = null; return; }
      const point = event.touches[0];
      if (point.identifier !== touch.id) return;
      activity();
      const dx = point.clientX - touch.x;
      const dy = point.clientY - touch.y;
      const now = win.performance.now();
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 6 || now - lastTouchAt < 80) return;
      // Vertical swipe direction matches the resulting content scroll.
      look(Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? 'down' : 'up') : (dx < 0 ? 'left' : 'right'));
      lastTouchAt = now;
      touch = { x: point.clientX, y: point.clientY, id: point.identifier };
    };
    const touchEnd = () => { touch = null; };
    bindings.push(listen(guideDoc, 'touchstart', touchStart, { passive: true }));
    bindings.push(listen(guideDoc, 'touchmove', touchMove, { passive: true }));
    bindings.push(listen(guideDoc, 'touchend', touchEnd, { passive: true }));
    bindings.push(listen(guideDoc, 'touchcancel', touchEnd, { passive: true }));

    const explain = (text, topic) => {
      showBubble(text, true);
      if (topic) onTopic?.(topic);
      react('thinking', 2);
      armIdle();
    };
    function explainTarget(event) {
      if (!hoverEnabled) return;
      if (event.type === 'pointerover' && event.pointerType === 'touch') return;
      const target = event.target;
      const topic = topicForElement(target, topics);
      const tip = actionTipForElement(target, currentTopic);
      if (!topic && !tip) return;
      const identity = tip || topic.id;
      if (hoverIdentity === identity && (hoverDismissed || !bubble.hidden)) return;
      cancel(hoverTimer);
      hoverTarget = target.closest('[data-genny-topic], a[href], h1, h2, h3, button, [data-genny-tip]');
      hoverIdentity = identity;
      hoverDismissed = false;
      hoverTimer = later(() => explain(tip || `${topic.punch} ${topic.explanation}`, topic), event.type === 'focusin' ? 0 : 550);
    }
    function leaveTarget(event) {
      if (hoverTarget?.contains?.(event.relatedTarget) || event.relatedTarget === bubble) return;
      cancel(hoverTimer);
      hoverIdentity = null;
      hoverTarget = null;
      hoverDismissed = false;
      // Keep the explanation until explicitly dismissed. The user can move
      // across the page to the bubble without racing an auto-hide timer.
    }
    bindings.push(listen(guideDoc, 'pointerover', explainTarget));
    bindings.push(listen(guideDoc, 'focusin', explainTarget));
    bindings.push(listen(guideDoc, 'pointerout', leaveTarget));
    bindings.push(listen(guideDoc, 'focusout', leaveTarget));
    bindings.push(listen(guideDoc, 'keydown', (event) => { if (event.key === 'Escape') { hoverDismissed = true; cancel(hoverTimer); hideBubble(); retryTip(); } }));

    function attemptTip() {
      cancel(tipTimer);
      if (!candidate || shown.has(candidate.index) || destroyed || media.matches || doc.hidden || guideDoc.hidden) return;
      // Persistent hover help waits for a real dismissal, not a polling loop.
      if (!bubble.hidden) return;
      const remaining = Math.max(dwellUntil - Date.now(), lastTipAt + TIP_GAP - Date.now());
      if (remaining > 0 || pending) {
        tipTimer = later(attemptTip, Math.max(remaining, 250));
        return;
      }
      shown.add(candidate.index);
      lastTipAt = Date.now();
      showBubble(candidate.tip.text);
      react(candidate.tip.anim, 1);
      armIdle();
    }
    function refreshCandidate() {
      const middle = guideWin.innerHeight / 2;
      const visible = targets.filter(({ el }) => {
        const rect = el.getBoundingClientRect();
        return rect.height > 0 && rect.top < guideWin.innerHeight && rect.bottom > 0;
      });
      visible.sort((a, b) => {
        const distance = ({ el }) => { const r = el.getBoundingClientRect(); return Math.abs((r.top + r.bottom) / 2 - middle); };
        return distance(a) - distance(b);
      });
      const next = visible[0] || null;
      if (candidate?.el !== next?.el) { cancel(tipTimer); dwellUntil = Date.now() + TIP_DWELL; candidate = next; }
      if (candidate && !timers.has(tipTimer)) attemptTip();
    }
    retryTip = refreshCandidate;
    const onScroll = (event) => {
      activity();
      const now = win.performance.now();
      const elapsed = now - lastScrollAt;
      const target = event?.target;
      if (target?.closest?.('.genny-guide')) return;
      const nested = target && target !== guideDoc && target !== guideDoc.documentElement && typeof target.scrollTop === 'number';
      const position = nested ? target.scrollTop : guideWin.scrollY;
      const previous = nested ? (scrollPositions.get(target) ?? 0) : lastY;
      const delta = position - previous;
      if (nested) scrollPositions.set(target, position);
      else lastY = position;
      if (Math.abs(delta) > 2 && (elapsed > 80 || root.dataset.look !== (delta > 0 ? 'down' : 'up'))) {
        lastScrollAt = now;
        const direction = delta > 0 ? 'down' : 'up';
        // Deliberate scrolling wins over ambient/hover reactions, but never
        // interrupts a direct mascot click or a success/error acknowledgement.
        look(direction);
      }
      refreshCandidate();
    };
    bindings.push(listen(guideWin, 'scroll', onScroll, { passive: true }));
    bindings.push(listen(guideDoc, 'scroll', onScroll, { passive: true, capture: true }));
    bindings.push(listen(guideWin, 'resize', refreshCandidate, { passive: true }));
    if (guideWin !== win) for (const event of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'touchmove']) {
      bindings.push(listen(guideWin, event, activity, { passive: true }));
    }
    guideDoc.querySelectorAll('.btn-primary').forEach((cta) => {
      bindings.push(listen(cta, 'mouseenter', () => { react('excited', 1); armIdle(); }));
      bindings.push(listen(cta, 'click', () => { react('excited', 3); armIdle(); }));
    });
    guideDoc.querySelectorAll('.w-form').forEach((form) => {
      let wasDone = false;
      let wasFailed = false;
      const observer = new guideWin.MutationObserver(() => {
        const visible = (el) => Boolean(el && guideWin.getComputedStyle(el).display !== 'none' && el.getClientRects().length);
        const done = visible(form.querySelector('.w-form-done'));
        const failed = visible(form.querySelector('.w-form-fail'));
        if (done && !wasDone) react('celebrate', 3);
        if (failed && !wasFailed) react('confused', 3);
        wasDone = done; wasFailed = failed;
      });
      observer.observe(form, { attributes: true, subtree: true, attributeFilter: ['style', 'class', 'hidden'], childList: true });
      bindings.push(() => observer.disconnect());
    });
    if (guideWin.IntersectionObserver) {
      const observer = new guideWin.IntersectionObserver(refreshCandidate, { threshold: [0, 0.5] });
      targets.forEach(({ el }) => observer.observe(el));
      bindings.push(() => observer.disconnect());
    }
    unbindGuide = () => {
      cancel(tipTimer);
      cancel(hoverTimer);
      bindings.forEach((cleanup) => cleanup());
      retryTip = () => {};
      candidate = null;
    };
    refreshCandidate();
  }
  return { bindDocument, destroy, explain: (text) => showBubble(text, true) };
}
