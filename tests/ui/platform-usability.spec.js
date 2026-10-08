const { test, expect } = require('@playwright/test');
const { renderFlipbookReader } = require('../../server/views/flipbookReader');

const identity = { username: 'Audit workspace', email: 'audit@example.com', role: 'super_admin', isSuperAdmin: true, scormAccess: true, platformAccess: true };
async function workspace(page, theme = 'dark', account = identity) {
  await page.addInitScript(({ identity, theme }) => {
    localStorage.setItem('token', 'ui-fixture');
    localStorage.setItem('user', JSON.stringify(identity));
    localStorage.setItem('scormAccessGranted', '1');
    localStorage.setItem('scormPlatformAccess', '1');
    localStorage.setItem('quizmoto_scorm_platform_theme', theme);
  }, { identity: account, theme });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    let data = { users: [], roster: [], groups: [], courses: [], packages: [], features: {}, summary: {}, overview: {} };
    if (path.endsWith('/auth/scorm/status')) data = { ...account, token: 'ui-fixture' };
    if (path.endsWith('/courses') || path.endsWith('/packages')) data = [];
    if (path.endsWith('/flipbooks')) data = { flipbooks: [], quota: { max: 2, used: 0 } };
    if (path.endsWith('/flipbooks/library')) data = { library: { books: [], enabled: false } };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
}

