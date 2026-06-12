import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@core': r('./src/core'),
      '@': r('./src'),
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
    },
    projects: [
      {
        // Pure core logic (parser, converter) — no DOM.
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        // DOM-bound engine tests (scanner, mutator, observer) — added in tasks 06–08 — plus the
        // fixture-based integration + adapter-regression layer (task 14), which loads the saved
        // e-shop snapshots in tests/fixtures/ and runs the full chain. (Playwright E2E in
        // tests/e2e/ is a separate runner — `pnpm test:e2e` — not part of this Vitest project.)
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['tests/dom/**/*.test.ts', 'tests/integration/**/*.test.ts'],
        },
      },
    ],
  },
});
