import { useCallback, useEffect, useRef, useState } from 'react';
import { createAvatar } from '@bible-strong/avatar-react';
import '@bible-strong/avatar-react/styles.css';
import gennyDefinition from './genny.avatar.json';
import './mascot.css';

// ---------------------------------------------------------------------------
// Genny — the LMSGEN website mascot.
//
// Art + animation engine: Bible Strong Avatar Lab by Stephane Montlouis-Calixte
// (AGPL-3.0 — github.com/smontlouis/bible-strong-avatar-lab). The definition
// was designed in the studio's Export flow ("Make Your Own Mascot" guide) and
// recolored to LMSGEN teal; see genny.avatar.json.
//
// Behavior (mirrors the guide's "make it react" prompt):
//   page opens      -> "waking", then "idle"
//   hover main CTA  -> "excited"
//   contact form ok -> "celebrate" | form error -> "confused"
//   30s no activity -> "drowsy", then "sleeping" (any activity wakes Genny)
//   click Genny     -> "laughing"
//   reduced motion  -> still "neutral" expression, no animation, no reactions
// ---------------------------------------------------------------------------

let GennyAvatar = null;
try {
  GennyAvatar = createAvatar(gennyDefinition);
} catch (error) {
  // Never break the site over the mascot: render nothing if invalid.
  console.error('[mascot] invalid avatar definition', error);
}

const IDLE_MS = 30_000;
const DISMISS_KEY = 'lmsgen-mascot-dismissed';
const GREETED_KEY = 'lmsgen-mascot-greeted';

function readSessionFlag(key) {
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeSessionFlag(key) {
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    /* storage unavailable — mascot simply won't remember */
  }
}

