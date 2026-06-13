# TimePrice

Chrome extension (MV3) converting e-shop prices into the work time needed to earn them. Built with **WXT** + **TypeScript**, popup UI in **Svelte**, content engine in vanilla TS.

> No code exists yet. The repo is a roadmap: [`tasks/README.md`](tasks/README.md) and numbered `tasks/*.md` are the binding scope. Build top-down; order respects dependencies.

## Stack

- **WXT** (Vite-based extension framework) — file-based entrypoints, auto manifest, HMR, cross-browser.
- **TypeScript** strict. **Svelte** for popup/options only. **Vanilla TS** for the content engine (perf).
- **Vitest** (unit + jsdom), **Playwright** (E2E). **pnpm**.
- `webextension-polyfill` (`browser.*`, never `chrome.*` hardcoded — cross-browser ready).

## Layers (strict boundaries)

- **`src/core/**`** — PURE TS. No DOM, no browser APIs, no `webextension-polyfill`. Houses the price `parser/` and the `convert/` engine (`Converter` interface + `TimeConverter`). Fully unit-testable in node. ESLint enforces the no-DOM/no-browser import ban here.
- **`src/content/**`** — DOM-bound engine: `scanner` (TreeWalker), `mutator` (in-place replace + revert + tooltip), `observer` (MutationObserver + guard), `adapters/` (site overrides + registry).
- **`src/settings/**`** — `AppSettings` + `chrome.storage.sync` wrapper + sensitive-domain blocklist. Runs in both popup and service worker; no DOM.
- **`entrypoints/`** — WXT entrypoints: `content.ts`, `background.ts`, `popup/` (Svelte).

## Data flow

`scanner.scan()` → `parser.parsePrices()` → `convert.formatTime()` → `mutator.applyAll()` (stores original in `data-tp-*` attrs) → `observer` re-applies on dynamic changes. All gated by `settings.isActiveForHost()` (global / per-site / blocklist).

## Core invariants

- **Currency anchor required.** The parser only matches numbers with `Kč` / `CZK` / `,-`. No anchorless guessing (kills false positives). Adapters may opt into anchorless within explicit selectors.
- **Offset invariant.** `text.slice(match.start, match.end) === match.raw` always holds. Replace matches back-to-front to keep offsets valid.
- **Idempotent + reversible.** Mutator wraps prices in `<span data-timeprice>` with the original in `data-tp-original`. Re-running never double-processes; `revertAll()` restores exact original text.
- **No MutationObserver loop.** Self-writes are wrapped in a guard and flushed via `observer.takeRecords()`. The scanner skips `data-timeprice` subtrees as a second guard.
- **Pluggable `Converter`.** Future metrics (% income, days, savings) are new `Converter` implementations behind the registry — never a rewrite of scan/mutate/observe.
- **Privacy is a hard constraint.** No `fetch`/`XMLHttpRequest`/`WebSocket`/`sendBeacon` anywhere in `core`/`content`/`entrypoints`. No analytics, no backend. ESLint enforces this.

## Build & test

```bash
pnpm dev            # load unpacked extension into Chrome (HMR)
pnpm build          # production bundle
pnpm zip            # store package
pnpm test           # Vitest (unit + jsdom)
pnpm check          # svelte-check + tsc --noEmit
pnpm lint           # ESLint + Prettier
```

Core logic changes (`parser`, `convert`) require passing unit tests. DOM changes get jsdom tests + a manual smoke test on a real e-shop (Alza). E2E lives in [task 14](tasks/14-e2e-and-release.md).

## Conventions

- Time output shows the **top two units** (ladder `d`→`h`→`min`→`s`, a "day" = `workdayHours`), e.g. `1 h, 59 min`, `62 d, 4 h`, `46 s`; a zero second unit is dropped (`30 h`). The legacy `rounding` setting is ignored by the converter (kept only for stored-settings compat).
- Per-site state and blocklist key on `registrableDomain` (`www.alza.cz` → `alza.cz`).
- Settings read merges over `DEFAULT_SETTINGS` — missing keys default, no migrations until `schemaVersion` bumps.
- Content engine stays framework-free; Svelte is popup-only.

## Task workflow

- Numbered task files define Scope, Mimo scope (out of scope), Hotovo když (done criteria), Rizika (risks). Treat them as binding.
- If a task marks something out of scope, do not implement it opportunistically.
- Future tasks (15–19) are **design docs only** — do not implement in MVP.
- Work on `main`, gitmoji-prefixed commits. Commit only when the user asks.
- Deeper agent-facing rules: [`AGENTS.md`](AGENTS.md).
