// Framework-independent affect model for Genny. Each behavior reuses the
// approved avatar geometry; only sequence, timing, blink and recovery change.
export const GENNY_EMOTION_PROFILES = {
  listening: { expressions: ['small-attentive', 'downward-gaze', 'gentle-downward-gaze'], durationMs: 1800, transitionMs: 220, transition: 'smooth', priority: 1, cooldownMs: 1200 },
  focused: { expressions: ['attentive-left', 'small-attentive', 'downward-gaze'], durationMs: 2200, transitionMs: 240, transition: 'smooth', priority: 1, cooldownMs: 1600 },
  searching: { expressions: ['far-right-glance', 'asymmetric-down-right', 'attentive-left', 'wide-down-left', 'asymmetric-up-left'], durationMs: 2200, transitionMs: 180, transition: 'smooth', priority: 1, cooldownMs: 1800 },
  curious: { expressions: ['surprised-left', 'upward-side-glance', 'far-right-glance'], durationMs: 1800, transitionMs: 180, transition: 'smooth', priority: 2, cooldownMs: 1000 },
  considering: { expressions: ['upward-side-glance', 'skeptical-left', 'curious-left'], durationMs: 2200, transitionMs: 260, transition: 'smooth', priority: 1, cooldownMs: 1800 },
  delighted: { expressions: ['surprised-wide-left', 'joyful-wide', 'joyful-down-right'], durationMs: 1900, transitionMs: 160, transition: 'snappy', priority: 2, recovery: 'grateful', cooldownMs: 2400 },
  grateful: { expressions: ['joyful-down-right', 'gentle-downward-gaze', 'eyes-closed'], durationMs: 2000, transitionMs: 240, transition: 'smooth', priority: 1, cooldownMs: 2600 },
  proud: { expressions: ['far-right-glance', 'curious-left', 'joyful-down-right'], durationMs: 1900, transitionMs: 200, transition: 'smooth', priority: 2, cooldownMs: 2000 },
  reassured: { expressions: ['uneasy-left', 'gentle-downward-gaze', 'joyful-down-right'], durationMs: 2100, transitionMs: 280, transition: 'smooth', priority: 2, cooldownMs: 2200 },
  relieved: { expressions: ['uneasy-left', 'eyes-closed', 'gentle-downward-gaze'], durationMs: 2300, transitionMs: 300, transition: 'smooth', priority: 2, cooldownMs: 2200 },
  surprised: { expressions: ['surprised-left', 'surprised-wide-left'], durationMs: 1400, transitionMs: 160, transition: 'snappy', priority: 3, recovery: 'curious', cooldownMs: 1800, blink: false },
  startled: { expressions: ['surprised-wide-left', 'wide-down-left', 'uneasy-left'], durationMs: 1600, transitionMs: 140, transition: 'snappy', priority: 4, recovery: 'cautious', cooldownMs: 2200, blink: false },
  cautious: { expressions: ['uneasy-left', 'suspicious-right', 'small-attentive'], durationMs: 2200, transitionMs: 260, transition: 'smooth', priority: 2, recovery: 'reassured', cooldownMs: 2200 },
  concerned: { expressions: ['uneasy-left', 'gentle-downward-gaze', 'small-attentive'], durationMs: 2400, transitionMs: 300, transition: 'smooth', priority: 3, recovery: 'reassured', cooldownMs: 2600 },
  disappointed: { expressions: ['wide-downward-gaze', 'shy-downward', 'gentle-downward-gaze'], durationMs: 2500, transitionMs: 320, transition: 'smooth', priority: 3, recovery: 'concerned', cooldownMs: 2800 },
  sad: { expressions: ['sleepy-squint', 'wide-downward-gaze', 'eyes-closed'], durationMs: 2800, transitionMs: 340, transition: 'smooth', priority: 3, recovery: 'reassured', cooldownMs: 3200 },
  bored: { expressions: ['sleepy-squint', 'drowsy-closed', 'upward-side-glance'], durationMs: 2400, transitionMs: 320, transition: 'smooth', priority: 0, cooldownMs: 7000 },
  impatient: { expressions: ['skeptical-right', 'upward-side-glance', 'angry-right'], durationMs: 1900, transitionMs: 190, transition: 'snappy', priority: 2, recovery: 'focused', cooldownMs: 3200 },
  frustrated: { expressions: ['skeptical-left', 'angry-left', 'uneasy-left'], durationMs: 2500, transitionMs: 210, transition: 'snappy', priority: 3, recovery: 'concerned', cooldownMs: 3200 },
  suspicious: { expressions: ['skeptical-left', 'skeptical-right', 'suspicious-right'], durationMs: 2300, transitionMs: 230, transition: 'smooth', priority: 2, cooldownMs: 2600 },
  angry: { expressions: ['angry-right', 'angry-left', 'angry-brows'], durationMs: 4000, transitionMs: 200, transition: 'snappy', priority: 4, recovery: 'embarrassed', cooldownMs: 5000, blink: false },
  afraid: { expressions: ['surprised-wide-left', 'uneasy-left', 'surprised-left'], durationMs: 4000, transitionMs: 200, transition: 'snappy', priority: 5, recovery: 'shy', cooldownMs: 3000, blink: false },
  shy: { expressions: ['upward-side-glance', 'shy-downward', 'eyes-closed'], durationMs: 2400, transitionMs: 200, transition: 'smooth', priority: 3, recovery: 'relieved', cooldownMs: 2200 },
  embarrassed: { expressions: ['angry-brows', 'shy-downward', 'eyes-closed'], durationMs: 2300, transitionMs: 280, transition: 'smooth', priority: 2, recovery: 'relieved', cooldownMs: 3000 },
  determined: { expressions: ['small-attentive', 'attentive-left', 'angry-right'], durationMs: 2200, transitionMs: 210, transition: 'smooth', priority: 2, recovery: 'focused', cooldownMs: 1800 },
};

export function createEmotionAnimation(source, profile) {
  const expressions = profile.expressions.filter((name) => source.expressions[name]);
  if (!expressions.length) return null;
  const transitionBudget = expressions.length * profile.transitionMs;
  const holdBudget = Math.max(expressions.length, profile.durationMs - transitionBudget);
  const holdMs = Math.floor(holdBudget / expressions.length);
  const remainder = holdBudget % expressions.length;
  return {
    playbackMode: 'once',
    blink: { ...source.animations.idle.blink, enabled: profile.blink !== false },
    steps: expressions.map((expression, index) => ({
      expression,
      holdMs: holdMs + (index < remainder ? 1 : 0),
      transitionMs: profile.transitionMs,
      transition: profile.transition,
    })),
  };
}

export function emotionDuration(animation) {
  return animation.steps.reduce((total, step) => total + step.holdMs + step.transitionMs, 0);
}
