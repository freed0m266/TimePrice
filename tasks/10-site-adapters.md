# 10 — Site adapter framework + první adaptéry

**Status:** Todo

**Priorita:** v1.0 · **Úsilí:** L · **Dopad:** Vysoký

## Cíl

Zavést tenkou vrstvu site-adaptérů: registry, který podle aktuální domény vybere adaptér, jenž generickému engine řekne, **kde přesně** ceny na daném eshopu hledat (CSS selektory cenových kontejnerů), které ceny ignorovat (košík input, srovnávací cena), a jak řešit split-price patterny specifické pro ten web. Generický engine (tasky 06–08) zůstává fallback pro všechny ostatní weby. Dodat adaptéry pro top CZ eshopy.

## Kontext

- Rozhodnutí z grill-me: **generický engine + tenké site-adaptéry pro top eshopy**. Generická vrstva drží pokrytí všude; adaptéry zvedají přesnost tam, kde to nejvíc vidí uživatelé.
- Adaptér **nenahrazuje** parser/converter — jen zužuje a upřesňuje, kde scanner kope. Pořád platí měnová kotva (task 04), pokud adaptér explicitně neřekne „v tomto selektoru je cena i bez kotvy" (povolená výjimka z grill-me — kotvu může web dávat do separátního elementu).
- Adaptéry řeší reálné bolesti: cena rozdělená přes `<span class="price">30 000</span><span class="currency">Kč</span>`, srovnávací/přeškrtnutá cena v jiném selektoru, cena za kus vs za balení, „od" ceny ve filtru.

## Scope

### 1. Adapter interface — `src/content/adapters/types.ts`

```ts
export interface SiteAdapter {
  /** registrable domény, na které se adaptér váže. */
  domains: string[];
  /** Selektory cenových kontejnerů; scanner scanuje JEN uvnitř (perf + přesnost). */
  priceSelectors?: string[];
  /** Selektory, které vždy ignorovat (košík qty, doprava zdarma threshold, srovnání). */
  ignoreSelectors?: string[];
  /** Volitelný custom extractor pro split-price uvnitř kontejneru. */
  extract?: (container: Element) => AdapterPriceMatch[] | null;
  /** Povolit cenu bez měnové kotvy uvnitř priceSelectors (web dává Kč separátně). */
  allowAnchorless?: boolean;
}
```

### 2. Registry — `src/content/adapters/registry.ts`

```ts
export function getAdapter(host: string): SiteAdapter | null; // dle registrableDomain
export const GENERIC_FALLBACK: null; // null = použij generický scan(document.body)
```

- Scanner/observer (tasky 06, 08) se zeptají registry: je adaptér? → scanuj jen `priceSelectors` podstromy, aplikuj `ignoreSelectors`, použij `extract` pokud je. Není? → generický `scan(document.body)`.

### 3. První adaptéry — `src/content/adapters/sites/`

Pořadí dle návštěvnosti a bolestivosti detekce. Pro každý: ručně projít reálný web, najít selektory produktové karty, výpisu, detailu, košíku.

- `alza.ts` — Alza.cz (cenové bloky `.price-box__price`, srovnávací `.price-box__compare-price` apod. — ověřit aktuální DOM).
- `mall.ts` — Mall.cz / Allegro CZ.
- `datart.ts` — Datart.cz.
- `czc.ts` — CZC.cz.
- `notino.ts` — Notino.cz (React-heavy, split-price → dobrý test pro adaptér + observer).

> Selektory v dokumentu **needokumentuj natvrdo** (web se mění) — v kódu je drž s komentářem „ověřeno YYYY-MM" a v tasku 14 (E2E fixtury) ulož snapshot HTML, ať detekuješ regrese, když eshop změní markup.

### 4. Integrace s enginem

- Upravit orchestrátor (task 07/08): při startu `getAdapter(location.host)`. Předat scanneru `root`-y dle `priceSelectors` (víc rootů) a `ignoreSelectors` do `acceptNode` filtru (task 06 rozšířit o ignore predikát).
- Observer (task 08) při mutaci řeší jen podstromy protínající se s `priceSelectors` (perf + méně false positives).
- `allowAnchorless` propíše do parseru volání (parser dostane flag „v tomto scope kotva nepovinná" — rozšířit `ParseOptions` z tasku 04 nebo řešit na úrovni adaptéru `extract`).

### 5. Robustnost proti změně markupu

- Adaptér musí **degradovat na generický engine**, když jeho selektory nic nenajdou (eshop předělal web). Tj. „adaptér nic nevrátil" → fallback na generický scan, ne prázdná stránka bez konverze. Logovat (debug) „adapter X selectors stale".

### 6. Testy — `tests/dom/adapters.test.ts` + fixtury

- Pro každý adaptér mini-fixtura (zjednodušený HTML snapshot karty) → ověřit, že najde cenu(y) na správných místech a ignoruje košík/srovnání dle `ignoreSelectors`.
- Stale-selector fallback: adaptér se selektory, co nic netrefí, → engine spadne na generický scan a cenu přesto najde.
- A/B markup varianta (dvě verze karty) → adaptér zvládne obě, nebo fallback.

## Mimo scope

- Per-unit sémantika (`/měsíc`, `/kg`) — task 16; adaptér teď jen lokalizuje cenu, nerozlišuje jednotku.
- Více než 5 eshopů v MVP — další se přidávají inkrementálně (každý je malý PR), ne všechny najednou.
- Zahraniční eshopy (jiná měna) — task 18.
- Automatické generování adaptérů / crowdsourcing selektorů — Future.

## Hotovo když

- Registry vybírá adaptér dle domény; bez adaptéru běží generický engine.
- 5 adaptérů (Alza, Mall, Datart, CZC, Notino) převádí ceny na produktové kartě, ve výpisu i v detailu, ignoruje košík qty a srovnávací ceny dle definice.
- Stale selektory → graceful fallback na generický engine (žádná prázdná/rozbitá stránka).
- Adapter testy + fixtury procházejí.
- Manuální smoke test na všech 5 reálných webech: ceny převedené, web vizuálně drží, košík/qty netknuté.

## Rizika

- **Křehkost selektorů** — eshopy mění markup průběžně. Mitigace: fallback na generický engine + fixture regrese (task 14) + komentář s datem ověření. Adaptéry jsou „nice to have on top", ne single point of failure.
- **Notino/React split-price** — nejtěžší case; dobrý lakmus pro `extract` + observer re-aplikaci. Pokud `extract` nestihneme, nechat Notino na generickém engine + konzervativním glue (task 06).
- **Over-fitting na jednu variantu** — eshopy běží A/B testy (prompt to zmiňuje). Adaptér nesmí předpokládat jediný markup; psát selektory tolerantně a vždy s fallbackem.
- **Maintenance burden** — 5 adaptérů = 5 věcí, co se rozbije. Záměrně malý počet v MVP; rozšiřovat podle reálné potřeby a uživatelské zpětné vazby, ne preventivně.

## Reference

- Task 04 — parser + `ParseOptions` (anchorless flag).
- Task 06 — scanner (rozšířit o `root` selektory + ignore predikát).
- Task 08 — observer (omezit na `priceSelectors` podstromy).
- Task 14 — fixture regrese pro selektory.
