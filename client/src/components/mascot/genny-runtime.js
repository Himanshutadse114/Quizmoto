// One behavior implementation for static pages and the React marketing iframe.
// Inject the renderer to allow deterministic lifecycle/timing regression tests.
// Art/animation engine: Bible Strong Avatar Lab, Stephane Montlouis-Calixte
// (AGPL-3.0, https://github.com/smontlouis/bible-strong-avatar-lab).
import { GENNY_TOPICS, topicForElement, actionTipForElement } from './genny-knowledge.js';
import { GENNY_PERSONAS } from './genny-personas.js';
import { motionEnabled } from './genny-motion.js';
const DISMISS_KEY = 'lmsgen-mascot-dismissed';
const GREETED_KEY = 'lmsgen-mascot-greeted';
const POSITION_KEY = 'lmsgen-genny-position-v1';
const TIP_GAP = 9000;
const TIP_DWELL = 1200;
const DRAG_THRESHOLD = 5;
const POSITION_MARGIN = 8;
const SCROLL_ANGER_WINDOW = 3000;
const SCROLL_ANGER_STROKE = 48;
const SCROLL_ANGER_STROKES = 6;

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
  const extraMoodExpressions = {
    listening: ['small-attentive', 'downward-gaze', 'gentle-downward-gaze'],
    searching: ['far-right-glance', 'asymmetric-down-right', 'surprised-left', 'wide-down-left', 'attentive-left', 'asymmetric-up-left'],
    bored: ['sleepy-squint', 'drowsy-closed', 'upward-side-glance'],
    suspicious: ['skeptical-left', 'skeptical-right', 'suspicious-right'],
    angry: ['angry-right', 'angry-left', 'angry-brows'],
    surprised: ['surprised-left', 'surprised-wide-left'],
    afraid: ['surprised-wide-left', 'uneasy-left', 'surprised-left'],
    curious: ['surprised-left', 'surprised-wide-left', 'upward-side-glance', 'far-right-glance'],
    proud: ['far-right-glance', 'curious-left', 'joyful-down-right'],
    shy: ['upward-side-glance', 'shy-downward', 'eyes-closed'],
    sad: ['sleepy-squint', 'eyes-closed', 'drowsy-closed'],
  };
  const extraMoodNames = [];
  for (const [name, expressionNames] of Object.entries(extraMoodExpressions)) {
    if (animations[name]) continue;
    const available = expressionNames.filter((expression) => expressions[expression]);
    if (!available.length) continue;
    const sustained = name === 'afraid' || name === 'angry';
    const recovery = name === 'shy';
    const timedDuration = sustained ? 4000 : recovery ? 2400 : 0;
    const transitionMs = timedDuration ? 200 : 180;
    const timedHoldBudget = timedDuration - available.length * transitionMs;
    const timedHoldMs = Math.floor(timedHoldBudget / available.length);
    const timedRemainder = timedHoldBudget % available.length;
    animations[name] = {
      playbackMode: 'once',
      blink: { ...source.animations.idle.blink, enabled: name !== 'angry' },
      steps: available.map((expression, index) => ({
        expression,
        holdMs: timedDuration ? timedHoldMs + (index < timedRemainder ? 1 : 0) : 260,
        transitionMs,
        transition: 'snappy',
      })),
    };
    extraMoodNames.push(name);
  }
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
    animations, animationOrder: [...source.animationOrder, ...extraMoodNames, ...directions.map((direction) => `look-${direction}`)] };
}

