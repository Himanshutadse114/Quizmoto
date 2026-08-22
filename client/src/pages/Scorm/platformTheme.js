export const SCORM_PLATFORM_THEME_KEY = 'quizmoto_scorm_platform_theme';

export function readScormPlatformTheme() {
  if (typeof window === 'undefined') return 'dark';
  try {
    return window.localStorage.getItem(SCORM_PLATFORM_THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch (_) {
    return 'dark';
  }
}

export function applyScormPlatformTheme(theme) {
  if (typeof document === 'undefined') return;
  const normalized = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.scormTheme = normalized;
  document.body.classList.toggle('scorm-platform-light', normalized === 'light');
  document.body.classList.toggle('scorm-platform-dark', normalized === 'dark');
}

export function saveScormPlatformTheme(theme) {
  const normalized = theme === 'light' ? 'light' : 'dark';
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(SCORM_PLATFORM_THEME_KEY, normalized); } catch (_) {}
  }
  applyScormPlatformTheme(normalized);
  return normalized;
}
