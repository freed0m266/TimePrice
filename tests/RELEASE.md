# TimePrice — release checklist

Odškrtni **před každým uploadem** do Chrome Web Store. Pořadí respektuje závislosti: nejdřív
zelené automaty, pak ruční QA, pak balení a store. Cokoli blokujícího = stopka.

## 1. Automatické testy (lokálně i v CI)

- [ ] `pnpm check` zelené (svelte-check + `tsc --noEmit`).
- [ ] `pnpm lint` zelené (ESLint + Prettier; no-network ban nezakázán).
- [ ] `pnpm test` zelené (Vitest: pure core + jsdom moduly + fixture integrace/regrese).
- [ ] `pnpm test:e2e` zelené (Playwright na fixturách — adaptéry, generický fallback, sleva,
      split/unit cena, dynamika/SPA, blocklist, toggly).
- [ ] Žádný adaptér regresní test nečervená (= selektory pořád trefují fixtury). Pokud ano →
      obnov fixturu v `tests/fixtures/sites/` a selektory v `src/content/adapters/sites/`.

## 2. Ruční QA na živých webech

- [ ] [`QA.md`](QA.md) matice projetá; všechny adaptérové eshopy (detail/výpis/sleva/košík/hover).
- [ ] 3 generické eshopy (fallback) bez false positives.
- [ ] React/SPA + infinite scroll bez záseku a bez zacyklení observeru.
- [ ] **Banka i platební brána 100 % netknuté** (blocklist hard gate).
- [ ] Výkon: subjektivní plynulost + DevTools profil na nejtěžší stránce (kritéria task 11).
- [ ] Light/dark + víc sazeb (500/1000/1500/custom) + všechny rounding módy.
- [ ] **Všechny blokující bugy vyřešené.**

## 3. Privacy & permissions (task 12)

- [ ] Manifest žádá **jen** `storage` + `activeTab` (žádné `tabs`/`scripting`/`webNavigation`/
      `cookies`, žádné `host_permissions` nad rámec `<all_urls>` matche content scriptu).
- [ ] **Žádný síťový request z extension** — ověřeno v DevTools → Network na reálné stránce
      (content i background). ESLint no-network ban je zelený jako druhá pojistka.
- [ ] Privacy policy hostovaná na veřejné URL + odkaz v popupu funguje (vede na hostovanou verzi).
- [ ] Manifest `version` = `1.0.0` (sedí s `package.json`).

## 4. Store assety (task 13)

- [ ] Ikony 16/32/48/128 přítomné a správné (`public/icon/*`, `action.default_icon`).
- [ ] Store listing kompletní: název, krátký + dlouhý popis, kategorie, jazyk.
- [ ] Screenshoty / promo grafika podle požadavků Web Store.
- [ ] **Známé limitace** sepsané ve store popisu i v [README](../README.md) (CZK only, canvas/SVG,
      split ceny mimo adaptéry, neúplný blocklist).

## 5. Balení a upload

- [ ] `pnpm zip` → balík v `.output/` (`timeprice-<verze>-chrome.zip`).
- [ ] Balík nahraný do Chrome Web Store Developer Dashboard.
- [ ] **Privacy disclosures** ve Web Store vyplněné: data se nesbírají ani neodesílají; zdůvodnění
      pro `<all_urls>` (= in-place převod cen na libovolném eshopu, vše lokálně).
- [ ] Justifikace permissions (`storage`, `activeTab`, `<all_urls>`) vyplněná.
- [ ] Po schválení: smoke check publikované verze z Web Store na 1 eshopu + 1 bance.

---

**Mimo scope pro v1.0** (nehlídá tento checklist): Firefox/Edge build (task 19), monetizace
(task 15), další metriky/panely (task 16–17), multi-currency (task 18). Cross-browser `pnpm
zip:firefox` existuje, ale Firefox review je samostatný release.
