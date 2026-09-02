import { apiUrl } from './config';

const CONTROL_ATTR = 'data-lmsgen-campaign-lifecycle';
const ROUTE_EVENT = 'lmsgen-campaign-lifecycle-route';
const UPDATE_EVENT = 'lmsgen-campaign-lifecycle-updated';
let scanQueued = false;
let observer = null;

function onCampaignPage() {
  return window.location.pathname === '/scorm/assignments';
}

function token() {
  return window.localStorage.getItem('token') || '';
}

function campaignIdFromRow(row) {
  const link = row.querySelector('a[href*="/scorm/campaigns/"][href$="/analytics"]');
  const href = String(link?.getAttribute('href') || '');
  const match = href.match(/\/scorm\/campaigns\/([^/]+)\/analytics(?:$|[?#])/);
  return match ? decodeURIComponent(match[1]) : '';
}

function campaignNameFromRow(row) {
  const title = row.querySelector('.min-w-0 .text-sm.font-semibold');
  return String(title?.textContent || 'campaign').trim() || 'campaign';
}

function buttonWithText(actions, label) {
  const wanted = String(label || '').trim().toLowerCase();
  return Array.from(actions.querySelectorAll('button,a')).find((node) =>
    String(node.textContent || '').trim().toLowerCase() === wanted
  ) || null;
}

function badgeFromRow(row) {
  return Array.from(row.querySelectorAll('span')).find((node) => {
    const text = String(node.textContent || '').trim().toLowerCase();
    return ['active', 'draft', 'completed', 'stopped'].includes(text) && node.className.includes('uppercase');
  }) || null;
}

function rowStatus(row, actions) {
  const badge = String(badgeFromRow(row)?.textContent || '').trim().toLowerCase();
  if (badge === 'active') return 'active';
  if (badge === 'completed') return 'completed';
  if (badge === 'stopped') return 'stopped';
  if (buttonWithText(actions, 'Start')) return 'draft';
  // The React view predates the stopped state and renders unknown states using
  // the Draft label plus a Portal button. This combination uniquely identifies
  // a stopped campaign until the page component is upgraded.
  if (badge === 'draft' && buttonWithText(actions, 'Portal')) return 'stopped';
  return badge || 'unknown';
}

function lifecycleControl(actions, kind) {
  return actions.querySelector(`[${CONTROL_ATTR}="${kind}"]`);
}

function removeLifecycleControl(actions, kind) {
  const node = lifecycleControl(actions, kind);
  if (node) node.remove();
}

function svgIcon(kind) {
  if (kind === 'stop') {
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="2"/></svg>';
  }
  return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

async function request(path, options = {}) {
  const authToken = token();
  if (!authToken) throw new Error('Your session has expired. Sign in again.');
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  let payload = null;
  try { payload = await response.json(); } catch (_) {}
  if (!response.ok) throw new Error(payload?.message || `Request failed (${response.status}).`);
  return payload || {};
}

function setBusy(button, busy, text) {
  if (!button) return;
  if (busy) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.style.opacity = '0.65';
    button.textContent = text;
  } else {
    button.disabled = false;
    button.style.opacity = '';
    if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
  }
}

function emitLifecycleUpdate(detail) {
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail }));
}

function markRowStopped(row, id, name) {
  if (!row) return;
  const actions = row.querySelector('.campaign-actions');
  const badge = badgeFromRow(row);
  if (badge) badge.textContent = 'Stopped';
  if (actions) {
    const portal = buttonWithText(actions, 'Portal');
    if (portal) portal.style.display = 'none';
    const codes = buttonWithText(actions, 'Codes');
    if (codes) codes.style.display = 'none';
    removeLifecycleControl(actions, 'stop');
    if (!lifecycleControl(actions, 'delete')) actions.appendChild(makeDeleteButton(id, name));
  }
  emitLifecycleUpdate({ id, status: 'stopped' });
}

function removeDeletedRow(row, id) {
  if (row) row.remove();
  emitLifecycleUpdate({ id, status: 'deleted' });
}

