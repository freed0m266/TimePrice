# 13 — Ikony + Chrome Web Store listing assets

**Status:** Done — 2026-06-12

**Priorita:** v1.0 · **Úsilí:** S · **Dopad:** Střední (blokuje publikaci)

## Cíl

Dodat reálné ikony extension (16/32/48/128 px) a kompletní vizuální + textové assety pro Chrome Web Store listing (název, popis, screenshoty, promo dlaždice). Po tomto tasku je extension vizuálně hotová k odeslání do store.

## Kontext

- Scaffolding (task 01) používá WXT placeholder ikony. Store vyžaduje vlastní ikonu ve více velikostech + listing grafiku.
- Vizuální identita: koncept „cena → čas". Ikona může kombinovat symbol času (hodiny/přesýpací hodiny) s cenovkou. Drž jednoduchost — čitelnost v 16 px je king.
- Marketing je dle promptu mimo scope; tady řešíme jen **povinné store assety**, ne kampaň.

## Scope

### 1. Ikony

- `assets/icons/` — 16, 32, 48, 128 px PNG (+ zdrojový SVG/Figma export).
- Manifest `icons` + `action.default_icon` na ně napojit (WXT konvence).
- Light i dark čitelnost (ikona v toolbaru na různých pozadích).
- Volitelně stavová varianta (extension vypnutá na doméně → šedá/badge) — nice-to-have, ne nutné v MVP.

### 2. Store listing texty (CZ + EN)

- **Název**: TimePrice.
- **Krátký popis** (132 znaků): „Převádí ceny na e-shopech na čas, který musíš odpracovat. Zjisti, kolik hodin tě nákup reálně stojí."
- **Podrobný popis**: co dělá, jak nastavit sazbu, privacy claim („nic neposíláme, vše lokálně"), seznam podporovaných eshopů (adaptéry), known limitations (canvas, cizí měny).
- **Single purpose** (z tasku 12) konzistentní s manifestem.

### 3. Screenshoty a promo grafika

- 3–5 screenshotů 1280×800 (nebo 640×400): před/po na reálném eshopu (cena → čas), popup s nastavením sazby, per-site toggle, tooltip s původní cenou.
- Malá promo dlaždice 440×280 (povinná pro některé sekce).
- Konzistentní vizuál s ikonou.

### 4. Verze a metadata

- `version` v manifestu bump na `1.0.0` při releasu.
- Kategorie store: „Shopping" nebo „Productivity".
- Jazyky listingu: čeština primárně (CZK only produkt), EN volitelně.

## Mimo scope

- Marketingová kampaň, ASO klíčová slova nad rámec listingu, sociální sítě — mimo scope (prompt).
- Animovaná promo videa — out.
- Firefox AMO grafika — task 19.
- Landing page web — Future (mohl by hostit i privacy policy z tasku 12).

## Hotovo když

- Ikony 16/32/48/128 existují, napojené v manifestu, čitelné v toolbaru light/dark.
- Kompletní listing texty (CZ) připravené v `marketing/store-listing.md`.
- 3–5 screenshotů + promo dlaždice v `marketing/store/`.
- `version` = `1.0.0`.
- `pnpm zip` vyrobí balík připravený k uploadu.

## Rizika

- **Čitelnost ikony v 16 px** — komplexní motiv (hodiny + cenovka) se v malém slije. Navrhnout primárně pro 16 px, pak škálovat nahoru.
- **Screenshoty s reálným eshopem** — mohou obsahovat cizí brand/produkty. Použít neutrální nebo vlastní demo stránku, ať není problém s právy/ochrannými známkami na store grafice.
- **Listing slibující víc, než MVP umí** — nepsat „funguje na všech eshopech ve všech měnách". Být přesný (CZK, top CZ eshopy + generický fallback), jinak 1★ recenze a zamítnutí.

## Reference

- Task 12 — privacy claim + single purpose (konzistence v listingu).
- Task 01 — manifest ikony napojení.
- Chrome Web Store image guidelines: <https://developer.chrome.com/docs/webstore/images>
- Keymoji `tasks/47-app-store-listing.md` — analogický listing task (jiný store).
