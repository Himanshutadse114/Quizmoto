function parsedSeconds(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  const scorm12 = text.match(/^(\d+):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (scorm12) {
    const hours = Number(scorm12[1]);
    const minutes = Number(scorm12[2]);
    const seconds = Number(`${scorm12[3]}.${scorm12[4] || 0}`);
    return hours * 3600 + minutes * 60 + seconds;
  }

  const iso = text.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!iso) return null;
  const days = Number(iso[1] || 0);
  const hours = Number(iso[2] || 0);
  const minutes = Number(iso[3] || 0);
  const seconds = Number(iso[4] || 0);
  if (![days, hours, minutes, seconds].every(Number.isFinite)) return null;
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

export function formatScormDuration(value) {
  const parsed = parsedSeconds(value);
  if (parsed == null) return '—';

  const totalSeconds = Math.max(0, Math.floor(parsed));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

