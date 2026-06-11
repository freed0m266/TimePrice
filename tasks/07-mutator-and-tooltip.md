# 07 — In-place mutator + reverzibilita + hover tooltip

**Status:** Todo

**Priorita:** v1.0 · **Úsilí:** L · **Dopad:** Blokující

## Cíl

Vzít kandidáty ze scanneru (task 06), nahradit cenu v textu jejím časovým ekvivalentem (`formatTime` z tasku 05) **in-place**, zabalit ji do `<span data-timeprice>` tak, aby šla kdykoliv vrátit zpět, zachovat původní cenu pro **tooltip na hover**, a nerozbít přitom okolní styl (včetně přeškrtnutí u slev). Po tomto tasku web reálně ukazuje čas místo cen.

## Kontext

- Rozhodnutí z grill-me: **in-place mutace text nodeů + idempotentní guard**, původní cena dostupná **na hover/tooltip**, slevy = **konvertovat obě ceny a zachovat přeškrtnutí**.
- Zachování přeškrtnutí je zadarmo: měníme jen text uvnitř existujícího elementu, `line-through`/`<del>`/`<s>` styl rodiče zůstává. Proto konvertujeme každou cenu nezávisle, bez speciální logiky pro slevy.
- Reverzibilita je nutná pro: (a) hover tooltip s původní cenou, (b) global/per-site vypnutí (task 09) → vrátit stránku do původního stavu bez reloadu, (c) re-aplikaci při změně sazby (task 08).
- Musíme být **idempotentní**: označený `data-timeprice` span se znovu nezpracuje (scanner ho už filtruje, ale mutator to musí garantovat i při re-běhu).

## Scope

### 1. Náhrada jednoho matche — `src/content/mutator.ts`

Pro každý `PriceMatch` v kandidátovi (od konce textu, aby se offsety nerozbily při postupné náhradě):

