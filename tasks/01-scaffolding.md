# 01 — Scaffolding: WXT projekt, TypeScript, Svelte, lint, Vitest

**Status:** Todo

**Priorita:** v1.0 · **Úsilí:** M · **Dopad:** Blokující

## Cíl

Připravit kostru extension projektu postavenou na **WXT**. Po dokončení se projekt buildne (`pnpm dev` načte rozbalenou extension do Chromu, `pnpm build` vyrobí produkční bundle), v Chromu se objeví prázdná extension s placeholder popupem, content script se injectuje na každý web a do konzole vypíše „TimePrice loaded". Žádná detekce cen ani konverze — to jsou tasky 04+.

## Kontext

- Projekt je čistý prázdný git repo. Žádný předchozí build setup neexistuje.
- WXT je framework přímo pro browser extensions nad Vite: file-based entrypoints v `entrypoints/`, auto-generovaný `manifest.json`, HMR pro content/background scripty, vestavěný cross-browser build (Chrome + Firefox) přes `webextension-polyfill`.
- Content engine bude **vanilla TS** kvůli výkonu (běží na cizích stránkách, žádný framework overhead). Popup/options UI bude **Svelte** (`@wxt-dev/module-svelte`).
- Package manager: **pnpm** (rychlý, deterministický). Pokud uživatel preferuje npm, přepsat skripty — ale `.gitignore` i lockfile předpokládají pnpm.
- Sdílené **pure jádro** (parser, converter) musí žít odděleně od DOM kódu v `src/core/`, aby šlo unit-testovat ve Vitest bez jsdom.

## Scope

### 1. Inicializace WXT projektu

```bash
cd /Users/martin/Development/TimePrice
pnpm dlx wxt@latest init . --template vanilla --pm pnpm
pnpm add -D @wxt-dev/module-svelte svelte
pnpm add webextension-polyfill
pnpm add -D vitest @vitest/coverage-v8 typescript svelte-check
pnpm add -D eslint prettier eslint-config-prettier eslint-plugin-svelte
```

(Pokud `init` odmítne neprázdný adresář kvůli `tasks/` a docs, inicializovat v temp a soubory přesunout, nebo použít `--force` a pak vrátit přepsané docs z gitu.)

### 2. `wxt.config.ts`

- Zaregistrovat Svelte modul: `modules: ['@wxt-dev/module-svelte']`.
- `manifest`:
  - `name: 'TimePrice'`, `description`, `version: '0.1.0'`.
  - `permissions: ['storage']` — **nic víc** (žádné `tabs`, `scripting`, `webNavigation` zatím). Host permissions řešíme v tasku 12 minimalisticky.
  - `action` (popup) → `entrypoints/popup`.
  - Content script `matches: ['<all_urls>']`, ale `run_at: 'document_idle'`. (Default-on chování řešíme runtime gatingem v tasku 09, ne manifestem.)
- `manifestVersion: 3`.
- Cíl: `chrome` default; konfigurace připravená i pro `firefox` target (task 19), ale neaktivovat.

### 3. Adresářová struktura

```
TimePrice/
├── wxt.config.ts
├── package.json
├── tsconfig.json
├── entrypoints/
│   ├── background.ts            # service worker (zatím prázdný + lifecycle log)
│   ├── content.ts               # content script entry (zatím jen log)
│   └── popup/
│       ├── index.html
│       ├── main.ts
│       └── App.svelte           # placeholder „TimePrice" + verze
├── src/
│   ├── core/                    # PURE TS — žádný DOM, žádné browser API
│   │   ├── parser/              # task 04
│   │   ├── convert/             # task 05
│   │   └── types.ts
│   ├── content/                 # DOM-bound engine (tasky 06–08, 10, 11)
│   │   └── adapters/
│   ├── settings/                # task 02
│   └── ui/                      # sdílené Svelte komponenty
├── tests/
│   ├── unit/
│   └── fixtures/                # HTML fixtury eshopů (task 14)
└── assets/
    └── icons/                   # placeholder ikony (real v tasku 13)
```

Vytvořit `.gitkeep` v prázdných adresářích, které ještě nemají kód (`src/content/adapters/`, `tests/fixtures/`).

### 4. `tsconfig.json`

