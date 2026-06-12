// Dynamic-content E2E (task 14 §2) — the live MutationObserver in a real browser: a price injected
// after load (lazy render) and a SPA pushState navigation. These exercise the real timing the jsdom
// mirror fakes with a manual frame queue. Uses Playwright's auto-retrying expectations (no fixed
// sleeps) so observer debounce/idle timing can't make them flaky.

import { test, expect, fixtureUrl, seedSettings } from './fixtures';

test.beforeEach(async ({ background }) => {
  await seedSettings(background, { enabled: true, netHourlyRateCzk: 1000 });
});

test('dynamic: a price injected ~150 ms after load is converted by the observer', async ({
  page,
}) => {
  await page.goto(fixtureUrl('shop.example', '/edge/dynamic.html'));
  // The fixture's inline script appends `.lazy-price` after a timeout; the observer must convert it.
  await expect(page.locator('.lazy-price')).toHaveText('5 h'); // 5 000 Kč
});

test('SPA: a pushState navigation re-converts the swapped-in view', async ({ page }) => {
  await page.goto(fixtureUrl('shop.example', '/edge/spa.html'));
  await expect(page.locator('.price')).toHaveText('10 h'); // 10 000 Kč (first pass)

  await page.locator('#nav').click(); // history.pushState + view swap
  await expect(page.locator('.price')).toHaveText('20 h'); // 20 000 Kč (observer re-pass)
});
