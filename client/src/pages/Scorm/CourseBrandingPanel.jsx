import { ImagePlus, RotateCcw, X } from 'lucide-react';

const DEFAULT_BRANDING = Object.freeze({
  logoDataUrl: '',
  primaryColor: '#177E78',
  accentColor: '#8EDDD5'
});

function validHex(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '').trim());
}

function normaliseHex(value, fallback) {
  const clean = String(value || '').trim();
  return validHex(clean) ? clean.toUpperCase() : fallback;
}

function readLogo(file, onReady, onError) {
  if (!file) return;
  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.type)) {
    onError('Use a PNG, JPEG or WebP logo.');
    return;
  }
  if (file.size > 1024 * 1024) {
    onError('Use a logo smaller than 1 MB.');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => onReady(String(reader.result || ''));
  reader.onerror = () => onError('The selected logo could not be read.');
  reader.readAsDataURL(file);
}

export { DEFAULT_BRANDING };

export default function CourseBrandingPanel({ value, onChange, error, onError }) {
  const branding = { ...DEFAULT_BRANDING, ...(value || {}) };

  const patch = (next) => onChange?.({ ...branding, ...next });
  const setColour = (key, raw, fallback) => patch({ [key]: normaliseHex(raw, fallback) });

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--scorm-surface-soft)', borderColor: 'var(--scorm-line)' }}>
      <div className="px-4 md:px-5 py-4 border-b flex items-start justify-between gap-4" style={{ borderColor: 'var(--scorm-line)' }}>
        <div>
          <div className="scorm-micro text-[9px] uppercase font-semibold">Course branding</div>
          <div className="text-sm font-semibold mt-1" style={{ color: 'var(--scorm-ink)' }}>Add your logo and colours</div>
          <div className="text-[11px] leading-relaxed mt-1" style={{ color: 'var(--scorm-muted)' }}>
            Branding is embedded into the learner course and remains inside the downloaded SCORM package.
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange?.({ ...DEFAULT_BRANDING })}
          className="scorm-button-secondary h-9 px-3 inline-flex items-center gap-2 text-[10px] font-semibold shrink-0"
        >
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      <div className="p-4 md:p-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.9fr)] gap-5">
        <div className="space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-[.08em] font-semibold mb-2" style={{ color: 'var(--scorm-muted)' }}>Company logo</div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="scorm-button-secondary h-11 px-4 inline-flex items-center gap-2 text-[11px] font-semibold cursor-pointer">
                <ImagePlus size={15} />
                {branding.logoDataUrl ? 'Replace logo' : 'Upload logo'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    readLogo(
                      file,
                      (logoDataUrl) => {
                        onError?.('');
                        patch({ logoDataUrl });
                      },
                      (message) => onError?.(message)
                    );
                    event.target.value = '';
                  }}
                />
              </label>
              {branding.logoDataUrl && (
                <button
                  type="button"
                  onClick={() => patch({ logoDataUrl: '' })}
                  className="h-11 px-3 rounded-lg border inline-flex items-center gap-2 text-[11px] font-semibold"
                  style={{ borderColor: 'var(--scorm-line)', color: 'var(--scorm-muted)' }}
                >
                  <X size={14} /> Remove
                </button>
              )}
            </div>
            <div className="text-[10px] mt-2" style={{ color: error ? 'var(--scorm-danger)' : 'var(--scorm-muted)' }}>
              {error || 'PNG, JPEG or WebP. Maximum 1 MB. Transparent PNG works best.'}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ['primaryColor', 'Primary colour', DEFAULT_BRANDING.primaryColor],
              ['accentColor', 'Accent colour', DEFAULT_BRANDING.accentColor]
            ].map(([key, label, fallback]) => (
              <label key={key} className="block">
                <span className="text-[10px] uppercase tracking-[.08em] font-semibold" style={{ color: 'var(--scorm-muted)' }}>{label}</span>
                <div className="mt-2 h-11 rounded-lg border flex items-center gap-2 px-2" style={{ background: 'var(--scorm-surface)', borderColor: 'var(--scorm-line)' }}>
                  <input
                    type="color"
                    value={normaliseHex(branding[key], fallback)}
                    onChange={(event) => patch({ [key]: event.target.value.toUpperCase() })}
                    className="w-8 h-8 rounded border-0 bg-transparent p-0 cursor-pointer"
                    aria-label={label}
                  />
                  <input
                    type="text"
                    value={branding[key]}
                    maxLength={7}
                    onChange={(event) => patch({ [key]: event.target.value })}
                    onBlur={() => setColour(key, branding[key], fallback)}
                    className="min-w-0 flex-1 bg-transparent outline-none text-xs font-semibold uppercase"
                    style={{ color: 'var(--scorm-ink)' }}
                    aria-label={`${label} hex value`}
                  />
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[.08em] font-semibold mb-2" style={{ color: 'var(--scorm-muted)' }}>Live preview</div>
          <div className="rounded-xl border overflow-hidden min-h-[188px]" style={{ background: '#F6F9F8', borderColor: 'var(--scorm-line)' }}>
            <div className="h-12 px-3 flex items-center gap-3 border-b" style={{ borderColor: '#DCE7E4', background: '#FFFFFF' }}>
              {branding.logoDataUrl ? (
                <img src={branding.logoDataUrl} alt="Brand preview" className="max-w-[92px] max-h-7 object-contain" />
              ) : (
                <div className="w-7 h-7 rounded-md grid place-items-center text-[10px] font-bold text-white" style={{ background: normaliseHex(branding.primaryColor, DEFAULT_BRANDING.primaryColor) }}>LOGO</div>
              )}
              <div className="h-2 w-24 rounded-full" style={{ background: '#DCE7E4' }} />
              <div className="ml-auto h-1.5 w-20 rounded-full overflow-hidden" style={{ background: '#DCE7E4' }}>
                <div className="h-full w-[62%]" style={{ background: normaliseHex(branding.primaryColor, DEFAULT_BRANDING.primaryColor) }} />
              </div>
            </div>
            <div className="p-4">
              <div className="text-[8px] uppercase tracking-[.1em] font-bold" style={{ color: normaliseHex(branding.primaryColor, DEFAULT_BRANDING.primaryColor) }}>Learning section</div>
              <div className="h-3 w-3/4 rounded-full mt-3" style={{ background: '#233735' }} />
              <div className="h-2 w-full rounded-full mt-3" style={{ background: '#C8D6D3' }} />
              <div className="h-2 w-4/5 rounded-full mt-2" style={{ background: '#C8D6D3' }} />
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="h-10 rounded-lg border" style={{ background: '#FFFFFF', borderColor: normaliseHex(branding.accentColor, DEFAULT_BRANDING.accentColor) }} />
                <div className="h-10 rounded-lg" style={{ background: `${normaliseHex(branding.primaryColor, DEFAULT_BRANDING.primaryColor)}18` }} />
              </div>
              <div className="mt-4 flex justify-end">
                <div className="h-8 min-w-20 px-3 rounded-lg grid place-items-center text-[9px] font-bold text-white" style={{ background: normaliseHex(branding.primaryColor, DEFAULT_BRANDING.primaryColor) }}>Continue</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
