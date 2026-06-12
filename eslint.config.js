import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

// Privacy is a hard constraint (task 12): nothing the extension processes may leave the
// device. These two lists make "no network, ever" mechanically enforceable so a stray
// `fetch` / analytics SDK can never slip into the content / core / settings / entrypoints
// surface unnoticed. A negative test (tests/unit/eslint-no-network.test.ts) asserts the
// rule actually fires.
const NO_NETWORK_MESSAGE =
  'Network access is banned in TimePrice — privacy is a hard constraint (no data ever ' +
  'leaves the device). See task 12 / CLAUDE.md.';

// Bare global references: `fetch(...)`, `new XMLHttpRequest()`, `new WebSocket()`,
// `new EventSource()`. `no-restricted-globals` only fires when the identifier resolves to
// the global scope, so a local variable that happens to be named `fetch` is fine.
const NETWORK_GLOBALS = [
  { name: 'fetch', message: NO_NETWORK_MESSAGE },
  { name: 'XMLHttpRequest', message: NO_NETWORK_MESSAGE },
  { name: 'WebSocket', message: NO_NETWORK_MESSAGE },
  { name: 'EventSource', message: NO_NETWORK_MESSAGE },
];

// Member-access and dynamic-import forms the global rule can't see:
// dotted (`window.fetch(...)`, `navigator.sendBeacon(...)`, `globalThis.WebSocket`),
// computed (`window['fetch'](...)`, `navigator['sendBeacon'](...)`), and a remote
// `import('https://…')`. (Destructuring a global, e.g. `const { fetch } = window`, is a
// deliberate-evasion form — not covered, since a blanket ban on a `fetch` binding would
// false-positive on unrelated `.fetch` members and lint can't sandbox a hostile author.)
const NETWORK_SYNTAX = [
  {
    selector:
      'MemberExpression[property.name=/^(fetch|sendBeacon|XMLHttpRequest|WebSocket|EventSource)$/]',
    message: NO_NETWORK_MESSAGE,
  },
  {
    selector:
      'MemberExpression[computed=true][property.value=/^(fetch|sendBeacon|XMLHttpRequest|WebSocket|EventSource)$/]',
    message: NO_NETWORK_MESSAGE,
  },
  {
    selector: 'ImportExpression[source.value=/^(https?:)?\\/\\//]',
    message: NO_NETWORK_MESSAGE,
  },
];

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
      'no-restricted-globals': ['error', ...NETWORK_GLOBALS],
      'no-restricted-syntax': ['error', ...NETWORK_SYNTAX],
    },
  },

  // Privacy enforcement (task 12): ban every networking API across the whole bundled
  // surface — all of `src/**` (content engine, settings, shared UI components, constants,
  // and any future module) plus the WXT entrypoints (content/background scripts + popup).
  // Broadening to `src/**` keeps the guard intact when popup logic is factored into shared
  // modules. `src/core/**` also carries this ban in its own block above (which additionally
  // owns the purity import rule); `src/settings/**` re-declares it below so its DOM ban and
  // this network ban coexist on the same rule.
  {
    files: ['src/**/*.{ts,tsx,svelte}', 'entrypoints/**/*.{ts,tsx,svelte}'],
    rules: {
      'no-restricted-globals': ['error', ...NETWORK_GLOBALS],
      'no-restricted-syntax': ['error', ...NETWORK_SYNTAX],
    },
  },

  // Settings layer runs in the popup AND the service worker, where there is no DOM.
  // Guard against accidental DOM access so the storage wrapper stays SW-safe, and carry
  // the same no-network ban (it is bundled into both surfaces).
  {
    files: ['src/settings/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'document', message: 'src/settings runs in the service worker — no DOM.' },
        { name: 'window', message: 'src/settings runs in the service worker — no DOM.' },
        ...NETWORK_GLOBALS,
      ],
      'no-restricted-syntax': ['error', ...NETWORK_SYNTAX],
    },
  },

  prettier,
);
