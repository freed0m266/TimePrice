// Blocklist E2E (task 14 §2 + task 12) — the extension must NEVER run on a built-in sensitive
// domain (banks, payment gateways, gov, brokers), even when globally enabled. Swapping a balance or
// a payment total for a time value could mislead about real money. The control test proves the bank
// fixture IS convertible on a normal host, so the blocked tests prove it is the HOST GATE — not
// absence of prices — that protects the page.

import { test, expect, fixtureUrl, seedSettings } from './fixtures';

test.beforeEach(async ({ background }) => {
  await seedSettings(background, { enabled: true, netHourlyRateCzk: 1000 });
});

test('control: the bank fixture is fully convertible on a normal e-shop host', async ({ page }) => {
  await page.goto(fixtureUrl('shop.example', '/blocklist/bank.html'));
  await expect(page.locator('[data-timeprice]')).toHaveCount(2); // both amounts convert
});

test('bank host (built-in blocklist) is never converted', async ({ page }) => {
  await page.goto(fixtureUrl('csas.cz', '/blocklist/bank.html')); // Česká spořitelna
  // Negative assertion: give the content script time to run and (correctly) do nothing.
  await page.waitForTimeout(500);
  await expect(page.locator('[data-timeprice]')).toHaveCount(0);
  await expect(page.locator('.balance')).toHaveText('125 000 Kč');
  await expect(page.locator('.payment .amount')).toHaveText('4 500 Kč');
});

test('payment-gateway host (built-in blocklist) is never converted', async ({ page }) => {
  await page.goto(fixtureUrl('gopay.com', '/blocklist/bank.html'));
  await page.waitForTimeout(500);
  await expect(page.locator('[data-timeprice]')).toHaveCount(0);
});
