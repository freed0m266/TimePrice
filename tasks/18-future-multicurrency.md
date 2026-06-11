# 18 — Multi-currency (DESIGN)

**Status:** Future — design dokument, NEIMPLEMENTOVAT v MVP

**Priorita:** Future · **Úsilí:** L · **Dopad:** Rozšíření trhu

## Cíl

Zafixovat, jak rozšířit detekci a převod z CZK-only na další měny (EUR, USD, GBP, PLN…), aby TimePrice fungoval na zahraničních eshopech a pro uživatele s příjmem v jiné měně.

## Kontext

- MVP je CZK-only (rozhodnutí z grill-me) — záměrně, aby parser nebyl bažina formátů a lokalizací. Tady se to rozšiřuje.
- Dvě nezávislé osy: (a) **detekce** cen v různých měnách/formátech, (b) **převod** přes kurz na uživatelovu měnu sazby.

## Návrh

### Detekce (rozšíření parseru, task 04)

- Parser se zobecní na tabulku měn: symbol/kód (`€`, `$`, `£`, `zł`, `EUR`, `USD`), pozice (prefix `$30` vs suffix `30 €`), oddělovače (US `1,299.00` vs EU `1.299,00` vs CZ `1 299,00`).
- **Formát ambiguita** je hlavní problém: `1,299` = 1299 (US tisíce) nebo 1,299 (EU desetinné)? Řešit per-měna konvencí + per-doména hintem (TLD, `lang` atribut, adaptér).
- Kotva zůstává povinná (symbol/kód měny).

### Převod (kurzy)

- Pro převod `30 €` → čas při sazbě v Kč je potřeba **kurz EUR/CZK**.
- **Privacy dilema**: aktuální kurzy = síťový call. To by porušilo „neposíláme nic". Řešení:
  - bundlovat **periodicky aktualizované** kurzy přes update extension (žádný runtime call, ale lehce zastaralé), nebo
  - opt-in „aktualizovat kurzy" (uživatel vědomě povolí občasný fetch z jednoho zdroje), jasně komunikované, ne v content scriptu.
  - Pro orientační „kolik hodin" je i týden starý kurz dost přesný → bundlované kurzy jsou pravděpodobně nejlepší kompromis.
- Uživatel si zvolí měnu své sazby (zatím implicitně CZK).

### UI

- Settings: měna sazby + (volitelně) zobrazovaná měna.
- Adaptéry (task 10) dostanou měnový kontext per doména.

## Realistická kritika

- Multi-currency násobí složitost parseru (formát ambiguita) i testovací matici.
- Kurzy vs privacy je reálný konflikt — bundlované kurzy ho řeší, ale přidávají závislost na pravidelných update extension.
- Dělat až bude poptávka mimo CZ — globální trh je lákavý, ale CZK-first fokus je důvod, proč MVP vůbec dojede.

## Mimo scope

- Real-time kurzy v content scriptu (privacy).
- Krypto měny.

## Hotovo když (jako design)

- Je jasné, že parser se zobecní na měnovou tabulku, kurzy se řeší bundlovaně (ne runtime fetch) kvůli privacy, a měna sazby je nové settings pole.
- MVP (CZK-only) tomu architektonicky nebrání (parser bere měnu jako parametr, converter je měna-agnostický nad hodnotou).

## Reference

- Task 04 — parser (zobecnění na měny).
- Task 10 — adaptéry (měnový kontext per doména).
- Task 12 — privacy (kurzy bez runtime fetch).
