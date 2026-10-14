# 20 — Hover-swap: na najetí ukázat původní cenu místo času

**Status:** Done — 2026-06-15 (vydáno v 1.0.0) · hover-swap nahrazen nativním tooltipem v [tasku 21](21-native-tooltip.md); přepínač `invertHover` zůstává

**Priorita:** v1.1 (post-MVP UX) · **Úsilí:** S · **Dopad:** UX (discoverability původní ceny)

## Cíl

Když je extension zapnutá a cena je už nahrazená časem (task 07), tak **najetí myší** na ten čas
ho v místě prohodí zpět na **původní cenu v Kč** (např. „30 h" → „30 000 Kč"), a **odjetí myší**
ho vrátí na čas. Žádný OS-tooltip, žádné okno — čistá in-place záměna textu uvnitř téhož spanu.

Tohle **nahrazuje** dosavadní afordanci z tasku 07 (nativní `title` atribut v
[`tooltip.ts`](../src/content/tooltip.ts)). Cena se po tomto tasku ukazuje jen jednou cestou —
swapem — ne navíc i jako OS bublina (rozhodnuto, jinak redundantní).

## Kontext

- Task 07 (Done) ukládá při konverzi původní cenu do `data-tp-original` na
  `<span class="tp-converted" data-timeprice>` a navěšuje na něj `setTooltip` → `span.title`.
  Surovina pro swap **už na stránce je**, nepřidává se žádný nový data-atribut ani re-parsování.
- Rozhodnutí z této session:
  - **Nahradit** `title` swapem (ne nechat oba).
  - **Žádný vizuální náznak** interaktivity — drží invariant „web vypadá stejně". Čas je obyčejný
    text, cena se objeví až při hoveru. (Tedy žádné podtržení, žádný `cursor: help`.)
- Klíčový invariant, který tenhle task **nesmí** porušit: *No MutationObserver loop* a
  *idempotence*. Proto je doporučený přístup CSS-only (viz níže) — hover nezpůsobí žádnou DOM
  mutaci, takže [`observer.ts`](../src/content/observer.ts) nemá co zpracovávat a
  [`guard.ts`](../src/content/guard.ts) se swapu vůbec netýká.

## Návrh — CSS-only swap přes dva vnořené inline spany (doporučeno)

Místo jednoho textového uzlu bude konvertovaný span obsahovat **dva inline child spany**:

```html
<span class="tp-converted" data-timeprice data-tp-original="30 000 Kč" data-tp-value="30000" data-tp-hours="30">
  <span class="tp-time">30 h</span><span class="tp-orig" aria-hidden="true">30 000 Kč</span>
</span>
```

Záměnu řeší výhradně CSS přes `:hover` na rodičovském `[data-timeprice]` — **žádné JS
mouseenter/mouseleave listenery**:

```css
[data-timeprice] > .tp-orig { display: none; }
[data-timeprice]:hover > .tp-time { display: none; }
[data-timeprice]:hover > .tp-orig { display: inline; }
```

Proč CSS-only a ne JS swap:

- **Nulová DOM mutace při hoveru** → observer (`characterData`/`childList`) nemá co zachytit,
  žádné re-scany, žádné riziko smyčky, nepotřebuje `withGuard`.
- **Nekoliduje s `reformatAll`** (změna sazby z popupu). `reformatAll` přepisuje jen čas; když
  je span zrovna „v hoveru", CSS pseudo-stav zůstává a po update se ukáže nová hodnota času
  korektně — žádný stavový souboj o `textContent`.
- Reverz (`detachSpan` čte `data-tp-original` a nahradí celý span text uzlem) a idempotence
  (guard klíčuje na `data-timeprice` předka) zůstávají beze změny.

## Scope

### 1. Mutace na dva child spany — [`src/content/mutator.ts`](../src/content/mutator.ts)

- V `applyMatch` přestat dělat `span.textContent = result.display`. Místo toho vytvořit dva
  child spany: `.tp-time` s `result.display` a `.tp-orig` s `match.raw` (= `data-tp-original`).
- `.tp-orig` dostane `aria-hidden="true"` (default skrytý, ať ho čtečky/akcesibilní strom
  nečtou dvakrát; přístupnost viz Rizika).