for (const theme of ['dark', 'light']) for (const width of [320, 390, 1440]) {
  test(`${theme} header search navigates platform pages at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await workspace(page, theme);
    await page.goto('/scorm/roster');
    const search = page.getByRole('searchbox', { name: 'Search platform pages' });
    await expect(search).toBeVisible();
    await page.locator('header.scorm-topbar').screenshot({ path: testInfo.outputPath('header-search.png') });
    if (width === 1440) {
      const searchBox = await search.boundingBox();
      const themeBox = await page.getByRole('button', { name: /Switch to .* theme/ }).boundingBox();
      expect(searchBox.x + searchBox.width).toBeLessThan(themeBox.x);
    }
    await search.fill('publica');
    await page.getByRole('navigation', { name: 'Search results', exact: true }).getByRole('link', { name: 'Publica' }).click();
    await expect(page).toHaveURL(/\/scorm\/publica$/);
    await expect(search).toHaveValue('');
    await search.fill('not-a-platform-page');
    await expect(page.getByRole('status').filter({ hasText: 'No matching pages' })).toBeVisible();
    await search.press('Escape');
    await expect(search).toHaveValue('');
    await search.fill('roster');
    await search.press('Enter');
    await expect(page).toHaveURL(/\/scorm\/roster$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('analytics header search does not expose administration or authoring pages', async ({ page }) => {
  await workspace(page, 'dark', { ...identity, role: 'analytics_viewer', isSuperAdmin: false });
  await page.goto('/scorm/tracking');
  const search = page.getByRole('searchbox', { name: 'Search platform pages' });
  for (const query of ['tenant', 'danger', 'author', 'roster']) {
    await search.fill(query);
    await expect(page.getByRole('status').filter({ hasText: 'No matching pages' })).toBeVisible();
  }
  await search.fill('reports');
  await expect(page.getByRole('navigation', { name: 'Search results', exact: true }).getByRole('link', { name: 'Reports & Insights' })).toBeVisible();
});

for (const theme of ['dark', 'light']) for (const width of [390, 1440]) test(`${theme} uploaded SCORM package can be renamed at ${width}px without replacing files`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await workspace(page, theme);
  let title = 'Uploaded security course';
  let failSave = true;
  let saves = 0;
  const pkg = () => ({ id: 'uploaded-package', title, source: 'upload', status: 'ready', fileCount: 13, entryHref: 'index.html' });
  await page.route('**/api/scorm/packages', route => route.fulfill({ json: [pkg()] }));
  await page.route('**/api/scorm/packages/uploaded-package', route => {
    expect(route.request().method()).toBe('PATCH');
    saves++;
    if (failSave) return route.fulfill({ status: 503, json: { message: 'Saving temporarily unavailable' } });
    expect(Object.keys(route.request().postDataJSON())).toEqual(['title']);
    title = route.request().postDataJSON().title;
    return route.fulfill({ json: { id: 'uploaded-package', title } });
  });
  await page.goto('/scorm/library');
  const rename = page.getByRole('button', { name: 'Rename Uploaded security course', exact: true });
  await rename.click();
  const input = page.getByLabel('Package name', { exact: true });
  await expect(input).toBeFocused();
  await input.fill('Changed but cancelled');
  await input.press('Escape');
  await expect(rename).toBeFocused();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  expect(saves).toBe(0);
  await rename.click();
  await input.fill('');
  await expect(page.getByRole('button', { name: 'Save name', exact: true })).toBeDisabled();
  await input.fill('New SCORM name');
  await page.getByRole('button', { name: 'Save name', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Saving temporarily unavailable' })).toBeVisible();
  await expect(input).toHaveValue('New SCORM name');
  await page.locator('.scorm-course-rows').screenshot({ path: testInfo.outputPath('package-rename-form.png') });
  failSave = false;
  await page.getByRole('button', { name: 'Save name', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'New SCORM name', exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Package renamed' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'New SCORM name', exact: true })).toBeVisible();
  await expect(page.getByText('index.html', { exact: true })).toBeVisible();
  expect(saves).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.scorm-course-rows').screenshot({ path: testInfo.outputPath('package-renamed.png') });
});

test('password visibility keeps the entered password and never submits the form', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await page.goto('/login');
  const password = page.locator('input[autocomplete="current-password"]');
  await password.fill('private-fixture');
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('private-fixture');
  await page.getByRole('button', { name: 'Hide password', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await expect(page).toHaveURL(/\/login$/);
});

test('reader identification traps focus and releases the book after sign-in', async ({ page }) => {
  process.env.NODE_ENV = 'test';
  const { trackingInjection } = require('../../server/routes/flipbookAnalytics');
  const injected = trackingInjection('gate-fixture');
  const reader = renderFlipbookReader({ title: 'Gate fixture', shareToken: 'gate-fixture', pageCount: 0 });
  await page.route('**/gate-fixture', route => route.fulfill({ contentType: 'text/html', body: reader.replace('</head>', injected.style + '</head>').replace('</body>', injected.html + injected.script + '</body>') }));
  await page.route('**/api/**', route => route.fulfill({ json: { sessionToken: 'fixture', readerEmail: 'reader@example.com' } }));
  await page.goto('/gate-fixture');
  const dialog = page.getByRole('dialog', { name: 'Open this publication' });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeFocused();
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.getByLabel('Email address').fill('reader@example.com');
  await page.getByRole('button', { name: 'Open publication', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(await page.locator('.reader-shell').evaluate(el => el.inert)).toBe(false);
});

test('mobile navigation traps focus and restores it after Escape', async ({ page }) => {
  await workspace(page);
  await page.goto('/scorm/roster');
  const trigger = page.getByRole('button', { name: 'Open LMSGEN navigation' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Workspace navigation' });
  await expect(dialog).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  for (let i = 0; i < 30; i++) await page.keyboard.press('Tab');
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeAttached();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('Publica failure has retry and does not claim the library is empty', async ({ page }) => {
  await workspace(page);
  let fail = true;
  await page.route('**/api/scorm/flipbooks', route => route.fulfill(fail
    ? { status: 503, json: { message: 'Publications temporarily unavailable' } }
    : { json: { flipbooks: [], quota: { max: 2, used: 0 } } }));
  await page.goto('/scorm/publica');
  await expect(page.getByRole('alert').filter({ hasText: 'Publications temporarily unavailable' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Create your first publication' })).not.toBeVisible();
  await expect(page.getByText(/of undefined/)).not.toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Create your first publication' })).toBeVisible();
});

test('user Publica limits live in Tenant Management, not the publication library', async ({ page }) => {
  await workspace(page);
  let limit = 2;
  let patches = 0;
  await page.route('**/flipbooks/admin/users**', route => {
    if (route.request().method() === 'PATCH') {
      patches++;
      limit = route.request().postDataJSON().maxFlipbooks;
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: { users: [{ id: 2, username: 'Sample account', email: 'member@example.com', quota: { max: limit, used: 1 } }] } });
  });
  await page.goto('/scorm/publica');
  await expect(page.getByRole('heading', { name: 'User Publica limits' })).not.toBeVisible();
  await page.goto('/scorm/access');
  await page.getByRole('button', { name: 'Publica Controls', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'User Publica limits' })).toBeVisible();
  await page.getByLabel('Publica limit for member@example.com', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Save Publica limit for member@example.com', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'allowance updated' })).toBeVisible();
  expect(limit).toBeNull();
  expect(patches).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const theme of ['dark', 'light']) test(`${theme} mobile roster has usable form labels and fits the viewport`, async ({ page }) => {
  await workspace(page, theme);
  await page.goto('/scorm/roster');
  await page.getByLabel(/^Name/).fill('Sample learner');
  await page.getByLabel('Email', { exact: true }).fill('learner@example.com');
  await expect(page.getByLabel('Search learners by name or email')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('main h1').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBe(22);
  expect(await page.locator('main p').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBe(14);
});

for (const width of [320, 390, 768, 1440]) test(`dark Publica reader fits ${width}px and keeps working page navigation`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 844 });
  const book = { title: 'Reader fixture', shareToken: 'ui-fixture', pageCount: 4, pages: Array.from({ length: 4 }, () => ({ width: 1200, height: 1600 })) };
  await page.route('**/reader-fixture', route => route.fulfill({ contentType: 'text/html', body: renderFlipbookReader(book) }));
  await page.route('**/api/**', route => route.fulfill(route.request().url().includes('/pages/')
    ? { contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600"><rect width="1200" height="1600" fill="#163648"/><text x="90" y="180" fill="#fff" font-size="72">Publica reading demo</text><text x="90" y="300" fill="#73e5da" font-size="42">Original publication colours</text></svg>' }
    : { status: 200, body: '' }));
  await page.goto('/reader-fixture');
  await expect(page.locator('#book')).toHaveClass(/is-ready/);
  expect(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(8, 15, 24)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (width < 768) {
    expect(await page.locator('.control-dock').evaluate(el => el.getBoundingClientRect().height)).toBeLessThanOrEqual(112);
    for (const id of ['prevBtn', 'nextBtn', 'shareBtn', 'fullBtn']) expect(await page.locator('#' + id).evaluate(el => el.getBoundingClientRect().height)).toBe(44);
  }
  await page.locator('#nextBtn').click();
  await expect(page.locator('#pageJump')).not.toHaveValue('1');
  await page.locator('#pageSlider').focus();
  await page.keyboard.press('End');
  await expect(page.locator('#pageStatus')).toHaveText('Back cover');
  await expect(page.locator('#nextBtn')).toBeDisabled();
  if (width === 390) {
    await page.screenshot({ path: testInfo.outputPath('reader-dark-mobile.png') });
    await page.locator('#fullBtn').click();
    await expect(page.locator('html')).toHaveClass(/reader-fullscreen/);
    await expect(page.locator('.control-row')).not.toBeVisible();
    await page.locator('#mobileFullscreenExit').click();
    await expect(page.locator('.control-row')).toBeVisible();
  }
});
