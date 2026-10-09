import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateAvatarDefinition, playAvatarAnimation, advanceAvatarPlayback } from '@bible-strong/avatar-core';
import { mountGenny, prepareGennyDefinition, GENNY_TIPS } from '../src/components/mascot/genny-runtime.js';
import { GENNY_TOPICS, topicForPath, topicsForAccess, tourForAccess, searchTopics, topicForElement, actionTipForElement } from '../src/components/mascot/genny-knowledge.js';
import { SCORM_FEATURES } from '../src/pages/Scorm/scormFeatureCatalog.js';
import { mountSiteGuide } from '../src/components/mascot/genny-site-guide.js';
import { watchGuideViewport } from '../src/components/mascot/genny-viewport.js';
import { GENNY_DEMO_GUIDANCE, demoGuidanceFor, demoTopics } from '../src/components/mascot/genny-demo-guidance.js';

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
  rect = { top: 100, bottom: 500, height: 400 };
  attributes = {};
  classList = { add() {}, remove() {} };
  appendChild(child) { this.children.push(child); child.parent = this; }
  replaceChildren(...children) { this.children = children; }
  focus() { this.focused = true; }
  remove() { this.parent.children = this.parent.children.filter((child) => child !== this); }
  setAttribute(key, value) { this.attributes[key] = value; }
  getAttribute(key) { return this.attributes[key] || null; }
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

function fixture(t, { reduced = false, greeted = true, dismissed = false, ...runtimeOptions } = {}) {
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
    doc.createElement = () => { const element = new Element(); element.ownerDocument = doc; return element; };
    return doc;
  }
  const doc = makeDocument();
  const plays = [];
  const controller = { play: (name) => { plays.push(name); return { ok: true }; }, stop() {}, pause() { this.paused = true; }, setExpression(name) { this.expression = name; }, destroy() { this.destroyed = true; } };
  let options;
  const mascot = mountGenny({ document: doc, definition, ...runtimeOptions, createAvatar: (_target, opts) => { options = opts; return controller; } });
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
  button('Start / resume tour').emit('click'); assert.equal(saved.get('lmsgen-genny-tour-v1:website'), 'overview');
  button('Next').emit('click'); assert.equal(saved.get('lmsgen-genny-tour-v1:website'), 'author');
  const search = find((node) => node.type === 'search'); search.value = 'CSV'; search.emit('input');
  const card = find((node) => node.className === 'genny-topic-card'); assert.equal(card.dataset.gennyCard, 'roster');
  const topics = find((node) => node.className === 'genny-topic-list'); assert.equal(topics.children.length, 1);
  assert.equal(topics.children[0].textContent, 'Learner Roster');
  f.doc.emit('keydown', { key: 'Escape' }); assert.equal(panel.hidden, true);
  const listenersBefore = f.doc.count(); guide.destroy(); assert.equal(f.doc.count(), listenersBefore - 1);
  assert.equal(f.doc.body.children.length, 1);
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
