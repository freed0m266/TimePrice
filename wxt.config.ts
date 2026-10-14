import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-svelte'],
  // srcDir makes WXT's reserved `@`/`~` aliases resolve to `src/*` (it hardcodes them
  // to srcDir). Entrypoints stay at the repo root via entrypointsDir; publicDir,
  // modulesDir and outDir remain root-relative regardless of srcDir.
  srcDir: 'src',
  entrypointsDir: '../entrypoints',
  // `@core/*` → `src/core/*` (pure, DOM-free layer). `@/*` → `src/*` comes from srcDir.
  alias: {
    '@core': 'src/core',
  },
  manifest: {
    name: 'TimePrice',
    description: 'Převádí ceny v e-shopech na čas, který musíš odpracovat, abys na ně vydělal.',
    version: '1.0.1',
    // Minimal permissions (audited in task 12). `storage` for settings; `activeTab` lets the
    // popup read the active tab's URL (for the per-site toggle, task 09) only after the user
    // opens it — no broad `tabs`/`scripting`/`webNavigation`/`cookies`, and no
    // `host_permissions` beyond the content script's `<all_urls>` match. Store justification
    // for `<all_urls>` lives in marketing/store-listing.md.
    permissions: ['storage', 'activeTab'],
    // Toolbar icon. WXT auto-detects public/icon/*.png into manifest `icons`, but it does not
    // populate `action.default_icon`, so we wire it explicitly here. This merges with the
    // popup entrypoint's default_popup/default_title. Source of truth: assets/icons/icon.svg.
    action: {
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
        128: 'icon/128.png',
      },
    },
  },
});
