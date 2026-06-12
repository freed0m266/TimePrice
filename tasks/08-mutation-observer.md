# 08 — MutationObserver + idempotentní guard (SPA, infinite scroll)

**Status:** Done — 2026-06-12

**Priorita:** v1.0 · **Úsilí:** L · **Dopad:** Blokující

## Cíl

Napojit scanner + mutator (tasky 06, 07) na živý DOM: detekovat nově přidaný/změněný obsah (SPA navigace, infinite scroll, React/Vue re-rendery, lazy-load) a aplikovat na něj náhradu — **bez nekonečné smyčky** (vlastní mutace nesmí spustit další kolo) a **bez degradace výkonu**. Reagovat na změnu sazby/toggle živě. Po tomto tasku TimePrice funguje na dynamických webech, ne jen na statickém prvním renderu.

## Kontext

- Rozhodnutí z grill-me: **in-place mutace + idempotentní guard, re-aplikace při re-renderu**. To celé žije tady.
- Dvě jádrové pasti:
  1. **Smyčka**: náš mutator zapíše do DOM → MutationObserver to zaznamená → spustí scan → … donekonečna. Řešení: guard flag, který observer kolem vlastních zápisů ignoruje, + idempotentní scanner (přeskakuje `data-timeprice`).
  2. **React přepíše náš span**: SPA re-render nahradí náš `<span data-timeprice>` zpět původní cenou. Observer to detekuje (nový node bez markeru) a znovu aplikuje. To je správné chování — re-aplikace, ne smyčka.
- Výkon: na infinite-scroll stránce přibývají stovky nodeů. Observer musí **batchovat** a **debouncovat**, scanovat jen přidané podstromy (`mutation.addedNodes`), ne celý dokument.

## Scope

### 1. Guard kolem vlastních zápisů — `src/content/guard.ts`

- Jednoduchý mechanismus: `let isWriting = false;`. Mutator (task 07) obalit: `withGuard(() => applyAll(...))`. Observer callback na začátku zkontroluje `if (isWriting) return;`.
- **Pozor**: MutationObserver doručuje záznamy **asynchronně** (microtask), takže `isWriting` flag nemusí stačit (než se callback spustí, už je `false`). Robustnější: po vlastním zápisu **vyprázdnit** observer frontu vlastních záznamů — `observer.takeRecords()` ihned po `applyAll` a zahodit je. Kombinovat: označené spany scanner stejně ignoruje (druhá pojistka). Implementovat `takeRecords()` flush jako primární obranu.

### 2. Observer engine — `src/content/observer.ts`

```ts
export function startObserving(ctx: ConversionContext): () => void; // vrací stop()
```

- `new MutationObserver(cb)` na `document.body`, config: `{ childList: true, subtree: true, characterData: true }`.
- `characterData: true` je nutné pro SPA, které mění **text** existujícího nodu (cena se aktualizuje) — ale je drahé a hrozí smyčkou (náš text zápis). Guard + flush to drží. Zvážit zúžení: pokud `characterData` dělá problémy, vypnout a spoléhat na `childList` (React typicky vyměňuje nodey, ne jen text). **Default: zapnout, ale pečlivě otestovat smyčku.**
- Callback:
  - Sebrat `addedNodes` a `characterData` cíle z dávky.
  - Deduplikovat na nejvyšší společné podstromy (neskenovat dítě i rodiče zvlášť).
  - **Debounce / batch**: nezpracovávat každou dávku okamžitě. Akumulovat „dirty roots" a zpracovat je v `requestAnimationFrame` nebo `requestIdleCallback` (task 11 to dotáhne; tady minimálně rAF debounce ~16–50 ms).
  - Pro každý dirty root: `withGuard(() => applyAll(scan({ root }), ctx))`.

### 3. SPA navigace (URL change bez reloadu)

