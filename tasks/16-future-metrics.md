# 16 — Pluggable metriky: pracovní dny, % příjmu, spoření (DESIGN)

**Status:** Future — design dokument, NEIMPLEMENTOVAT v MVP

**Priorita:** Future · **Úsilí:** M · **Dopad:** Produkt (vize z promptu)

## Cíl

Rozšířit konverzi z „čas" na další metriky z vize promptu: pracovní dny, % ročního/měsíčního příjmu, „týdny spoření", vlastní metriky. Postaveno na `Converter` rozhraní (task 05), takže každá metrika = další implementace, ne přepis enginu.

## Kontext

- Vize z promptu: „30 hodin práce / 3,75 pracovního dne / 0,7 % ročního příjmu / 2 týdny spoření / vlastní metriky".
- MVP záměrně dodal jen `TimeConverter` + smart jednotku, ale **interface a registry** (task 05) jsou připravené přesně kvůli tomuto rozšíření. Tady se to materializuje.
- Per-unit ceny (`/měsíc`, `/kg`, `/ks`) — semantika, kterou MVP parser vědomě neřešil — patří taky sem (např. „předplatné 299 Kč/měsíc → 18 min/měsíc").

## Návrh

### Nové Converter implementace

- `IncomeShareConverter` — cena jako % měsíčního/ročního čistého příjmu. Potřebuje `monthlyNetIncome` v settings (nové pole, default null).
- `WorkdayConverter` — vždy v pracovních dnech (i pod 1 den), pro lidi, co myslí ve dnech.
- `SavingsConverter` — „kolik týdnů spoření" při zadané měsíční úspoře (`monthlySavings` setting).
- Vlastní metrika — uživatel zadá „1 jednotka = X Kč" a label (např. „obědů", „piv") → `CustomUnitConverter`.

### Per-unit sémantika (parser rozšíření)

- Rozšířit `PriceMatch` (task 04) o detekovaný `period`/`unit` suffix (`/měsíc`, `/rok`, `/kg`, `/ks`, `/l`).
- Converter pak může výstup anotovat („18 min/měsíc"). Detekce suffixu je opt-in, neovlivní MVP chování.

### UI

- Settings/popup: výběr aktivní metriky (nebo víc najednou → tooltip ukáže všechny, inline jen primární). Víc metrik současně je kandidát na **Pro** (task 15).
- Display zůstává kompaktní (inline náhrada), sekundární metriky v tooltipu.

### Architektura — co MVP už zařídil

- `Converter` interface + registry (task 05) → sem jen přidat implementace a zaregistrovat.
- `ConversionContext` rozšířit o nová pole (income, savings) s defaulty → žádná migrace (task 02 merge-with-defaults).
- Tooltip (task 07) už umí zobrazit sekundární info → rozšířit o víc metrik.

## Mimo scope

- Daňové modelování příjmu (čistý zadává uživatel, jako v MVP).
- Reálná historie cen / kurzy — to je task 17 / 18.

## Hotovo když (jako design)

- Je jasné, že nové metriky jsou aditivní `Converter` implementace + pár settings polí + tooltip rozšíření, bez zásahu do scan/mutate/observe jádra.
- Per-unit detekce je navržená jako opt-in rozšíření parseru.

## Reference

- Task 04 — parser (per-unit rozšíření).
- Task 05 — Converter interface + registry (nosná abstrakce).
- Task 07 — tooltip (víc metrik).
- Task 15 — víc metrik současně jako Pro funkce.
