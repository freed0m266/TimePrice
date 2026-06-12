# 04 — Price parser: CZK formáty, měnová kotva, normalizace

**Status:** Done — 2026-06-12

**Priorita:** v1.0 · **Úsilí:** L · **Dopad:** Blokující

## Cíl

Čistá, plně unit-testovaná funkce, která z kusu textu najde ceny v CZK **s explicitní měnovou kotvou** a vrátí strukturovaný výsledek (číselná hodnota + rozsah znaků v textu + detekovaný formát). Žádný DOM, žádné browser API — vstup je `string`, výstup je pole `PriceMatch`. Tohle je srdce přesnosti celé extension: false positives tady = rozbitý web pro uživatele.

## Kontext

- Rozhodnutí z grill-me: **konvertujeme jen čísla s měnovou kotvou** (`Kč`, `CZK`, `,-`). „500 W", „1000 GB", roky (2024), PSČ, telefonní čísla → ignorovat. To je hlavní obrana proti false positives.
- České formátování cen je rozmanité a musí se zvládnout:
  - `30 000 Kč`, `30000 Kč`, `30 000,00 Kč` (mezera/nbsp/úzká nbsp jako oddělovač tisíců, čárka desetinná)
  - `30 000,-`, `30000,-` (lidový zápis „korun bez haléřů")
  - `Kč 30 000` (měna před číslem — řidší, ale existuje)
  - `1 299 Kč`, `1.299 Kč` (tečka jako oddělovač tisíců — pozor, kolize s desetinnou tečkou!)
  - `19,90 Kč` (haléře)
  - `od 499 Kč`, `499 Kč/ks`, `499 Kč / měsíc` (prefix/suffix kontext — viz task 16 pro per-unit, teď jen detekovat základ)
- Whitespace varianty: ASCII space (U+0020), no-break space (U+00A0), narrow no-break space (U+202F), thin space (U+2009). Eshopy používají všechny. Normalizovat před matchem.
- Tento modul **neřeší** přeškrtnuté ceny (to je DOM-level, task 07) ani per-unit sémantiku (task 16). Vrací jen „tady je cena X Kč na pozici start–end".

## Scope

### 1. Typy — `src/core/parser/types.ts`

```ts
export interface PriceMatch {
  /** Číselná hodnota v Kč (např. 30000, 19.9). */
  value: number;
  /** Offsety v PŮVODNÍM (nenormalizovaném) textu — pro přesnou náhradu v DOM. */
  start: number;
  end: number;
  /** Surový matchnutý podřetězec, např. "30 000 Kč". */
  raw: string;
  /** Jak byla kotva detekována — pro debug a adaptér logiku. */
  anchor: 'kc' | 'czk' | 'dash'; // "Kč" | "CZK" | ",-"
}

export interface ParseOptions {
  /** Min. hodnota, pod kterou cenu ignorovat (default 0). */
  minValue?: number;
}
```

### 2. Normalizace whitespace — `src/core/parser/normalize.ts`

- Funkce, která mapuje všechny whitespace varianty na ASCII space **a zároveň vrací index map** (offset v normalizovaném → offset v originále), protože `PriceMatch.start/end` musí ukazovat do **původního** textu (jinak DOM náhrada v tasku 07 trefí špatné znaky).
- Alternativa (jednodušší a preferovaná): regexovat **přímo nad původním textem** s character class pokrývající všechny whitespace varianty (`[\s   ]`), takže žádná index mapa není potřeba. Zvolit tuto cestu, pokud regex zůstane čitelný; jinak normalizace + mapa.

### 3. Matcher — `src/core/parser/parse.ts`

```ts
export function parsePrices(text: string, opts?: ParseOptions): PriceMatch[];
```

Algoritmus (regex-based, anchored):

- **Číselné jádro**: `\d{1,3}(?:[    .]\d{3})*(?:,\d{1,2})?` — skupiny po 3 oddělené mezerou/tečkou, volitelné `,dd` haléře. Plus varianta bez oddělovačů `\d+(?:,\d{1,2})?`.
- **Kotva** musí být přítomná:
  - suffix `\s*(Kč|CZK)\b` (case-insensitive na „czk", `Kč` přesně) →  `anchor: 'kc'|'czk'`
  - suffix `,-` (tj. číslo končící `,-`) → `anchor: 'dash'`
  - prefix `(Kč|CZK)\s*` před číslem → `anchor`
- **Parsování hodnoty**: odstranit oddělovače tisíců, čárku → tečka, `parseFloat`. Pozor na **tečku jako oddělovač tisíců** (`1.299 Kč` = 1299, ne 1.299): heuristika — tečka následovaná přesně 3 číslicemi a dál není desetinná značka → oddělovač tisíců; čárka je v CZK vždy desetinná.
- Vrátit `start`/`end` přesně kolem celého matche **včetně** kotvy (aby se nahradila i „Kč"/„,-" a nezůstal viset symbol). Pro `Kč` prefix variantu zahrnout symbol taky.
- Respektovat `minValue` (default 0; reálně použijeme např. drobný floor proti „0 Kč" / „0,-" šumu — konfigurovatelné z volajícího).

### 4. Odolnost proti false positives (kritické)

Vědomě **nematchovat**:
- Čísla bez kotvy (`2024`, `500 W`, `1000 mAh`).
- Procenta (`20 %`), i když mají mezeru — nemají měnovou kotvu, takže přirozeně vypadnou.
- IBAN/čísla účtů, telefonní čísla — nemají `Kč`/`,-`, vypadnou.
- `,-` musí být **těsně** za číslem (`30000,-`), ne „30000, - něco" (ošetřit `\b`/lookahead).

### 5. Testy — `tests/unit/parser.test.ts` (povinné, vyčerpávající)

Tabulkové testy. Min. pokrytí:
- Pozitivní: `30 000 Kč` → 30000; `30000 Kč` → 30000; `30 000,00 Kč` → 30000; `30000,-` → 30000; `Kč 1 299` → 1299; `19,90 Kč` → 19.9; `1.299 Kč` → 1299; `od 499 Kč` → 499 (start ukazuje na „499", ne na „od"); nbsp/narrow-nbsp varianty.
- Vícenásobné v jednom textu: `Bylo 30 000 Kč, teď 24 000 Kč` → dva matche se správnými offsety.
- Negativní (musí vrátit prázdno): `500 W`, `1000 GB`, `2024`, `PSČ 30000`, `20 %`, `+420 777 123 456`, holé `30000` bez kotvy.
- Offset přesnost: pro každý pozitivní case ověřit, že `text.slice(start, end) === raw`.

## Mimo scope

- Žádná měna kromě CZK (EUR/USD je task 18).
- Žádná per-unit sémantika (`/měsíc`, `/kg`, `/ks`) — task 16 to nadstaví; parser teď vrací jen hodnotu.
- Žádné DOM, žádné přeškrtnutí, žádná konverze na čas (tasky 05, 07).
- Žádná detekce „toto je cena podle kontextu" bez kotvy — vědomě out (rozhodnutí z grill-me).

## Hotovo když

- `parsePrices` je čistá funkce v `src/core/parser/`, žádný import DOM/browser.
- Všechny testy v bodě 5 procházejí; coverage parseru ≥ 95 %.
- `text.slice(match.start, match.end) === match.raw` platí pro všechny matche (offset invariant).
- Negativní cases vracejí `[]` — nula false positives na test setu.
- ESLint guard potvrzuje čistotu jádra.

## Rizika

- **Tečka jako oddělovač tisíců vs desetinná** je nejzákeřnější. CZK desetinná je čárka, takže tečka = tisíce — ale některé špatně lokalizované weby použijí `1.299,00`. Heuristika „tečka + 3 číslice = tisíce, čárka = desetinná" pokrývá realitu; zdokumentovat předpoklad a pokrýt testem.
- **Příliš liberální kotva** — kdyby `,-` matchovalo i tam, kde to není cena (řídké). Vázat striktně na číslo bezprostředně před.
- **Výkon** — `parsePrices` poběží na **tisících** krátkých text nodeů (task 06). Regex musí být lineární, žádný katastrofický backtracking. Otestovat na dlouhém řetězci. Volat ho per-text-node (krátké stringy), ne na celý `innerText` stránky.
- **Lokalizace e-shopů** — některé používají `Kč` jako `KČ`, `kč`, nebo entitu. Normalizovat case pro „czk", `Kč` brát i lowercase `kč`. SVG/HTML entity řeší DOM vrstva (text node už má dekódovaný text).

## Reference

- Task 05 — `Converter`, který spotřebuje `PriceMatch.value`.
- Task 06/07 — DOM scanner a mutator, které volají `parsePrices` per text node a použijí offsety.
- Unicode whitespace: <https://en.wikipedia.org/wiki/Whitespace_character#Unicode>
- České formátování čísel (ČSN): desetinná čárka, mezera jako oddělovač tisíců.
