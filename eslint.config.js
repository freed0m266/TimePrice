import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    // Generated / vendored output — never lint.
    ignores: [
      '.output/**',
      '.wxt/**',
      'node_modules/**',
      'public/**',
      'coverage/**',
      'stats.html',
      'web-ext.config.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    // WXT injects auto-imports (defineContentScript, defineBackground, …) as globals,
    // resolved by TypeScript — so `no-undef` is redundant and noisy here.
    files: ['**/*.{ts,tsx,svelte}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.webextensions },
    },
    rules: {
      'no-undef': 'off',
    },
  },

  // Svelte (popup/options UI only). Covers `.svelte` components and `.svelte.ts`/.js
  // runes modules — both go through the Svelte parser, with the TS parser nested so
  // type syntax inside them is understood.
  ...svelte.configs.recommended,
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },

  // Core-layer purity guard: src/core/** must stay free of DOM/browser layers so it
  // remains unit-testable in node. (DOM globals are banned by review/structure for now;
  // a stricter no-DOM rule lands with the parser/converter in tasks 04–05.)
  {
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'webextension-polyfill',
              message: 'src/core must stay pure TS — no browser APIs.',
            },
            { name: 'wxt/browser', message: 'src/core must stay pure TS — no browser APIs.' },
          ],
          patterns: [
            {
              group: ['**/entrypoints/**', '@/content/**', '@/settings/**', '@/ui/**'],
              message: 'src/core must not depend on DOM/browser/UI layers.',
            },
          ],
        },
      ],
    },
  },

  // Settings layer runs in the popup AND the service worker, where there is no DOM.
  // Guard against accidental DOM access so the storage wrapper stays SW-safe.
  {
    files: ['src/settings/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'document', message: 'src/settings runs in the service worker — no DOM.' },
        { name: 'window', message: 'src/settings runs in the service worker — no DOM.' },
      ],
    },
  },

  prettier,
);
