// Hover-swap E2E (task 20) — the one behaviour jsdom cannot cover, because it needs a real CSS
// `:hover`. With the extension active, hovering a converted time swaps it IN PLACE for the
// original price (pure CSS, no DOM mutation, no OS tooltip); moving away restores the time.
//
// All assertions use `{ useInnerText: true }`: the converted span carries BOTH the time
// (`.tp-time`) and the original price (`.tp-orig`) as real text, with one CSS-hidden at a time.
// Playwright's default text matcher reads `textContent` (which ignores `display:none` and would
// see both); `innerText` honours the CSS, so it matches what the user actually sees.

import { test, expect, fixtureUrl, seedSettings } from './fixtures';

test.beforeEach(async ({ background }) => {
  await seedSettings(background, { enabled: true, netHourlyRateCzk: 1000 });
});

test('hovering a converted price swaps the time for the original price, then restores it', async ({
  page,
}) => {
  await page.goto(fixtureUrl('alza.cz', '/sites/alza.html'));

  // The detail price: 30 000 Kč → 30 h. Target the converted span itself, not its container.
  const price = page.locator('.price-box__price [data-timeprice]');
  await expect(price).toHaveText('30 h', { useInnerText: true }); // resting: time shown

  await price.hover();
  await expect(price).toHaveText('30 000 Kč', { useInnerText: true }); // hover: original revealed in place

  await page.mouse.move(0, 0); // move the pointer away
  await expect(price).toHaveText('30 h', { useInnerText: true }); // restored
});

test('the swap does not resize the box (no hover flicker / layout jump)', async ({ page }) => {
  await page.goto(fixtureUrl('alza.cz', '/sites/alza.html'));

  // 1 990 Kč → "1 h, 59 min": the time is WIDER than the price, the case that flickered. The box
  // stacks both children in one grid cell, so its width is constant — a `display` swap would
  // shrink it on hover, drop `:hover`, and oscillate. Equal width at rest and on hover proves it.
  const price = page.locator('[data-testid="pricePrimary"] [data-timeprice]');
  await expect(price).toHaveText('1 h, 59 min', { useInnerText: true });

  const rest = await price.boundingBox();
  await price.hover();
  await expect(price).toHaveText('1 990 Kč', { useInnerText: true }); // swapped in place
  const hovered = await price.boundingBox();

  expect(rest).not.toBeNull();
  expect(hovered).not.toBeNull();
  expect(hovered!.width).toBeCloseTo(rest!.width, 1); // box width unchanged → no flicker
  expect(hovered!.x).toBeCloseTo(rest!.x, 1); // and it didn't shift sideways
});

test('the swap replaces the OS tooltip — no title attribute is set', async ({ page }) => {
  await page.goto(fixtureUrl('alza.cz', '/sites/alza.html'));

  const price = page.locator('.price-box__price [data-timeprice]');
  await expect(price).toHaveAttribute('data-tp-original', '30 000 Kč'); // swap source present
  await expect(price).not.toHaveAttribute('title'); // task 07's title affordance is gone
});

test('invertHover: the page shows the price at rest and reveals the time on hover', async ({
  page,
  background,
}) => {
  await seedSettings(background, { invertHover: true }); // inverted direction
  await page.goto(fixtureUrl('alza.cz', '/sites/alza.html'));

  // Mirror of the default: the original price is shown at rest, the time appears on hover.
  const price = page.locator('.price-box__price [data-timeprice]');
  await expect(price).toHaveText('30 000 Kč', { useInnerText: true }); // resting: price shown
  await expect(page.locator('html')).toHaveAttribute('data-tp-invert', ''); // direction marker set

  await price.hover();
  await expect(price).toHaveText('30 h', { useInnerText: true }); // hover: time revealed

  await page.mouse.move(0, 0);
  await expect(price).toHaveText('30 000 Kč', { useInnerText: true }); // restored
});
