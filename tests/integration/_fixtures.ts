// Fixture loader for the jsdom integration layer (task 14). Reads the saved e-shop snapshots in
// tests/fixtures/ from disk and injects their <body> into the live jsdom document, so the real
// engine (scan → parse → convert → mutate → observe) runs against realistic HTML — the same files
// the Playwright E2E serves to a real Chromium. Pure node fs here (this is a test helper, outside
// the no-network/DOM-purity layers), DOMParser comes from the jsdom environment.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ConversionContext } from '@core/convert';

// Resolved once. NB: we deliberately avoid `new URL(`../fixtures/${rel}`, import.meta.url)` — Vite
// intercepts that pattern as a static-asset import and mangles a dynamic path. `fileURLToPath` +
// `join` is a plain runtime path computation Vite leaves alone.
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

/** Shared test rate: 1000 Kč/h, 8 h day, 5 d week, auto rounding → 30 000 Kč = 30 h. */
export const CTX: ConversionContext = {
  netHourlyRateCzk: 1000,
  workdayHours: 8,
  workweekDays: 5,
  rounding: 'auto',
};

/**
 * The `<body>` inner HTML of a fixture. Parsed with DOMParser, which does NOT execute the
 * fixture's inline `<script>`s (and neither does assigning `innerHTML`), so dynamic/SPA fixtures
 * load in their initial state and the test drives the mutation itself.
 */
export function fixtureBody(rel: string): string {
  const html = readFileSync(join(FIXTURES_DIR, rel), 'utf8');
  return new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
}

/** Load a fixture's body into the live document and return `document.body`. */
export function loadFixture(rel: string): HTMLElement {
  document.body.innerHTML = fixtureBody(rel);
  return document.body;
}

/** Every numeric `data-tp-value` currently on the page, sorted — "what got converted". */
export function convertedValues(root: ParentNode = document): number[] {
  return [...root.querySelectorAll('[data-timeprice]')]
    .map((el) => Number(el.getAttribute('data-tp-value')))
    .sort((a, b) => a - b);
}
