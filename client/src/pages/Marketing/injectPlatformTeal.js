export function injectPlatformTeal(doc) {
  if (!doc?.documentElement) return;

  const STYLE_ID = 'atelora-platform-teal';
  const css = `
:root{color-scheme:dark;}
html,body{
  background:#0A0F0E !important;
  color:#EDF4F2 !important;
  color-scheme:dark !important;
  accent-color:#4FC9BF;
}
body,main,section,article,aside,header,nav,footer,[role="banner"],[role="dialog"],[aria-modal="true"]{
  background-color:#0A0F0E !important;
  color:#EDF4F2 !important;
}
h1,h2,h3,h4,h5,h6{color:#F4FBFA !important;}
p,small,figcaption{color:#A9BAB6 !important;}
[data-atelora-navbar-guard]{display:none !important;}
[data-atelora-logo],[data-atelora-footer-logo],header img,nav img{
  background:transparent !important;
}
::selection{background:rgba(79,201,191,.28);color:#06201E;}
a[href="/login"],
a[data-atelora-login-cta="1"],
button[data-atelora-login-cta="1"]{
  background:#4FC9BF !important;
  background-image:none !important;
  border-color:#7BDCD3 !important;
  color:#06201E !important;
}
`;

  doc.documentElement.style.colorScheme = 'dark';
  doc.documentElement.style.background = '#0A0F0E';
  if (doc.body) {
    doc.body.style.background = '#0A0F0E';
    doc.body.style.color = '#EDF4F2';
  }

  let style = doc.getElementById(STYLE_ID);
  if (!style) {
    style = doc.createElement('style');
    style.id = STYLE_ID;
    (doc.head || doc.documentElement).appendChild(style);
  }
  style.textContent = css;

  if (!doc.querySelector('link[href="/atelora-platform-teal.css"]')) {
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/atelora-platform-teal.css';
    (doc.head || doc.documentElement).appendChild(link);
  }

  const map = [
    [/#58d5d1/gi, '#4FC9BF'],
    [/#5edad7/gi, '#7BDCD3'],
    [/#7ad8d2/gi, '#7BDCD3'],
    [/#3bafc5/gi, '#4FC9BF'],
    [/#a9dfff/gi, '#9BE8E1'],
    [/#bfeff1/gi, '#12201E'],
    [/#cfe8ff/gi, '#12201E'],
    [/#cfeeff/gi, '#12201E'],
    [/#dff3ff/gi, '#12201E'],
    [/#2cc9bf/gi, '#4FC9BF'],
    [/#19b7ad/gi, '#4FC9BF'],
    [/#35d4ca/gi, '#7BDCD3'],
    [/#35cbd0/gi, '#4FC9BF'],
    [/#2abdc5/gi, '#4FC9BF'],
    [/#17978d/gi, '#4FC9BF'],
    [/#8ae6e7/gi, '#7BDCD3'],
    [/#f8fafa/gi, '#0A0F0E'],
    [/#f7f9f8/gi, '#0A0F0E'],
    [/#f7fbfa/gi, '#0A0F0E'],
    [/#f6fafb/gi, '#0A0F0E'],
    [/#f6fafc/gi, '#0A0F0E'],
    [/#f5f9fb/gi, '#0A0F0E'],
    [/#f4f9fb/gi, '#0A0F0E'],
    [/#eff5f7/gi, '#0D1413'],
    [/#f3f7f9/gi, '#0D1413'],
    [/#f3f8fa/gi, '#0D1413'],
    [/#e9f3f4/gi, '#121A19'],
    [/#eef4f5/gi, '#121A19'],
    [/#ffffff/gi, '#0A0F0E'],
    [/#fff(?![0-9a-f])/gi, '#0A0F0E'],
    [/#d8dee2/gi, '#2C3835'],
    [/#394650/gi, '#C7D5D1'],
    [/#6e7a83/gi, '#A9BAB6'],
    [/#182128/gi, '#EDF4F2'],
    [/rgb\(\s*88\s*,\s*213\s*,\s*209\s*\)/gi, 'rgb(79, 201, 191)'],
    [/rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)/gi, 'rgb(10, 15, 14)'],
  ];

  const remap = (value) => {
    if (typeof value !== 'string' || !value) return value;
    return map.reduce((next, [from, to]) => next.replace(from, to), value);
  };

  doc.querySelectorAll('style').forEach((node) => {
    if (node.id === STYLE_ID) return;
    const next = remap(node.textContent || '');
    if (next !== node.textContent) node.textContent = next;
  });

  doc.querySelectorAll('[style]').forEach((el) => {
    const current = el.getAttribute('style');
    const next = remap(current);
    if (next !== current) el.setAttribute('style', next);
  });

  Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).forEach((link) => {
    if (link.dataset.ateloraTeal === '1') return;
    const href = link.getAttribute('href');
    if (!href || href.includes('atelora-platform-teal.css')) return;
    link.dataset.ateloraTeal = '1';
    fetch(href).then((res) => (res.ok ? res.text() : Promise.reject())).then((source) => {
      const next = remap(source);
      if (next === source) return;
      const override = doc.createElement('style');
      override.dataset.ateloraTealSheet = '1';
      override.textContent = next;
      link.after(override);
    }).catch(() => {});
  });

  const win = doc.defaultView;
  if (!win) return;

  const parseRgb = (value) => {
    const match = String(value || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return null;
    return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
  };
  const luma = ({ r, g, b }) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  doc.querySelectorAll('body, body *').forEach((el) => {
    const tag = el.tagName;
    if (tag === 'IMG' || tag === 'SVG' || tag === 'VIDEO' || tag === 'CANVAS' || tag === 'PATH') return;
    if (el.dataset?.ateloraLoginCta === '1' || el.closest?.('[data-atelora-login-cta="1"]')) return;

    const computed = win.getComputedStyle(el);
    const bg = parseRgb(computed.backgroundColor);
    if (bg && luma(bg) > 0.74) {
      const panel = el.clientWidth > 220 && el.clientHeight > 120;
      el.style.setProperty('background-color', panel ? '#121A19' : '#0A0F0E', 'important');
      el.style.setProperty('background-image', 'none', 'important');
    }

    const fg = parseRgb(computed.color);
    if (fg && luma(fg) < 0.55) {
      el.style.setProperty('color', '#EDF4F2', 'important');
    }
  });
}
