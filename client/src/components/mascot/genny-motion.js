// Follow accessibility settings unless the user explicitly chooses eye motion.
export const GENNY_MOTION_KEY = 'lmsgen-genny-motion';
export function readMotionPreference(win) {
  try {
    const value = win.localStorage.getItem(GENNY_MOTION_KEY);
    return ['on', 'off'].includes(value) ? value : 'auto';
  } catch { return 'auto'; }
}
export function motionEnabled(preference, reduced) {
  return preference === 'on' || (preference !== 'off' && !reduced);
}
