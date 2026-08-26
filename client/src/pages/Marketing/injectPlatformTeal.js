export function injectPlatformTeal(doc) {
  if (!doc?.documentElement) return;

  const STYLE_ID = 'atelora-platform-teal';
  const css = `
:root{
  --scorm-platform-teal:#4FC9BF;
  --scorm-platform-teal-strong:#7BDCD3;
  --scorm-platform-teal-hover:#9BE8E1;
  --scorm-platform-teal-dark:#06201E;
}
html{accent-color:#4FC9BF;}
a,button,input,select,textarea{accent-color:#4FC9BF;}
::selection{background:rgba(79,201,191,.28);color:#06201E;}
a[href="/login"],
a[data-atelora-login-cta="1"],
button[data-atelora-login-cta="1"]{
  background:#4FC9BF !important;
  background-image:none !important;
  border-color:#7BDCD3 !important;
  color:#06201E !important;
}
a[href="/login"]:hover,
a[data-atelora-login-cta="1"]:hover{
  background:#7BDCD3 !important;
  color:#06201E !important;
}
`;

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
    [/#bfeff1/gi, '#D9F5F1'],
    [/#cfe8ff/gi, '#D9F5F1'],
    [/#cfeeff/gi, '#D9F5F1'],
    [/#dff3ff/gi, '#E8F7F5'],
    [/#2cc9bf/gi, '#4FC9BF'],
    [/#19b7ad/gi, '#4FC9BF'],
    [/#35d4ca/gi, '#7BDCD3'],
    [/#35cbd0/gi, '#4FC9BF'],
    [/#2abdc5/gi, '#4FC9BF'],
    [/#17978d/gi, '#4FC9BF'],
    [/#8ae6e7/gi, '#7BDCD3'],
    [/rgb\(\s*88\s*,\s*213\s*,\s*209\s*\)/gi, 'rgb(79, 201, 191)'],
    [/rgb\(\s*59\s*,\s*175\s*,\s*197\s*\)/gi, 'rgb(79, 201, 191)'],
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
}
