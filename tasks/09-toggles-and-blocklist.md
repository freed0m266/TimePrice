# 09 — Global + per-site toggle + blocklist citlivých domén

**Status:** Todo

**Priorita:** v1.0 · **Úsilí:** M · **Dopad:** Vysoký

## Cíl

Dát uživateli plnou kontrolu: globální on/off, „vypnout na téhle doméně" přímo z popupu, a vestavěný blocklist citlivých domén (banky, internet banking, státní správa, platební brány), kde TimePrice **nikdy** neběží. Zapnutí/vypnutí se projeví živě bez reloadu (přes mutator `revertAll`/`applyAll` z tasku 07 a observer z tasku 08).

## Kontext

- Rozhodnutí z grill-me: **běžet všude + global a per-site vypínač + blocklist citlivých domén**. Default-on dává wow efekt, ale bez blocklistu hrozí, že extension „rozbije" číslo na bankovním webu nebo v internet bankingu — to je nejen UX problém, ale i důvěryhodnostní (uživatel uvidí změněnou částku u platby a zpanikaří).
- Rozhodovací logika už částečně existuje: `isActiveForHost` (task 02). Tento task ji dotáhne (built-in blocklist obsah), napojí na popup UI (per-site toggle) a na živé zapnutí/vypnutí v content scriptu.
- Per-site stav i user blocklist klíčují přes `registrableDomain` (task 02).

## Scope

### 1. Built-in blocklist — `src/settings/blocklist.ts`

- Seznam domén/vzorů, kde TimePrice **nikdy** nemodifikuje DOM, ani když je global on:
  - **České banky**: `csas.cz`, `kb.cz`, `csob.cz`, `moneta.cz`, `fio.cz`, `airbank.cz`, `rb.cz` (Raiffeisen), `unicreditbank.cz`, `mbank.cz`, … (+ jejich internet-banking subdomény, které `registrableDomain` sjednotí).
  - **Platební brány**: `gopay.com`, `comgate.cz`, `paypal.com`, `stripe.com`, `gpwebpay.cz`.
  - **Státní správa**: `*.gov.cz`, `mojedane.cz`, `nia.gov.cz`, `czechpoint.cz`, datové schránky.
  - **Investice/broker**: `portu.cz`, `xtb.com`, `etoro.com`, `revolut.com` (částka = zůstatek, ne cena).
- Pattern matching: registrable domain exact + jednoduchý suffix match pro `gov.cz`. Žádné regex peklo — udržovatelný seznam s komentáři.
- Tento seznam je **konzervativní a rozšiřitelný**; spíš víc blokovat než míň. Dokumentovat kritérium: „kde by záměna částky za čas mohla uvést uživatele v omyl o penězích, které reálně posílá/má".

### 2. Per-site toggle v popupu — rozšíření `CompactView.svelte` (task 03)

- Zjistit aktuální doménu (z aktivního tabu: `browser.tabs.query({active, currentWindow})` — vyžaduje `activeTab` permission, **ne** `tabs`; ověřit v tasku 12 minimální oprávnění).
- Zobrazit: „TimePrice na **alza.cz**: [ Zapnuto / Vypnuto ]" toggle → zapisuje `siteOverrides[domain] = 'on'|'off'`.
- Pokud je doména v built-in blocklistu: ukázat „Na tomto webu je TimePrice vypnutý z bezpečnostních důvodů (banka/platby)" — toggle disabled, nelze přepnout on. (Vědomě: built-in blocklist user nepřebije v MVP — bezpečnostní default. Power-user override zvážit později.)
- Global on/off toggle (už z tasku 03) + per-site toggle vedle sebe, jasná hierarchie (global vypne vše).

### 3. Živé zapnutí/vypnutí — napojení na content (task 08)

- Když `onSettingsChanged` přinese změnu `enabled` / `siteOverrides[thisDomain]` / `blocklist`:
  - nově neaktivní → `revertAll()` + `stop()` observer.
  - nově aktivní → `scan + applyAll + startObserving`.
- Žádný reload stránky. Uživatel přepne toggle v popupu a vidí okamžitě ceny zpět / čas zpět.

### 4. User blocklist (lehké)

- `settings.blocklist` (task 02) — uživatel může přidat vlastní doménu k vypnutí. MVP UI: minimální — per-site „off" toggle to v praxi pokrývá; explicitní seznam v popupu je nice-to-have. Rozhodnout: pravděpodobně stačí per-site overrides, `blocklist` pole nechat pro budoucí options page. Dokumentovat.

### 5. Testy

- `isActiveForHost` (rozšířený o built-in blocklist) — unit (task 02 testy rozšířit): banka → false i při global on; per-site off → false; jinak true.
- Blocklist matching: `internetbanking.csas.cz` → blokováno (registrable `csas.cz`); `nieco.gov.cz` → blokováno (suffix).
- DOM/integrace: přepnutí per-site off → `revertAll` zavolán (mock).

## Mimo scope

- Pokročilá správa user blocklistu / allowlistu v options page — Future.
- Override built-in blocklistu uživatelem — vědomě out v MVP (bezpečnost).
- Per-path granularita (jen `/cart`) — out, doménová úroveň stačí.

## Hotovo když

- Global toggle vypne/zapne TimePrice na všech webech živě.
- Per-site toggle v popupu vypne/zapne aktuální doménu živě, stav přežije reload i restart.
- Built-in blocklist spolehlivě brání běhu na bankách/platbách/gov, i když je global on; popup to uživateli vysvětlí.
- Zapnutí/vypnutí nikdy nevyžaduje reload stránky.
- Unit testy blocklistu a `isActiveForHost` procházejí.

## Rizika

- **Neúplný blocklist** — vždy bude banka/brána, na kterou zapomeneme. Mitigace: konzervativní kritérium, snadné rozšíření, a v tasku 12 zvážit obecnější signál (např. heuristika „stránka má `<input type=password>` + formulář s částkou" → opatrnost) — ale to je riziko false-skip; v MVP držet explicitní seznam.
- **`activeTab` vs `tabs` permission** — pro doménu aktivního tabu z popupu stačí `activeTab` (uživatel klikl na ikonu = gesture). Nepřidávat širší `tabs`. Ověřit v tasku 12.
- **Registrable domain limity** (task 02 heuristika bez full PSL) — `gov.cz` suffix řešit explicitně; vícenásobné TLD hlídat.

## Reference

- Task 02 — `isActiveForHost`, `siteOverrides`, `registrableDomain`.
- Task 03 — popup CompactView (sem se per-site toggle přidá).
- Task 07/08 — `revertAll`/`applyAll`/`startObserving` pro živé přepnutí.
- Task 12 — minimalizace oprávnění (`activeTab`).
