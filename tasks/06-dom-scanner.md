# 06 — DOM scanner: TreeWalker, kandidáti cen

**Status:** Todo

**Priorita:** v1.0 · **Úsilí:** M · **Dopad:** Blokující

## Cíl

Modul, který projde DOM (nebo zadaný podstrom) přes `TreeWalker`, najde text nodey obsahující ceny (přes `parsePrices` z tasku 04), odfiltruje nevhodné kontexty (`<script>`, `<style>`, editovatelná pole, už zpracované uzly) a vrátí seznam kandidátů k náhradě. Sám **nic nemění** — jen najde a vrátí. Náhradu dělá task 07.

## Kontext

- Rozdělení scanner (najdi) / mutator (změň) / observer (reaguj na změny) drží každý kus testovatelný a malý. Tento task je „najdi".
- `TreeWalker` s `NodeFilter.SHOW_TEXT` je nejrychlejší způsob, jak iterovat text nodey bez rekurze a bez `innerHTML` parsování. Per node voláme `parsePrices(node.textContent)` (krátké stringy → levné).
- Cena může být rozbitá přes víc elementů: `<span>30 000</span><span>Kč</span>` nebo `<span>30 000</span><sup>,-</sup>`. To je častý eshop pattern a čistý per-text-node sken ho mine. MVP řeší **dvě úrovně**: (a) cena v jednom text node (většina případů), (b) cena rozdělená mezi sourozence v rámci jednoho „price container" elementu — to dořeší site-adaptéry (task 10) a omezený generický „glue" níže.
- Musíme přeskočit kontexty, kde náhrada nedává smysl nebo je škodlivá: `<script>`, `<style>`, `<noscript>`, `<textarea>`, `contenteditable`, `<input>`, a uzly už označené `data-timeprice` (idempotence).

## Scope

### 1. Typy — `src/content/scanner.ts`

```ts
export interface PriceCandidate {
  /** Text node, který cenu obsahuje. */
  node: Text;
  /** Matche z parseru, s offsety do node.textContent. */
  matches: PriceMatch[];
}

export interface ScanOptions {
  root?: Node;            // default document.body
  minValue?: number;
}

export function scan(opts?: ScanOptions): PriceCandidate[];
```

### 2. TreeWalker + filtr

- `document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode })`.
- `acceptNode` vrací `FILTER_REJECT` pro text uvnitř zakázaných předků: `SCRIPT, STYLE, NOSCRIPT, TEXTAREA, SELECT, OPTION` a pro elementy s `isContentEditable`. Implementovat kontrolou `node.parentElement?.closest(...)` nebo cachovaným výstupem během chůze (perf).
- Přeskočit prázdné/whitespace-only nodey rychlým testem před `parsePrices`.
- Přeskočit nodey, jejichž rodič nebo předek nese `data-timeprice` nebo `data-timeprice-skip` (idempotence + opt-out hook pro adaptéry).
- Pro každý přijatý node zavolat `parsePrices(node.textContent, { minValue })`; pokud vrátí ≥1 match, přidat `PriceCandidate`.

### 3. Viditelnost a perf hinty

- Scanner **nefiltruje podle viditelnosti** (to je optimalizace v tasku 11 — viewport-first). Tady jen úplnost a správnost.
- Vrátit kandidáty v dokumentovém pořadí (TreeWalker to dává zdarma).
- Žádné `getComputedStyle` per node (drahé) — viditelnost/skryté ceny řeší task 11 dávkově.

### 4. Split-price „glue" (omezený, generický)

- Detekovat častý pattern: text node s číslem bez kotvy, jehož **bezprostřední** element-sibling obsahuje samotnou kotvu (`Kč`/`,-`). Pokud ano, nabídnout to jako kandidáta s rozšířeným rozsahem (vrátit informaci, že match pokrývá víc nodeů).
- **Pozor na false positives** — tohle je riziková heuristika. V MVP ji držet **konzervativní**: jen když sibling obsahuje *pouze* kotvu (whitespace + `Kč`/`CZK`/`,-`, nic jiného). Pokud je to moc křehké, **odložit do tasku 10** (adaptéry to vyřeší cíleně přes selektory) a v tomto tasku řešit jen single-node ceny. Rozhodnout během implementace podle toho, kolik reálných eshopů split pattern používá.

### 5. Testy — `tests/dom/scanner.test.ts` (jsdom)

- Najde cenu v jednoduchém `<span>30 000 Kč</span>`.
- Ignoruje `<script>30000 Kč</script>`, `<textarea>30000 Kč</textarea>`, `contenteditable`.
- Ignoruje už označený `data-timeprice` podstrom.
- Více cen na stránce → správný počet kandidátů v dokumentovém pořadí.
- (Pokud implementováno) split-price glue na `<span>30 000</span><span> Kč</span>`.

## Mimo scope

- Žádná náhrada/mutace (task 07).
- Žádný MutationObserver / reakce na dynamiku (task 08).
- Žádná viewport/perf optimalizace (task 11).
- Žádné site-specific selektory (task 10).
- `<canvas>` a rasterové obrázky — mimo scope úplně (known limitation). SVG `<text>` uzly TreeWalker projde jen pokud jsou text nodey; složitý SVG necílit.

## Hotovo když

- `scan()` vrací `PriceCandidate[]` se správnými nodey a matchi.
- Zakázané kontexty (script/style/textarea/contenteditable/už-zpracované) jsou spolehlivě vynechány.
- jsdom testy v bodě 5 procházejí.
- Scanner nevolá žádné DOM write API a nemění stránku (čistě read).
- Sken střední stránky (stovky nodeů) je rychlý — žádné per-node `getComputedStyle`.

## Rizika

- **Split-price napříč elementy** je nejčastější příčina „nenašlo to cenu" i „rozbilo to layout". Konzervativní generický glue + adaptéry (task 10) jsou dvojitá pojistka. Nepřehánět to v generické vrstvě.
- **Velké stránky / infinite scroll** — `scan(document.body)` na obří stránce je drahé. Task 08 bude scanovat jen mutované podstromy; task 11 přidá viewport-first. Scanner musí umět scanovat **libovolný `root`**, ne jen celý dokument (proto `ScanOptions.root`).
- **Shadow DOM** — TreeWalker neprojde do `shadowRoot`. Některé komponenty (web components) tam ceny mají. MVP: dokumentovat jako limitaci; volitelně projít `element.shadowRoot` rekurzivně, pokud je `open` (přidat až když narazíme na reálný eshop, co to potřebuje).

## Reference

- Task 04 — `parsePrices` (volá se per text node).
- Task 07 — mutator spotřebuje `PriceCandidate[]`.
- Task 08 — observer volá `scan({ root: mutatedSubtree })`.
- `TreeWalker`: <https://developer.mozilla.org/en-US/docs/Web/API/Document/createTreeWalker>
- `NodeFilter`: <https://developer.mozilla.org/en-US/docs/Web/API/NodeFilter>
