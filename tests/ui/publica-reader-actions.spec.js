const { test, expect } = require('@playwright/test');
const { renderFlipbookReader } = require('../../server/views/flipbookReader');

const publicUrl = 'https://www.lmsgen.in/publica/theauthorsgallery';
const book = { title: 'The Authors Gallery', shareToken: 'reader-ui', pageCount: 7, pages: Array.from({ length: 7 }, () => ({ width: 1200, height: 1800 })) };
async function reader(page, { embedded = false, ...shareMocks } = {}) {
  await page.addInitScript(mocks => {
    window.copiedLinks = [];
    window.nativeShares = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: mocks.native ? async payload => {
      window.nativeShares.push(payload);
      if (mocks.native !== 'success') throw new DOMException('Share unavailable', mocks.native);
    } : undefined });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => mocks.canShare !== false });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => {
      if (mocks.clipboard === 'fail') throw new DOMException('Clipboard blocked', 'NotAllowedError');
      window.copiedLinks.push(text);
    } } });
    document.execCommand = command => {
      if (command !== 'copy' || mocks.legacy !== 'success') return false;
      window.copiedLinks.push(document.activeElement.value);
      return true;
    };
  }, shareMocks);
  await page.route('**/reader-actions', r => r.fulfill({ contentType: 'text/html', body: renderFlipbookReader(book, { publicUrl }) }));
  await page.route('**/api/**', r => {
    if (r.request().url().includes('/view')) return r.fulfill({ contentType: 'text/html', body: renderFlipbookReader(book, { publicUrl }) });
    return r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1800"><rect width="1200" height="1800" fill="#164452"/><text x="100" y="200" fill="#fff" font-size="60">Publica reader QA</text></svg>' });
  });
  await page.goto(embedded ? '/publica/reader-ui' : '/reader-actions');
  const frame = embedded ? page.frameLocator('iframe[title="LMSGEN Publica"]') : page;
  await expect(frame.locator('#book')).toHaveClass(/is-ready/);
  return frame;
}

for (const [width, height] of [[320, 640], [390, 844], [800, 900], [1024, 768], [1440, 900], [1920, 870]]) test(`Publica fits the stage at ${width}px, including an open spread`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height });
  const frame = await reader(page, { embedded: true });
  await expect(page.locator('iframe')).toHaveAttribute('allow', /web-share/);
  const fit = async () => frame.locator('#readerStage').evaluate(stage => {
    const box = document.querySelector('#zoomSpace').getBoundingClientRect();
    const rect = stage.getBoundingClientRect();
    return { width: stage.scrollWidth - stage.clientWidth, height: stage.scrollHeight - stage.clientHeight, overflow: getComputedStyle(stage).overflow, inside: box.left >= rect.left && box.right <= rect.right && box.top >= rect.top && box.bottom <= rect.bottom };
  });
  expect(await fit()).toEqual({ width: 0, height: 0, overflow: 'hidden', inside: true });
  await frame.locator('#nextBtn').click();
  await expect(frame.locator('#pageStatus')).not.toHaveText('Cover');
  await expect.poll(fit).toEqual({ width: 0, height: 0, overflow: 'hidden', inside: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('reader-fitted.png') });
});

test('desktop resize stays fitted; deliberate zoom supports panning and reset', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  const frame = await reader(page);
  await page.setViewportSize({ width: 900, height: 620 });
  await expect.poll(() => frame.locator('#readerStage').evaluate(el => el.scrollWidth - el.clientWidth)).toBe(0);
  await expect.poll(() => frame.locator('#readerStage').evaluate(el => el.scrollHeight - el.clientHeight)).toBe(0);
  await frame.locator('#zoomInBtn').click();
  await expect(frame.locator('#readerStage')).toHaveClass(/is-zoomed/);
  await expect(frame.locator('#zoomValue')).toHaveText('125%');
  expect(await frame.locator('#readerStage').evaluate(el => getComputedStyle(el).overflow)).toBe('auto');
  await frame.locator('#zoomResetBtn').click();
  await expect(frame.locator('#readerStage')).not.toHaveClass(/is-zoomed/);
  await expect(frame.locator('#zoomValue')).toHaveText('100%');
});

for (const width of [320, 800, 1024, 1920]) test(`embedded Share copies the public URL with visible feedback at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const frame = await reader(page, { embedded: true, native: 'NotAllowedError' });
  await frame.getByRole('button', { name: 'Share publication', exact: true }).click();
  await expect(frame.locator('#shareStatus')).toHaveText('Link copied');
  await expect(frame.getByRole('button', { name: 'Link copied', exact: true })).toBeVisible();
  expect(await frame.locator('#shareBtn').evaluate(() => window.copiedLinks)).toEqual([publicUrl]);
  expect(await frame.locator('.reader-shell').evaluate(el => el.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const [name, mocks, status, copied] of [
  ['clipboard fallback', {}, 'Link copied', true],
  ['blocked native share', { native: 'NotAllowedError' }, 'Link copied', true],
  ['legacy clipboard fallback', { clipboard: 'fail', legacy: 'success' }, 'Link copied', true],
  ['blocked clipboard', { clipboard: 'fail' }, 'Unable to copy the link.', false],
  ['successful native share', { native: 'success' }, 'Publication shared.', false],
  ['cancelled native share', { native: 'AbortError' }, '', false],
]) test(`Share handles ${name} with honest feedback`, async ({ page }) => {
  const frame = await reader(page, mocks);
  await frame.getByRole('button', { name: 'Share publication', exact: true }).click();
  if (status) await expect(frame.locator('#shareStatus')).toContainText(status);
  else await expect(frame.locator('#shareStatus')).toBeEmpty();
  expect(await page.evaluate(() => window.copiedLinks)).toEqual(copied ? [publicUrl] : []);
  if (copied) await expect(frame.getByRole('button', { name: 'Link copied', exact: true })).toBeVisible();
  else await expect(frame.getByRole('button', { name: 'Share publication', exact: true })).toBeEnabled();
});
