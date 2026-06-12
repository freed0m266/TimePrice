# Test fixtures

Cleaned, offline HTML snapshots of e-shop pages. They are the deterministic substrate for two
test layers, so neither depends on the live web:

- **jsdom integration + adapter regression** — [`tests/integration/`](../integration), run by
  `pnpm test`. Loads each fixture's `<body>` into jsdom and runs the real engine
  (scan → parse → convert → mutate → observe).
- **Playwright E2E** — [`tests/e2e/`](../e2e), run by `pnpm test:e2e`. A static server roots at
  this folder; Chromium loads the built extension and navigates to each fixture (under a spoofed
  host, so the real adapter/blocklist host gating is exercised).

## Layout

| Path | Purpose |
| --- | --- |
| `sites/<name>.html` | One rich page per shipped adapter (Alza, Mall, Datart, CZC, Notino). Each exercises **every** `priceSelector` and at least one `ignoreSelector` (nested inside a price container, where ignore actually fires). This is the regression pin: if an e-shop changes its markup and a selector stops matching, the adapter test goes red. |
| `generic/*.html` | Pages with no adapter — the generic anchored engine runs on `document.body`. Cover product detail, listing, and prose, plus the currency-anchor invariant (bare numbers, years, specs must not convert). |
| `edge/discount.html` | Strikethrough original + sale price — both convert, `<del>` and line-through stay intact. |
| `edge/split-price.html` | Amount and `Kč` in separate elements — the generic engine leaves it alone (no `30 h Kč` artifact). |
| `edge/unit-price.html` | `Kč/kg`, `Kč / měsíc` — the amount converts, the unit suffix is preserved (offset invariant). |
| `edge/no-prices.html` | Numbers but no currency anchor — zero conversions. |
| `edge/dynamic.html` | Injects a price ~150 ms after load — the observer converts it live. Inline script runs under Playwright; jsdom drives the injection directly. |
| `edge/spa.html` | `history.pushState` + content swap on a button — the observer re-passes the new view. |
| `blocklist/bank.html` | Bank-like page — must stay untouched when served under a built-in-blocked host. |

Each file's top comment lists its **expected conversions** at the test rate (**1000 Kč/h**, 8 h
day, 5 d week, `auto` rounding), so a value like `30 000 Kč` reads back as `30 h`.

## Refreshing

These are a fast regression layer, not a substitute for live QA — the live matrix in
[`tests/QA.md`](../QA.md) stays part of every release. When a real e-shop ships a markup redesign:

1. Re-snapshot the relevant page, strip it to the price-bearing structure, and update
   `sites/<name>.html` (keep the selectors the adapter targets).
2. Update the adapter selectors in `src/content/adapters/sites/<name>.ts` if they moved.
3. Re-run `pnpm test` (regression) and `pnpm test:e2e`.

Prettier is told to ignore this folder (`.prettierignore`): whitespace inside price elements is
load-bearing (it defines the text-node boundaries the parser and offset-invariant tests rely on),
so it must not be reflowed.
