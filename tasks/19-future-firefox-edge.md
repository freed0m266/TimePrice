# 19 — Firefox + Edge release (DESIGN)

**Status:** Future — design dokument, NEIMPLEMENTOVAT v MVP

**Priorita:** Future · **Úsilí:** S–M · **Dopad:** Rozšíření dosahu

## Cíl

Vydat TimePrice i na Firefox (AMO) a Edge (Microsoft Add-ons) s minimem dodatečné práce, protože MVP byl od začátku psán cross-browser-ready (WXT + `webextension-polyfill`, rozhodnutí z grill-me).

## Kontext

- MVP cílí Chrome, ale kód je browser-agnostický (`browser.*` přes polyfill, žádné `chrome.*` natvrdo, žádné Chrome-only API). WXT umí build pro víc cílů.
- Edge sdílí Chromium engine i store mechaniku s Chrome → skoro zadarmo. Firefox má odlišnosti v MV3.

## Návrh

### Edge

- `wxt build -b chrome` balík je v zásadě kompatibilní; Edge má vlastní store (Microsoft Partner Center) a vlastní review.
- Hlavně listing + submission, minimum kódu.

### Firefox

- WXT target `firefox`. Odlišnosti MV3 ve Firefoxu:
  - `background` jako event page / `scripts` místo `service_worker` (WXT to řeší dle targetu).
  - Vyžaduje `browser_specific_settings.gecko.id` (a min. verzi) pro `storage.sync`.
  - Některá MV3 API se chovají jinak; ověřit observer/storage/popup.
- AMO review bývá přísnější na zdroj — mít čistý, ne-obfuskovaný build a zdroj připravený.

### Sdílené

- CI matrix: build + (kde lze) E2E pro každý target.
- Cross-browser QA matice (rozšíření tasku 14).
- Verzování a changelog napříč storey.

## Realistická kritika

- Firefox + Edge mají zlomek Chrome trhu; ROI je nízké, dokud Chrome verze nemá trakci.
- Každý store = další review, listing, údržba. Nezačínat dřív, než Chrome verze stojí za rozšiřování.

## Mimo scope

- Safari (Web Extensions přes Xcode) — výrazně víc práce, vlastní projekt. Out i z Future, dokud nebude silný důvod.

## Hotovo když (jako design)

- Je jasné, že Edge je téměř zadarmo (Chromium), Firefox stojí menší MV3 adaptaci (gecko id, background tvar), oboje hlavně listing/review.
- MVP cross-browser-ready přístup (polyfill, žádné `chrome.*` natvrdo) je potvrzený jako správný a dluhu-prostý.

## Reference

- Task 01 — WXT cross-browser konfigurace.
- Task 12 — store disclosures (per store).
- Task 14 — QA matice (rozšířit cross-browser).
- WXT targets: <https://wxt.dev/guide/essentials/target-different-browsers.html>
