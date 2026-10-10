import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateAvatarDefinition, playAvatarAnimation, advanceAvatarPlayback, renderAvatarDefinition, renderAvatarFrame } from '@bible-strong/avatar-core';
import { createAvatar as createWebAvatar } from '@bible-strong/avatar-web';
import { mountGenny, prepareGennyDefinition, GENNY_TIPS } from '../src/components/mascot/genny-runtime.js';
import { GENNY_TOPICS, topicForPath, topicsForAccess, tourForAccess, searchTopics, topicForElement, actionTipForElement } from '../src/components/mascot/genny-knowledge.js';
import { SCORM_FEATURES } from '../src/pages/Scorm/scormFeatureCatalog.js';
import { mountSiteGuide } from '../src/components/mascot/genny-site-guide.js';
import { watchGuideViewport } from '../src/components/mascot/genny-viewport.js';
import { GENNY_DEMO_GUIDANCE, demoGuidanceFor, demoTopics } from '../src/components/mascot/genny-demo-guidance.js';
import { GENNY_PERSONAS, GENNY_WEBSITE_TOPICS, GENNY_WEBSITE_TOUR } from '../src/components/mascot/genny-personas.js';

const definition = JSON.parse(readFileSync(new URL('../src/components/mascot/genny.avatar.json', import.meta.url)));

class Events {
  listeners = new Map();
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(fn); }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
  emit(name, details = {}) { for (const fn of this.listeners.get(name) || []) fn({ type: name, ...details }); }
  count() { return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0); }
}
class Element extends Events {
  style = { values: new Map(), setProperty(key, value) { this.values.set(key, value); } };
  dataset = {};
  children = [];
  selectors = new Map();
  hidden = false;
  rect = { left: 100, top: 100, right: 220, bottom: 220, width: 120, height: 120 };
  attributes = {};
  classList = { add() {}, remove() {} };
  appendChild(child) { this.children.push(child); child.parent = this; }
  append(...children) { children.forEach((child) => this.appendChild(child)); }
  replaceChildren(...children) { this.children = children; }
  focus() { this.focused = true; }
  remove() { this.parent.children = this.parent.children.filter((child) => child !== this); }
  setAttribute(key, value) { this.attributes[key] = value; }
  getAttribute(key) { return this.attributes[key] || null; }
  setPointerCapture(pointerId) { this.capturedPointer = pointerId; }
  releasePointerCapture(pointerId) { if (this.capturedPointer === pointerId) this.capturedPointer = null; }
  closest(selector) {
    if (selector.includes('.lmsgen-mascot') || selector === '.genny-guide') return null;
    return this;
  }
  contains(element) { return this === element; }
  set innerHTML(_value) {
    for (const selector of ['.lmsgen-mascot-btn', '.lmsgen-mascot-mount', '.lmsgen-mascot-bubble', '.lmsgen-mascot-dismiss']) this.selectors.set(selector, new Element());
    this.selectors.get('.lmsgen-mascot-bubble').hidden = true;
  }
  querySelector(selector) { return this.selectors.get(selector); }
  querySelectorAll(selector) { return this.selectors.has(selector) ? [this.selectors.get(selector)] : []; }
  getBoundingClientRect() { return this.rect; }
  getClientRects() { return this.hidden ? [] : [this.rect]; }
}

