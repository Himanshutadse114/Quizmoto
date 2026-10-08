const { test, expect } = require('@playwright/test');
const { workspace } = require('./platform-spacing-fixtures.cjs');

for (const theme of ['dark', 'light']) for (const width of [320, 390, 768, 1024, 1440]) {
  test(`${theme} roster has content-sized entry panels at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 960 });
    await workspace(page, theme);
    await page.goto('/scorm/roster');
    await expect(page.getByRole('heading', { name: 'Approved learner roster' })).toBeVisible();
    await expect(page.getByLabel('Learner CSV to import', { exact: true })).toBeHidden();
    const metrics = await page.evaluate(() => {
      const add = document.querySelector('.roster-add-panel').getBoundingClientRect();
      const bulk = document.querySelector('.roster-import-panel').getBoundingClientRect();
      const button = document.querySelector('.roster-add-form button').getBoundingClientRect();
      const titles = [...document.querySelectorAll('.learner-roster-page h2')].map(el => getComputedStyle(el).fontSize);
      return { add: { top: add.top, bottom: add.bottom, height: add.height }, bulk: { top: bulk.top, height: bulk.height }, buttonBottom: button.bottom, titles, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(metrics.titles).toEqual(['16px', '16px']);
    expect(metrics.overflow).toBe(false);
    expect(metrics.add.bottom - metrics.buttonBottom).toBeLessThanOrEqual(25);
    expect(metrics.add.height).toBeLessThan(340);
    if (width >= 1100) expect(metrics.add.top).toBe(metrics.bulk.top);
    else expect(metrics.bulk.top).toBeGreaterThan(metrics.add.bottom);
    await page.screenshot({ path: testInfo.outputPath('roster-default.png'), fullPage: true });
    await page.getByText('Or paste a learner list', { exact: true }).click();
    await expect(page.getByLabel('Learner CSV to import', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import pasted list', exact: true })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width >= 1100) expect(await page.locator('.roster-add-panel').evaluate(el => el.getBoundingClientRect().height)).toBe(metrics.add.height);
    await page.screenshot({ path: testInfo.outputPath('roster-expanded.png'), fullPage: true });
  });
}

test('learner entry, upload, paste, modes, template and roster search still work', async ({ page }) => {
  await workspace(page);
  let roster = [];
  const imports = [];
  await page.route('**/api/scorm/roster', async route => {
    const request = route.request();
    if (request.method() === 'POST') {
      const body = request.postDataJSON();
      roster.push({ id: 'manual', ...body, source: 'manual' });
      return route.fulfill({ json: { roster } });
    }
    if (request.method() === 'PUT') {
      const body = request.postDataJSON();
      imports.push(body);
      const incoming = body.learners.map((learner, index) => ({ id: `import-${imports.length}-${index}`, ...learner, source: 'import' }));
      roster = body.mode === 'replace' ? incoming : [...roster, ...incoming];
      return route.fulfill({ json: { accepted: incoming.length, total: roster.length } });
    }
    return route.fulfill({ json: { roster } });
  });
  await page.goto('/scorm/roster');
  await page.getByLabel(/^Name/).fill('Manual learner');
  await page.getByLabel('Email', { exact: true }).fill('manual@example.com');
  await page.getByRole('button', { name: 'Add learner', exact: true }).click();
  await expect(page.getByText('manual@example.com', { exact: true })).toBeVisible();

  const fileChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import CSV/TXT', exact: true }).click();
  await (await fileChooser).setFiles({ name: 'learners.csv', mimeType: 'text/csv', buffer: Buffer.from('Name,Email\nCSV learner,csv@example.com\n') });
  await expect(page.getByText('csv@example.com', { exact: true })).toBeVisible();
  expect(imports[0]).toEqual({ mode: 'append', learners: [{ learnerName: 'CSV learner', email: 'csv@example.com' }] });
  await expect(page.getByText('manual@example.com', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Replace', exact: true }).click();
  await expect(page.getByText('Replace removes existing roster entries that are not in this import.', { exact: true })).toBeVisible();
  await page.getByText('Or paste a learner list', { exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Learner CSV to import', { exact: true }).fill('Name,Email\nPasted learner,paste@example.com');
  await page.getByRole('button', { name: 'Import pasted list', exact: true }).click();
  await expect(page.getByText('paste@example.com', { exact: true })).toBeVisible();
  await expect(page.getByText('manual@example.com', { exact: true })).toHaveCount(0);
  expect(imports[1].mode).toBe('replace');
  await expect(page.getByLabel('Learner CSV to import', { exact: true })).toHaveValue('');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download template', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('lmsgen-learner-roster-template.csv');
  await page.getByLabel('Search learners by name or email').fill('does-not-match');
  await expect(page.getByText('No learners match this search.')).toBeVisible();
  await page.getByLabel('Search learners by name or email').fill('Pasted');
  await expect(page.getByText('paste@example.com', { exact: true })).toBeVisible();
});