export default function SiteMascot({ frameRef, pageSrc }) {
  // Computed once: the OS reduced-motion setting is not expected to flip
  // mid-visit, and reading a ref during render is forbidden by the hooks lint.
  const [prefersReducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [dismissed, setDismissed] = useState(() => readSessionFlag(DISMISS_KEY));
  const dismissedRef = useRef(dismissed);
  const controllerRef = useRef(null);
  const modeRef = useRef('idle'); // 'idle' | 'busy' | 'asleep'
  const pendingRef = useRef(null); // { name, next, run, endMode } | null
  const fallbackRef = useRef(null);
  const idleTimerRef = useRef(null);
  const greetHideRef = useRef(null);
  const wiredSrcRef = useRef(null);

  const [greeting, setGreeting] = useState(false);

  const clearFallback = useCallback(() => {
    if (fallbackRef.current) {
      window.clearTimeout(fallbackRef.current);
      fallbackRef.current = null;
    }
  }, []);

  const play = useCallback((name) => {
    const controller = controllerRef.current;
    if (!controller) return false;
    try {
      const result = controller.play(name);
      return Boolean(result && result.ok);
    } catch {
      return false;
    }
  }, []);

  const finishPending = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    clearFallback();
    if (pending) {
      modeRef.current = pending.endMode;
      pending.run();
    } else {
      modeRef.current = 'idle';
    }
  }, [clearFallback]);

  // Play `name`, then `next` when it ends (or after `waitMs` as a fallback in
  // case the animation loops forever and never reports its end).
  const playThen = useCallback(
    (name, next, options = {}) => {
      const { waitMs = 6000, endMode = 'idle' } = options;
      if (prefersReducedMotion || dismissedRef.current) return;
      pendingRef.current = { name, next, run: () => play(next), endMode };
      modeRef.current = 'busy';
      play(name);
      clearFallback();
      fallbackRef.current = window.setTimeout(finishPending, waitMs);
    },
    [play, finishPending, clearFallback, prefersReducedMotion],
  );

  // Only consume the pending step when the animation that ended is the one we
  // started — looping animations (idle, sleeping) also report ends.
  const handleAnimationEnd = useCallback(
    (animation) => {
      if (pendingRef.current && pendingRef.current.name === animation) {
        finishPending();
      }
    },
    [finishPending],
  );

  // A transient reaction: only starts from the idle state, always settles back.
  const react = useCallback(
    (name, next = 'idle') => {
      if (modeRef.current !== 'idle') return;
      playThen(name, next);
    },
    [playThen],
  );

  const armIdleTimerRef = useRef(null);
  const armIdleTimer = useCallback(() => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      if (dismissedRef.current || prefersReducedMotion) return;
      if (modeRef.current !== 'idle') {
        // Busy reacting — check again later (via ref to satisfy the
        // react-hooks/immutability rule about self-reference).
        if (armIdleTimerRef.current) armIdleTimerRef.current();
        return;
      }
      playThen('drowsy', 'sleeping', { waitMs: 8000, endMode: 'asleep' });
    }, IDLE_MS);
  }, [playThen, prefersReducedMotion]);

  useEffect(() => {
    armIdleTimerRef.current = armIdleTimer;
  }, [armIdleTimer, prefersReducedMotion]);

  const wake = useCallback(() => {
    if (prefersReducedMotion || dismissedRef.current) return;
    playThen('waking', 'idle', { waitMs: 3000 });
    armIdleTimer();
  }, [playThen, armIdleTimer, prefersReducedMotion]);

  // ---- entrance: waking -> idle, plus a one-time greeting bubble ----------
  useEffect(() => {
    if (dismissedRef.current) return undefined;
    if (prefersReducedMotion) return undefined;
    playThen('waking', 'idle', { waitMs: 3000 });
    armIdleTimer();
    if (!readSessionFlag(GREETED_KEY)) {
      const showAt = window.setTimeout(() => {
        writeSessionFlag(GREETED_KEY);
        setGreeting(true);
        greetHideRef.current = window.setTimeout(() => setGreeting(false), 6000);
      }, 3500);
      return () => window.clearTimeout(showAt);
    }
    return undefined;
  }, [playThen, armIdleTimer, prefersReducedMotion]);

  // ---- inactivity tracking: 30s idle -> drowsy/sleeping, activity wakes ----
  useEffect(() => {
    if (prefersReducedMotion) return undefined;
    const onActivity = () => {
      if (dismissedRef.current) return;
      const pending = pendingRef.current;
      if (modeRef.current === 'asleep') {
        wake();
        return;
      }
      if (pending && pending.next === 'sleeping') {
        // User came back mid-drowsy: cancel the nap.
        pendingRef.current = null;
        clearFallback();
        modeRef.current = 'idle';
        play('idle');
      }
      armIdleTimer();
    };
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    return () => {
      events.forEach((event) => window.removeEventListener(event, onActivity));
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      if (greetHideRef.current) window.clearTimeout(greetHideRef.current);
      clearFallback();
    };
  }, [wake, armIdleTimer, play, clearFallback, prefersReducedMotion]);

  // ---- wire reactions inside the marketing iframe (same-origin) ------------
  useEffect(() => {
    if (prefersReducedMotion || dismissedRef.current) return undefined;
    const frame = frameRef && frameRef.current;
    if (!frame) return undefined;

    let observer = null;
    const cleanups = [];

    const wireDocument = (doc) => {
      // Hover / tap on primary CTAs -> excited.
      doc.querySelectorAll('.btn-primary').forEach((button) => {
        if (button.dataset.gennyBound === '1') return;
        button.dataset.gennyBound = '1';
        const onOver = () => react('excited');
        const onOut = () => {
          if (modeRef.current === 'idle') play('idle');
        };
        button.addEventListener('mouseenter', onOver);
        button.addEventListener('mouseleave', onOut);
        button.addEventListener('click', onOver);
        cleanups.push(() => {
          button.removeEventListener('mouseenter', onOver);
          button.removeEventListener('mouseleave', onOut);
          button.removeEventListener('click', onOver);
          delete button.dataset.gennyBound;
        });
      });

      // Contact page (Webflow form): success -> celebrate, error -> confused.
      const form = doc.querySelector('.w-form');
      if (form && !observer) {
        const seen = { done: false, failAt: 0 };
        observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            const target = mutation.target;
            if (!(target instanceof Element) || !target.closest('.w-form')) continue;
            const doneEl = form.querySelector('.w-form-done');
            const failEl = form.querySelector('.w-form-fail');
            const visible = (el) =>
              el && el.style.display !== 'none' && el.offsetParent !== null;
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
        });
        observer.observe(form, {
          attributes: true,
          subtree: true,
          attributeFilter: ['style', 'class'],
        });
      }
    };

    const wireFrame = () => {
      if (wiredSrcRef.current === pageSrc) return;
      wiredSrcRef.current = pageSrc;
      try {
        const doc = frame.contentDocument;
        if (doc) wireDocument(doc);
      } catch {
        // Cross-origin frame: reactions stay off, mascot still idles.
      }
    };

    frame.addEventListener('load', wireFrame);
    try {
      if (frame.contentDocument && frame.contentDocument.readyState === 'complete') {
        wireFrame();
      }
    } catch {
      /* ignore */
    }

    return () => {
      frame.removeEventListener('load', wireFrame);
      cleanups.forEach((fn) => fn());
      if (observer) observer.disconnect();
    };
  }, [frameRef, pageSrc, react, play, prefersReducedMotion]);

  const onMascotClick = useCallback(() => {
    setGreeting(false);
    if (greetHideRef.current) window.clearTimeout(greetHideRef.current);
    if (dismissedRef.current || prefersReducedMotion) return;
    if (modeRef.current === 'asleep') {
      wake();
      return;
    }
    react('laughing');
    armIdleTimer();
  }, [react, wake, armIdleTimer, prefersReducedMotion]);

  const onDismiss = useCallback((event) => {
    event.stopPropagation();
    writeSessionFlag(DISMISS_KEY);
    dismissedRef.current = true;
    pendingRef.current = null;
    clearFallback();
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    setGreeting(false);
    setDismissed(true);
  }, [clearFallback]);

  if (!GennyAvatar || dismissed) return null;

  const still = prefersReducedMotion;

  return (
    <div className="lmsgen-mascot" aria-hidden={false}>
      {greeting && !still && (
        <div className="lmsgen-mascot-bubble" role="status">
          Hi, I&rsquo;m Genny!
        </div>
      )}
      <button
        type="button"
        className="lmsgen-mascot-btn"
        onClick={onMascotClick}
        aria-label="Genny, the LMSGEN mascot. Select to make Genny laugh."
        title="Genny"
      >
        <GennyAvatar
          ref={controllerRef}
          defaultAnimation={still ? undefined : 'idle'}
          defaultExpression={still ? 'neutral' : undefined}
          size="100%"
          ariaLabel="Genny, the LMSGEN mascot"
          onAnimationEnd={handleAnimationEnd}
          onError={(error) => {
            if (import.meta.env.DEV) console.warn('[mascot]', error);
          }}
        />
      </button>
      <button
        type="button"
        className="lmsgen-mascot-dismiss"
        onClick={onDismiss}
        aria-label="Hide Genny the mascot for this visit"
        title="Hide"
      >
        ×
      </button>
    </div>
  );
}
