// ---------------------------------------------------------------------------
// Genny — vanilla JS mascot for the STATIC LMSGEN marketing pages.
//
// The public site (lmsgen.in) is served as static HTML; the React shell never
// loads there, so this self-contained bundle (built by
// scripts/build-mascot-bundle.mjs into public/landing/js/genny-mascot.js and
// injected by scripts/inject-mascot.mjs) brings Genny to those pages.
//
// Uses @bible-strong/avatar-web per the guide's "any other site" prompt.
// Behavior:
//   page opens      -> "waking", then "idle"; greeting bubble once per visit
//   scroll sections -> scroll-spy tips: one short verified feature tip per
//                      section (after ~1.2s dwell, max one per 9s, once per view)
//   fast scroll     -> "playful" (22s cooldown)
//   hover main CTA  -> "excited"
//   contact form ok -> "celebrate" | form error -> "confused"
//   30s no activity -> "drowsy", then "sleeping" (any activity wakes Genny)
//   click Genny     -> "laughing"; click bubble -> dismiss bubble
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
  // Returns true when the reaction actually started.
  function react(name, next) {
    if (mode !== 'idle') return false;
    playThen(name, next || 'idle');
    return true;
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
  function showBubble(text, ms) {
    bubble.textContent = text;
    bubble.hidden = false;
    if (greetHideTimer) clearTimeout(greetHideTimer);
    greetHideTimer = setTimeout(() => {
      bubble.hidden = true;
    }, ms || 6000);
  }

  bubble.addEventListener('click', () => {
    bubble.hidden = true;
    if (greetHideTimer) clearTimeout(greetHideTimer);
  });

  playThen('waking', 'idle', { waitMs: 3000 });
  armIdleTimer();
  if (!readFlag(GREETED_KEY) && !prefersReducedMotion) {
    setTimeout(() => {
      writeFlag(GREETED_KEY);
      showBubble("Hi, I'm Genny!", 6000);
    }, 3500);
  }

  // ---- scroll-spy feature tips ---------------------------------------------
  // One short, verified tip per section as the visitor scrolls. A tip shows
  // only after the visitor lingers ~1.2s on a section, at most one per 9s,
  // and once per page view — a guide, not a nag.
  const TIPS = [
    // homepage
    { sel: '.lmsgen-pain-section', text: 'Weeks of course writing? AI builds it in minutes.', anim: 'happy' },
    { sel: '.hp-platform-s', text: 'Enter a topic or upload material. You review before learners see it.', anim: 'happy' },
    { sel: '.lmsgen-pdf-course-section', text: 'Turn PDFs into interactive flipbooks with page-level analytics.', anim: 'playful' },
    { sel: '.hp-trust-s', text: 'Track every slide and every question. Always audit-ready.', anim: 'happy' },
    { sel: '.hp-advg-s', text: 'Campaigns with deadlines and automatic reminders, all in one place.', anim: 'happy' },
    { sel: '.hp-insights-s', text: 'Run a live Quizmoto quiz. Learners join with a simple code.', anim: 'excited' },
    { sel: '.lmsgen-faq-section', text: 'Still curious? A free demo walks through your use case in 30 minutes.', anim: 'thinking' },
    // solutions
    { sel: '.sl-hero-s', text: 'Create, deliver and track training. All in one workspace.', anim: 'happy' },
    { sel: '.sl-feat-templ-s', text: 'Build a course once, assign it anywhere.', anim: 'happy' },
    { sel: '.nsl-local-s', text: 'Group learners by department or role.', anim: 'happy' },
    { sel: '.nsol-manage-s', text: 'See completions, scores and pending learners at a glance.', anim: 'happy' },
    // contact
    { sel: '.ct-main-s', text: 'Share your learner count for a tailored plan.', anim: 'happy' },
    // demo CTA (every page)
    { sel: '.book-demo-s', text: 'Your turn! Book a free demo and see it live.', anim: 'excited' },
  ];

  const TIP_GAP_MS = 9000;
  const TIP_DWELL_MS = 1200;
  const shownTips = new Set();
  let lastTipAt = 0;
  let dwellTimer = null;

  function showTip(tip, index) {
    if (dismissed || prefersReducedMotion || mode !== 'idle') return false;
    if (Date.now() - lastTipAt < TIP_GAP_MS) return false;
    shownTips.add(index);
    lastTipAt = Date.now();
    showBubble(tip.text, 6500);
    playThen(tip.anim, 'idle');
    armIdleTimer();
    return true;
  }

  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    const tipTargets = [];
    TIPS.forEach((tip, index) => {
      document.querySelectorAll(tip.sel).forEach((el) => {
        tipTargets.push({ el, tip, index });
      });
    });

    if (tipTargets.length) {
      const visible = new Map();
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            const target = tipTargets.find((t) => t.el === en.target);
            if (!target) return;
            if (en.isIntersecting) visible.set(en.target, target);
            else visible.delete(en.target);
          });

          if (dwellTimer) {
            clearTimeout(dwellTimer);
            dwellTimer = null;
          }
          if (!visible.size) return;

          // Most-centered section wins.
          let best = null;
          let bestRatio = -1;
          visible.forEach((t, el) => {
            const rect = el.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            const dist = Math.abs(mid - window.innerHeight / 2);
            const score = 1 / (1 + dist);
            if (score > bestRatio) {
              bestRatio = score;
              best = t;
            }
          });
          if (!best || shownTips.has(best.index)) return;

          dwellTimer = setTimeout(() => {
            dwellTimer = null;
            showTip(best.tip, best.index);
          }, TIP_DWELL_MS);
        },
        { rootMargin: '-35% 0px -35% 0px', threshold: [0, 0.5] },
      );
      tipTargets.forEach((t) => observer.observe(t.el));
    }
  }

  // ---- fast scroll -> playful -------------------------------------------------
  // Genny notices vigorous scrolling (with a cooldown so it stays charming).
  let lastScrollY = window.scrollY;
  let lastScrollT = performance.now();
  let lastPlayfulAt = 0;
  window.addEventListener(
    'scroll',
    () => {
      const now = performance.now();
      const dy = Math.abs(window.scrollY - lastScrollY);
      const dt = now - lastScrollT;
      lastScrollY = window.scrollY;
      lastScrollT = now;
      if (dt <= 0 || dismissed || prefersReducedMotion) return;
      const velocity = (dy / dt) * 1000; // px per second
      if (velocity > 2600 && now - lastPlayfulAt > 22000 && mode === 'idle') {
        lastPlayfulAt = now;
        if (react('playful')) armIdleTimer();
      }
      armIdleTimer();
    },
    { passive: true },
  );

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
  ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach((ev) =>
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
