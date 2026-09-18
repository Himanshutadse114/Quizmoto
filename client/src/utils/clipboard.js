const FEEDBACK_EVENT = 'lmsgen:clipboard-feedback';

function announce(type, message) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FEEDBACK_EVENT, { detail: { type, message } }));
}

function legacyCopy(value) {
  if (typeof document === 'undefined') return false;
  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';
  document.body.appendChild(input);
  input.focus();
  input.select();
  input.setSelectionRange(0, input.value.length);
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { copied = false; }
  document.body.removeChild(input);
  return copied;
}

export async function copyText(value, options = {}) {
  const text = String(value || '');
  const successMessage = options.successMessage || 'Link copied.';
  const errorMessage = options.errorMessage || 'Could not copy the link.';

  try {
    if (!text) throw new Error('Nothing to copy');
    let copied = false;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        copied = legacyCopy(text);
      }
    } else {
      copied = legacyCopy(text);
    }
    if (!copied) throw new Error('Clipboard unavailable');
    announce('success', successMessage);
    return true;
  } catch (error) {
    announce('error', errorMessage);
    throw error;
  }
}

export { FEEDBACK_EVENT };