- SPA mění `location` přes `history.pushState`/`replaceState` bez page reloadu → content script se nenačítá znovu, ale obsah se kompletně vymění.
- Patchnout/poslouchat `history` (monkey-patch `pushState`/`replaceState` + `popstate`) a na URL change spustit plný `scan(document.body)` znovu (s guardem). Alternativně to často pokryje i samotný MutationObserver (velká výměna `addedNodes`), ale explicitní URL hook je spolehlivější pro per-site re-eval (task 09: jiná doména/cesta = jiný stav).

### 4. Reakce na změnu settings

- `onSettingsChanged` (task 02) → pokud se změnila **sazba/rounding/workdayHours**: `reformatAll(newCtx)` (task 07) — levné, jen přepočet označených spanů.
- Pokud se změnil **enabled / per-site / blocklist** (task 09): buď `revertAll()` (vypnuto), nebo `scan + applyAll + startObserving` (zapnuto). Tady připravit větvení; plnou toggle logiku dotáhne task 09.

### 5. Teardown

- `stop()` odpojí observer, history hooky a settings listener. Důležité pro čistotu při vypnutí na doméně.

### 6. Testy — `tests/dom/observer.test.ts` (jsdom)

- Přidání nového `<span>30 000 Kč</span>` po startu → observer ho zpracuje (časem / po flush).
- **Žádná smyčka**: po `applyAll` se observer callback nespustí donekonečna (čítač invokací omezený).
- React-style přepsání: nahradit náš tp span zpět původní cenou → observer znovu aplikuje.
- Změna sazby → `reformatAll` přepočítá existující spany.
- `stop()` odpojí vše (žádná reakce po teardownu).
- (jsdom nemá `requestIdleCallback`/`history` plně — mocknout / použít fake timers.)

## Mimo scope

- Viewport-first / lazy scanning a `requestIdleCallback` jemné ladění — task 11 (tady stačí rAF debounce baseline).
- Per-site toggle/blocklist rozhodovací logika — task 09 (tady jen větvení podle settings eventu).
- Shadow DOM observing — known limitation (viz task 06).
- Site-specific re-scan triggery — task 10.

## Hotovo když

- Na infinite-scroll stránce (např. výpis produktů s lazy-loadem) se nově načtené ceny převedou bez reloadu.
- Na SPA (route change bez reloadu) se nový obsah převede.
- **Žádná nekonečná smyčka** — ověřeno čítačem i manuálně (CPU neroste, stránka neseká).
- Změna sazby v popupu se okamžitě promítne do už převedených cen (`reformatAll`).
- React eshop: když framework přepíše náš span, observer ho korektně znovu převede (manuální test na reálném webu).
- jsdom testy v bodě 6 procházejí.

## Rizika

- **Nekonečná smyčka přes `characterData`** je nejpravděpodobnější bug. `takeRecords()` flush po vlastním zápisu + idempotentní scanner + případné vypnutí `characterData` jsou tři vrstvy obrany. Testovat agresivně.
- **Výkonová smrt na velkých SPA** — neomezený `subtree: true` observer na stránce s tisíci mutacemi/s (např. live burza, chat) zabije CPU. Mitigace: debounce, batch, scan jen `addedNodes`, a v tasku 11 přidat throttle/limit + viewport gating. Zvážit i odpojení observeru během vlastního zápisu a znovu připojení (alternativa k `takeRecords`).
- **History monkey-patch konflikty** — některé SPA samy patchují `history`. Patchovat defenzivně (zachovat a volat původní funkci), nikdy nerozbít navigaci webu.
- **`reformatAll` vs paralelní re-render** — když přijde změna sazby zároveň s React re-renderem, může nastat race. Idempotence + re-scan to dorovná; není to korupce dat, jen krátký nekonzistentní frame.

## Reference

- Task 02 — `onSettingsChanged`.
- Task 06 — `scan({ root })`.
- Task 07 — `applyAll`/`reformatAll`/`revertAll` + guard wrapping.
- Task 09 — toggle/blocklist větvení.
- Task 11 — perf hardening (idle, viewport, throttle).
- `MutationObserver.takeRecords`: <https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/takeRecords>
- SPA history patching pattern: <https://developer.mozilla.org/en-US/docs/Web/API/History/pushState>