function makeStopButton(id, name) {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute(CONTROL_ATTR, 'stop');
  button.className = 'scorm-button-secondary h-10 px-3 inline-flex items-center gap-2 text-xs font-semibold';
  button.title = 'Stop campaign and stop learner tracking';
  button.innerHTML = `${svgIcon('stop')}<span>Stop</span>`;
  button.addEventListener('click', async () => {
    const confirmed = window.confirm(`Stop “${name}”? Learner access will close immediately and no further score, progress or completion tracking will be accepted. After stopping, the campaign can be deleted.`);
    if (!confirmed) return;
    const row = button.closest('.campaign-list-row');
    setBusy(button, true, 'Stopping…');
    try {
      await request(`/api/scorm/campaigns/${encodeURIComponent(id)}/stop`, { method: 'POST', body: '{}' });
      // Keep the page mounted. Only the affected campaign row changes state so
      // stopping a campaign never blanks/reloads the whole Campaigns screen.
      markRowStopped(row, id, name);
    } catch (error) {
      window.alert(error.message || 'Unable to stop campaign.');
      setBusy(button, false);
    }
  });
  return button;
}

function makeDeleteButton(id, name) {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute(CONTROL_ATTR, 'delete');
  button.className = 'scorm-button-secondary h-10 px-3 inline-flex items-center gap-2 text-xs font-semibold';
  button.title = 'Delete stopped campaign';
  button.innerHTML = `${svgIcon('delete')}<span>Delete</span>`;
  button.addEventListener('click', async () => {
    const confirmed = window.confirm(`Delete stopped campaign “${name}”? The campaign will be removed permanently. Its learner registrations are already revoked so tracking cannot continue.`);
    if (!confirmed) return;
    const row = button.closest('.campaign-list-row');
    setBusy(button, true, 'Deleting…');
    try {
      await request(`/api/scorm/campaigns/${encodeURIComponent(id)}`, { method: 'DELETE' });
      removeDeletedRow(row, id);
    } catch (error) {
      window.alert(error.message || 'Unable to delete campaign.');
      setBusy(button, false);
    }
  });
  return button;
}

function enhanceRow(row) {
  const actions = row.querySelector('.campaign-actions');
  if (!actions) return;
  const id = campaignIdFromRow(row);
  if (!id) return;
  const name = campaignNameFromRow(row);
  const status = rowStatus(row, actions);

  if (status === 'active') {
    removeLifecycleControl(actions, 'delete');
    if (!lifecycleControl(actions, 'stop')) actions.appendChild(makeStopButton(id, name));
    return;
  }

  if (status === 'stopped') {
    removeLifecycleControl(actions, 'stop');
    const badge = badgeFromRow(row);
    if (badge && String(badge.textContent || '').trim() !== 'Stopped') badge.textContent = 'Stopped';
    const portal = buttonWithText(actions, 'Portal');
    if (portal && portal.style.display !== 'none') portal.style.display = 'none';
    const codes = buttonWithText(actions, 'Codes');
    if (codes && codes.style.display !== 'none') codes.style.display = 'none';
    if (!lifecycleControl(actions, 'delete')) actions.appendChild(makeDeleteButton(id, name));
    return;
  }

  removeLifecycleControl(actions, 'stop');
  removeLifecycleControl(actions, 'delete');
}

function scan() {
  scanQueued = false;
  if (!onCampaignPage()) return;
  document.querySelectorAll('.campaign-list-row').forEach(enhanceRow);
}

function queueScan() {
  if (!onCampaignPage() || scanQueued) return;
  scanQueued = true;
  window.requestAnimationFrame(scan);
}

function connectCampaignObserver() {
  if (!onCampaignPage() || observer) return;
  observer = new MutationObserver(queueScan);
  const root = document.getElementById('root') || document.body;
  observer.observe(root, { childList: true, subtree: true });
  queueScan();
}

function disconnectCampaignObserver() {
  if (!observer) return;
  observer.disconnect();
  observer = null;
  scanQueued = false;
}

function syncRoute() {
  if (onCampaignPage()) connectCampaignObserver();
  else disconnectCampaignObserver();
}

function installRouteEvents() {
  if (window.__lmsgenCampaignLifecycleRouteEvents) return;
  window.__lmsgenCampaignLifecycleRouteEvents = true;
  ['pushState', 'replaceState'].forEach((method) => {
    const original = window.history[method];
    if (typeof original !== 'function') return;
    window.history[method] = function patchedHistoryState(...args) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event(ROUTE_EVENT));
      return result;
    };
  });
  window.addEventListener('popstate', () => window.dispatchEvent(new Event(ROUTE_EVENT)));
}

function start() {
  installRouteEvents();
  window.addEventListener(ROUTE_EVENT, syncRoute);
  syncRoute();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
