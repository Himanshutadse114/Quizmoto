const { test, expect } = require('@playwright/test');
const { routes, workspace } = require('./platform-spacing-fixtures.cjs');

async function palette(page, theme) {
  return page.locator(theme === 'light' ? '.scorm-editorial.scorm-theme-light, .scorm-auth-workbench.scorm-theme-light' : '.scorm-editorial.scorm-theme-dark, .scorm-auth-workbench.scorm-theme-dark').evaluate(shell => {
    const style = getComputedStyle(shell);
    const auth = shell.classList.contains('scorm-auth-workbench');
    return {
      canvas: style.getPropertyValue(auth ? '--sa-bg' : '--scorm-canvas').trim().toLowerCase(),
      ink: style.getPropertyValue(auth ? '--sa-cream' : '--scorm-ink').trim().toLowerCase(),
      accent: style.getPropertyValue(auth ? '--sa-orange' : '--scorm-accent').trim().toLowerCase(),
      overflow: document.documentElement.scrollWidth > innerWidth,
      headingSize: getComputedStyle(shell.querySelector('h1,h2,.qe-heading,.sa-form-title')).fontSize,
    };
  });
}

for (const theme of ['light', 'dark']) for (const width of [390, 1440]) test(`original ${theme} palette preserves current workspace layouts at ${width}px`, async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width, height: 960 });
  await workspace(page, theme);
  const findings = [];
  for (const path of routes) {
    await page.goto(path);
    await page.waitForFunction(() => [...document.querySelectorAll('#workspace-content h1, #workspace-content h2, #workspace-content .qe-heading')].some(el => el.getBoundingClientRect().height));
    const result = await palette(page, theme);
    findings.push({ path, ...result });
    expect(result.canvas, path).toBe(theme === 'light' ? '#f4f8f7' : '#0a0f0e');
    expect(result.ink, path).toBe(theme === 'light' ? '#14201e' : '#edf4f2');
    expect(result.accent, path).toBe('#4fc9bf');
    expect(result.overflow, path).toBe(false);
    if (['/scorm/roster', '/scorm/publica', '/scorm/quizmoto/create', '/scorm/settings'].includes(path)) await page.screenshot({ path: testInfo.outputPath(path.replaceAll('/', '_') + '.png'), fullPage: true });
  }
  await testInfo.attach('original-palette-audit', { body: JSON.stringify(findings, null, 2), contentType: 'application/json' });
});

for (const theme of ['light', 'dark']) test(`sign-in and registration retain the original ${theme} colours and compact forms`, async ({ page }, testInfo) => {
  await page.addInitScript(theme => localStorage.setItem('quizmoto_scorm_platform_theme', theme), theme);
  await page.route('**/api/**', route => route.fulfill({ status: 401, json: { message: 'Sign in required' } }));
  for (const path of ['/login', '/register']) {
    await page.goto(path);
    await expect(page.locator('.scorm-auth-workbench')).toBeVisible();
    const result = await palette(page, theme);
    expect(result.canvas, path).toBe(theme === 'light' ? '#f4f8f7' : '#0a0f0e');
    expect(result.ink, path).toBe(theme === 'light' ? '#14201e' : '#edf4f2');
    expect(result.overflow, path).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(path.slice(1) + '.png'), fullPage: true });
  }
});
