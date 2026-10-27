import { expect, test } from '@playwright/test';

test('plays offline after the first visit', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    await (window as unknown as { __offlineReady?: Promise<void> }).__offlineReady;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: /light the lamp/i })).toBeVisible();
  await page.getByRole('button', { name: /light the lamp/i }).click();
  await expect(page.getByRole('slider', { name: 'Play position' })).toBeAttached();
});

test('a returning visitor who is online gets the latest play, not the cached one', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    await (window as unknown as { __offlineReady?: Promise<void> }).__offlineReady;
  });
  await context.route('**/lakon/demo-eyang-putri.json', async (route) => {
    const res = await route.fetch();
    const lakon = await res.json();
    lakon.title = 'A Fresher Story';
    await route.fulfill({ response: res, json: lakon });
  });
  await page.reload();
  await expect(page.getByRole('button', { name: /A Fresher Story/ })).toBeVisible();
});
