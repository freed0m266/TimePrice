import { defineConfig } from '@playwright/test';

// Playwright E2E (task 14 §2) — loads the BUILT unpacked extension (.output/chrome-mv3) into a
// persistent Chromium context and drives it over the local fixtures (tests/fixtures/), served by
// request interception in tests/e2e/fixtures.ts. Run with `pnpm test:e2e` (it builds first). This
// is a separate runner from Vitest (`pnpm test`); the deterministic jsdom mirror of these flows
// lives in tests/integration so the same regressions also surface in unit CI.
//
// Prereq (once, and in CI before this runs): `pnpm exec playwright install chromium`. The harness
// uses `channel: 'chromium'` — the FULL Chromium (new headless can load extensions); the default
// headless-shell cannot. CI: `pnpm exec playwright install --with-deps chromium`.

export default defineConfig({
  testDir: './tests/e2e',
  // The extension's persistent context and the seeded chrome.storage.sync are per worker; serialize
  // so tests can't race on each other's storage or browser instance.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'on-first-retry',
  },
});
