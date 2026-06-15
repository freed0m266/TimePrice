// Core conversion E2E (task 14 §2) — the real extension converting real fixtures in Chromium.

import { test, expect, fixtureUrl, seedSettings } from './fixtures';

// Default suite rate: 1000 Kč/h → 30 000 Kč = 30 h. Seeded before each navigation so the content
// script reads it on first load.
test.beforeEach(async ({ background }) => {
  await seedSettings(background, { enabled: true, netHourlyRateCzk: 1000 });
});

test('alza adapter binds by host: detail + cards convert, comparison/out-of-container untouched', async ({
  page,
}) => {
  await page.goto(fixtureUrl('alza.cz', '/sites/alza.html'));

  await expect(page.locator('.price-box__price')).toContainText('30 h', { useInnerText: true }); // detail main
  await expect(page.locator('.c2-price-final')).toContainText('7 h', { useInnerText: true }); // listing card
  await expect(page.locator('[data-testid="pricePrimary"]')).toHaveText('1 h, 59 min', {
    useInnerText: true,
  }); // 1 990 Kč

  // Ignored + out-of-container prices stay raw.
  await expect(page.locator('.price-box__compare-price')).toHaveText('35 000 Kč');
  await expect(page.locator('.c2-price-old')).toHaveText('9 000 Kč');
  await expect(page.locator('.footer')).toContainText('79 Kč');
});

test('generic engine converts anchored prices on a non-adapter host, leaves bare numbers', async ({
  page,
}) => {
  await page.goto(fixtureUrl('shop.example', '/generic/generic-shop.html'));

  await expect(page.locator('.price-main')).toHaveText('2 h', { useInnerText: true }); // 2 000 Kč
  await expect(page.locator('.specs')).toContainText('60 W'); // spec, no anchor → untouched
  await expect(page.locator('.specs')).toContainText('2026'); // model year → untouched
});

test('discount: both prices convert and the strikethrough element survives', async ({ page }) => {
  await page.goto(fixtureUrl('shop.example', '/edge/discount.html'));

  await expect(page.locator('del.original')).toHaveText('2 h', { useInnerText: true }); // 2 000 Kč, still in <del>
  await expect(page.locator('.sale')).toHaveText('1 h', { useInnerText: true }); // 1 000 Kč
});
