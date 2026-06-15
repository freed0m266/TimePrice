# TimePrice — manuální QA matice

Fixtury ([`tests/fixtures/`](fixtures)) a jejich automatizace ([`tests/integration/`](integration)
+ [`tests/e2e/`](e2e)) jsou rychlá regresní vrstva, **ne** náhrada za ověření na živém webu. Tahle
matice se projíždí **ručně na reálných eshopech** před každým uploadem do Chrome Web Store (viz
[`RELEASE.md`](RELEASE.md)). Fixtury zestárnou vůči živým webům — pokud tady něco selže a fixtura
ne, je čas fixturu obnovit (a nejspíš i adaptér v `src/content/adapters/sites/`).

## Jak projet

1. `pnpm build` → načti rozbalenou extension z `.output/chrome-mv3` (`chrome://extensions` →
   Načíst rozbalené). Nebo `pnpm dev` pro HMR.
2. V popupu nastav sazbu (otestuj víc sazeb, viz spodní sekce).
3. Pro každý řádek projdi scénáře a zapiš výsledek: **✅ pass** / **❌ fail** (+ číslo issue) /
   **➖ n/a**. Sloupec _Síť_ = otevři DevTools → Network a potvrď **0 requestů** z extension.
4. Blokující bug (❌ u převodu ceny, jakýkoli zásah na bance/platbě, síťový request) = **stopka
   pro release**, dokud není vyřešen.

## Eshopy s adaptérem

Scénáře: **Detail** (karta produktu) · **Výpis** (listing/kategorie) · **Sleva** (přeškrtnutá +
aktuální cena) · **Košík** (qty/cena netknuté tam, kde nemá převádět) · **Hover** (najetí
prohodí čas zpět na původní cenu v místě, odjetí vrátí čas; **žádný** OS-tooltip ani vizuální
náznak — task 20) · **Síť** (0 requestů).

| Eshop | Detail | Výpis | Sleva | Košík | Hover | Síť | Pozn. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| alza.cz | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | |
| mall.cz | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | |
| datart.cz | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | |
| czc.cz | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | |
| notino.cz | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | React — ověř i re-render při filtrování/varianty |

## Generické eshopy (bez adaptéru → fallback)

Vyber **3 menší CZ eshopy** mimo seznam adaptérů. Ověř, že generický engine s měnovou kotvou
ceny převede a nedělá false positives (roky, kódy, technické parametry).

| Eshop | Detail | Výpis | False positives | Síť | Pozn. |
| --- | --- | --- | --- | --- | --- |
| _(doplň)_ | ☐ | ☐ | ☐ | ☐ | |
| _(doplň)_ | ☐ | ☐ | ☐ | ☐ | |
| _(doplň)_ | ☐ | ☐ | ☐ | ☐ | |

## Speciální typy stránek

| Typ | Web | Očekávání | Výsledek | Pozn. |
| --- | --- | --- | --- | --- |
| React/SPA | notino.cz / jiný | Re-render přepíše náš span → observer znovu převede, žádný loop | ☐ | |
| Infinite scroll | _(doplň)_ | Dočítané ceny se převedou plynule, bez záseku | ☐ | |
| Ceny v SVG `<text>` | _(doplň)_ | Best-effort; pokud nepřevedeno, je to **známá limitace**, ne bug | ☐ | |
| Ceny v `<canvas>`/obrázku | _(doplň)_ | **Nepřevádí se** (nelze spolehlivě číst) — limitace | ☐ | |
| **Banka** (blocklist) | csas.cz / kb.cz | **Stránka 100 % netknutá**, 0 spanů, 0 requestů | ☐ | hard gate |
| **Platební brána** (blocklist) | gopay.com / comgate.cz | **Netknuté** u placení | ☐ | hard gate |

## Výkon (kritéria task 11)

| Měření | Jak | Výsledek | Pozn. |
| --- | --- | --- | --- |
| Subjektivní plynulost | Scroll/načítání na nejtěžší stránce (velký výpis) | ☐ | bez viditelného záseku |
| DevTools profil | Performance profil na nejtěžší stránce | ☐ | scan pod rozpočtem (task 11) |
| First paint cen | Viditelné ceny převedeny do ~1 frame | ☐ | |
| Mutation storm | Rychlé filtrování/řazení nevyvolá zacyklení | ☐ | watchdog drží throttle |

## Vzhled a sazby

| Varianta | Výsledek | Pozn. |
| --- | --- | --- |
| Light mode | ☐ | spany dědí barvu/font, stránka vypadá stejně |
| Dark mode | ☐ | žádný kontrastní artefakt |
| Sazba 500 Kč/h | ☐ | |
| Sazba 1000 Kč/h | ☐ | |
| Sazba 1500 Kč/h | ☐ | |
| Custom sazba | ☐ | min/h/d jednotky se škálují správně |
| Rounding auto / tenths / whole | ☐ | formát času odpovídá |

## Známé limitace (sepsat do store popisu / README)

- **Jen CZK.** Cizí měny se nepřevádějí (záměr MVP — měnová kotva `Kč`/`CZK`/`,-`). Future: task 18.
- **`<canvas>` a rastrové obrázky** — ceny v nich nelze spolehlivě číst, nepřevádějí se.
- **SVG `<text>`** — best-effort, není garantováno.
- **Split ceny mimo top eshopy** — číslo a `Kč` v různých elementech řeší jen adaptéry; jinde se
  konzervativně nepřevádí (raději nic než artefakt `30 h Kč`).
- **Blocklist citlivých domén** je konzervativní, ale **ne vyčerpávající** — když narazíš na
  banku/platbu/brokera, který chybí, přidej registrovatelnou doménu do
  `src/settings/blocklist.ts`.
- **Adaptéry zestárnou** při redesignu eshopu → engine spadne na generický anchored scan (cena se
  pořád převede), ale přesnost klesne. Hlídá to regresní test na fixtuře; obnov fixturu + selektory.
