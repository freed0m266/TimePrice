# 05 — Time converter + smart unit formatter (pluggable `Converter`)

**Status:** Done — 2026-06-12

**Priorita:** v1.0 · **Úsilí:** M · **Dopad:** Blokující

## Cíl

Čistá vrstva, která z ceny (Kč) a uživatelovy sazby spočítá čas a naformátuje ho do **smart auto-scaling jednotky** (minuty / hodiny / pracovní dny) jako lidsky čitelný řetězec („25 min", „30 h", „3,75 dne"). Postaveno za **pluggable `Converter` rozhraním**, aby budoucí metriky (% příjmu, spoření — task 16) byly jen další implementace, ne přepis. Plně unit-testované, žádný DOM.

## Kontext

- Rozhodnutí z grill-me: **smart auto-scaling** jednotka — `<1 h` → minuty, `1–40 h` → hodiny, `>40 h` (resp. > workday) → pracovní dny. Pracovní den konfigurovatelný (`workdayHours`, default 8) z settings (task 02).
- Pluggable `Converter` interface je explicitní příprava na vizi z promptu (dny, % ročního příjmu, týdny spoření). MVP dodá **jednu** implementaci: `TimeConverter`. Architektura ale musí umožnit přidat další bez zásahu do content enginu.
- Formátování je **česky** a musí znít přirozeně: skloňování jednotek („1 hodina" / „2 hodiny" / „5 hodin") — nebo zvolit kompaktní neutrální tvar („1 h", „30 h", „3,75 dne") který skloňování obchází. **Rozhodnutí: kompaktní tvar** (`min`, `h`, `dne`/`dny`) — kratší, vejde se místo ceny, neměníme layout. Plné skloňování je over-engineering pro inline náhradu.
- Popup (task 03) použije **stejný** `formatTime()` pro live preview — jeden zdroj pravdy.

## Scope

### 1. `Converter` rozhraní — `src/core/convert/converter.ts`

```ts
export interface ConversionContext {
  netHourlyRateCzk: number;
  workdayHours: number;   // default 8
  workweekDays: number;   // default 5 (rezerva pro task 16)
  rounding: 'auto' | 'tenths' | 'whole';
}

export interface ConversionResult {
  /** Hotový lidský řetězec k vložení místo ceny, např. "30 h". */
  display: string;
  /** Strojová hodnota pro tooltip/řazení (hodiny). */
  hours: number;
  /** Vybraná jednotka — pro testy a budoucí styling. */
  unit: 'min' | 'h' | 'day';
}

export interface Converter {
  readonly id: string; // 'time' pro MVP
  convert(priceCzk: number, ctx: ConversionContext): ConversionResult;
}
```

### 2. `TimeConverter` — `src/core/convert/timeConverter.ts`

- `hours = priceCzk / ctx.netHourlyRateCzk`.
- Výběr jednotky (auto-scaling):
  - `hours * 60 < 60` (tj. < 1 h) → **minuty**: `Math.round(hours * 60)` + „min". Pod 1 min → „<1 min".
  - `hours <= workdayHours * 5` (≈ ≤ 1 pracovní týden, práh laditelný — default „do ~40 h ukazuj hodiny") → **hodiny**: zaokrouhlení dle `rounding`, „h".
  - jinak → **pracovní dny**: `hours / workdayHours`, „dne"/„dny" (kompaktně lze jen „d" — ale „dne" je čitelnější; zvolit `X,Y d` pro kompaktnost a konzistenci se zarovnáním? **Rozhodnutí: `min` / `h` / `d`** jednopísmenné suffixy kromě případu, kdy chceme čitelnost — viz bod 4).
- Zaokrouhlení:
  - `auto`: hodiny na celé do 10 h, nad to taky celé; minuty na celé; dny na 1 desetinné místo. (Cíl: krátké, ne „29,9999 h".)
  - `tenths`: vždy 1 desetinné místo.
  - `whole`: celá čísla.
- Desetinná **čárka** (české formátování) ve výstupu: `3,75` ne `3.75`. Použít `Intl.NumberFormat('cs-CZ')` nebo ruční replace.

### 3. `formatTime()` fasáda — `src/core/convert/index.ts`

```ts
export function formatTime(priceCzk: number, ctx: ConversionContext): ConversionResult;
```

- Tenká fasáda nad default `TimeConverter`. Tohle volá content mutator (task 07) i popup preview (task 03).
- Registry pattern připravit (`Map<string, Converter>`), ale v MVP s jediným záznamem `'time'`. Task 16 sem přidá další a popup/settings umožní výběr.

### 4. Edge cases formátování

- `priceCzk === 0` → „0 min" (nebo necháme být? Rozhodnutí: „0 min" je OK, ale parser typicky 0 odfiltruje).
- Velmi malá cena (19 Kč @ 1000/h = 0,019 h = ~1 min) → „1 min".
- Velmi velká (2 000 000 Kč @ 1000/h = 2000 h = 250 dní) → „250 d" — čitelné. Nešplhat do „let" v MVP (možná rozšíření, ale 250 d je OK).
- Sazba `null`/0 → **nevolat** (content engine to gatuje). Pokud přesto, vrátit prázdný `display` a `convert` no-op (defenzivně, ale primárně guard u volajícího).
- Záporná cena → ignorovat (parser ji nevrátí).

### 5. Testy — `tests/unit/converter.test.ts` (povinné)

- Auto-scaling hranice: 19 Kč @ 1000 → „1 min"; 999 Kč @ 1000 → „1 h" (nebo „60 min"? definovat práh přesně a otestovat); 30000 Kč @ 1000 → „30 h"; 500000 Kč @ 1000 → „X d".
- Sazby: 500 / 1000 / 1500; ověřit, že 30000 @ 500 = 60 h, @ 1500 = 20 h.
- České desetinné čárky v outputu (`3,75` ne `3.75`).
- `rounding` varianty.
- `workdayHours` jiný než 8 (např. 6) mění práh dnů.
- Determinismus: stejný vstup → stejný výstup (žádné `Date`/`Math.random`).

## Mimo scope

- Žádné další metriky (dny jako % příjmu, spoření) — to je task 16, jen připravit interface.
- Žádný DOM, žádné vkládání do stránky (task 07).
- Žádné per-unit ceny (`/měsíc`, `/kg`) — task 16; converter dostává čistou hodnotu.
- Žádná měna kromě CZK.
- Žádné plné morfologické skloňování jednotek (vědomě kompaktní suffixy).

## Hotovo když

- `Converter` interface + `TimeConverter` + `formatTime()` existují v `src/core/convert/`, čistě (žádný DOM/browser import).
- Auto-scaling vybírá min/h/d podle prahů a `workdayHours`.
- Výstup používá českou desetinnou čárku a kompaktní suffix.
- Všechny testy v bodě 5 procházejí; coverage ≥ 95 %.
- Popup (task 03) lze přepojit na `formatTime()` (TODO marker z tasku 03 vyřešen — udělat v rámci tohoto tasku jako follow-up commit).

## Rizika

- **Práh mezi jednotkami** je UX otázka, ne jen technická. „999 Kč = 1 h vs 60 min" — zvolit prahy, otestovat na reálných cenách a v případě potřeby doladit (konstanta nahoře v souboru, ne magické číslo roztroušené).
- **Zarovnání délky** — „3,75 d" je delší než „30 h" a může rozhodit úzké cenové kontejnery (task 07 řeší šířku/overflow). Converter má držet výstup co nejkratší.
- **Nepřesnost vnímání** — uživatel uvidí „30 h" a může to brát doslova; mikrocopy v popupu (task 03) musí říct „orientačně, podle tvé čisté sazby". Není to bug converteru, ale produktové riziko.

## Reference

- Task 02 — `ConversionContext` pole pochází z `AppSettings`.
- Task 03 — popup preview přepojí na `formatTime()`.
- Task 07 — mutator volá `formatTime()` per cena a vkládá `display` + ukládá `hours` do data-atributu.
- Task 16 — budoucí `Converter` implementace (dny, % příjmu).
- `Intl.NumberFormat`: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat>
