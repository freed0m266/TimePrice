# TimePrice

Chrome extension (MV3), která na e-shopech převádí ceny na **čas potřebný k jejich vydělání**. Místo „30 000 Kč" uvidíš „30 h" — podle své čisté hodinové sazby. Cílem je nezměnit pocit z webu: stránka vypadá stejně, jen čísla mluví v čase.

> Status: **návrh / pre-implementace.** Kód zatím neexistuje — repozitář obsahuje kompletní roadmapu v [`tasks/`](tasks/README.md), podle které se staví. Tahle README popisuje produkt a architekturu; `tasks/` je závazný zdroj scope.

## Co to dělá

- Najde ceny s měnovou kotvou (`Kč` / `CZK` / `,-`) na libovolném e-shopu.
- Nahradí je in-place časovým ekvivalentem ve **smart jednotce** (minuty / hodiny / pracovní dny).
- Původní cenu ukáže na hover (tooltip) — u pokladny pořád víš, kolik reálně platíš.
- U slev převede obě ceny a zachová přeškrtnutí.
- Funguje i na React/Vue/SPA webech a při infinite scrollu (živý `MutationObserver`).
- Běží lokálně, **nic neposílá na síť**. Žádná analytics, žádný backend.

## Klíčová rozhodnutí

Vzešla z grill-me návrhové session a jsou závazně rozepsaná v jednotlivých taskech:

| Oblast | Rozhodnutí |
|---|---|
| Detekce | CZK only, generický engine + tenké site-adaptéry pro top CZ eshopy |
| Build | [WXT](https://wxt.dev) (MV3, Vite, file-based manifest, cross-browser ready) |
| Zobrazení | In-place náhrada textu, původní cena v tooltipu |
| Sazba | Volná čistá hodinovka (presety 500/1000/1500 + custom), žádný daňový engine |
| Jednotka | Smart auto-scaling (min / h / pracovní dny), pluggable konvertor |
| Detekce cen | Vyžadovat měnovou kotvu — minimum false positives |
| DOM | In-place mutace text nodeů + idempotentní guard, re-aplikace při re-renderu |
| Monetizace | MVP 100 % free/local; monetizace jen design (task 15), nestaví se |
| Popup UI | Svelte (content engine = vanilla TS) |
| Prohlížeče | Chrome-first, kód cross-browser ready |
| Default | Běžet všude + global/per-site toggle + blocklist citlivých domén (banky, platby, gov) |

## Architektura (cílová)

```
entrypoints/
  content.ts         # injectovaný engine (vanilla TS, perf-critical)
  background.ts      # service worker (lifecycle, minimální)
  popup/             # Svelte — onboarding sazby + ovládání
src/
  core/              # PURE TS, žádný DOM — unit-testovatelné
    parser/          # detekce CZK cen (měnová kotva, formáty)
    convert/         # Converter interface + TimeConverter + smart jednotka
  content/           # DOM-bound engine
    scanner.ts       # TreeWalker → kandidáti cen
    mutator.ts       # in-place náhrada + reverzibilita + tooltip
    observer.ts      # MutationObserver + guard (SPA, infinite scroll)
    adapters/        # site-adaptéry (Alza, Mall, Datart, CZC, Notino) + registry
  settings/          # AppSettings + chrome.storage.sync wrapper + blocklist
  ui/                # sdílené Svelte komponenty
tests/               # unit (core) + jsdom (DOM) + Playwright E2E + fixtury
```

Datový tok: `scanner` najde cenu → `parser` ji rozparsuje → `converter` spočítá čas → `mutator` ji nahradí a uloží originál → `observer` hlídá dynamické změny a re-aplikuje. Vše gatováno přes `settings` (global/per-site/blocklist).

Klíčová abstrakce pro budoucnost: **`Converter` interface** (task 05) — další metriky (% příjmu, dny, spoření z promptové vize) jsou jen nové implementace, ne přepis enginu.

## Roadmapa

Plná roadmapa s dependency pořadím: [`tasks/README.md`](tasks/README.md).

- **Tasky 01–08** → plně funkční engine na běžných i SPA webech.
- **Tasky 09–10** → kontrola (toggly, blocklist) a přesnost (adaptéry).
- **Tasky 11–14** → výkon, privacy, ikony, E2E + release.
- **Tasky 15–19** → Future design dokumenty (monetizace, další metriky, panely, multi-currency, Firefox/Edge) — **nestaví se v MVP**, jen fixují směr.

## Vývoj

```bash
pnpm install
pnpm dev          # načte rozbalenou extension do Chromu (HMR)
pnpm build        # produkční bundle
pnpm zip          # balík pro Chrome Web Store
pnpm test         # Vitest (unit + jsdom)
pnpm check        # svelte-check + tsc --noEmit
pnpm lint         # ESLint + Prettier
```

(Toolchain se zřizuje v [tasku 01](tasks/01-scaffolding.md).)

## Privacy

TimePrice nesbírá ani neodesílá žádná data. Tvá sazba a nastavení žijí jen v `chrome.storage.sync` (synchronizace přes tvůj Google účet, ne náš server). Obsah stránek (ceny) se zpracovává lokálně a nikam neopouští zařízení. Detail v [tasku 12](tasks/12-privacy-and-permissions.md).

## Známé limitace (MVP)

- Jen **CZK** (cizí měny → [task 18](tasks/18-future-multicurrency.md)).
- Ceny v `<canvas>` a rasterových obrázcích se nepřevádějí (nelze spolehlivě číst).
- Ceny rozdělené přes víc elementů řeší adaptéry; mimo top eshopy nemusí být vždy zachyceny.
- Blocklist citlivých domén je konzervativní, ale ne vyčerpávající.