- Odstranit volání `setTooltip(span, match.raw)` (rozhodnutí „nahradit `title` swapem").

### 2. Re-format cílí na časový child — `reformatSpan` / `reformatAll`

- `reformatSpan` musí psát do `.tp-time` (`span.querySelector('.tp-time')`), **ne** do
  `span.textContent` — jinak by smazal `.tp-orig`. Když child chybí (starší span / cizí
  re-render), degradovat bezpečně (no-op nebo rekonstrukce), ne crash.

### 3. CSS pravidla — rozšířit `STYLE_TEXT` / `ensureStyles`

- Doplnit tři `:hover` pravidla výše do injektované `STYLE_TEXT`. Child spany musí dál dědit
  barvu/font/přeškrtnutí (žádná vlastní barva), aby přeškrtnutí u slev procházelo (jako u
  `[data-timeprice]` dnes).

### 4. tooltip.ts

- `setTooltip` (nastavení `span.title`) se přestane volat. Buď soubor smazat, nebo přejmenovat
  na nositele hover-swap CSS/struktury. Zrušit i jeho import v `mutator.ts`. Aktualizovat
  případné testy `tooltip.test.ts`.

### 5. Testy — jsdom

- **Pozor, ripple:** stávající testy v `tests/dom/mutator.test.ts` (task 07 §7) ověřují
  `span.textContent === '30 h'`. Po této změně `span.textContent` zřetězí oba childy
  (`'30 h30 000 Kč'`, `display:none` to v jsdom neskryje). Testy přepsat tak, aby četly
  `.tp-time` (viditelný čas) a `.tp-orig` (`=== data-tp-original`).
- Nový test: po konverzi existují oba childy, `.tp-orig` má `aria-hidden`, `data-tp-original`
  drží přesně `match.raw`.
- Nový test: `reformatAll` s jinou sazbou změní text `.tp-time`, `.tp-orig` i `data-tp-value`
  zůstanou netknuté.
- Reverz: `revertAll` dál vrátí bitově shodný původní text (`detachSpan` se nemění — ověřit, že
  testy procházejí beze změny).
- jsdom neumí reálný `:hover`; samotnou vizuální záměnu (display:none ↔ inline) pokrýt v E2E
  (task 14) přes Playwright `hover()`, ne v jsdom.

### 6. E2E / smoke (napojení na task 14)

- Playwright: najet na konvertovaný čas → viditelný text se změní na původní cenu; odjet →
  zpět na čas. Přidat jako case do release QA matice.
- Manuální smoke na reálné Alze: produktová karta + výpis, včetně slevy (přeškrtnutá cena drží
  při hoveru i swapu).

## Mimo scope

- **Žádný vizuální náznak** interaktivity (podtržení, kurzor, ikonka) — vědomě (viz Kontext).
- **JS mouseenter/mouseleave swap** — pokud by se CSS přístup ukázal jako neschůdný (viz
  Rizika: layout jump), je to dokumentovaná fallback varianta, ne default. Vyžadovala by
  `withGuard` kolem `textContent` zápisů a ošetření kolize s `reformatAll` — proto až jako
  plán B.
- **Sekundární metriky v hoveru** (víc Converterů najednou) — to je task 16, ne sem.
- **Touch / klik-toggle** chování na dotykových zařízeních — known limitation (viz Rizika).
- **Animace / fade přechod** záměny — MVP je instantní swap.

## Hotovo když

- Se zapnutou extension a nastavenou sazbou: hover nad časem ukáže původní cenu v Kč v místě
  textu, odjetí vrátí čas. Bez OS-tooltipu (`title` je pryč).
- Web vizuálně drží (font, barva, přeškrtnutí u slev) v obou stavech; žádný trvalý vizuální
  náznak interaktivity.
- `reformatAll` (změna sazby z popupu) správně přepíše čas i u spanu, na kterém zrovna visí
  myš, bez rozbití swapu.
- `revertAll` dál vrací bitově shodný původní text; idempotence a no-loop invariant nedotčené
  (hover nezpůsobí žádnou DOM mutaci).
- jsdom testy (přepsané + nové) procházejí; E2E hover case v tasku 14 prochází; manuální smoke
  na Alze OK.

## Rizika

- **Layout jump při hoveru.** Cena a čas mají různou šířku (`30 000 Kč` vs `30 h`), takže
  `display` swap může způsobit reflow / posun okolního textu. Sledovat na reálných eshopech.
  Možná mitigace (jen pokud ruší): `white-space: nowrap` + `display: inline-block` na rodiči,
  nebo `min-width`. Nezavádět preventivně — drží to invariant „neměnit pocit webu" minimálně.
- **`textContent` ripple.** Dva childy mění `span.textContent` (zřetězí oba). Cokoliv, co čte
  viditelný text konvertovaného spanu (testy task 07 §7, fixture asserty task 14), musí číst
  `.tp-time`. V runtime enginu nikdo `textContent` konvertovaného spanu nečte (`detachSpan`
  čte `data-tp-original`, scanner přeskakuje `data-timeprice`), takže ripple je čistě v testech
  — ale je nutné je projít.
- **Přístupnost.** `.tp-orig` má default `aria-hidden`, aby SR nečetl „30 h 30 000 Kč". Zvážit,
  zda nedát původní cenu naopak jako primární pro SR (čtečka nemá hover) — minimálně nesmí číst
  obojí. Držet jednoduché: `aria-hidden` na skrytém childu, případně `aria-label` na rodiči
  s původní cenou. Doladit v rámci tasku, ne přemýšlet dopředu do nekonečna.
- **Touch zařízení.** `:hover` na dotyku nefunguje (nebo „lepí"). Chrome desktop-first, takže
  known limitation; nepřidávat kvůli tomu klik-toggle (mimo scope).
- **React re-render** může přepsat obsah spanu (smazat childy). To řeší stávající re-aplikace
  (task 08): observer zachytí cizí mutaci a `applyMatch` span znovu postaví i s childy. Ověřit,
  že rekonstrukce dvou childů je idempotentní (žádné zdvojení `.tp-time`).

## Reference

- Task 07 — [`mutator.ts`](../src/content/mutator.ts) (`applyMatch`, `reformatSpan`,
  `detachSpan`, `STYLE_TEXT`), [`tooltip.ts`](../src/content/tooltip.ts) (`setTooltip` — ruší se).
- Task 08 — [`observer.ts`](../src/content/observer.ts), [`guard.ts`](../src/content/guard.ts)
  (proč CSS-only nepotřebuje guard).
- Task 14 — E2E + QA matice (hover case + smoke).
- Task 16 — pluggable metriky (víc metrik v hoveru — pozdější rozšíření, ne sem).