- `strict: true`, `noUncheckedIndexedAccess: true`, `target: ES2022`, `moduleResolution: bundler`.
- Path alias `@/*` → `src/*` a `@core/*` → `src/core/*`.
- Zahrnout WXT generované typy (`.wxt/tsconfig.json` extends).

### 5. Lint & format

- ESLint flat config (`eslint.config.js`): TS + Svelte, `eslint-config-prettier` na konci.
- Prettier `.prettierrc`: 2 spaces, single quotes, trailing commas, print width 100.
- Pravidlo: **`src/core/**` nesmí importovat nic z `webextension-polyfill`, `entrypoints/` ani DOM API** — to vynutíme později ESLint `no-restricted-imports` (nastavit už teď, drží to čistotu jádra pro testy).

### 6. Vitest

- `vitest.config.ts`: dva projekty/environments —
  - `node` env pro `tests/unit/**` testující `src/core/**` (žádný DOM).
  - `jsdom` env pro pozdější DOM testy (`tests/dom/**`) — připravit konfiguraci, zatím bez testů.
- Skript `test`, `test:watch`, `test:coverage`.
- Smoke test: `tests/unit/smoke.test.ts` ověří `1 + 1 === 2`, aby CI greenfield prošel.

### 7. `package.json` skripty

```jsonc
{
  "scripts": {
    "dev": "wxt",
    "build": "wxt build",
    "zip": "wxt zip",
    "check": "svelte-check && tsc --noEmit",
    "lint": "eslint . && prettier --check .",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### 8. Placeholder obsah

- `entrypoints/content.ts`: `export default defineContentScript({ matches: ['<all_urls>'], main() { console.debug('[TimePrice] content loaded'); } })`.
- `entrypoints/background.ts`: `export default defineBackground(() => { console.debug('[TimePrice] background loaded'); })`.
- `popup/App.svelte`: nadpis „TimePrice", verze z `import { version } from '../../package.json'`, text „Nastavení sazby přijde v tasku 03".

### 9. Verifikace

```bash
pnpm install
pnpm check
pnpm lint
pnpm test
pnpm dev   # otevře Chrome s načtenou extension
```

V Chromu: `chrome://extensions` → vidět „TimePrice" (dev). Otevřít libovolný web → DevTools console → „[TimePrice] content loaded". Kliknout na ikonu → popup s nadpisem.

## Mimo scope

- Žádná detekce cen, žádný parser, žádná konverze (tasky 04–05).
- Žádný settings storage (task 02), popup je čistý placeholder.
- Žádné reálné ikony (task 13) — použít WXT default placeholder ikony.
- Žádný options page zatím (přidá se v tasku 03 nebo 09, pokud bude potřeba víc než popup).
- Žádné host permissions nad `<all_urls>` match — minimalizace je task 12.

## Hotovo když

- `pnpm install && pnpm check && pnpm lint && pnpm test` projde zeleně.
- `pnpm dev` načte extension do Chromu bez chyb.
- Content script loguje na libovolném webu; popup se otevře a ukáže nadpis + verzi.
- Adresářová struktura odpovídá bodu 3; `src/core/` je prázdné ale s aliasy a lint guardem proti DOM/browser importům.
- `manifest.json` (generovaný) má jen `storage` permission a žádné varování v `chrome://extensions`.

## Rizika

- **WXT `init` na neprázdném adresáři** může chtít přepsat `tasks/`/docs. Zazálohovat přes git (`git add -A && git stash` není potřeba — soubory jsou už commitnuté po prvním commitu) nebo init v temp adresáři a smergovat.
- **Svelte 5 vs WXT modul kompatibilita** — ověřit verze `@wxt-dev/module-svelte` proti Svelte major. Pokud kolize, pinnout Svelte 4 a poznamenat v tasku.
- **`<all_urls>` content script** vyvolá v review později pozornost (task 12). Teď OK pro dev, ale počítat s justifikací do store listingu.

## Reference

- WXT Getting Started: <https://wxt.dev/guide/installation.html>
- WXT Svelte module: <https://wxt.dev/guide/essentials/frontend-frameworks.html>
- WXT entrypoints: <https://wxt.dev/guide/essentials/entrypoints.html>
- Keymoji `tasks/01-scaffolding.md` — analogický scaffolding task (jiná platforma, stejný duch)