function fixture(t, { reduced = false, greeted = true, dismissed = false, realRenderer = false, viewport = null, ...runtimeOptions } = {}) {
  let time = 100000;
  let nextId = 0;
  const timers = new Map();
  const frames = new Map();
  t.mock.method(Date, 'now', () => time);
  const media = new Events(); media.matches = reduced;
  const flags = new Map();
  const localStorage = new Map();
  if (greeted) flags.set('lmsgen-mascot-greeted', '1');
  if (dismissed) flags.set('lmsgen-mascot-dismissed', '1');
  const observers = [];
  function makeDocument() {
    const win = new Events();
    Object.assign(win, {
      innerWidth: 390, innerHeight: 800, scrollY: 0, performance: { now: () => time },
      matchMedia: () => media,
      sessionStorage: { getItem: (key) => flags.get(key), setItem: (key, value) => flags.set(key, value) },
      localStorage: { getItem: (key) => localStorage.get(key), setItem: (key, value) => localStorage.set(key, value) },
      setTimeout: (fn, ms) => { const id = ++nextId; timers.set(id, { at: time + ms, fn }); return id; },
      clearTimeout: (id) => timers.delete(id),
      getComputedStyle: (el) => ({ display: el.hidden ? 'none' : 'block' }),
      MutationObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} disconnect() { this.disconnected = true; } },
      IntersectionObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} disconnect() { this.disconnected = true; } },
    });
    if (viewport) win.visualViewport = Object.assign(new Events(), viewport);
    const doc = new Element(); doc.hidden = false; doc.body = new Element(); doc.defaultView = win;
    doc.createElement = (tag) => { const element = new Element(); element.tagName = tag; element.ownerDocument = doc; return element; };
    doc.createElementNS = (_namespace, tag) => doc.createElement(tag);
    return doc;
  }
  const doc = makeDocument();
  const plays = [];
  let controller = { play: (name) => { plays.push(name); return { ok: true }; }, stop() {}, pause() { this.paused = true; }, setExpression(name) { this.expression = name; }, destroy() { this.destroyed = true; } };
  const globals = new Map();
  if (realRenderer) {
    // Exercise the installed SVG renderer and its RAF lifecycle, not a fake
    // controller. This DOM harness doesn't launch or automate a browser.
    for (const [key, value] of Object.entries({ document: doc, window: doc.defaultView,
      requestAnimationFrame: (fn) => { const id = ++nextId; frames.set(id, fn); return id; },
      cancelAnimationFrame: (id) => frames.delete(id) })) {
      globals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    }
    t.mock.method(performance, 'now', () => time);
    t.mock.method(Math, 'random', () => 0.5);
  }
  let options;
  const mascot = mountGenny({ document: doc, definition, ...runtimeOptions, createAvatar: (target, opts) => {
    options = opts;
    if (realRenderer) controller = createWebAvatar(target, opts);
    return controller;
  } });
  const root = doc.body.children[0];
  const tick = (ms) => {
    const end = time + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      time = due[1].at; timers.delete(due[0]); due[1].fn();
    }
    time = end;
  };
  const frame = (ms = 16) => {
    tick(ms); const callbacks = [...frames.values()]; frames.clear();
    callbacks.forEach((fn) => fn(time));
  };
  const animate = (ms) => { for (let elapsed = 0; elapsed < ms; elapsed += 16) frame(Math.min(16, ms - elapsed)); };
  t.after(() => {
    mascot.destroy();
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return { doc, root, mascot, controller, options, plays, timers, tick, media, makeDocument, observers, flags, localStorage, frames, frame, animate };
}

test('reactions are once-only, short, non-mutating and waking opens its eyes', () => {
  const tuned = prepareGennyDefinition(definition);
  const validation = validateAvatarDefinition(tuned);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
  for (const [name, animation] of Object.entries(tuned.animations)) {
    if (['idle', 'sleeping'].includes(name)) assert.equal(animation.playbackMode, 'loop');
    else {
      assert.equal(animation.playbackMode, 'once');
      const duration = animation.steps.reduce((sum, step) => sum + step.holdMs + step.transitionMs, 0);
      if (['afraid', 'angry'].includes(name)) assert.equal(duration, 4000, name);
      else assert.ok(duration < 3000, name);
    }
  }
  assert.equal(tuned.animations.waking.steps.at(-1).expression, 'neutral');
  assert.equal(definition.animations.laughing.playbackMode, 'loop');
  assert.ok(tuned.animations.idle.steps[0].holdMs < 2000);
  for (const mood of ['listening', 'searching', 'bored', 'suspicious', 'angry', 'surprised', 'afraid', 'curious', 'proud', 'shy', 'sad']) assert.ok(tuned.animations[mood], mood);
  for (const mood of ['afraid', 'angry']) {
    assert.equal(tuned.animations[mood].steps.reduce((sum, step) => sum + step.holdMs + step.transitionMs, 0), 4000);
  }
});

test('the real avatar engine completes each transient reaction naturally', () => {
  const tuned = prepareGennyDefinition(definition);
  for (const name of Object.keys(tuned.animations).filter((name) => !['idle', 'sleeping'].includes(name))) {
    const start = playAvatarAnimation(tuned, name, 0);
    assert.equal(start.ok, true);
    let state = start.value;
    for (let time = 20; time <= 4500; time += 20) state = advanceAvatarPlayback(tuned, state, time, { random: () => 0.5 });
    assert.equal(state.status, 'stopped', name);
  }
});

test('the next section tip waits for cooldown and retries while the visitor stays', (t) => {
  const f = fixture(t); const first = new Element(); const second = new Element();
  second.rect = { top: 900, bottom: 1300, height: 400 };
  f.doc.selectors.set('.hp-platform-s', first); f.doc.selectors.set('.hp-insights-s', second);
  f.mascot.bindDocument(f.doc); f.tick(2200);
  const bubble = f.root.querySelector('.lmsgen-mascot-bubble'); assert.equal(bubble.textContent, GENNY_TIPS[1].text);
  bubble.emit('click'); first.rect = { top: -600, bottom: -200, height: 400 }; second.rect = { top: 100, bottom: 500, height: 400 };
  f.doc.defaultView.emit('scroll'); f.tick(7000); assert.equal(bubble.hidden, true);
  f.tick(3000); assert.equal(bubble.textContent, GENNY_TIPS[5].text); assert.equal(bubble.hidden, false);
});

test('direct clicks preempt waking and CTA reactions, including repeated clicks', (t) => {
  const f = fixture(t); const cta = new Element(); f.doc.selectors.set('.btn-primary', cta); f.mascot.bindDocument(f.doc);
  cta.emit('mouseenter'); assert.equal(f.plays.at(-1), 'excited');
  f.root.querySelector('.lmsgen-mascot-btn').emit('click'); assert.equal(f.plays.at(-1), 'laughing');
  const count = f.plays.length;
  f.root.querySelector('.lmsgen-mascot-btn').emit('click'); assert.equal(f.plays.length, count + 1);
  f.options.onAnimationEnd('excited'); assert.equal(f.root.dataset.mode, 'busy');
  f.options.onAnimationEnd('laughing');
  assert.equal(f.root.dataset.mode, 'busy'); // exit the renderer frame before replay
  f.tick(0); assert.equal(f.root.dataset.mode, 'idle');
});

test('blocked section tips retry without another scroll or observer callback', (t) => {
  const f = fixture(t); f.doc.selectors.set('.hp-platform-s', new Element()); f.mascot.bindDocument(f.doc);
  f.root.querySelector('.lmsgen-mascot-btn').emit('click');
  f.tick(1200); assert.equal(f.root.querySelector('.lmsgen-mascot-bubble').hidden, true);
  f.tick(1000); assert.equal(f.root.querySelector('.lmsgen-mascot-bubble').textContent, GENNY_TIPS[1].text);
});

test('tips obey cooldown, do not repeat, and do not show a section after leaving it', (t) => {
  const f = fixture(t); const section = new Element(); f.doc.selectors.set('.hp-platform-s', section); f.mascot.bindDocument(f.doc);
  f.tick(2200); const bubble = f.root.querySelector('.lmsgen-mascot-bubble'); assert.equal(bubble.textContent, GENNY_TIPS[1].text);
  bubble.emit('click'); assert.equal(bubble.hidden, true);
  f.doc.defaultView.emit('scroll'); f.tick(12000); assert.equal(bubble.hidden, true);
  section.rect = { top: 900, bottom: 1200, height: 300 };
  const second = new Element(); f.doc.selectors.set('.hp-insights-s', second);
  f.mascot.bindDocument(f.doc); f.tick(500);
  second.rect = { top: 900, bottom: 1200, height: 300 }; f.doc.defaultView.emit('scroll'); f.tick(1500);
  assert.equal(bubble.hidden, true);
});

test('iframe activity prevents sleep and form success works across document realms', (t) => {
  const f = fixture(t); const frame = f.makeDocument(); const form = new Element(); const success = new Element(); success.hidden = true;
  form.selectors.set('.w-form-done', success); frame.selectors.set('.w-form', form); f.mascot.bindDocument(frame);
  f.tick(29000); frame.defaultView.emit('pointermove'); f.tick(5000); assert.notEqual(f.plays.at(-1), 'sleeping');
  success.hidden = false; f.observers.find((observer) => !observer.disconnected).fn([{ target: success }]);
  assert.equal(f.plays.at(-1), 'celebrate');
  const before = frame.defaultView.count(); assert.ok(before > 0);
  f.mascot.bindDocument(f.makeDocument()); assert.equal(frame.defaultView.count(), 0);
});

test('sleep wakes on activity and visibility pauses background rendering', (t) => {
  const f = fixture(t); f.tick(32500); assert.equal(f.root.dataset.mode, 'asleep');
  f.doc.defaultView.emit('pointerdown'); assert.equal(f.plays.at(-1), 'waking');
  f.doc.hidden = true; f.doc.emit('visibilitychange'); assert.equal(f.controller.paused, true);
  const count = f.plays.length; f.tick(40000); assert.equal(f.plays.length, count);
  f.doc.hidden = false; f.doc.emit('visibilitychange'); assert.equal(f.plays.at(-1), 'idle');
});

test('dismiss cleans all timers, observers, guide listeners and renderer exactly once', (t) => {
  const f = fixture(t, { greeted: false }); const guide = f.makeDocument(); guide.selectors.set('.hp-platform-s', new Element()); f.mascot.bindDocument(guide);
  f.root.querySelector('.lmsgen-mascot-dismiss').emit('click');
  assert.equal(f.controller.destroyed, true); assert.equal(f.timers.size, 0); assert.equal(f.doc.body.children.length, 0);
  assert.equal(f.doc.defaultView.count(), 0); assert.equal(guide.defaultView.count(), 0);
  assert.ok(f.observers.every((observer) => observer.disconnected));
  f.tick(60000); assert.equal(f.timers.size, 0);
  assert.equal(f.flags.get('lmsgen-mascot-dismissed'), '1');
});

test('reduced motion stays still, responds to preference changes and cancels greeting', (t) => {
  const f = fixture(t, { reduced: true, greeted: false });
  assert.equal(f.plays.length, 0); assert.equal(f.controller.expression, 'neutral');
  f.root.querySelector('.lmsgen-mascot-btn').emit('click'); assert.equal(f.plays.length, 0);
  f.media.matches = false; f.media.emit('change'); assert.equal(f.plays.at(-1), 'idle');
  f.root.querySelector('.lmsgen-mascot-btn').emit('click'); assert.equal(f.plays.at(-1), 'laughing');
  f.media.matches = true; f.media.emit('change'); assert.equal(f.timers.size, 0);
});

test('dragging repositions Genny, shows fear, persists the position and suppresses the guide click', (t) => {
  let opened = 0;
  const f = fixture(t, { onActivate: () => opened++ });
  const button = f.root.querySelector('.lmsgen-mascot-btn');
  button.emit('pointerdown', { pointerId: 7, button: 0, clientX: 150, clientY: 150 });
  button.emit('pointermove', { pointerId: 7, clientX: 210, clientY: 230, preventDefault() {} });
  assert.equal(f.root.dataset.dragging, 'true');
  assert.equal(f.root.style.values.get('--genny-left'), '160px');
  assert.equal(f.root.style.values.get('--genny-top'), '180px');
  assert.equal(f.plays.at(-1), 'afraid');
  button.emit('pointerup', { pointerId: 7 }); button.emit('click');
  assert.equal(opened, 0); assert.equal(f.root.dataset.dragging, undefined);
  assert.equal(button.getAttribute('aria-grabbed'), 'false');
  assert.ok(f.localStorage.get('lmsgen-genny-position-v1:website'));
});

test('Alt plus arrow keys provide a precise non-drag placement option', (t) => {
  const f = fixture(t); let prevented = false;
  f.root.querySelector('.lmsgen-mascot-btn').emit('keydown', {
    altKey: true, key: 'ArrowLeft', preventDefault() { prevented = true; },
  });
  assert.equal(prevented, true); assert.equal(f.root.style.values.get('--genny-left'), '76px');
  assert.equal(f.plays.at(-1), 'curious');
});

test('mobile dragging stays inside the visual viewport and above workspace navigation', (t) => {
  const f = fixture(t, { platform: true, viewport: { width: 320, height: 420, offsetLeft: 10, offsetTop: 100, scale: 1 } });
  f.root.rect = { left: 200, top: 200, right: 272, bottom: 272, width: 72, height: 72 };
  const button = f.root.querySelector('.lmsgen-mascot-btn');
  button.emit('pointerdown', { pointerId: 8, button: 0, clientX: 220, clientY: 220 });
  button.emit('pointermove', { pointerId: 8, clientX: 900, clientY: 900, preventDefault() {} });
  assert.equal(f.plays.at(-1), 'afraid');
  assert.equal(f.root.dataset.mode, 'busy');
  button.emit('pointerup', { pointerId: 8 });
  assert.equal(f.root.style.values.get('--genny-left'), '250px');
  assert.equal(f.root.style.values.get('--genny-top'), '354px');
  const viewport = f.doc.defaultView.visualViewport;
  viewport.height = 300; viewport.offsetTop = 140; viewport.emit('resize');
  assert.ok(Number.parseFloat(f.root.style.values.get('--genny-top')) <= 274);
  assert.ok(f.localStorage.get('lmsgen-genny-position-v1:platform'));
});

test('mobile bubbles open toward available visual viewport space', (t) => {
  const f = fixture(t, { viewport: { width: 320, height: 500, offsetLeft: 0, offsetTop: 80, scale: 1 } });
  f.root.rect = { left: 8, top: 90, right: 84, bottom: 166, width: 76, height: 76 };
  const bubble = f.root.querySelector('.lmsgen-mascot-bubble');
  bubble.rect = { left: 0, top: 0, right: 240, bottom: 100, width: 240, height: 100 };
  f.mascot.explain('A useful explanation that must remain visible on a phone.');
  assert.equal(f.root.dataset.horizontal, 'left');
  assert.equal(f.root.dataset.vertical, 'top');
});

test('session dismissal never mounts an avatar', (t) => {
  const f = fixture(t, { dismissed: true }); assert.equal(f.doc.body.children.length, 0); assert.equal(f.options, undefined);
});

test('scroll direction follows window and nested mobile/sidebar scrolling', (t) => {
  const f = fixture(t); f.mascot.bindDocument(f.doc); f.tick(1500);
  f.doc.defaultView.scrollY = 150; f.doc.defaultView.emit('scroll');
  assert.equal(f.root.dataset.look, 'down'); assert.equal(f.plays.at(-1), 'look-down');
  f.tick(1000); f.doc.defaultView.scrollY = 50; f.doc.defaultView.emit('scroll');
  assert.equal(f.root.dataset.look, 'up'); assert.equal(f.plays.at(-1), 'look-up');
  f.tick(1000); const nested = new Element(); nested.scrollTop = 100;
  f.doc.emit('scroll', { target: nested }); assert.equal(f.root.dataset.look, 'down');
  f.tick(1000); nested.scrollTop = 10;
  f.doc.emit('scroll', { target: nested }); assert.equal(f.root.dataset.look, 'up');
});

test('repeated up-down scrolling changes Genny from gaze tracking to angry', (t) => {
  const f = fixture(t); f.mascot.bindDocument(f.doc); f.tick(1500);
  f.doc.defaultView.scrollY = 100; f.doc.defaultView.emit('scroll');
  f.tick(200); f.doc.defaultView.scrollY = 0; f.doc.defaultView.emit('scroll');
  f.tick(200); f.doc.defaultView.scrollY = 100; f.doc.defaultView.emit('scroll');
  assert.equal(f.plays.at(-1), 'angry');
});

test('curated hover explanations dwell, persist and stay dismissed until leaving', (t) => {
  let selected;
  const f = fixture(t, { onTopic: (topic) => { selected = topic; } }); f.mascot.bindDocument(f.doc);
  const title = new Element(); title.setAttribute('data-genny-topic', 'roster');
  const bubble = f.root.querySelector('.lmsgen-mascot-bubble');
  f.doc.emit('pointerover', { target: title, pointerType: 'mouse' });
  f.tick(500); assert.equal(bubble.hidden, true);
  f.tick(60); assert.equal(selected.id, 'roster'); assert.match(bubble.textContent, /Append.*Replace/);
  f.tick(9000); assert.equal(bubble.hidden, false);
  f.doc.emit('keydown', { key: 'Escape' }); assert.equal(bubble.hidden, true);
  f.doc.emit('pointerover', { target: title }); f.tick(1000); assert.equal(bubble.hidden, true);
  f.doc.emit('pointerout', { relatedTarget: null });
  f.doc.emit('focusin', { target: title }); f.tick(1); assert.equal(bubble.hidden, false);
});

test('dynamic form and disclosure interactions use the expanded mood set', (t) => {
  const f = fixture(t); f.mascot.bindDocument(f.doc);
  const field = new Element(); field.matches = (selector) => selector.includes('input');
  f.doc.emit('focusin', { target: field }); assert.equal(f.plays.at(-1), 'listening');
  f.doc.emit('input', { target: field }); assert.equal(f.plays.at(-1), 'working');
  f.doc.emit('invalid', { target: field }); assert.equal(f.plays.at(-1), 'sad');
  const details = new Element(); details.open = true; details.matches = (selector) => selector === 'details';
  f.doc.emit('toggle', { target: details }); f.options.onAnimationEnd('sad'); f.tick(0);
  assert.equal(f.plays.at(-1), 'curious');
});

test('touch and opt-out skip hover; reduced motion still permits explicit guidance', (t) => {
  let opened = false;
  const f = fixture(t, { reduced: true, onActivate: () => { opened = true; } }); f.mascot.bindDocument(f.doc);
  const title = new Element(); title.setAttribute('data-genny-topic', 'publica');
  f.doc.emit('pointerover', { target: title, pointerType: 'touch' }); f.tick(1000);
  assert.equal(f.root.querySelector('.lmsgen-mascot-bubble').hidden, true);
  f.doc.emit('focusin', { target: title }); f.tick(1);
  assert.match(f.root.querySelector('.lmsgen-mascot-bubble').textContent, /flipbook/);
  f.root.querySelector('.lmsgen-mascot-btn').emit('click'); assert.equal(opened, true); assert.equal(f.plays.length, 0);
  f.mascot.explain('Manual help'); f.tick(9000); assert.equal(f.root.querySelector('.lmsgen-mascot-bubble').hidden, false);
  const disabled = fixture(t, { hoverEnabled: false }); disabled.mascot.bindDocument(disabled.doc);
  disabled.doc.emit('focusin', { target: title }); disabled.tick(1000);
  assert.equal(disabled.root.querySelector('.lmsgen-mascot-bubble').hidden, true);
});

test('website dismissal does not hide the platform guide or disable its launcher', (t) => {
  let hidden = false;
  const f = fixture(t, { dismissed: true, platform: true, onDismiss: () => { hidden = true; } });
  assert.ok(f.root); f.root.querySelector('.lmsgen-mascot-dismiss').emit('click'); assert.equal(hidden, true);
});

test('all feature workflows are grounded in the existing feature catalog', () => {
  for (const feature of Object.values(SCORM_FEATURES)) {
    const topic = GENNY_TOPICS.find((item) => item.id === feature.id);
    assert.equal(topic.route, feature.route); assert.deepEqual(topic.steps, feature.workflow);
    assert.ok(topic.punch.length < 70); assert.equal(topic.steps.length, 3);
  }
  assert.equal(new Set(GENNY_TOPICS.map((topic) => topic.id)).size, GENNY_TOPICS.length);
});

test('guide topics and tours obey the actual role-visible routes', () => {
  const routes = ['/scorm/publica', '/scorm/tracking', '/scorm/reports', '/scorm/settings'];
  const analytics = topicsForAccess({ allowedRoutes: routes });
  assert.deepEqual(analytics.map((topic) => topic.route).sort(), [...routes].sort());
  assert.ok(!topicsForAccess().some((topic) => topic.adminOnly));
  const admin = tourForAccess({ allowedRoutes: GENNY_TOPICS.map((topic) => topic.route), isSuperAdmin: true });
  assert.ok(admin.some((topic) => topic.id === 'tenants')); assert.ok(!admin.some((topic) => topic.id === 'danger'));
  assert.equal(topicsForAccess({ allowedRoutes: [] }).length, 0);
});

test('nested routes, CSV search and explicit action help resolve accurately', () => {
  for (const [path, id] of [['/scorm/campaigns/new', 'campaigns'], ['/scorm/publica/12/analytics', 'publica'], ['/scorm/access/danger', 'danger'], ['/scorm/quizmoto/quiz/1/edit', 'quizmoto'], ['/scorm/presentation/new', 'author']]) assert.equal(topicForPath(path).id, id);
  assert.equal(topicForPath('/login'), undefined);
  assert.ok(searchTopics('CSV').some((topic) => topic.id === 'roster'));
  assert.equal(searchTopics('unrecognizedxyz').length, 0);
  const title = new Element(); title.textContent = 'Learner Management'; assert.equal(topicForElement(title).id, 'roster');
  title.textContent = 'Private learner or course title'; assert.equal(topicForElement(title), null);
  title.setAttribute('href', '/solutions#learner-management'); assert.equal(topicForElement(title).id, 'roster');
  title.setAttribute('href', '/solutions#unknown'); assert.equal(topicForElement(title), null);
  title.textContent = 'Replace'; assert.match(actionTipForElement(title, topicForPath('/scorm/roster')), /existing entries may be removed/);
  assert.equal(actionTipForElement(title, topicForPath('/scorm/publica')), null);
});

test('sign-in remains minimal without removing authentication paths', () => {
  const source = readFileSync(new URL('../src/pages/Scorm/ScormAuth.jsx', import.meta.url), 'utf8');
  assert.match(source, /Welcome back\. Sign in to continue\./);
  assert.doesNotMatch(source, /Assigned identities open|AI course authoring|SCORM library|complete interactive LMSGEN/);
  for (const text of ['Forgot password?', 'Sign in with Microsoft', 'GoogleLogin', 'Need an account?']) assert.ok(source.includes(text), text);
});

test('scrolling preempts hover animation but not a direct mascot click', (t) => {
  const f = fixture(t); f.mascot.bindDocument(f.doc);
  const title = new Element(); title.setAttribute('data-genny-topic', 'roster');
  f.doc.emit('focusin', { target: title }); f.tick(1); assert.equal(f.plays.at(-1), 'thinking');
  f.doc.defaultView.scrollY = 80; f.doc.defaultView.emit('scroll'); assert.equal(f.plays.at(-1), 'look-down');
  f.root.querySelector('.lmsgen-mascot-btn').emit('click');
  f.doc.defaultView.scrollY = 10; f.doc.defaultView.emit('scroll'); assert.equal(f.plays.at(-1), 'laughing');
});

test('static guide opens, searches, resumes its tour, closes with Escape and cleans up', (t) => {
  const f = fixture(t); const saved = new Map();
  f.doc.defaultView.localStorage = { getItem: (key) => saved.get(key), setItem: (key, value) => saved.set(key, value) };
  let opened = 0;
  const guide = mountSiteGuide(f.doc, { onOpen: () => opened++ });
  const root = f.doc.body.children.at(-1);
  const nodes = (node) => [node, ...node.children.flatMap(nodes)];
  const find = (predicate) => nodes(root).find(predicate);
  const button = (text) => find((node) => node.textContent === text);
  const panel = find((node) => node.id === 'genny-guide-panel');
  assert.equal(panel.hidden, true); guide.open(); assert.equal(opened, 1); assert.equal(panel.hidden, false);
  button('Take a product tour').emit('click'); assert.equal(saved.get('lmsgen-genny-tour-v1:website'), 'overview');
  button('Next').emit('click'); assert.equal(saved.get('lmsgen-genny-tour-v1:website'), 'author');
  const search = find((node) => node.type === 'search'); search.value = 'CSV'; search.emit('input');
  const card = find((node) => node.className === 'genny-topic-card'); assert.equal(card.dataset.gennyCard, 'roster');
  const topics = find((node) => node.className === 'genny-topic-list'); assert.equal(topics.children.length, 1);
  assert.equal(topics.children[0].textContent, 'Learner Roster');
  f.doc.emit('keydown', { key: 'Escape' }); assert.equal(panel.hidden, true);
  const listenersBefore = f.doc.count(); guide.destroy(); assert.equal(f.doc.count(), listenersBefore - 1);
  assert.equal(f.doc.body.children.length, 1);
});

test('website and workspace share Genny colours while keeping distinct guidance', () => {
  const original = JSON.stringify(definition);
  const website = prepareGennyDefinition(definition);
  const platform = prepareGennyDefinition(definition, { platform: true });
  assert.equal(validateAvatarDefinition(platform).ok, true);
  assert.deepEqual(website.colors, platform.colors);
  assert.notDeepEqual(website.animations.idle.steps, platform.animations.idle.steps);
  assert.notEqual(GENNY_PERSONAS.website.title, GENNY_PERSONAS.platform.title);
  assert.equal(GENNY_WEBSITE_TOUR.length, 8);
  assert.ok(GENNY_WEBSITE_TOUR.every((topic) => !topic.adminOnly));
  assert.ok(!GENNY_WEBSITE_TOPICS.some((topic) => topic.adminOnly));
  for (const topic of GENNY_WEBSITE_TOPICS) {
    const canonical = GENNY_TOPICS.find((item) => item.id === topic.id);
    assert.notEqual(topic.explanation, canonical.explanation, topic.id);
    assert.equal(topic.route, canonical.route);
    assert.notDeepEqual(topic.steps, canonical.steps);
  }
  assert.equal(JSON.stringify(definition), original);
});

test('real renderer changes eye geometry in four directions and animates idle without hover', () => {
  for (const platform of [false, true]) {
    const tuned = prepareGennyDefinition(definition, { platform });
    const neutral = renderAvatarDefinition(tuned, 'neutral').geometry;
    const poses = ['up', 'down', 'left', 'right'].map((direction) => {
      const pose = renderAvatarDefinition(tuned, `genny-look-${direction}`).geometry;
      assert.notEqual(pose.leftPath, neutral.leftPath, `${direction}:left eye`);
      assert.notEqual(pose.rightPath, neutral.rightPath, `${direction}:right eye`);
      assert.equal(pose.leftVisible, true); assert.equal(pose.rightVisible, true);
      return JSON.stringify([pose.leftPath, pose.rightPath]);
    });
    assert.equal(new Set(poses).size, 4);
    const start = playAvatarAnimation(tuned, 'idle', 0).value;
    const moved = advanceAvatarPlayback(tuned, start, 2100, { random: () => 0.5 });
    assert.notDeepEqual(renderAvatarFrame(tuned, start, 0, { random: () => 0.5 }).geometry,
      renderAvatarFrame(tuned, moved, 2100, { random: () => 0.5 }).geometry);
  }
});

test('passive mobile touch follows vertical and horizontal swipes, releases and cleans up', (t) => {
  const f = fixture(t); const frame = f.makeDocument(); f.mascot.bindDocument(frame); f.tick(1500);
  const target = new Element();
  const event = (x, y) => ({ target, touches: [{ identifier: 1, clientX: x, clientY: y }],
    preventDefault() { assert.fail('must not block native mobile scrolling'); } });
  frame.emit('touchstart', event(40, 600)); assert.equal(f.plays.at(-1), 'look-left');
  f.tick(100); frame.emit('touchmove', event(40, 450)); assert.equal(f.plays.at(-1), 'look-down');
  f.tick(100); frame.emit('touchmove', event(40, 550)); assert.equal(f.plays.at(-1), 'look-up');
  f.tick(100); frame.emit('touchmove', event(140, 550)); assert.equal(f.plays.at(-1), 'look-right');
  frame.emit('touchcancel'); const count = f.plays.length;
  f.tick(100); frame.emit('touchmove', event(40, 550)); assert.equal(f.plays.length, count);
  frame.emit('touchstart', event(40, 600));
  frame.emit('touchmove', { target, touches: [{}, {}] });
  f.tick(100); frame.emit('touchmove', event(40, 450)); assert.equal(f.plays.at(-1), 'look-left');
  f.tick(1200); assert.equal(f.plays.at(-1), 'idle');
  f.mascot.bindDocument(f.doc); assert.equal(frame.count(), 0); assert.equal(frame.defaultView.count(), 0);
});

test('ongoing scrolling holds gaze until the swipe settles, not midway through it', (t) => {
  const f = fixture(t); f.mascot.bindDocument(f.doc); f.tick(1500);
  f.doc.defaultView.scrollY = 100; f.doc.defaultView.emit('scroll');
  f.tick(800); f.doc.defaultView.scrollY = 200; f.doc.defaultView.emit('scroll');
  f.options.onAnimationEnd('look-down');
  f.tick(900); assert.equal(f.plays.at(-1), 'look-down');
  f.tick(250); assert.equal(f.plays.at(-1), 'idle'); assert.equal(f.root.dataset.look, undefined);
});

test('touch gaze respects reduced motion and higher-priority explicit interactions', (t) => {
  const reduced = fixture(t, { reduced: true }); reduced.mascot.bindDocument(reduced.doc);
  const target = new Element(); const touches = [{ identifier: 1, clientX: 40, clientY: 500 }];
  reduced.doc.emit('touchstart', { target, touches });
  reduced.doc.emit('touchmove', { target, touches: [{ ...touches[0], clientY: 200 }] });
  assert.equal(reduced.plays.length, 0);
  const f = fixture(t); f.mascot.bindDocument(f.doc);
  f.root.querySelector('.lmsgen-mascot-btn').emit('click');
  f.doc.emit('touchstart', { target, touches }); assert.equal(f.plays.at(-1), 'laughing');
});

test('demo guidance covers every visible demo topic without widening route access', () => {
  const visible = topicsForAccess();
  assert.equal(Object.keys(GENNY_DEMO_GUIDANCE).length, visible.length);
  for (const topic of visible) {
    const guide = demoGuidanceFor(topic);
    for (const field of ['detail', 'available', 'example', 'tip', 'answer']) assert.ok(guide[field]?.length > 35, `${topic.id}:${field}`);
    assert.ok(guide.question.length > 15 && guide.question.endsWith('?'), topic.id);
    assert.ok(guide.next.every((id) => visible.some((item) => item.id === id)));
  }
  const limited = topicsForAccess({ allowedRoutes: ['/scorm/publica', '/scorm/settings'] });
  assert.deepEqual(demoTopics(limited).map((topic) => topic.route), limited.map((topic) => topic.route));
  assert.equal(demoGuidanceFor({ id: 'danger' }), null);
  assert.ok(searchTopics('handbook', demoTopics(visible)).some((topic) => topic.id === 'publica'));
  assert.ok(searchTopics('phishing', demoTopics(visible)).some((topic) => topic.id === 'author'));
  assert.ok(!visible.some((topic) => topic.searchDetail)); // no mutation of approved/website data
});

test('demo explanations distinguish allowance, private evidence and locked live operations', () => {
  assert.match(GENNY_DEMO_GUIDANCE.publica.available, /account limits/);
  assert.match(GENNY_DEMO_GUIDANCE.courses.available, /does not create tenant learner assignments/);
  assert.match(GENNY_DEMO_GUIDANCE.quizmoto.available, /locked/);
  assert.match(GENNY_DEMO_GUIDANCE.reports.tip, /not Publica reader analytics/);
  assert.match(GENNY_DEMO_GUIDANCE.team.answer, /analytics viewer remains read-only/);
  const source = readFileSync(new URL('../src/components/mascot/GennyGuide.jsx', import.meta.url), 'utf8');
  assert.match(source, /const isDemo = platform && !scormAccess/);
  assert.match(source, /article key=\{selected.id\}/); // topic changes reset disclosures
  assert.match(source, /open=\{!compact\}/); // mobile workflow starts collapsed
});

test('guide tracks keyboard viewport, scroll offsets, fallback and cleans every listener', (t) => {
  const f = fixture(t);
  const win = f.doc.defaultView;
  const viewport = new Events(); Object.assign(viewport, { height: 800, offsetTop: 0, scale: 1 });
  win.visualViewport = viewport;
  const panel = f.doc.createElement('section');
  const before = win.count();
  const stop = watchGuideViewport(panel);
  assert.equal(panel.style.values.get('--genny-visible-height'), '800px');
  assert.equal(panel.dataset.gennyKeyboard, 'false');
  viewport.height = 360; viewport.emit('resize');
  assert.equal(panel.style.values.get('--genny-visible-bottom'), '440px');
  assert.equal(panel.dataset.gennyKeyboard, 'true');
  viewport.offsetTop = 50; viewport.emit('scroll');
  assert.equal(panel.style.values.get('--genny-visible-bottom'), '390px');
  viewport.scale = 2; viewport.emit('resize');
  assert.equal(panel.dataset.gennyKeyboard, 'false'); // zoom is not treated as a keyboard
  viewport.height = 800; viewport.offsetTop = 0; viewport.scale = 1; viewport.emit('resize');
  assert.equal(panel.style.values.get('--genny-visible-bottom'), '0px');
  stop(); assert.equal(win.count(), before); assert.equal(viewport.count(), 0);
  delete win.visualViewport;
  const fallback = watchGuideViewport(panel);
  win.innerHeight = 500; win.emit('resize');
  assert.equal(panel.style.values.get('--genny-visible-height'), '500px');
  fallback(); assert.equal(win.count(), before);
});

test('static guide collapses mobile details on breakpoint changes and preserves its footer', (t) => {
  const f = fixture(t);
  const compact = new Events(); compact.matches = false;
  f.doc.defaultView.matchMedia = () => compact;
  const guide = mountSiteGuide(f.doc);
  const root = f.doc.body.children.at(-1);
  const find = (node, className) => node.className === className ? node : node.children.map((child) => find(child, className)).find(Boolean);
  assert.equal(find(root, 'genny-detail genny-workflow').open, true);
  compact.matches = true; compact.emit('change');
  assert.equal(find(root, 'genny-detail genny-workflow').open, false);
  assert.equal(find(root, 'genny-detail genny-topics-disclosure').open, false);
  const footer = find(root, 'genny-guide-footer');
  assert.equal(footer.children[0].href, '/login');
  compact.matches = false; compact.emit('change');
  assert.equal(find(root, 'genny-detail genny-workflow').open, true);
  assert.equal(find(root, 'genny-guide-footer'), footer);
  guide.destroy(); assert.equal(compact.count(), 0);
});

function renderedEyes(root) {
  const all = (node) => [node, ...node.children.flatMap(all)];
  return all(root.querySelector('.lmsgen-mascot-mount'))
    .filter((node) => node.tagName === 'path' && node.getAttribute('fill') === GENNY_PERSONAS.website.eyes)
    .map((node) => node.getAttribute('d'));
}

for (const platform of [false, true]) test(`real SVG eyes move on phone-width ${platform ? 'workspace' : 'website'} and recover suspended playback`, (t) => {
  const f = fixture(t, { realRenderer: true, platform });
  f.mascot.bindDocument(f.doc);
  f.animate(1200); const neutral = renderedEyes(f.root);
  assert.equal(neutral.length, 2);
  f.animate(2200); assert.notDeepEqual(renderedEyes(f.root), neutral);
  assert.equal(f.frames.size, 1, 'exactly one renderer loop');
  const target = new Element();
  f.doc.emit('touchstart', { target, touches: [{ identifier: 1, clientX: 30, clientY: 600 }] });
  f.animate(250); const left = renderedEyes(f.root);
  f.doc.emit('touchmove', { target, touches: [{ identifier: 1, clientX: 30, clientY: 350 }] });
  f.animate(250); assert.notDeepEqual(renderedEyes(f.root), left);
  assert.equal(f.root.dataset.look, 'down');
  f.doc.emit('touchend'); f.animate(1500);
  assert.equal(f.root.dataset.mode, 'idle');
  assert.equal(f.frames.size, 1);
  // Simulate a browser discarding a queued frame without notifying renderer.
  f.frames.clear(); f.tick(8000);
  assert.equal(f.frames.size, 1, 'stalled RAF was cleared and restarted');
  const beforeRecovery = renderedEyes(f.root);
  let recoveredMotion = false;
  for (let elapsed = 0; elapsed < 4000; elapsed += 160) {
    f.animate(160);
    recoveredMotion ||= JSON.stringify(renderedEyes(f.root)) !== JSON.stringify(beforeRecovery);
  }
  assert.equal(recoveredMotion, true, 'SVG eye paths move again after recovery');
  f.doc.hidden = true; f.doc.emit('visibilitychange'); assert.equal(f.frames.size, 0);
  f.tick(8000); assert.equal(f.frames.size, 0, 'no background recovery/rendering');
  f.doc.hidden = false; f.doc.emit('visibilitychange'); f.animate(2200);
  assert.equal(f.frames.size, 1);
  f.frames.clear(); f.doc.defaultView.emit('pageshow'); assert.equal(f.frames.size, 1);
  f.mascot.destroy(); assert.equal(f.frames.size, 0); assert.equal(f.timers.size, 0);
});

test('motion follows device by default, but explicit eye-motion opt-in and opt-out work', (t) => {
  const enabled = fixture(t, { reduced: true, motionPreference: 'on' });
  enabled.mascot.bindDocument(enabled.doc); enabled.tick(1500);
  enabled.doc.defaultView.scrollY = 30; enabled.doc.defaultView.emit('scroll');
  assert.equal(enabled.plays.at(-1), 'look-down'); assert.equal(enabled.root.dataset.motion, 'on');
  const disabled = fixture(t, { motionPreference: 'off' });
  disabled.tick(8000); assert.equal(disabled.plays.length, 0); assert.equal(disabled.timers.size, 0);
  assert.equal(disabled.root.dataset.motion, 'off');
});

test('explicit motion opt-in moves actual SVG eyes even when the OS reduces motion', (t) => {
  const f = fixture(t, { reduced: true, motionPreference: 'on', realRenderer: true });
  f.animate(1200); const before = renderedEyes(f.root);
  let changed = false;
  for (let elapsed = 0; elapsed < 4000; elapsed += 160) {
    f.animate(160);
    changed ||= JSON.stringify(renderedEyes(f.root)) !== JSON.stringify(before);
  }
  assert.equal(changed, true);
  assert.equal(f.frames.size, 1);
});

test('slow mobile scroll accumulates small deltas and body scroll uses the document position', (t) => {
  const f = fixture(t); f.mascot.bindDocument(f.doc); f.tick(1500);
  f.doc.body.scrollTop = 0;
  for (let position = 1; position <= 4; position++) {
    f.doc.defaultView.scrollY = position; f.doc.emit('scroll', { target: f.doc.body }); f.tick(20);
  }
  assert.equal(f.root.dataset.look, 'down');
  f.tick(100);
  for (let position = 3; position >= 0; position--) {
    f.doc.defaultView.scrollY = position; f.doc.emit('scroll', { target: f.doc.body }); f.tick(20);
  }
  assert.equal(f.root.dataset.look, 'up');
});

test('guide measures visible width/right offset on zoom as well as keyboard height', (t) => {
  const f = fixture(t); const win = f.doc.defaultView;
  const viewport = new Events(); Object.assign(viewport, { height: 600, width: 260, offsetTop: 20, offsetLeft: 30, scale: 1.5 });
  win.visualViewport = viewport;
  const panel = f.doc.createElement('section'); const stop = watchGuideViewport(panel);
  assert.equal(panel.style.values.get('--genny-visible-width'), '260px');
  assert.equal(panel.style.values.get('--genny-visible-right'), '100px');
  viewport.offsetLeft = 100; viewport.emit('scroll');
  assert.equal(panel.style.values.get('--genny-visible-right'), '30px');
  stop(); assert.equal(viewport.count(), 0);
});

test('static guide offers explicit motion choice, persists it, and follows system changes by default', (t) => {
  const f = fixture(t, { reduced: true }); const saved = new Map();
  f.doc.defaultView.localStorage = { getItem: (key) => saved.get(key), setItem: (key, value) => saved.set(key, value) };
  let preference;
  const guide = mountSiteGuide(f.doc, { onMotionChange: (value) => { preference = value; } });
  const all = (node) => [node, ...node.children.flatMap(all)];
  const label = all(f.doc.body.children.at(-1)).find((node) => node.children.some((child) => child.textContent === 'Move Genny’s eyes'));
  const checkbox = label.children[0]; assert.equal(checkbox.checked, false);
  f.media.matches = false; f.media.emit('change'); assert.equal(checkbox.checked, true);
  checkbox.checked = false; checkbox.emit('change');
  assert.equal(preference, 'off'); assert.equal(saved.get('lmsgen-genny-motion'), 'off');
  f.media.matches = false; f.media.emit('change'); assert.equal(checkbox.checked, false);
  checkbox.checked = true; checkbox.emit('change'); assert.equal(preference, 'on');
  guide.destroy();
});

test('guide sizing and layering stay scoped; platform artwork has no alternate uniform', () => {
  const css = readFileSync(new URL('../src/components/mascot/genny-guide.css', import.meta.url), 'utf8');
  assert.match(css, /width: min\(340px, calc\(var\(--genny-visible-width/);
  assert.match(css, /max-height: min\(480px,/);
  assert.match(css, /width: min\(320px,/);
  assert.match(css, /max-height: min\(400px,/);
  assert.match(css, /\.genny-website \.genny-guide \{ z-index: 2147483005; \}/);
  assert.match(css, /\.genny-guide-header \{[^}]*flex: 0 0 auto/);
  assert.match(css, /\.genny-guide-footer \{[^}]*flex: 0 0 auto/);
  const mascotCss = readFileSync(new URL('../src/components/mascot/mascot.css', import.meta.url), 'utf8');
  assert.match(mascotCss, /safe-area-inset-right/);
  assert.match(mascotCss, /--genny-visible-width/);
  assert.match(mascotCss, /width: 40px/);
  assert.doesNotMatch(mascotCss, /#164e63|#ecfeff|distinct uniform/);
});
