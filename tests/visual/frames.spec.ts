import { expect, test, type Page } from '@playwright/test';

async function frameAt(page: Page, query: string) {
  await page.goto(`/?${query}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  // A baseline must never lock in an empty stage: the lit middle of the screen has shadows on it.
  const shadowShare = await page.evaluate(() => {
    const c = document.querySelector('canvas')!;
    const g = c.getContext('2d')!;
    const x = Math.round(c.width * 0.25), y = Math.round(c.height * 0.15);
    const d = g.getImageData(x, y, Math.round(c.width * 0.5), Math.round(c.height * 0.6)).data;
    let dark = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 70 && d[i + 1] < 50) dark++;
    return dark / (d.length / 4);
  });
  expect(shadowShare).toBeGreaterThan(0.03);
}

const shot = { maxDiffPixelRatio: 0.01, animations: 'disabled' as const };

test('lamp intro', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot('lamp-intro.png', shot);
});

test('gunungan mid-spin', async ({ page }) => {
  await frameAt(page, 't=2.9&paused=1');
  await expect(page).toHaveScreenshot('gunungan-spin.png', shot);
});

test('the giant looms', async ({ page }) => {
  await frameAt(page, 't=24.5&paused=1');
  await expect(page).toHaveScreenshot('giant-looms.png', shot);
});

test('gara-gara miss', async ({ page }) => {
  await frameAt(page, 't=47.4&paused=1');
  await expect(page).toHaveScreenshot('gara-gara-miss.png', shot);
});

test('the shadow lingers', async ({ page }) => {
  await frameAt(page, 't=57.2&paused=1');
  await expect(page).toHaveScreenshot('linger.png', shot);
});
