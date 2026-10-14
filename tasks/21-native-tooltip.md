# 21 — Návrat nativního tooltipu místo hover-swapu

**Status:** In progress

**Priorita:** v1.0.1 (UX fix) · **Úsilí:** S · **Dopad:** UX (stabilní text na stránce, cena/čas v tooltipu)

## Cíl

Najetí myší na převedenou cenu **už nepřepisuje text v místě** (hover-swap z tasku 20). Místo toho
se po najetí ukáže **nativní tooltip prohlížeče** (malý šedý obdélník, atribut `title`, jako v
tasku 07) s tou hodnotou, která na stránce zrovna **není** vidět. Text na stránce se při hoveru
nemění.

Přepínač z tasku 20 (`invertHover`, v popupu „Zobrazovat ceny (čas na hover)") **zůstává**, jen
mění, co je vidět v klidu:

| Režim (glosář) | Na stránce | Tooltip |
| --- | --- | --- |
| **Time-first** (default, `invertHover: false`) | `3 h, 45 min` | `1 499 Kč` |
| **Price-first** (`invertHover: true`) | `1 499 Kč` | `3 h, 45 min` |

Tooltip obsahuje **jen hodnotu**, bez popisku („Cena:", „Práce:" apod.) — stejně jako v tasku 07.

## Kontext

- V Chrome Web Store je `1.0.0` **s hover-swapem a přepínačem** (task 20). Uživatelé mají
  `invertHover` uložený v `chrome.storage.sync` → klíč se **nepřejmenovává** (žádná migrace).
  V glosáři ([CONTEXT.md](../CONTEXT.md)) se ale režim jmenuje **price-first mode**.
- Vydává se jako **1.0.1**.
- Rozhodnutí z této session: tooltip uživateli vyhovuje víc než přepisování textu; přepínač má
  zůstat; tooltip bez popisku.

## Návrh — `title` na obou dětech, režim dál čistě v CSS

Struktura spanu z tasku 20 (dvě inline děti) zůstává, jen každé dítě nese v `title` hodnotu
toho druhého:

```html
<span class="tp-converted" data-timeprice data-tp-original="1 499 Kč" data-tp-value="1499" data-tp-hours="…">
  <span class="tp-time" title="1 499 Kč">3 h, 45 min</span><span class="tp-orig" title="3 h, 45 min">1 499 Kč</span>
</span>
```

- Vidět je vždy jen jedno dítě (druhé `display:none`), takže myš najede právě na to viditelné a
  prohlížeč ukáže jeho `title` = tu druhou hodnotu. **Přepnutí režimu tak dál nemutuje žádný
  span** — jen kořenový atribut `data-tp-invert`, CSS udělá zbytek.
- Žádná `:hover` pravidla, žádný `inline-grid`: skryté dítě je `display:none`, takže span má
  šířku jen viditelné hodnoty → v price-first módu stránka drží přesně původní layout.
- `reformatAll` (změna sazby) přepíše text `.tp-time` **a** `title` na `.tp-orig`. Observer
  atributy nesleduje, takže zápis `title` nevyvolá re-scan.
- Vnitřnější `title` vyhrává nad `title` předka (eshopy mívají `title` na odkazu karty) → ukáže
  se náš.

## Scope

1. [`src/content/mutator.ts`](../src/content/mutator.ts) — `renderSpanChildren` nastaví `title`
   na obě děti; `reformatSpan` aktualizuje i `title` na `.tp-orig`; `STYLE_TEXT` bez `:hover` a
   gridu (`display:none` na skrytém dítěti, price-first přes `[data-tp-invert]`); komentáře
   přepsat z „hover-swap" na tooltip / time-first / price-first.
2. [`src/content/index.ts`](../src/content/index.ts), `setHoverMode` — beze změny chování, jen
   komentáře (režim už neurčuje směr swapu, ale co je vidět v klidu).
3. Popup — texty přepínače sedí i pro tooltip („…čas se objeví po najetí myší"), neměnit.
4. Testy:
   - jsdom ([`tests/dom/mutator.test.ts`](../tests/dom/mutator.test.ts)): obě děti mají správný
     `title`; `reformatAll` změní `.tp-time` text i `.tp-orig` `title`, `.tp-time` `title` (cena)
     zůstane.
   - E2E ([`tests/e2e/hover.spec.ts`](../tests/e2e/hover.spec.ts)): hover **nemění** viditelný
     text; viditelné dítě nese správný `title` v obou režimech. Nativní tooltip sám Playwright
     nevyfotí — ověřuje se atribut + ruční smoke.
   - [`tests/visible-text.ts`](../tests/visible-text.ts) — jen komentář (`.tp-orig` je teď skrytý
     trvale, ne „do hoveru").
5. [`tests/QA.md`](../tests/QA.md) — sloupec Hover: tooltip s druhou hodnotou, text se nemění.
6. `package.json` `version` → `1.0.1`; `pnpm zip`.

## Mimo scope

- Vlastní (CSS) bublina místo nativního tooltipu — nativní je imunní vůči `overflow:hidden` a
  z-indexu eshopů (důvod z tasku 07).
- Popisky v tooltipu, přejmenování klíče `invertHover`, změny store listingu (listing už o
  tooltipu mluví).
- Touch zařízení (tooltip na dotyku nefunguje — známá limitace jako dřív).

## Hotovo když

- Time-first: stránka ukazuje čas, po najetí šedý tooltip s původní cenou; text se při hoveru
  nemění.
- Price-first: stránka ukazuje původní cenu (bez posunu layoutu), po najetí tooltip s časem.
- Přepnutí režimu i změna sazby se projeví bez reloadu; tooltip s časem odpovídá nové sazbě.
- `revertAll` dál vrací bitově shodný text; idempotence a no-loop invariant drží.
- `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` zelené; manuální smoke na Alze OK.
- `timeprice-1.0.1-chrome.zip` připravený k uploadu do Chrome Web Store.

## Rizika

- **Zpoždění nativního tooltipu** (~0,5–1 s, OS styl) — vědomě akceptováno (task 07).
- **Cizí re-render** smaže děti → stávající re-aplikace (task 08) / fallback v `reformatSpan`
  je postaví znovu i s `title`.

## Reference

- Task 07 — původní `title` tooltip. Task 20 — dvě děti + `invertHover` (hover-swap tímto
  nahrazen).
