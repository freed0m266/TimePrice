// Hover tooltip E2E (task 21) — the behaviour jsdom cannot cover, because which face is shown
// needs real CSS. With the extension active, a converted price shows ONE face (time-first by
// default, price-first when `invertHover` is on) and hovering it pops the browser's native
// tooltip with the other face. The page text never changes on hover.
//
// The native tooltip itself is OS-drawn and invisible to Playwright, so we assert the `title`
// on the child the user can actually see (and hover). All text assertions use
// `{ useInnerText: true }`: the converted span carries BOTH faces as real text with one CSS-hidden;
// Playwright's default matcher reads `textContent` (which ignores `display:none` and would see
// both), while `innerText` honours the CSS and matches what the user actually sees.

import { test, expect, fixtureUrl, seedSettings } from './fixtures';

test.beforeEach(async ({ background }) => {
  await seedSettings(background, { enabled: true, netHourlyRateCzk: 1000 });
});

test('time-first: the page shows the time, its tooltip the original price, hover changes nothing', async ({
  page,
}) => {
  await page.goto(fixtureUrl('alza.cz', '/sites/alza.html'));

  // The detail price: 30 000 Kč → 30 h. Target the converted span itself, not its container.
  const price = page.locator('.price-box__price [data-timeprice]');
  await expect(price).toHaveText('30 h', { useInnerText: true });

  const shown = price.locator('.tp-time');
  await expect(shown).toBeVisible();
  await expect(shown).toHaveAttribute('title', '30 000 Kč'); // native tooltip = original price
  await expect(price.locator('.tp-orig')).toBeHidden();

  await shown.hover();
  await expect(price).toHaveText('30 h', { useInnerText: true }); // no in-place swap (task 20 retired)
});

test('hover does not resize or shift the box (no layout jump)', async ({ page }) => {
  await page.goto(fixtureUrl('alza.cz', '/sites/alza.html'));

  // 1 990 Kč → "1 h, 59 min": the case that used to flicker under the task 20 swap.
  const price = page.locator('[data-testid="pricePrimary"] [data-timeprice]');
  await expect(price).toHaveText('1 h, 59 min', { useInnerText: true });

  const rest = await price.boundingBox();
  await price.hover();
  const hovered = await price.boundingBox();

  expect(rest).not.toBeNull();
  expect(hovered).not.toBeNull();
  expect(hovered!.width).toBeCloseTo(rest!.width, 1);
  expect(hovered!.x).toBeCloseTo(rest!.x, 1);
});

test('price-first: the page shows the price, its tooltip the time', async ({
  page,
  background,
}) => {
  await seedSettings(background, { invertHover: true });
  await page.goto(fixtureUrl('alza.cz', '/sites/alza.html'));

  const price = page.locator('.price-box__price [data-timeprice]');
  await expect(price).toHaveText('30 000 Kč', { useInnerText: true });
  await expect(page.locator('html')).toHaveAttribute('data-tp-invert', '');

  const shown = price.locator('.tp-orig');
  await expect(shown).toBeVisible();
  await expect(shown).toHaveAttribute('title', '30 h'); // native tooltip = work time
  await expect(price.locator('.tp-time')).toBeHidden();

  await shown.hover();
  await expect(price).toHaveText('30 000 Kč', { useInnerText: true }); // hover changes nothing
});

test('the converted span keeps the page layout: no title on the wrapper, no inline style', async ({
  page,
}) => {
  await page.goto(fixtureUrl('alza.cz', '/sites/alza.html'));

  const price = page.locator('.price-box__price [data-timeprice]');
  await expect(price).toHaveAttribute('data-tp-original', '30 000 Kč');
  await expect(price).not.toHaveAttribute('title'); // the tooltip lives on the shown child
  await expect(price).not.toHaveAttribute('style');
});
