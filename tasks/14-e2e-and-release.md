# 14 — E2E testy na fixturách + QA matice + release checklist

**Status:** Done — 2026-06-12

**Priorita:** v1.0 · **Úsilí:** M · **Dopad:** Vysoký (release gate)

## Cíl

Postavit end-to-end ověření, že celý řetězec (scan → parse → convert → mutate → observe) funguje na realistických stránkách, zachytit regrese v adaptérech (změna markupu eshopu), projet manuální QA matici na reálných webech a sepsat release checklist pro publikaci do Chrome Web Store.

## Kontext

- Unit testy pokrývají pure jádro (tasky 04, 05) a jednotlivé DOM moduly (06–08) v jsdom. Chybí **integrační** úroveň: reálný HTML + reálný observer + reálný layout. A potřebujeme **regresní pojistku** na adaptéry (task 10), které se rozbijí, když eshop změní web.
- E2E přes **Playwright** s načtenou rozbalenou extension (Chromium persistent context) na **lokálních HTML fixturách** (uložené snapshoty eshop stránek) — deterministické, offline, žádná závislost na živém webu v CI.

## Scope

### 1. Fixtury — `tests/fixtures/`

- Uložené (očištěné) HTML snapshoty: produktová karta + výpis + detail pro každý adaptér (Alza, Mall, Datart, CZC, Notino) a 2–3 generické weby bez adaptéru.
- Zahrnout edge cases: sleva s přeškrtnutím, split-price, cena za kg/měsíc (ověřit, že se nepřevádí špatně), stránka bez cen, banka (blocklist).
- Statické servírování fixtur lokálním serverem v testu.

### 2. Playwright E2E — `tests/e2e/`

- Load extension do Chromium (`launchPersistentContext` s `--load-extension`).
- Nastavit sazbu (přes `storage.sync` seed nebo přes popup interakci).
- Pro každou fixturu: ověřit, že ceny → čas na správných místech, košík/qty netknuté, blocklist fixtura nemodifikovaná, sleva má obě ceny a přeškrtnutí drží.
- Dynamika: test s injektovaným nodem po loadu (observer ho převede), test s SPA-style výměnou obsahu.
- Toggle test: vypnout per-site → `revertAll`, stránka zpět; zapnout → znovu převedeno.

### 3. Adapter regrese

- Pro každý adaptér: fixture-based test, který selže, když selektory přestanou trefovat (early-warning, že eshop změnil markup). Doplnit `extract`/split-price asserty.
- Generický fallback test: adaptér se „stale" selektory → engine přesto najde cenu genericky.

### 4. Manuální QA matice — `tests/QA.md`

Tabulka „web × scénář × výsledek". Min. pokrytí na **živých** webech (mimo CI):
- Alza, Mall, Datart, CZC, Notino: karta / výpis / detail / košík / sleva.
- 3 generické eshopy bez adaptéru (fallback).
- 1 React/SPA, 1 infinite scroll, 1 web s cenami v SVG (limitace), 1 banka (musí být netknutá).
- Výkon: subjektivní plynulost + DevTools profil na nejtěžší stránce (task 11 kritéria).
- Light/dark, různé sazby.

### 5. Release checklist — `tests/RELEASE.md`

- [ ] `pnpm check && pnpm lint && pnpm test` zelené.
- [ ] E2E zelené.
- [ ] QA matice projetá, blokující bugy vyřešené.
- [ ] Manifest: jen `storage` + `activeTab`, version `1.0.0` (task 12, 13).
- [ ] Žádný síťový request z extension (Network panel ověřen).
- [ ] Privacy policy hostovaná + odkaz v popupu funguje.
- [ ] Store assety kompletní (task 13).
- [ ] `pnpm zip` balík nahrán do Web Store, privacy disclosures vyplněné.

## Mimo scope

- Vizuální regrese (pixel snapshot) celé stránky — křehké u cizích webů; spoléháme na asserty o textu/atributech tp spanů.
- Cross-browser E2E (Firefox) — task 19.
- Load testing nad rámec ruční profilace (task 11) — out.
- Automatický monitoring živých eshopů na změnu markupu — Future (mohl by hlídat adaptér regrese v provozu).

## Hotovo když

- Playwright E2E suite běží lokálně i v CI na fixturách a je zelená.
- Každý adaptér má regresní test; stale selektory test ověřuje fallback.
- `tests/QA.md` matice existuje a je projetá na živých webech bez blokujících bugů.
- `tests/RELEASE.md` checklist existuje a je odškrtaný před prvním uploadem.
- Známé limitace (canvas, SVG, cizí měny, neúplný blocklist) sepsané v QA/README.

## Rizika

- **Fixtury zestárnou** vůči živým webům — proto QA matice na živých webech zůstává součástí release, fixtury jsou jen rychlá regresní vrstva. Obnovovat fixtury při velké změně eshopu.
- **Playwright + MV3 extension** má svá specifika (service worker lifecycle, načtení rozbalené extension). Počítat s laděním setupu; držet se oficiálního Playwright extension guide.
- **Flaky observer testy** — časování (debounce/idle) může v CI blikat. Použít explicit waits / `expect.poll`, ne fixní sleep.

## Reference

- Tasky 04–11 — celý řetězec, který se tu integračně ověřuje.
- Task 10 — adaptéry (regresní cíl).
- Task 12 — privacy/permission body checklistu.
- Playwright Chrome extension testing: <https://playwright.dev/docs/chrome-extensions>
