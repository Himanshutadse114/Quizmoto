const { test, expect } = require('@playwright/test');
const { renderFlipbookReader } = require('../../server/views/flipbookReader');

const identity = { username: 'Audit workspace', email: 'audit@example.com', role: 'super_admin', isSuperAdmin: true, scormAccess: true, platformAccess: true };
async function workspace(page, theme = 'dark') {
  await page.addInitScript(({ identity, theme }) => {
    localStorage.setItem('token', 'ui-fixture');
    localStorage.setItem('user', JSON.stringify(identity));
    localStorage.setItem('scormAccessGranted', '1');
    localStorage.setItem('scormPlatformAccess', '1');
    localStorage.setItem('quizmoto_scorm_platform_theme', theme);
  }, { identity, theme });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    let data = { users: [], roster: [], groups: [], courses: [], packages: [], features: {}, summary: {}, overview: {} };
    if (path.endsWith('/auth/scorm/status')) data = { ...identity, token: 'ui-fixture' };
    if (path.endsWith('/courses') || path.endsWith('/packages')) data = [];
    if (path.endsWith('/flipbooks')) data = { flipbooks: [], quota: { max: 2, used: 0 } };
    if (path.endsWith('/flipbooks/library')) data = { library: { books: [], enabled: false } };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
}

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
  expect(await page.locator('main h1').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeLessThanOrEqual(38);
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
