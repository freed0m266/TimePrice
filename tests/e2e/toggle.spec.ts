// Toggle E2E (task 14 §2 + task 09) — turning the extension off (per-site or globally) reverts the
// page live (revertAll) and turning it back on re-converts, all without a reload. Each step uses an
// auto-retrying text assertion, so there are no fixed sleeps.

import { test, expect, fixtureUrl, seedSettings } from './fixtures';

const PAGE = fixtureUrl('shop.example', '/generic/generic-shop.html');

test('per-site toggle: off reverts live, on re-converts', async ({ page, background }) => {
  await seedSettings(background, { enabled: true, netHourlyRateCzk: 1000 });
  await page.goto(PAGE);
  await expect(page.locator('.price-main')).toHaveText('2 h', { useInnerText: true }); // 2 000 Kč

  // Per-site overrides key on the registrable domain (shop.example).
  await seedSettings(background, { siteOverrides: { 'shop.example': 'off' } });
  await expect(page.locator('.price-main')).toHaveText('2 000 Kč'); // reverted, no reload

  await seedSettings(background, { siteOverrides: {} });
  await expect(page.locator('.price-main')).toHaveText('2 h', { useInnerText: true }); // re-converted
});

test('global disable reverts live, re-enable re-converts', async ({ page, background }) => {
  await seedSettings(background, { enabled: true, netHourlyRateCzk: 1000 });
  await page.goto(PAGE);
  await expect(page.locator('.price-main')).toHaveText('2 h', { useInnerText: true });

  await seedSettings(background, { enabled: false });
  await expect(page.locator('.price-main')).toHaveText('2 000 Kč');

  await seedSettings(background, { enabled: true });
  await expect(page.locator('.price-main')).toHaveText('2 h', { useInnerText: true });
});

test('rate change re-formats already-converted prices live', async ({ page, background }) => {
  await seedSettings(background, { enabled: true, netHourlyRateCzk: 1000 });
  await page.goto(PAGE);
  await expect(page.locator('.price-main')).toHaveText('2 h', { useInnerText: true }); // 2 000 / 1000

  await seedSettings(background, { netHourlyRateCzk: 2000 });
  await expect(page.locator('.price-main')).toHaveText('1 h', { useInnerText: true }); // 2 000 / 2000
});
