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
  // span (the offset invariant). We assert that at the DOM level, then in the rendered text: the
  // span is plain inline (task 21), so `innerText` reads exactly what the user sees.
  const converted = await page.evaluate(() =>
    [...document.querySelectorAll('[data-timeprice]')].map((el) => ({
      orig: el.getAttribute('data-tp-original'),
      time: el.querySelector('.tp-time')?.textContent ?? null,
      suffix: el.nextSibling?.textContent ?? null,
    })),
  );
  expect(converted).toContainEqual({ orig: '199 Kč', time: '11 min, 56 s', suffix: '/kg' }); // 716 s
  expect(converted).toContainEqual({ orig: '299 Kč', time: '17 min, 56 s', suffix: ' / měsíc' }); // 1076 s

  await expect(page.locator('.price').first()).toHaveText('11 min, 56 s/kg', {
    useInnerText: true,
  });
  await expect(page.locator('.price').nth(1)).toHaveText('17 min, 56 s / měsíc', {
    useInnerText: true,
  });

  // The raw price is not shown in time-first mode (the `.tp-orig` twin is display:none).
  await expect(page.locator('body')).not.toContainText('199 Kč', { useInnerText: true });
});

test('no prices: a page with no currency anchor converts nothing', async ({ page }) => {
  await page.goto(fixtureUrl('shop.example', '/edge/no-prices.html'));
  await expect(page.locator('main')).toContainText('Tým 42 lidí');
  await expect(page.locator('[data-timeprice]')).toHaveCount(0);
});
