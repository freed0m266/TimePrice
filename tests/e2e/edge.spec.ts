// Edge-case E2E (task 14 §2) — split price, unit price, and a page with no prices, in a real
// browser. Value-exact mirror: tests/integration/engine.fixture.test.ts.

import { test, expect, fixtureUrl, seedSettings } from './fixtures';

test.beforeEach(async ({ background }) => {
  await seedSettings(background, { enabled: true, netHourlyRateCzk: 1000 });
});

test('split price: amount and Kč in separate elements is left untouched (no artifact)', async ({
  page,
}) => {
  await page.goto(fixtureUrl('shop.example', '/edge/split-price.html'));
  // Let the content engine run, then assert it converted nothing.
  await expect(page.locator('.amount')).toHaveText('30 000');
  await expect(page.locator('.currency')).toHaveText('Kč');
  await expect(page.locator('[data-timeprice]')).toHaveCount(0);
});

test('unit price: the amount converts and the per-unit suffix is preserved', async ({ page }) => {
  await page.goto(fixtureUrl('shop.example', '/edge/unit-price.html'));
  await expect(page.locator('body')).toContainText('11 min, 56 s/kg'); // 199 Kč → 716 s
  await expect(page.locator('body')).toContainText('17 min, 56 s / měsíc'); // 299 Kč → 1076 s
  await expect(page.locator('body')).not.toContainText('199 Kč');
});

test('no prices: a page with no currency anchor converts nothing', async ({ page }) => {
  await page.goto(fixtureUrl('shop.example', '/edge/no-prices.html'));
  await expect(page.locator('main')).toContainText('Tým 42 lidí');
  await expect(page.locator('[data-timeprice]')).toHaveCount(0);
});
