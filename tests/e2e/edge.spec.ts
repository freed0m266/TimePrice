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
  await page.locator('[data-timeprice]').first().waitFor();

  // The amount converts; the per-unit suffix survives as the text node right after the converted
  // span (the offset invariant). We assert that at the DOM level: the hover-swap box stacks its
  // two children as block grid items, so `innerText` would weave a newline between "11 min, 56 s"
  // and "/kg" — a serialization quirk only; visually the suffix stays inline (verified by smoke).
  const converted = await page.evaluate(() =>
    [...document.querySelectorAll('[data-timeprice]')].map((el) => ({
      orig: el.getAttribute('data-tp-original'),
      time: el.querySelector('.tp-time')?.textContent ?? null,
      suffix: el.nextSibling?.textContent ?? null,
    })),
  );
  expect(converted).toContainEqual({ orig: '199 Kč', time: '11 min, 56 s', suffix: '/kg' }); // 716 s
  expect(converted).toContainEqual({ orig: '299 Kč', time: '17 min, 56 s', suffix: ' / měsíc' }); // 1076 s

  // The raw price is not shown at rest (the `.tp-orig` twin is visibility:hidden).
  await expect(page.locator('body')).not.toContainText('199 Kč', { useInnerText: true });
});

test('no prices: a page with no currency anchor converts nothing', async ({ page }) => {
  await page.goto(fixtureUrl('shop.example', '/edge/no-prices.html'));
  await expect(page.locator('main')).toContainText('Tým 42 lidí');
  await expect(page.locator('[data-timeprice]')).toHaveCount(0);
});