- Rozdělit původní `Text` node na tři části: před matchem, match, za matchem (`splitText`).
- Match `Text` nahradit `<span class="tp" data-timeprice>` který:
  - obsahuje `display` z `formatTime(match.value, ctx)` jako text,
  - nese data-atributy pro reverz a tooltip:
    - `data-timeprice` = marker
    - `data-tp-original` = původní `match.raw` (např. „30 000 Kč")
    - `data-tp-value` = `match.value` (číslo, pro budoucí re-konverzi bez re-parsování)
    - `data-tp-hours` = `result.hours`
  - **dědí styl** — span je `display: inline`, `color: inherit`, `font: inherit`. Žádná vlastní barva/velikost (cíl: „web vypadá stejně").
- Když cena pokrývá víc nodeů (split-price z tasku 06 / adaptér z tasku 10), nahradit jen „hodnotový" node a kotvu-node vyprázdnit (ne smazat — kvůli reverzu), nebo skrýt přes data-atribut. Zvolit přístup, který jde čistě vrátit.

### 2. Reverzibilita — `revert()`

```ts
export function revertAll(root?: Node): void;     // vrátí všechny tp spany do původního textu
export function revertSpan(span: HTMLElement): void;
```

- `revertSpan` přečte `data-tp-original`, nahradí span zpět prostým `Text` nodem a (ideálně) **znormalizuje** sousední text nodey (`parentNode.normalize()`), aby DOM nezbytněl. Tím je vypnutí (task 09) a re-aplikace (task 08) čisté.

### 3. Re-aplikace / re-konverze při změně sazby

- `reformatAll(ctx)` — projde existující `data-timeprice` spany a přepočítá `display` z `data-tp-value` novou sazbou **bez re-parsování DOM**. Volá to task 08/09 při změně settings. Levné (jen text update označených spanů).

### 4. Tooltip — `src/content/tooltip.ts`

- **CSS-only** tooltip na hover: `data-tp-original` ukázat přes `::after` + `content: attr(data-tp-original)` na `:hover`, nebo lehký `title` atribut jako baseline.
  - `title` = nejjednodušší, nativní, přístupné, žádný JS, žádné pozicování. **Default volba pro MVP.** Nevýhoda: zpoždění zobrazení a OS-styl. Akceptovatelné.
  - Hezčí CSS tooltip (`::after` bublina) jako vylepšení, pokud zbyde čas — ale pozor na `overflow: hidden` rodičů a z-index. Drž v `title` baseline, custom je nice-to-have.
- Tooltip ukazuje: původní cenu (např. „30 000 Kč") a volitelně přesnější čas. MVP: jen původní cena.

### 5. Styling izolace

- Třída `.tp` má **minimální** vlastní styl, vše `inherit`. Vložit jednou `<style>` (nebo přes WXT CSS injection) s `.tp { all: unset; ... }`? Ne — `all: unset` rozbije inherit fontu. Místo toho cíleně `color: inherit; font: inherit; text-decoration: inherit;` aby přeškrtnutí prošlo.
- **Žádné** layout-měnící vlastnosti (margin, padding, display: block). Cíl „neměnit pocit webu".

### 6. Aktivace — `src/content/index.ts` (orchestrátor, baseline)

- Tenký orchestrátor, který: načte settings (task 02), pokud `enabled` a `isActiveForHost` a `netHourlyRateCzk != null` → `scan()` → `applyAll(candidates, ctx)`. Plné napojení na observer a toggly je task 08/09; tady stačí „zapni jednou po načtení".

### 7. Testy — `tests/dom/mutator.test.ts` (jsdom)

- Náhrada: `<span>30 000 Kč</span>` @ 1000/h → text spanu „30 h", `data-tp-original="30 000 Kč"`, `data-tp-value="30000"`.
- Idempotence: druhý běh `applyAll` nic nezdvojí.
- Reverz: `revertAll` vrátí přesně původní text (`textContent` === původní).
- Sleva: `<del>30 000 Kč</del> <ins>24 000 Kč</ins>` → obě konvertované, `<del>` zůstává přeškrtnutý (struktura rodičů netknutá).
- Re-konverze: `reformatAll` s jinou sazbou změní `display`, ne `data-tp-value`.
- Multi-match v jednom nodu: `Bylo 30 000 Kč, teď 24 000 Kč` → dva spany, offsety sedí.

## Mimo scope

- Žádný MutationObserver (task 08) — tady jen jednorázová aplikace + API pro re-run.
- Žádné toggly/blocklist rozhodování (task 09) — orchestrátor jen zkontroluje `isActiveForHost` baseline.
- Žádná perf optimalizace (task 11).
- Custom animovaný tooltip — `title` baseline stačí; bublina je optional nice-to-have.
- Mutace `<input>`/`<canvas>` — out (viz tasks/README Mimo scope).

## Hotovo když

- Po načtení stránky s nastavenou sazbou se ceny s kotvou nahradí časem in-place, web vizuálně drží (font, barva, přeškrtnutí).
- Hover nad časem ukáže původní cenu (`title` minimálně).
- `revertAll` vrátí stránku do bitově shodného textového stavu.
- `reformatAll` přepočítá při změně sazby bez re-parsování.
- Idempotence: opakovaný běh nezdvojuje ani nerozbíjí.
- jsdom testy v bodě 7 procházejí + manuální smoke test na reálné Alze (alespoň produktová karta + výpis).

## Rizika

- **Rozbití offsetů při postupné náhradě** — nahrazovat matche **odzadu** (od největšího `start`), jinak se posunou indexy. Pokryto testem multi-match.
- **React reconciliation** — když nahradíme text node uvnitř React-řízeného elementu, React si při příštím renderu může stěžovat („node not found") nebo náš span přepsat. Náš guard + re-aplikace (task 08) to řeší; tady minimálně neházet a nepadat. Span vkládat tak, aby případný React re-render jen přepsal obsah (a observer ho znovu zpracuje), ne aby crashnul. Otestovat na reálném React eshopu (např. Notino/Alza části).
- **`title` overflow / `text-overflow: ellipsis`** rodiče může čas oříznout, když je delší než cena („3,75 d" vs „30 Kč"). Sledovat; task 11 může přidat `white-space: nowrap` na `.tp` jako mitigaci.
- **Přeškrtnutí přes `text-decoration` na rodiči** funguje díky `inherit`; ale pokud eshop dává `line-through` přímo na cenový `<span>` který nahrazujeme, musíme styl zachovat — proto nahrazujeme **obsah**, ne element.

## Reference

- Task 04 — `PriceMatch` offsety.
- Task 05 — `formatTime()` → `display` + `hours`.
- Task 06 — `PriceCandidate[]` vstup.
- Task 08 — observer volá `applyAll`/`reformatAll`/`revertAll`.
- Task 09 — toggly volají `revertAll`/`applyAll`.
- `Text.splitText`: <https://developer.mozilla.org/en-US/docs/Web/API/Text/splitText>
