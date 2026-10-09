import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateAvatarDefinition, playAvatarAnimation, advanceAvatarPlayback } from '@bible-strong/avatar-core';
import { mountGenny, prepareGennyDefinition, GENNY_TIPS } from '../src/components/mascot/genny-runtime.js';

const definition = JSON.parse(readFileSync(new URL('../src/components/mascot/genny.avatar.json', import.meta.url)));

class Events {
  listeners = new Map();
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(fn); }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
  emit(name) { for (const fn of this.listeners.get(name) || []) fn({ type: name }); }
  count() { return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0); }
}
class Element extends Events {
  dataset = {};
  children = [];
  selectors = new Map();
  hidden = false;
  rect = { top: 100, bottom: 500, height: 400 };
  attributes = {};
  appendChild(child) { this.children.push(child); child.parent = this; }
  remove() { this.parent.children = this.parent.children.filter((child) => child !== this); }
  setAttribute(key, value) { this.attributes[key] = value; }
  set innerHTML(_value) {
    for (const selector of ['.lmsgen-mascot-btn', '.lmsgen-mascot-mount', '.lmsgen-mascot-bubble', '.lmsgen-mascot-dismiss']) this.selectors.set(selector, new Element());
    this.selectors.get('.lmsgen-mascot-bubble').hidden = true;
  }
  querySelector(selector) { return this.selectors.get(selector); }
  querySelectorAll(selector) { return this.selectors.has(selector) ? [this.selectors.get(selector)] : []; }
  getBoundingClientRect() { return this.rect; }
  getClientRects() { return this.hidden ? [] : [this.rect]; }
}

function fixture(t, { reduced = false, greeted = true, dismissed = false } = {}) {
  let time = 100000;
  let nextId = 0;
  const timers = new Map();
  t.mock.method(Date, 'now', () => time);
  const media = new Events(); media.matches = reduced;
  const flags = new Map();
  if (greeted) flags.set('lmsgen-mascot-greeted', '1');
  if (dismissed) flags.set('lmsgen-mascot-dismissed', '1');
  const observers = [];
  function makeDocument() {
    const win = new Events();
    Object.assign(win, {
      innerHeight: 800, scrollY: 0, performance: { now: () => time },
      matchMedia: () => media,
      sessionStorage: { getItem: (key) => flags.get(key), setItem: (key, value) => flags.set(key, value) },
      setTimeout: (fn, ms) => { const id = ++nextId; timers.set(id, { at: time + ms, fn }); return id; },
      clearTimeout: (id) => timers.delete(id),
      getComputedStyle: (el) => ({ display: el.hidden ? 'none' : 'block' }),
      MutationObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} disconnect() { this.disconnected = true; } },
      IntersectionObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} disconnect() { this.disconnected = true; } },
    });
    const doc = new Element(); doc.hidden = false; doc.body = new Element(); doc.defaultView = win;
    doc.createElement = () => new Element();
    return doc;
  }
  const doc = makeDocument();
  const plays = [];
  const controller = { play: (name) => { plays.push(name); return { ok: true }; }, stop() {}, pause() { this.paused = true; }, setExpression(name) { this.expression = name; }, destroy() { this.destroyed = true; } };
  let options;
  const mascot = mountGenny({ document: doc, definition, createAvatar: (_target, opts) => { options = opts; return controller; } });
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
  t.after(() => mascot.destroy());
  return { doc, root, mascot, controller, options, plays, timers, tick, media, makeDocument, observers, flags };
}

test('reactions are once-only, short, non-mutating and waking opens its eyes', () => {
  const tuned = prepareGennyDefinition(definition);
  const validation = validateAvatarDefinition(tuned);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
  for (const [name, animation] of Object.entries(tuned.animations)) {
    if (['idle', 'sleeping'].includes(name)) assert.equal(animation.playbackMode, 'loop');
    else {
      assert.equal(animation.playbackMode, 'once');
      assert.ok(animation.steps.reduce((sum, step) => sum + step.holdMs + step.transitionMs, 0) < 3000);
    }
  }
  assert.equal(tuned.animations.waking.steps.at(-1).expression, 'neutral');
  assert.equal(definition.animations.laughing.playbackMode, 'loop');
  assert.ok(tuned.animations.idle.steps[0].holdMs < 2000);
});

test('the real avatar engine completes each transient reaction naturally', () => {
  const tuned = prepareGennyDefinition(definition);
  for (const name of Object.keys(tuned.animations).filter((name) => !['idle', 'sleeping'].includes(name))) {
    const start = playAvatarAnimation(tuned, name, 0);
    assert.equal(start.ok, true);
    let state = start.value;
    for (let time = 20; time <= 3500; time += 20) state = advanceAvatarPlayback(tuned, state, time, { random: () => 0.5 });
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
  f.options.onAnimationEnd('laughing'); assert.equal(f.root.dataset.mode, 'idle');
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

test('session dismissal never mounts an avatar', (t) => {
  const f = fixture(t, { dismissed: true }); assert.equal(f.doc.body.children.length, 0); assert.equal(f.options, undefined);
});