export function mountGenny({ document: doc, createAvatar, definition, container = doc.body, onActivate, onTopic, onDismiss, topics = GENNY_TOPICS, currentTopic, platform = false, hoverEnabled = true, motionPreference = 'auto' }) {
  const win = doc.defaultView;
  const media = win.matchMedia('(prefers-reduced-motion: reduce)');
  const motionOff = () => !motionEnabled(motionPreference, media.matches);
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
  let playbackTimer;
  let lastProgressAt = Date.now();
  let drag = null;
  let suppressClick = false;
  let position = null;
  const positionKey = `${POSITION_KEY}:${platform ? 'platform' : 'website'}`;

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
  function mascotSize() {
    const rectangle = root.getBoundingClientRect();
    const viewport = visibleViewport();
    return { width: rectangle.width || (viewport.width <= 767 ? 76 : 120), height: rectangle.height || (viewport.width <= 767 ? 76 : 120) };
  }
  function visibleViewport() {
    const viewport = win.visualViewport;
    const width = viewport?.width || win.innerWidth;
    const height = viewport?.height || win.innerHeight;
    const visible = {
      left: viewport?.offsetLeft || 0,
      top: viewport?.offsetTop || 0,
      width,
      height,
    };
    root.style.setProperty('--genny-visible-width', `${width}px`);
    root.style.setProperty('--genny-visible-height', `${height}px`);
    return visible;
  }
  function positionBounds(size = mascotSize()) {
    const viewport = visibleViewport();
    const compact = viewport.width <= 767;
    // Keep the dismiss control on-screen and, in the workspace, keep Genny
    // above the fixed mobile navigation/action strip after she is dragged.
    const topMargin = compact ? 14 : POSITION_MARGIN;
    const bottomMargin = platform && compact ? 94 : POSITION_MARGIN;
    const minLeft = viewport.left + POSITION_MARGIN;
    const minTop = viewport.top + topMargin;
    return {
      minLeft,
      minTop,
      maxLeft: Math.max(minLeft, viewport.left + viewport.width - size.width - POSITION_MARGIN),
      maxTop: Math.max(minTop, viewport.top + viewport.height - size.height - bottomMargin),
    };
  }
  function placeBubble() {
    if (bubble.hidden) return;
    const viewport = visibleViewport();
    const mascot = root.getBoundingClientRect();
    const message = bubble.getBoundingClientRect();
    const rightEdge = viewport.left + viewport.width - POSITION_MARGIN;
    const topEdge = viewport.top + POSITION_MARGIN;
    root.dataset.horizontal = mascot.left + message.width <= rightEdge ? 'left' : 'right';
    root.dataset.vertical = mascot.top - message.height - 12 >= topEdge ? 'bottom' : 'top';
  }
  function applyPosition(left, top) {
    const size = mascotSize();
    const bounds = positionBounds(size);
    position = {
      left: Math.max(bounds.minLeft, Math.min(left, bounds.maxLeft)),
      top: Math.max(bounds.minTop, Math.min(top, bounds.maxTop)),
    };
    root.style.setProperty('--genny-left', `${position.left}px`);
    root.style.setProperty('--genny-top', `${position.top}px`);
    root.dataset.positioned = 'true';
    placeBubble();
  }
  function savePosition() {
    if (!position) return;
    const size = mascotSize();
    const bounds = positionBounds(size);
    const width = Math.max(1, bounds.maxLeft - bounds.minLeft);
    const height = Math.max(1, bounds.maxTop - bounds.minTop);
    const stored = { x: (position.left - bounds.minLeft) / width, y: (position.top - bounds.minTop) / height };
    try { win.localStorage.setItem(positionKey, JSON.stringify(stored)); } catch { /* optional storage */ }
  }
  function restorePosition() {
    let stored;
    try { stored = JSON.parse(win.localStorage.getItem(positionKey)); } catch { return; }
    if (!stored || !Number.isFinite(stored.x) || !Number.isFinite(stored.y)) return;
    const size = mascotSize();
    const bounds = positionBounds(size);
    const width = Math.max(1, bounds.maxLeft - bounds.minLeft);
    const height = Math.max(1, bounds.maxTop - bounds.minTop);
    applyPosition(bounds.minLeft + stored.x * width, bounds.minTop + stored.y * height);
  }
  function moveWithKeyboard(event) {
    if (!event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault();
    const rectangle = root.getBoundingClientRect();
    const left = position?.left ?? rectangle.left;
    const top = position?.top ?? rectangle.top;
    if (event.key === 'Home') {
      const bounds = positionBounds();
      applyPosition(bounds.maxLeft, bounds.maxTop);
    }
    else applyPosition(left + (event.key === 'ArrowLeft' ? -24 : event.key === 'ArrowRight' ? 24 : 0), top + (event.key === 'ArrowUp' ? -24 : event.key === 'ArrowDown' ? 24 : 0));
    savePosition();
    react('curious', 3);
  }
  function beginDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const rectangle = root.getBoundingClientRect();
    drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: position?.left ?? rectangle.left, top: position?.top ?? rectangle.top, moved: false };
    button.setPointerCapture?.(event.pointerId);
  }
  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      root.dataset.dragging = 'true';
      button.setAttribute('aria-grabbed', 'true');
      hideBubble();
      cancel(greetingTimer);
    }
    event.preventDefault?.();
    applyPosition(drag.left + deltaX, drag.top + deltaY);
    react('afraid', 5);
    armIdle();
  }
  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const moved = drag.moved;
    button.releasePointerCapture?.(event.pointerId);
    drag = null;
    delete root.dataset.dragging;
    button.setAttribute('aria-grabbed', 'false');
    if (!moved) return;
    savePosition();
    suppressClick = true;
    react('shy', 4);
    later(() => { suppressClick = false; }, 0);
  }
  function setMode(next) { mode = next; root.dataset.mode = next; }
  function play(name) {
    if (destroyed) return false;
    lastProgressAt = Date.now();
    try { return Boolean(controller?.play(name)?.ok); } catch { return false; }
  }
  function hideBubble() { cancel(bubbleTimer); bubble.hidden = true; }
  function showBubble(text, persistent = false) {
    cancel(greetingTimer);
    hideBubble();
    bubble.textContent = text;
    bubble.hidden = false;
    placeBubble();
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
    delete root.dataset.look;
    if (queued) {
      const reaction = queued;
      queued = null;
      react(reaction.name, reaction.priority);
      return;
    }
    setMode(next === 'sleeping' ? 'asleep' : 'idle');
    play(next);
    retryTip();
  }
  function react(name, priority = 1, next = 'idle') {
    if (destroyed || motionOff() || doc.hidden) return false;
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
    if (motionOff() || doc.hidden || (pending && pending.priority > 2)) return;
    gazeUntil = Date.now() + 1100;
    root.dataset.look = direction;
    react(`look-${direction}`, 2);
  }
  function armIdle() {
    cancel(idleTimer);
    if (destroyed || motionOff() || doc.hidden) return;
    idleTimer = later(() => {
      if (pending) armIdle();
      else react('drowsy', 0, 'sleeping');
    }, 30000);
  }
  function activity() {
    if (destroyed || motionOff() || doc.hidden) return;
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
    cancel(playbackTimer);
    cancel(reactionTimer);
    cancel(idleTimer);
    cancel(greetingTimer);
    hideBubble();
    pending = queued = null;
    setMode('idle');
    gazeUntil = 0;
    delete root.dataset.look;
    root.dataset.motion = motionOff() ? 'off' : 'on';
    button.setAttribute('aria-label', onActivate ? persona.title : motionOff() ? 'Genny, the LMSGEN mascot' : 'Genny, the LMSGEN mascot. Select to make Genny laugh.');
    controller?.stop();
    if (motionOff() || doc.hidden) controller?.setExpression('neutral');
    else { play('idle'); armIdle(); retryTip(); watchPlayback(); }
  }
  function watchPlayback() {
    cancel(playbackTimer);
    if (destroyed || motionOff() || doc.hidden) return;
    playbackTimer = later(() => {
      // A queued RAF can be lost when a mobile browser suspends a page. Eye
      // poses normally change within 2 seconds; only recover a stalled idle.
      if (mode === 'idle' && !pending && Date.now() - lastProgressAt > 5000) {
        controller?.stop(); // clears the renderer's stale RAF handle
        play('idle');
      }
      watchPlayback();
    }, 2000);
  }

  try {
    controller = createAvatar(root.querySelector('.lmsgen-mascot-mount'), {
      definition: avatarDefinition,
      defaultAnimation: motionOff() ? undefined : 'idle',
      defaultExpression: motionOff() ? 'neutral' : undefined,
      size: '100%', ariaLabel: 'Genny, the LMSGEN mascot',
      onAnimationEnd: (name) => {
        if (pending?.name !== name) return;
        // Leave the renderer's RAF callback before starting the next animation.
        // Starting synchronously can schedule two render loops on every reaction.
        cancel(reactionTimer);
        reactionTimer = later(() => { if (pending?.name === name) settle(); }, 0);
      },
      onExpressionChange: (name) => { root.dataset.expression = name; lastProgressAt = Date.now(); },
    });
  } catch { destroy(); return { bindDocument: () => {}, destroy }; }

  button.setAttribute('aria-grabbed', 'false');
  button.setAttribute('title', `${persona.title}. Drag to move Genny; Alt + arrow keys also move her.`);
  cleanups.push(listen(button, 'pointerdown', beginDrag));
  cleanups.push(listen(button, 'pointermove', moveDrag));
  cleanups.push(listen(button, 'pointerup', finishDrag));
  cleanups.push(listen(button, 'pointercancel', finishDrag));
  cleanups.push(listen(button, 'keydown', moveWithKeyboard));
  cleanups.push(listen(button, 'click', () => {
    if (suppressClick) { suppressClick = false; return; }
    hideBubble(); cancel(greetingTimer); queued = null; react('laughing', 4); armIdle(); onActivate?.();
  }));
  cleanups.push(listen(bubble, 'click', () => { hideBubble(); retryTip(); }));
  cleanups.push(listen(root.querySelector('.lmsgen-mascot-dismiss'), 'click', () => { if (!platform) writeFlag(DISMISS_KEY); destroy(); onDismiss?.(); }));
  cleanups.push(listen(media, 'change', motionChanged));
  cleanups.push(listen(win, 'pageshow', () => { if (!doc.hidden) motionChanged(); }));
  const viewportChanged = () => {
    if (drag) return;
    if (position) applyPosition(position.left, position.top);
    restorePosition();
    placeBubble();
  };
  cleanups.push(listen(win, 'resize', viewportChanged, { passive: true }));
  if (win.visualViewport) {
    cleanups.push(listen(win.visualViewport, 'resize', viewportChanged, { passive: true }));
    cleanups.push(listen(win.visualViewport, 'scroll', viewportChanged, { passive: true }));
  }
  cleanups.push(listen(doc, 'resume', () => { if (!doc.hidden) motionChanged(); }));
  cleanups.push(listen(doc, 'keydown', (event) => { if (event.key === 'Escape') { hideBubble(); retryTip(); } }));
  for (const event of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'touchmove', 'scroll']) {
    cleanups.push(listen(win, event, activity, { passive: true }));
  }
  cleanups.push(listen(doc, 'visibilitychange', () => {
    if (doc.hidden) { cancel(playbackTimer); cancel(reactionTimer); cancel(idleTimer); hideBubble(); pending = queued = null; controller.pause(); }
    else motionChanged();
  }));
  motionChanged();
  restorePosition();
  if (!motionOff()) {
    react('waking', 0);
    if (!readFlag(greetKey)) greetingTimer = later(() => {
      if (motionOff() || doc.hidden) return;
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
    let scrollAngerSamples = [];
    let scrollAngerSource = null;
    let scrollAngerDirection = 0;
    let scrollAngerDistance = 0;
    let scrollAngerQualified = false;
    const scrollPositions = new WeakMap();
    const scrollDeltas = new WeakMap();
    let windowDelta = 0;
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
      if (!candidate || shown.has(candidate.index) || destroyed || motionOff() || doc.hidden || guideDoc.hidden) return;
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
      const nested = target && target !== guideDoc && target !== guideDoc.documentElement && target !== guideDoc.body && typeof target.scrollTop === 'number';
      const position = nested ? target.scrollTop : guideWin.scrollY;
      const previous = nested ? (scrollPositions.get(target) ?? 0) : lastY;
      const step = position - previous;
      const source = nested ? target : guideWin;
      if (source !== scrollAngerSource) {
        scrollAngerSource = source;
        scrollAngerSamples = [];
        scrollAngerDirection = 0;
        scrollAngerDistance = 0;
        scrollAngerQualified = false;
      }
      const stepDirection = Math.sign(step);
      if (stepDirection && stepDirection !== scrollAngerDirection) {
        scrollAngerDirection = stepDirection;
        scrollAngerDistance = Math.abs(step);
        scrollAngerQualified = false;
      } else if (stepDirection) {
        scrollAngerDistance += Math.abs(step);
      }
      let forcefulAlternatingScroll = false;
      if (!scrollAngerQualified && scrollAngerDistance >= SCROLL_ANGER_STROKE) {
        scrollAngerQualified = true;
        scrollAngerSamples = scrollAngerSamples.filter((sample) => now - sample.time <= SCROLL_ANGER_WINDOW);
        if (scrollAngerSamples.at(-1)?.direction !== scrollAngerDirection) {
          scrollAngerSamples.push({ direction: scrollAngerDirection, time: now });
        }
        forcefulAlternatingScroll = scrollAngerSamples.length >= SCROLL_ANGER_STROKES;
      }
      let delta = nested ? (scrollDeltas.get(target) || 0) : windowDelta;
      delta = step && Math.sign(step) !== Math.sign(delta) ? step : delta + step;
      if (nested) scrollPositions.set(target, position);
      else lastY = position;
      if (Math.abs(delta) > 2 && (elapsed > 80 || root.dataset.look !== (delta > 0 ? 'down' : 'up'))) {
        lastScrollAt = now;
        const direction = delta > 0 ? 'down' : 'up';
        // Only a deliberate, forceful up/down shake makes Genny angry. Normal
        // scrolling, momentum bounce and a single correction remain a gaze.
        if (forcefulAlternatingScroll) {
          scrollAngerSamples = [];
          scrollAngerDistance = 0;
          scrollAngerQualified = false;
          react('angry', 3);
        } else {
          // Deliberate scrolling wins over ambient/hover reactions, but never
          // interrupts a direct mascot click or a success/error acknowledgement.
          look(direction);
        }
        delta = 0;
      }
      if (nested) scrollDeltas.set(target, delta);
      else windowDelta = delta;
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
    const editable = (target) => Boolean(target?.matches?.('input, textarea, select, [contenteditable="true"]'));
    bindings.push(listen(guideDoc, 'focusin', (event) => {
      if (editable(event.target)) { react('listening', 1); armIdle(); }
    }));
    bindings.push(listen(guideDoc, 'input', (event) => {
      if (editable(event.target)) { react('working', 1); armIdle(); }
    }));
    bindings.push(listen(guideDoc, 'invalid', (event) => {
      if (editable(event.target)) { react('sad', 3); armIdle(); }
    }, true));
    bindings.push(listen(guideDoc, 'toggle', (event) => {
      if (event.target?.matches?.('details') && event.target.open) { react('curious', 1); armIdle(); }
    }, true));
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
