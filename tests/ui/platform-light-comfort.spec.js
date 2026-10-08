const { test, expect } = require('@playwright/test');
const { routes, workspace } = require('./platform-spacing-fixtures.cjs');

async function palette(page) {
  return page.locator('.scorm-editorial.scorm-theme-light, .scorm-auth-workbench.scorm-theme-light').evaluate(shell => {
    const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = color => rgb(color).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const visible = el => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
    const style = getComputedStyle(shell);
    const colors = shell.classList.contains('scorm-editorial')
      ? ['--scorm-ink', '--scorm-ink-soft', '--scorm-muted', '--scorm-subtle', '--scorm-accent-strong'].map(key => style.getPropertyValue(key).trim())
      : ['--sa-cream', '--sa-cream-soft', '--sa-soft', '--sa-muted', '--sa-muted-deep', '--sa-orange-strong'].map(key => style.getPropertyValue(key).trim());
    const asRgb = hex => `rgb(${hex.match(/[a-f\d]{2}/gi).map(v => parseInt(v, 16)).join(',')})`;
    const surfaces = ['#fbfcfa', '#f2f5f1', '#edf2eb', '#e4eee7'];
    const buttons = [...shell.querySelectorAll('.scorm-button-primary:not(:disabled), .sa-submit:not(:disabled), .flip-button-primary:not(.is-disabled), .qe-save:not(:disabled), .qc-generate:not(:disabled)')].filter(visible).map(el => {
      const css = getComputedStyle(el);
      return { text: el.textContent.trim(), background: css.backgroundColor, color: css.color, contrast: contrast(css.color, css.backgroundColor) };
    });
    return {
      background: style.backgroundColor,
      ratios: colors.flatMap(color => surfaces.map(surface => contrast(asRgb(color), asRgb(surface)))),
      buttons,
      overflow: document.documentElement.scrollWidth > innerWidth,
      canvas: style.getPropertyValue('--scorm-canvas').trim(),
      ink: style.getPropertyValue('--scorm-ink').trim(),
      panels: [...shell.querySelectorAll('.scorm-panel, .sa-card')].filter(visible).map(el => ({ background: getComputedStyle(el).backgroundColor, shadow: getComputedStyle(el).boxShadow })),
    };
  });
}

for (const width of [390, 1440]) test(`calm light palette and readable hierarchy across workspace pages at ${width}px`, async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width, height: 960 });
  await workspace(page, 'light');
  const findings = [];
  for (const path of routes) {
    await page.goto(path);
    await page.waitForFunction(() => [...document.querySelectorAll('#workspace-content h1, #workspace-content h2, #workspace-content .qe-heading')].some(el => el.getBoundingClientRect().height));
    const result = await palette(page);
    findings.push({ path, ...result });
    expect(result.canvas, path).toBe('#f2f5f1');
    expect(result.ink, path).toBe('#2b3b36');
    expect(Math.min(...result.ratios), path).toBeGreaterThanOrEqual(4.5);
    expect(result.buttons.filter(button => button.contrast < 4.5), path).toEqual([]);
    expect(result.overflow, path).toBe(false);
    if (['/scorm/roster', '/scorm/publica', '/scorm/quizmoto/create', '/scorm/settings'].includes(path)) await page.screenshot({ path: testInfo.outputPath(path.replaceAll('/', '_') + '.png'), fullPage: true });
  }
  await testInfo.attach('light-palette-audit', { body: JSON.stringify(findings, null, 2), contentType: 'application/json' });
});

test('sign-in and registration use the same calm light palette', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('quizmoto_scorm_platform_theme', 'light'));
  await page.route('**/api/**', route => route.fulfill({ status: 401, json: { message: 'Sign in required' } }));
  for (const path of ['/login', '/register']) {
    await page.goto(path);
    await expect(page.locator('.scorm-auth-workbench.scorm-theme-light')).toBeVisible();
    const result = await palette(page);
    expect(result.background, path).toBe('rgb(242, 245, 241)');
    expect(Math.min(...result.ratios), path).toBeGreaterThanOrEqual(4.5);
    expect(result.buttons.filter(button => button.contrast < 4.5), path).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(path.slice(1) + '.png'), fullPage: true });
  }
});
