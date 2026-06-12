// Playwright test harness for the unpacked extension (task 14 §2), following the official
// Playwright Chrome-extension guide (https://playwright.dev/docs/chrome-extensions):
//   - launch a PERSISTENT context with `--load-extension` (MV3 needs persistent context),
//   - grab the background SERVICE WORKER to read the extension id and seed storage.
//
// Fixtures are served by intercepting every navigation (`context.route`) and fulfilling it from
// tests/fixtures/ on disk — no server, no TLS. This lets us navigate to the REAL e-shop / bank
// hosts (https://alza.cz, https://csas.cz) so adapter binding and the sensitive-domain blocklist
// run for real, without tripping over those domains' HSTS upgrades or needing certificates.

import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = resolve(HERE, '../../.output/chrome-mv3');
const FIXTURES_DIR = resolve(HERE, '../fixtures');

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/** A subset of AppSettings worth seeding from a test. */
export interface SeedSettings {
  enabled?: boolean;
  netHourlyRateCzk?: number | null;
  workdayHours?: number;
  workweekDays?: number;
  rounding?: 'auto' | 'tenths' | 'whole';
  siteOverrides?: Record<string, 'on' | 'off'>;
  blocklist?: string[];
}

export const test = base.extend<{
  context: BrowserContext;
  background: Worker;
  extensionId: string;
}>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixture with no dependencies.
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      // `channel: 'chromium'` runs the full Chromium in NEW headless mode, which (unlike the
      // default headless-shell) can load extensions — per the Playwright extension guide.
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });

    // Serve the fixtures by interception, so any host (alza.cz, csas.cz, shop.example) resolves to
    // the matching file under tests/fixtures/ without a network or a certificate.
    await context.route('**/*', async (route) => {
      const { pathname } = new URL(route.request().url());
      const rel = normalize(pathname === '/' ? '/index.html' : pathname);
      const file = join(FIXTURES_DIR, rel);
      if (file !== FIXTURES_DIR && !file.startsWith(FIXTURES_DIR + '/')) {
        await route.fulfill({ status: 403, body: 'Forbidden' });
        return;
      }
      try {
        const body = await readFile(file);
        await route.fulfill({
          contentType: CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
          body,
        });
      } catch {
        await route.fulfill({ status: 404, body: 'Not found' });
      }
    });

    await use(context);
    await context.close();
  },
  background: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker');
    await use(sw);
  },
  extensionId: async ({ background }, use) => {
    // chrome-extension://<id>/background.js → the id is the host segment.
    await use(background.url().split('/')[2] ?? '');
  },
});

export const expect = test.expect;

/** A fixtures URL under a spoofed host, e.g. fixtureUrl('alza.cz', '/sites/alza.html'). */
export function fixtureUrl(host: string, path: string): string {
  return `https://${host}${path}`;
}

/**
 * Seed chrome.storage.sync via the extension's service worker BEFORE navigating, so the content
 * script reads it on first load. Settings are flat top-level keys (see src/settings/store.ts).
 */
export async function seedSettings(background: Worker, patch: SeedSettings): Promise<void> {
  await background.evaluate(
    async (items) => {
      const { chrome } = globalThis as unknown as {
        chrome: { storage: { sync: { set(items: Record<string, unknown>): Promise<void> } } };
      };
      await chrome.storage.sync.set(items);
    },
    patch as Record<string, unknown>,
  );
}
