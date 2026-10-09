import { topicsForAccess, tourForAccess, searchTopics } from './genny-knowledge.js';
import { watchGuideViewport } from './genny-viewport.js';

// Static marketing pages use the same product data as the React platform guide.
// DOM text nodes only: search text is never interpolated into HTML.
export function mountSiteGuide(doc, { onOpen, onHoverChange } = {}) {
  const win = doc.defaultView;
  const compactMedia = win.matchMedia('(max-width: 767px)');
  const topics = topicsForAccess();
  const tour = tourForAccess();
  const wrapper = doc.createElement('div');
  wrapper.className = 'genny-website';
  const removers = [];
  const el = (tag, className, text, parent) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    parent?.appendChild(node);
    return node;
  };
  const listen = (node, name, callback) => {
    node.addEventListener(name, callback);
    removers.push(() => node.removeEventListener(name, callback));
  };
  const button = (text, parent, callback, className) => {
    const node = el('button', className, text, parent);
    node.type = 'button';
    listen(node, 'click', callback);
    return node;
  };
  let selected = topics[0];
  let index = null;
  let previousFocus;
  let query = '';
  const launcher = button('Genny guide ?', wrapper, open, 'genny-launcher');
  launcher.setAttribute('aria-controls', 'genny-guide-panel');
  launcher.setAttribute('aria-expanded', 'false');
  const panel = el('section', 'genny-guide', '', wrapper);
  panel.id = 'genny-guide-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Genny interactive guide');
  const header = el('header', 'genny-guide-header', '', panel);
  const heading = el('div', '', '', header);
  el('span', 'genny-eyebrow', 'YOUR LEARNING SIDEKICK', heading);
  el('h2', '', 'Ask Genny', heading);
  const closeButton = button('', header, close, 'genny-close');
  el('span', 'genny-close-icon', '', closeButton).setAttribute('aria-hidden', 'true');
  closeButton.setAttribute('aria-label', 'Close Genny guide');
  const body = el('div', 'genny-guide-body', '', panel);
  el('p', 'genny-intro', 'Big platform. Simple next steps. Choose a feature or let me show you around.', body);
  const toolbar = el('div', 'genny-guide-toolbar', '', body);
  button('Start / resume tour', toolbar, () => {
    let saved;
    try { saved = win.localStorage.getItem('lmsgen-genny-tour-v1:website'); } catch { /* optional storage */ }
    record(Math.max(0, tour.findIndex((topic) => topic.id === saved)));
  }, 'genny-primary');
  const searchLabel = el('label', 'genny-search', 'Find an answer', body);
  const search = el('input', '', '', searchLabel);
  search.type = 'search';
  search.placeholder = 'Try: CSV, publish, quizzes, reports…';
  listen(search, 'input', () => { query = search.value; index = null; selected = searchTopics(query, topics)[0] || selected; render(); });
  const progress = el('div', 'genny-tour-progress', '', body);
  progress.setAttribute('aria-live', 'polite');
  const card = el('article', 'genny-topic-card', '', body);
  const controls = el('nav', 'genny-tour-controls', '', body);
  controls.setAttribute('aria-label', 'Genny tour steps');
  const back = button('Back', controls, () => record(index - 1));
  const next = button('Next', controls, () => {
    if (index + 1 < tour.length) record(index + 1);
    else { index = null; try { win.localStorage.setItem('lmsgen-genny-tour-v1:website', 'complete'); } catch { /* optional storage */ } render(); }
  }, 'genny-primary');
  button('End tour', controls, () => { index = null; render(); });
  const topicDisclosure = el('details', 'genny-detail genny-topics-disclosure', '', body);
  const topicSummary = el('summary', '', '', topicDisclosure);
  const list = el('div', 'genny-topic-list', '', topicDisclosure);
  list.setAttribute('aria-label', 'Genny topics');
  const hoverLabel = el('label', 'genny-hover-toggle', '', body);
  const hover = el('input', '', '', hoverLabel);
  hover.type = 'checkbox';
  try { hover.checked = win.localStorage.getItem('lmsgen-genny-hover') !== 'off'; } catch { hover.checked = true; }
  el('span', '', 'Explain topics on hover or keyboard focus', hoverLabel);
  listen(hover, 'change', () => {
    try { win.localStorage.setItem('lmsgen-genny-hover', hover.checked ? 'on' : 'off'); } catch { /* optional storage */ }
    onHoverChange?.(hover.checked);
  });
  el('p', 'genny-safety-note', 'Verified product guidance—not an AI chat. I explain and navigate; I never change your data.', body);
  const footer = el('footer', 'genny-guide-footer', '', panel);
  const link = el('a', 'genny-primary genny-visit', 'Explore the platform →', footer);
  link.href = '/login';

  function record(step) {
    index = Math.max(0, Math.min(step, tour.length - 1));
    selected = tour[index]; query = ''; search.value = '';
    try { win.localStorage.setItem('lmsgen-genny-tour-v1:website', selected.id); } catch { /* optional storage */ }
    render();
  }
  function render() {
    card.replaceChildren();
    card.dataset.gennyCard = selected.id;
    el('span', 'genny-eyebrow', selected.label, card);
    el('h3', '', selected.punch, card);
    el('p', '', selected.explanation, card);
    const workflow = el('details', 'genny-detail genny-workflow', '', card);
    workflow.open = !compactMedia.matches;
    el('summary', '', `How it works · ${selected.steps.length} steps`, workflow);
    const steps = el('ol', '', '', workflow);
    selected.steps.forEach(([title, detail]) => {
      const item = el('li', '', '', steps);
      el('strong', '', title, item); el('span', '', detail, item);
    });
    controls.hidden = index === null;
    progress.hidden = index === null;
    if (index !== null) {
      progress.replaceChildren();
      el('span', '', `Tour · ${index + 1} of ${tour.length}`, progress);
      const bar = el('progress', '', '', progress); bar.max = tour.length; bar.value = index + 1;
      back.disabled = index === 0; next.textContent = index + 1 === tour.length ? 'Finish tour' : 'Next';
    }
    list.replaceChildren();
    const results = searchTopics(query, topics);
    topicDisclosure.open = !!query || !compactMedia.matches;
    topicSummary.textContent = `Browse features · ${results.length}`;
    for (const topic of results) {
      const item = el('button', '', topic.label, list);
      item.type = 'button'; item.dataset.topicId = topic.id;
      item.setAttribute('aria-pressed', String(topic.id === selected.id));
    }
    if (!results.length) el('p', '', 'No matching feature yet. Try a module name or clear your search.', list);
  }
  // Delegation keeps topic rendering free of accumulating listeners.
  listen(list, 'click', (event) => {
    const id = event.target.closest('button')?.dataset.topicId;
    const topic = topics.find((item) => item.id === id);
    if (topic) { selected = topic; index = null; render(); list.querySelector(`[data-topic-id="${id}"]`)?.focus(); }
  });
  function open() {
    previousFocus = doc.activeElement;
    panel.hidden = false; wrapper.classList.add('genny-is-open');
    launcher.setAttribute('aria-expanded', 'true'); closeButton.focus(); onOpen?.();
  }
  function close() {
    panel.hidden = true; wrapper.classList.remove('genny-is-open');
    launcher.setAttribute('aria-expanded', 'false');
    (previousFocus?.isConnected && previousFocus !== doc.body ? previousFocus : launcher).focus();
  }
  listen(doc, 'keydown', (event) => { if (event.key === 'Escape' && !panel.hidden) close(); });
  listen(compactMedia, 'change', render);
  render(); doc.body.appendChild(wrapper);
  removers.push(watchGuideViewport(panel));
  return { open, select(topic) { if (index === null && panel.hidden) { selected = topic; render(); } }, destroy() { removers.forEach((remove) => remove()); wrapper.remove(); } };
}
