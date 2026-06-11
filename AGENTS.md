# TimePrice

TimePrice is a Manifest V3 Chrome extension that rewrites e-shop prices into the
work time needed to earn them ("30 000 Kč" → "30 h"). It is built to feel
invisible: the page must look unchanged, only the numbers speak in time.

Core product constraints:

- **No network, ever** from the content script, core, or background. No analytics,
  telemetry, crash reporting, ads, remote SDKs, or backend. Settings live only in
  `chrome.storage.sync`. Privacy claim "we send nothing, everything is local" is
  load-bearing and must never be silently broken.
- **CZK only** in the MVP. Multi-currency is a future design doc, not scope.
- **Currency anchor required** for detection — minimise false positives over coverage.
- **Do not change the page's look.** In-place text replacement only; inherit all styling.
- Chrome-first, but code is cross-browser ready: use `browser.*` via
  `webextension-polyfill`, never hardcode `chrome.*`.

## Important Files

- [`README.md`](README.md) — high-level product and architecture overview.
- [`tasks/README.md`](tasks/README.md) and numbered `tasks/*.md` — the roadmap and the
  binding source of scope. Each task has Cíl / Kontext / Scope / Mimo scope /
  Hotovo když / Rizika / Reference.
- [`CLAUDE.md`](CLAUDE.md) — condensed architecture + invariants quick reference.
- `wxt.config.ts` — manifest + build config (generated manifest, keep permissions minimal).
- `marketing/privacy-policy.html` — privacy policy source of truth (task 12).

## Architecture Boundaries

- **`src/core/**` is pure.** No DOM, no browser APIs, no `webextension-polyfill`.
  It contains the price `parser/` (CZK formats, currency anchor) and the `convert/`
  engine (`Converter` interface, `TimeConverter`, smart unit formatter). It must be
  unit-testable in a node environment. ESLint forbids DOM/browser imports here — keep it that way.
- **`src/content/**` owns the DOM.** `scanner.ts` (TreeWalker → candidates),
  `mutator.ts` (in-place replace, revert, tooltip), `observer.ts`
  (MutationObserver + guard), `adapters/` (per-site selectors + registry).
- **`src/settings/**`** holds `AppSettings`, the `chrome.storage.sync` wrapper, domain
  normalization, and the sensitive-domain blocklist. Runs in popup and service worker; no DOM.
- **`entrypoints/`** are WXT entrypoints. The content engine is framework-free; Svelte
  is for `popup/` (and any future options page) only.

## Critical Invariants (do not violate)

- **Currency anchor.** `parsePrices` matches only numbers carrying `Kč` / `CZK` / `,-`.
  Never add anchorless heuristic guessing to the generic engine. Adapters may opt into
  anchorless matching, but only within explicit CSS selectors.
- **Offset invariant.** `text.slice(match.start, match.end) === match.raw`. Replace
  matches back-to-front so earlier offsets stay valid.
- **Idempotent + reversible.** Replaced prices are wrapped in `<span data-timeprice>`
  carrying `data-tp-original` / `data-tp-value` / `data-tp-hours`. Re-running must never
  double-process. `revertAll()` must restore byte-identical original text.
- **No observer loop.** Wrap self-writes in the guard and flush them with
  `observer.takeRecords()` immediately after writing. The scanner skipping
  `data-timeprice` subtrees is the second line of defense. Be especially careful with
  `characterData: true` — it is the most likely loop source; test aggressively.
- **Survive SPA re-renders.** When React/Vue overwrites a `data-timeprice` span, the
  observer must re-apply, not crash and not loop. Never assume document structure is stable.
- **Pluggable Converter.** Adding metrics (% income, workdays, savings) means adding a
  `Converter` implementation behind the registry — not touching scan/mutate/observe.
- **Privacy.** No `fetch` / `XMLHttpRequest` / `WebSocket` / `sendBeacon` / `EventSource`
  in `core` / `content` / `entrypoints`. ESLint enforces it; do not bypass. Any networking
  (e.g. future monetization) requires explicit user opt-in and must stay out of the content path.

## Detection & Safety Rules

- Skip `<script>`, `<style>`, `<noscript>`, `<textarea>`, `<select>`, `<input>`,
  `contenteditable`, and already-processed (`data-timeprice`) subtrees.
- Never mutate `<input>`/`<textarea>` values or canvas/raster images. SVG `<text>` is
  best-effort only.
- Discounts: convert both prices, leave the strikethrough styling untouched (we replace
  text content, not elements).
- The sensitive-domain blocklist (banks, payment gateways, gov, brokers) is a hard gate:
  TimePrice never runs there even when globally enabled. Prefer over-blocking. Key blocklist
  and per-site state on `registrableDomain`.

## Build And Test

```bash
pnpm install
pnpm dev            # load unpacked extension into Chrome (HMR)
pnpm build          # production bundle
pnpm zip            # Chrome Web Store package
pnpm check          # svelte-check + tsc --noEmit
pnpm lint           # ESLint + Prettier
pnpm test           # Vitest (unit + jsdom)
```

- Pure-logic changes (`src/core/**`) require passing, near-exhaustive unit tests
  (parser and converter target ≥95% coverage). Include negative cases for the parser —
  zero false positives on the test set is the bar.
- DOM changes get jsdom tests plus a manual smoke test on a real e-shop (Alza at minimum).
- Verify "no network" in DevTools → Network on a real page after any change touching
  content/background.
- E2E (Playwright on local fixtures) and the QA matrix live in
  [task 14](tasks/14-e2e-and-release.md); run them before any release.

## Task Workflow

- Treat numbered task files as binding: implement what is in Scope, respect Mimo scope.
- If a task says something is out of scope, do not implement it opportunistically.
- Future tasks (15–19) are design documents only — do not implement them in the MVP.
- Update a task's status only when the requested work and its verification are complete.
- Key tasks (04, 05, 07, 08, 10) ask for `pnpm test` + lint and, for DOM tasks, a real-site
  smoke test before the closing commit.

## Git Hygiene

- Work on `main`, incremental commits, gitmoji-prefixed subjects
  (`✨`, `🐛`, `📝`, `💄`, `📸`, `👷`, `🧹`, `🚧`, `✅`, `⚡️`).
- The worktree may contain user changes. Never revert unrelated edits.
- Do not commit unless the user explicitly asks.
