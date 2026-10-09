// ---------------------------------------------------------------------------
// Genny — vanilla JS mascot for the STATIC LMSGEN marketing pages.
//
// The public site (lmsgen.in) is served as static HTML; the React shell never
// loads there, so this self-contained bundle (built by
// scripts/build-mascot-bundle.mjs into public/landing/js/genny-mascot.js and
// injected by scripts/inject-mascot.mjs) brings Genny to those pages.
//
// Uses @bible-strong/avatar-web per the guide's "any other site" prompt.
// Behavior mirrors the React twin (components/mascot/SiteMascot.jsx):
//   page opens      -> "waking", then "idle"
//   hover main CTA  -> "excited"
//   contact form ok -> "celebrate" | form error -> "confused"
//   30s no activity -> "drowsy", then "sleeping" (any activity wakes Genny)
//   click Genny     -> "laughing"
//   reduced motion  -> still "neutral" expression, no animation, no reactions
// ---------------------------------------------------------------------------
import { createAvatar } from '@bible-strong/avatar-web';
import definition from './genny.avatar.json';
import mascotCss from './mascot.css';

const IDLE_MS = 30000;
const DISMISS_KEY = 'lmsgen-mascot-dismissed';
const GREETED_KEY = 'lmsgen-mascot-greeted';

function readFlag(key) {
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key) {
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    /* storage unavailable — mascot simply won't remember */
  }
}

