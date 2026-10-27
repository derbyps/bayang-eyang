import { expect, test, type Page } from '@playwright/test';

async function lightLamp(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /light the lamp/i }).click();
}

const now = (page: Page) => page.getByRole('slider', { name: 'Play position' }).getAttribute('aria-valuenow');

test('scene markers show the five scenes and seek on click', async ({ page }) => {
  await lightLamp(page);
  for (const name of ['Gunungan', 'Jejer', 'Perang', 'Gara-gara', 'Tancep kayon']) {
    await expect(page.getByRole('button', { name: `Jump to ${name}` })).toBeAttached();
  }
  await page.mouse.move(640, 600);
  await page.getByRole('button', { name: 'Jump to Gara-gara' }).click();
  await expect.poll(async () => Number(await now(page))).toBeGreaterThanOrEqual(38);
  expect(Number(await now(page))).toBeLessThan(40);
});

test('controls hide when idle and return on pointer movement', async ({ page }) => {
  await lightLamp(page);
  const bar = page.locator('.controls');
  await page.mouse.move(640, 500);
  await expect(bar).toHaveAttribute('data-visible', 'true');
  await expect(bar).toHaveAttribute('data-visible', 'false', { timeout: 4000 });
  await page.mouse.move(600, 520);
  await expect(bar).toHaveAttribute('data-visible', 'true');
});

test('D toggles the dev panel, which tracks the current beat', async ({ page }) => {
  await page.goto('/?t=24.6&paused=1');
  const panel = page.getByRole('complementary', { name: 'Dalang notes' });
  await expect(panel).toBeHidden();
  await page.keyboard.press('d');
  await expect(panel).toBeVisible();
  await expect(panel.locator('[aria-current="true"]')).toContainText('loom');
  await page.keyboard.press('d');
  await expect(panel).toBeHidden();
});

test('a missing play shows a message and the error', async ({ page }) => {
  await page.goto('/?lakon=does-not-exist');
  await expect(page.getByText("The dalang can't find this play.")).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Dalang notes' })).toContainText('does-not-exist');
});

test('an invalid play lists its validation errors', async ({ page }) => {
  await page.route('**/lakon/broken.json', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        version: 1,
        title: 'Broken',
        seed: 1,
        cast: [{ id: 'a', puppet: 'petruk', name: 'A', type: 'punakawan' }],
        scenes: [{ id: 's', kind: 'jejer', title: 'S', start: 0 }],
        beats: [{ t: 0, actor: 'a', do: 'laugh' }],
      }),
    }),
  );
  await page.goto('/?lakon=broken');
  await expect(page.getByText("The dalang can't find this play.")).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Dalang notes' })).toContainText('not on stage');
});

test('portrait phones are asked to rotate', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByText(/turn your phone sideways/i)).toBeVisible();
});

test('the end card appears when the play is over', async ({ page }) => {
  await page.goto('/?t=999&paused=1');
  const card = page.getByRole('dialog', { name: 'Bayang Eyang' });
  await expect(card).toBeVisible();
  await expect(card.getByRole('button', { name: 'Watch again' })).toBeVisible();
  await expect(card).toContainText('@derbyps.dev');
});
