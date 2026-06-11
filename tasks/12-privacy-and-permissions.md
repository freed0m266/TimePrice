# 12 — Privacy & minimalizace oprávnění + privacy policy

**Status:** Todo

**Priorita:** v1.0 · **Úsilí:** S · **Dopad:** Vysoký (blokuje store review)

## Cíl

Zajistit, že TimePrice žádá **minimum oprávnění**, **neposílá nic na síť**, a má jasnou privacy policy. Privacy „vše běží lokálně, nic neodesíláme" je hlavní diferenciátor i podmínka hladkého Chrome Web Store review (extension s `<all_urls>` + DOM read dostane zvýšenou pozornost).

## Kontext

- Content script čte obsah **každé** navštívené stránky (ceny). To je z principu citlivé. Jediná obrana proti podezření je: nic z toho neopustí zařízení, a dá se to doložit (žádný `fetch`/`XMLHttpRequest`/`sendBeacon` v content/background).
- MV3 + WXT generují manifest; musíme ho udržet hubený.
- Tohle je z velké části **audit + dokumentace + omezení**, ne nová funkčnost.

## Scope

### 1. Audit oprávnění

- Manifest `permissions`: cíl **jen `storage`** + `activeTab` (pro zjištění domény aktivního tabu z popupu, task 09). **Žádné** `tabs`, `scripting`, `webNavigation`, `cookies`, `host_permissions` nad rámec content-script `matches`.
- Content script `matches: ['<all_urls>']` je nutné (extension má fungovat všude). Připravit **justifikaci** pro store: „upravuje zobrazené ceny na libovolném e-shopu; bez všesměrového přístupu nelze splnit účel". Zvážit `optional_host_permissions` model (uživatel udělí přístup per-site) — ale to zabíjí default-on wow efekt (rozhodnutí z grill-me). Rozhodnutí: ponechat `<all_urls>` content match + silná privacy policy + blocklist (task 09) jako kompenzace. Dokumentovat tento trade-off.

### 2. Žádná síť (vynutit + doložit)

- ESLint `no-restricted-globals`/`no-restricted-syntax` pravidlo zakazující `fetch`, `XMLHttpRequest`, `WebSocket`, `navigator.sendBeacon`, `EventSource`, `import()` z remote URL v `src/content/**`, `src/core/**`, `entrypoints/**`. CI to ohlídá.
- Žádné externí skripty/fonty/CDN v popupu — vše bundlované.
- Žádné analytics/telemetry/crash reporting SDK kdekoliv.

### 3. Privacy policy

- `marketing/privacy-policy.html` (statická stránka, hostovaná např. GitHub Pages — URL doplnit). Obsah:
  - jaká data se zpracovávají: sazba + nastavení, **jen lokálně** v `chrome.storage.sync` (synchronizace přes uživatelův Google účet je Chrome funkce, ne náš server).
  - co se **neposílá**: žádný obsah stránek, žádné ceny, žádné identifikátory, nikam.
  - žádné cookies, žádné třetí strany.
  - kontakt.
- `src/constants/urls.ts` (nebo obdoba) drží URL privacy policy; popup na ni odkáže („Soukromí").

### 4. Data minimalizace

- `storage.sync` drží jen nezbytné (task 02). Žádné logování navštívených URL, žádná historie cen (to by byl síťový/úložný feature — Future, task 17, a i tam lokálně).
- Debug logy (`console.debug`) za flagem, ve výchozím stavu tiché v produkčním buildu.

### 5. Chrome Web Store data disclosures

- Připravit odpovědi do „Privacy practices" formuláře: „Does not collect or transmit user data." Zaškrtnout odpovídající kategorie (žádné).
- Single purpose statement: „Převádí ceny na e-shopech na čas potřebný k jejich vydělání podle uživatelovy hodinové sazby."

## Mimo scope

- Reálné hostování privacy policy (deploy) — udělá se při store submission (task 13/14); tady připravit obsah.
- Monetizace a její data implikace (license server) — task 15 (a i tam navrženo license-key-first bez always-online).
- Cross-browser store disclosures (Firefox AMO) — task 19.

## Hotovo když

- Manifest žádá jen `storage` (+ `activeTab`); žádná zbytečná oprávnění.
- ESLint zakazuje síťová API v content/core/entrypoints; CI je zelené a pravidlo reálně chytá `fetch` (ověřeno negativním testem).
- `marketing/privacy-policy.html` existuje a popup na ni odkazuje.
- Připravené „single purpose" + „privacy practices" texty pro store listing.
- Manuální ověření: na reálném webu v DevTools → Network nevidíme **žádný** request iniciovaný extensionem.

## Rizika

- **`<all_urls>` review friction** — Google může chtít zdůvodnění nebo doporučit `activeTab`-only model. Mít připravenou justifikaci a být ochotný v nejhorším přejít na `optional_host_permissions` (degraduje default-on, ale projde review). Dokumentovat jako fallback plán.
- **`storage.sync` = „transmit data"?** — Synchronizace jde přes Google infrastrukturu (uživatelův účet), ne náš server. V disclosure formulovat přesně, aby to nevypadalo jako náš sběr. Alternativa: `storage.local` (žádná sync), pokud review dělá problém — drobná UX ztráta (nesdílí se mezi zařízeními).
- **Budoucí monetizace** nesmí tenhle claim porušit — task 15 to musí respektovat (license validace offline/minimalizovaná).

## Reference

- Task 02 — co se ukládá (`storage.sync`).
- Task 09 — blocklist (kompenzace `<all_urls>`).
- Task 15 — monetizace musí ctít privacy claim.
- Chrome Web Store User Data Policy: <https://developer.chrome.com/docs/webstore/program-policies/user-data-faq>
- Keymoji `AGENTS.md` privacy model — stejný duch („no networking, no analytics").