(function initGenny() {
  // Inside an iframe the React shell's SiteMascot owns the mascot — don't double up.
  if (window.self !== window.top) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dismissed = readFlag(DISMISS_KEY);
  if (dismissed) return;

  // Styles (shared with the React twin).
  const styleEl = document.createElement('style');
  styleEl.id = 'genny-mascot-styles';
  styleEl.textContent = mascotCss;
  document.head.appendChild(styleEl);

  // DOM.
  const root = document.createElement('div');
  root.className = 'lmsgen-mascot';
  root.innerHTML =
    '<div class="lmsgen-mascot-bubble" role="status" hidden>Hi, I&rsquo;m Genny!</div>' +
    '<button type="button" class="lmsgen-mascot-btn" aria-label="Genny, the LMSGEN mascot. Select to make Genny laugh." title="Genny">' +
    '<span class="lmsgen-mascot-mount"></span>' +
    '</button>' +
    '<button type="button" class="lmsgen-mascot-dismiss" aria-label="Hide Genny the mascot for this visit" title="Hide">&times;</button>';
  document.body.appendChild(root);

  const bubble = root.querySelector('.lmsgen-mascot-bubble');
  const mount = root.querySelector('.lmsgen-mascot-mount');

  let controller = null;
  try {
    controller = createAvatar(mount, {
      definition,
      defaultAnimation: prefersReducedMotion ? undefined : 'idle',
      defaultExpression: prefersReducedMotion ? 'neutral' : undefined,
      size: '100%',
      ariaLabel: 'Genny, the LMSGEN mascot',
      onAnimationEnd: handleAnimationEnd,
    });
  } catch {
    // Never break the page over the mascot.
    root.remove();
    return;
  }

  let mode = 'idle'; // 'idle' | 'busy' | 'asleep'
  let pending = null; // { name, next, endMode } | null
  let fallbackTimer = null;
  let idleTimer = null;
  let greetHideTimer = null;

  function clearFallback() {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
  }

  function play(name) {
    try {
      const result = controller.play(name);
      return Boolean(result && result.ok);
    } catch {
      return false;
    }
  }

  function finishPending() {
    const p = pending;
    pending = null;
    clearFallback();
    if (p) {
      mode = p.endMode;
      play(p.next);
    } else {
      mode = 'idle';
    }
  }

  function handleAnimationEnd(animation) {
    // Only consume the pending step when the animation that ended is the one
    // we started — looping animations (idle, sleeping) also report ends.
    if (pending && pending.name === animation) finishPending();
  }

  // Play `name`, then `next` when it ends (or after `waitMs` as a fallback).
  function playThen(name, next, opts) {
    opts = opts || {};
    const waitMs = opts.waitMs || 6000;
    const endMode = opts.endMode || 'idle';
    if (prefersReducedMotion || dismissed) return;
    pending = { name, next, endMode };
    mode = 'busy';
    play(name);
    clearFallback();
    fallbackTimer = setTimeout(finishPending, waitMs);
  }

  // A transient reaction: only starts from idle, always settles back.
  function react(name, next) {
    if (mode !== 'idle') return;
    playThen(name, next || 'idle');
  }

  function armIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (dismissed || prefersReducedMotion) return;
      if (mode !== 'idle') {
        armIdleTimer();
        return;
      }
      playThen('drowsy', 'sleeping', { waitMs: 8000, endMode: 'asleep' });
    }, IDLE_MS);
  }

  function wake() {
    if (prefersReducedMotion || dismissed) return;
    playThen('waking', 'idle', { waitMs: 3000 });
    armIdleTimer();
  }

  // ---- entrance -----------------------------------------------------------
  playThen('waking', 'idle', { waitMs: 3000 });
  armIdleTimer();
  if (!readFlag(GREETED_KEY) && !prefersReducedMotion) {
    setTimeout(() => {
      writeFlag(GREETED_KEY);
      bubble.hidden = false;
      greetHideTimer = setTimeout(() => {
        bubble.hidden = true;
      }, 6000);
    }, 3500);
  }

  // ---- inactivity ----------------------------------------------------------
  function onActivity() {
    if (dismissed) return;
    if (mode === 'asleep') {
      wake();
      return;
    }
    if (pending && pending.next === 'sleeping') {
      // User came back mid-drowsy: cancel the nap.
      pending = null;
      clearFallback();
      mode = 'idle';
      play('idle');
    }
    armIdleTimer();
  }
  ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'].forEach((ev) =>
    window.addEventListener(ev, onActivity, { passive: true }),
  );

  // ---- CTA hover -> excited --------------------------------------------------
  document.querySelectorAll('.btn-primary').forEach((btn) => {
    if (btn.dataset.gennyBound === '1') return;
    btn.dataset.gennyBound = '1';
    btn.addEventListener('mouseenter', () => react('excited'));
    btn.addEventListener('mouseleave', () => {
      if (mode === 'idle') play('idle');
    });
    btn.addEventListener('click', () => react('excited'));
  });

  // ---- Webflow contact form -> celebrate / confused ---------------------------
  const form = document.querySelector('.w-form');
  if (form) {
    const seen = { done: false, failAt: 0 };
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        const t = m.target;
        if (!(t instanceof Element) || !t.closest('.w-form')) continue;
        const doneEl = form.querySelector('.w-form-done');
        const failEl = form.querySelector('.w-form-fail');
        const visible = (el) => el && el.style.display !== 'none' && el.offsetParent !== null;
        if (visible(doneEl) && !seen.done) {
          seen.done = true;
          react('celebrate');
        }
        const now = Date.now();
        if (visible(failEl) && now - seen.failAt > 5000) {
          seen.failAt = now;
          react('confused');
        }
        break;
      }
    }).observe(form, { attributes: true, subtree: true, attributeFilter: ['style', 'class'] });
  }

  // ---- click Genny -> laughing | dismiss --------------------------------------
  root.querySelector('.lmsgen-mascot-btn').addEventListener('click', () => {
    bubble.hidden = true;
    if (greetHideTimer) clearTimeout(greetHideTimer);
    if (dismissed || prefersReducedMotion) return;
    if (mode === 'asleep') {
      wake();
      return;
    }
    react('laughing');
    armIdleTimer();
  });

  root.querySelector('.lmsgen-mascot-dismiss').addEventListener('click', (e) => {
    e.stopPropagation();
    writeFlag(DISMISS_KEY);
    dismissed = true;
    pending = null;
    clearFallback();
    if (idleTimer) clearTimeout(idleTimer);
    root.remove();
  });
})();
