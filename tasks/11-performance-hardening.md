# 11 — Performance hardening (batching, idle, viewport-first, caps)

**Status:** Done — 2026-06-12

**Priorita:** v1.0 · **Úsilí:** M · **Dopad:** Vysoký

## Cíl

Zajistit, že TimePrice nezpomalí ani obří stránky (tisíce cen, agresivní infinite scroll, často re-renderující SPA). Zavést viewport-first zpracování, idle scheduling, batching, deduplikaci práce a tvrdé stropy, aby content script zůstal pod prahem, kdy by ho uživatel pocítil (jank, vybitá baterie).

## Kontext

- Generický engine (tasky 06–08) je funkčně hotový, ale naivně scanuje vše hned. Na e-shopu s nekonečným výpisem (Alza „vše", srovnávače) to může znamenat tisíce nodeů a trvalý observer tlak.
- Cíl výkonu: první převod viditelných cen do ~1 frame po načtení/scrollu; žádný dlouhý task > 50 ms blokující main thread; CPU v klidu po ustálení ≈ 0.
- Tohle je polish task — engine funguje i bez něj, ale bez něj nebude použitelný na těžkých stránkách a v review/recenzích dostane „zpomaluje prohlížeč".

## Scope

### 1. Viewport-first

- Při iniciálním scanu i při observer dávkách: nejdřív zpracovat kandidáty **ve viewportu** (a blízko něj), zbytek odložit.
- `IntersectionObserver` na cenové kontejnery / kandidáty: převést cenu až když se blíží do viewportu. Pro infinite scroll ideální — nepřevádíme tisíce položek, co uživatel nikdy neuvidí.
- Kombinace: scanner najde kandidáty (levné), ale mutace (task 07) se aplikuje lazily přes IntersectionObserver gate.

### 2. Idle scheduling

- Těžké/odložené dávky zpracovat v `requestIdleCallback` (fallback `setTimeout(…, 1)`), s `timeout` aby se i mimo idle nakonec spustily.
- Observer callback (task 08) jen akumuluje „dirty roots" a plánuje jedno zpracování — coalescing, ne per-mutace práce.

### 3. Batching a dedup

- Slévání mutací do jednoho rAF/idle průchodu.
- Deduplikace dirty rootů (neskenovat potomka i předka).
- Limit velikosti dávky (např. max N nodeů/průchod), zbytek do dalšího idle slotu — drží jednotlivý task krátký.

### 4. Tvrdé stropy (safety valves)

- Max počet převedených cen na stránku (např. 5 000) — nad to přestat (krajní ochrana proti patologickým stránkám). Logovat, že byl dosažen strop (transparentnost — viz Mimo scope v tasks/README „no silent caps").
- Max frekvence observer zpracování (throttle, např. ≤ 1×/100 ms při bouři mutací).
- Watchdog: pokud zpracování opakovaně přetéká rozpočet, dočasně odpojit `characterData` observing nebo zvýšit debounce (adaptivní degradace).

### 5. Měření

- Jednoduchý dev-only profiling (`performance.mark`/`measure`) za debug flagem: kolik nodeů, kolik ms na scan/apply, kolik observer dávek. Pomůže ladit a doložit „nezpomaluje".
- Otestovat na 2–3 reálných těžkých stránkách (velký výpis Alza, nekonečný scroll, React detail).

## Mimo scope

- Web Worker offloading parseru — parser je tak levný, že se nevyplatí; a přenos DOM do workeru nejde. Out.
- Prefetch/predikce scrollu nad rámec IntersectionObserver rootMargin — out.
- Shadow DOM perf — N/A (shadow je known limitation, task 06).

## Hotovo když

- Na obří stránce (tisíce cen, infinite scroll) zůstává prohlížeč plynulý; žádný dlouhý task > 50 ms v profilu během běžného scrollu.
- Mimo viewport se ceny nepřevádějí, dokud se nepřiblíží (ověřeno IntersectionObserver chováním).
- Po ustálení stránky je CPU TimePrice ≈ 0 (observer v klidu, žádná smyčka).
- Tvrdé stropy fungují a jsou logované, ne tiché.
- Dev profiling flag dává čísla pro scan/apply/observer.

## Rizika

- **IntersectionObserver vs okamžitý wow efekt** — když uživatel uvidí cenu „problesknout" než se převede, je to horší UX. Nastavit `rootMargin` dostatečně velký, aby převod proběhl než položka dorazí do viewportu. Vyladit.
- **Adaptivní degradace** může nečekaně vypnout `characterData` a tím přestat reagovat na text-update SPA. Degradovat viditelně (debug log) a jen pod reálným tlakem.
- **Strop 5 000 cen** je arbitrární — doložit měřením, že je nad reálnými stránkami, a nezatajit, když se dosáhne.

## Reference

- Task 06/07/08 — engine, který se tu optimalizuje.
- `IntersectionObserver`: <https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver>
- `requestIdleCallback`: <https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback>
