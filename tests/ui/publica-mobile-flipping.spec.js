const { test, expect } = require('@playwright/test');
const { renderFlipbookReader } = require('../../server/views/flipbookReader');

test.use({ hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
const book = { title: 'Touch reader', shareToken: 'touch-reader', pageCount: 7, pages: Array.from({ length: 7 }, () => ({ width: 1200, height: 1800 })) };

async function openReader(page, pageCount = 7) {
  await page.route('**/api/**', route => route.fulfill(route.request().url().includes('/view')
    ? { contentType: 'text/html', body: renderFlipbookReader({ ...book, pageCount }) }
    : { contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1800"><rect width="1200" height="1800" fill="#164452"/></svg>' }));
  await page.goto('/publica/touch-reader');
  const frame = page.frameLocator('iframe[title="LMSGEN Publica"]');
  await expect(frame.locator('#book')).toHaveClass(/is-ready/);
  return frame;
}

async function swipe(page, frame, forward, duration = 120) {
  const box = await frame.locator('#bookFrame').boundingBox();
  const session = await page.context().newCDPSession(page);
  const startX = box.x + box.width * (forward ? .85 : .15);
  const endX = box.x + box.width * (forward ? .15 : .85);
  const y = box.y + box.height * .65;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y }] });
  for (let step = 1; step <= 8; step += 1) {
    await page.waitForTimeout(duration / 8);
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX + (endX - startX) * step / 8, y }] });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}

for (const width of [320, 390]) test(`mobile ${width}px flips with touch and buttons`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 844 });
  const frame = await openReader(page);
  expect(await frame.locator('html').evaluate(el => getComputedStyle(el).colorScheme)).toBe('light');
  await swipe(page, frame, true);
  await expect(frame.locator('#pageJump')).toHaveValue('2');
  await frame.locator('#book').evaluate(() => { window.flipStates = []; pageFlip.on('changeState', e => window.flipStates.push(e.data)); });
  await frame.locator('#nextBtn').tap();
  await expect.poll(() => frame.locator('#book').evaluate(() => pageFlip.getState())).toBe('flipping');
  await page.screenshot({ path: testInfo.outputPath('mobile-page-turn.png') });
  await expect(frame.locator('#pageJump')).toHaveValue('3');
  await swipe(page, frame, false);
  await expect(frame.locator('#pageJump')).toHaveValue('2');
  await swipe(page, frame, true, 600);
  await expect(frame.locator('#pageJump')).toHaveValue('3');
});

for (const pageCount of [2, 4]) test(`mobile can open and close every page of a ${pageCount}-page book`, async ({ page }) => {
  const frame = await openReader(page, pageCount);
  await swipe(page, frame, false);
  await expect(frame.locator('#pageJump')).toHaveValue('1');
  const box = await frame.locator('#bookFrame').boundingBox();
  await page.touchscreen.tap(box.x + box.width * .9, box.y + box.height * .5);
  await expect(frame.locator('#pageJump')).toHaveValue('2');
  for (let index = 3; index <= pageCount; index += 1) {
    await swipe(page, frame, true, 600);
    await expect(frame.locator('#pageJump')).toHaveValue(String(index));
  }
  await swipe(page, frame, true);
  await expect(frame.locator('#pageJump')).toHaveValue(String(pageCount));
  await expect(frame.locator('#nextBtn')).toBeDisabled();
  for (let index = pageCount - 1; index >= 1; index -= 1) {
    await swipe(page, frame, false, 600);
    await expect(frame.locator('#pageJump')).toHaveValue(String(index));
  }
  await expect(frame.locator('#prevBtn')).toBeDisabled();
});

test('mobile touch remains aligned in fullscreen', async ({ page }) => {
  const frame = await openReader(page);
  await frame.locator('#book').evaluate(() => { document.documentElement.requestFullscreen = undefined; });
  await frame.locator('#fullBtn').tap();
  await expect(frame.locator('html')).toHaveClass(/reader-fullscreen/);
  await swipe(page, frame, true);
  await expect(frame.locator('#pageJump')).toHaveValue('2');
  await swipe(page, frame, false);
  await expect(frame.locator('#pageJump')).toHaveValue('1');
});
