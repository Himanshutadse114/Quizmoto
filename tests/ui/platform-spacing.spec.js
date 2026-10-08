const { test, expect } = require('@playwright/test');
const { identity, routes, workspace } = require('./platform-spacing-fixtures.cjs');

async function measurements(page) {
  return page.evaluate(() => {
    const visible = el => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
    const frame = document.querySelector('#workspace-content > .platform-route-frame');
    const root = [...frame.children].find(visible);
    const heading = [...frame.querySelectorAll('h1,h2,.qe-heading')].find(visible);
    const style = getComputedStyle(frame);
    const rect = frame.getBoundingClientRect();
    const contentLeft = rect.left + parseFloat(style.paddingLeft);
    return {
      frame: { width: rect.width, left: rect.left, padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft], maxWidth: style.maxWidth },
      root: { left: root.getBoundingClientRect().left, padding: getComputedStyle(root).padding, margin: getComputedStyle(root).margin, maxWidth: getComputedStyle(root).maxWidth },
      heading: { text: heading?.textContent, inset: heading ? Math.round(heading.getBoundingClientRect().left - contentLeft) : null },
      panels: [...frame.querySelectorAll('.scorm-panel')].filter(visible).filter(el => ['p-4', 'p-5', 'p-6', 'p-7'].some(name => el.classList.contains(name))).map(el => ({ padding: getComputedStyle(el).padding, text: el.textContent.slice(0, 40) })),
      panelContents: [...frame.querySelectorAll('.platform-panel-content')].filter(visible).map(el => getComputedStyle(el).padding),
      sectionGaps: [...frame.querySelectorAll('.platform-content-grid')].filter(visible).map(el => getComputedStyle(el).gap),
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
}

for (const [theme, width] of [['dark', 320], ['dark', 390], ['light', 390], ['dark', 1440], ['light', 1440], ['dark', 1920]]) {
  test(`${theme} shared page spacing across all workspace templates at ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 960 });
    await workspace(page, theme);
    const findings = [];
    for (const path of routes) {
      await test.step(path, async () => {
        await page.goto(path);
        await page.waitForFunction(() => [...document.querySelectorAll('#workspace-content h1,#workspace-content h2,#workspace-content .qe-heading')].some(el => el.getBoundingClientRect().height));
        const result = await measurements(page);
        findings.push({ path, ...result });
        expect(result.frame.padding, path).toEqual(width < 768 ? ['20px', '16px', '32px', '16px'] : ['24px', '28px', '40px', '28px']);
        expect(result.frame.maxWidth, path).toBe('1280px');
        expect(result.frame.width, path).toBeLessThanOrEqual(1280);
        expect(result.root.padding, path).toBe('0px');
        expect(result.root.maxWidth, path).toBe('none');
        expect(result.heading.inset, path).toBe(path.endsWith('/danger') ? (width < 768 ? 17 : 21) : 0);
        expect(result.panels.filter(panel => panel.padding !== (width < 768 ? '16px' : '20px')), path).toEqual([]);
        expect(result.panelContents.filter(padding => padding !== (width < 768 ? '16px' : '20px')), path).toEqual([]);
        expect(result.sectionGaps.filter(gap => gap !== (width < 768 ? '20px' : '24px')), path).toEqual([]);
        expect(result.overflow, path).toBe(false);
        if (['/scorm/reports', '/scorm/quizmoto/create', '/scorm/publica/new', '/scorm/access', '/scorm/team', '/scorm/settings'].includes(path)) {
          await page.screenshot({ path: testInfo.outputPath(path.replaceAll('/', '_') + '.png'), fullPage: true });
        }
      });
    }
    await testInfo.attach('spacing-audit', { body: JSON.stringify(findings, null, 2), contentType: 'application/json' });
  });
}

test('admin tab subpages share the page gutter instead of adding their own', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await workspace(page);
  await page.goto('/scorm/access');
  for (const tab of ['Tenant Management', 'Platform Users', 'Course Distribution', 'Publica Controls', 'Email Templates', 'Danger Zone']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    const section = page.locator('.platform-admin-section').first();
    await expect(section).toBeVisible();
    expect(await section.evaluate(el => [getComputedStyle(el).paddingLeft, getComputedStyle(el).paddingRight])).toEqual(['0px', '0px']);
  }
});

test('shared spacing does not change authored preview insets or public sign-in layouts', async ({ page, browser }) => {
  await workspace(page);
  await page.goto('/scorm');
  const insets = await page.evaluate(() => {
    const preview = document.createElement('div');
    preview.style.setProperty('--preview-primary', '#4fc9bf');
    preview.innerHTML = '<section class="scorm-panel p-6" style="padding:36px"><h2>Authored course preview</h2></section>';
    document.querySelector('.platform-route-frame').append(preview);
    const padding = getComputedStyle(preview.firstElementChild).padding;
    preview.remove();
    return padding;
  });
  expect(insets).toBe('36px');
  const publicPage = await browser.newPage();
  try {
    await publicPage.route('**/api/**', route => route.fulfill({ status: 401, json: { message: 'Sign in required' } }));
    for (const path of ['/login', '/register', '/learn']) {
      await publicPage.goto(`http://localhost:4173${path}`);
      await expect(publicPage.locator('body')).toContainText(/sign in|register|learner/i);
      await expect(publicPage.locator('.platform-route-frame')).toHaveCount(0);
    }
  } finally {
    await publicPage.close();
  }
});

for (const account of [
  { ...identity, role: 'admin', isSuperAdmin: false },
  { ...identity, role: 'analytics_viewer', isSuperAdmin: false },
  { ...identity, role: 'trial', trialAccess: true, scormAccess: false, isSuperAdmin: false },
]) test(`${account.role} uses the same layout in permitted pages and locked demos`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 960 });
  await workspace(page, 'light', account);
  for (const path of account.role === 'analytics_viewer' ? ['/scorm/tracking', '/scorm/reports'] : ['/scorm', '/scorm/author', '/scorm/courses', '/scorm/quizmoto', '/scorm/publica']) {
    await page.goto(path);
    await page.waitForFunction(() => [...document.querySelectorAll('#workspace-content h1,#workspace-content h2')].some(el => el.getBoundingClientRect().height));
    const result = await measurements(page);
    expect(result.root.padding, path).toBe('0px');
    expect(result.frame.padding, path).toEqual(['20px', '16px', '32px', '16px']);
    expect(result.heading.inset, path).toBe(0);
    expect(result.overflow, path).toBe(false);
  }
});
