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
        // DOM-bound engine tests (scanner, mutator, observer) — added in tasks 06–08.
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['tests/dom/**/*.test.ts'],
        },
      },
    ],
  },
});
