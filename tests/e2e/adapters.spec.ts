// Per-adapter E2E (task 14 §3) — each shipped adapter binds by host in a real browser and converts
// its detail price while leaving the nested comparison/ignored price raw. Alza is covered in
// conversion.spec.ts; this file covers the remaining four. The deterministic, value-exact mirror is
// tests/integration/adapters.fixture.test.ts.

import { test, expect, fixtureUrl, seedSettings } from './fixtures';

test.beforeEach(async ({ background }) => {
  await seedSettings(background, { enabled: true, netHourlyRateCzk: 1000 });
});

interface Case {
  name: string;
  host: string;
  fixture: string;
  detailSelector: string;
  detailText: string;
  ignoredSelector: string;
  ignoredText: string;
}

const CASES: Case[] = [
  {
    name: 'mall',
    host: 'mall.cz',
    fixture: '/sites/mall.html',
    detailSelector: '.pdp-prices__main',
    detailText: '12 h', // 12 000 Kč
    ignoredSelector: '.pdp-prices__original',
    ignoredText: '15 000 Kč',
  },
  {
    name: 'datart',
    host: 'datart.cz',
    fixture: '/sites/datart.html',
    detailSelector: '.product-price__main',
    detailText: '5 h', // 4 990 Kč
    ignoredSelector: '.product-price__old',
    ignoredText: '5 990 Kč',
  },
  {
    name: 'czc',
    host: 'czc.cz',
    fixture: '/sites/czc.html',
    detailSelector: '.pd-price__value',
    detailText: '12 h', // 12 000 Kč
    ignoredSelector: '.price-novat',
    ignoredText: '9 917 Kč bez DPH',
  },
  {
    name: 'notino',
    host: 'notino.cz',
    fixture: '/sites/notino.html',
    detailSelector: '[data-testid="pd-price"]',
    detailText: '30 min', // 499 Kč
    ignoredSelector: 'del',
    ignoredText: '699 Kč',
  },
];

for (const c of CASES) {
  test(`${c.name} adapter converts its detail price by host, keeps the comparison price`, async ({
    page,
  }) => {
    await page.goto(fixtureUrl(c.host, c.fixture));
    await expect(page.locator(c.detailSelector)).toContainText(c.detailText);
    await expect(page.locator(c.ignoredSelector)).toHaveText(c.ignoredText);
  });
}
