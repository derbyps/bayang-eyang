import { expect, test, type Page } from '@playwright/test';

async function frameAt(page: Page, query: string) {
  await page.goto(`/?${query}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
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
