# 17 — Vlastní panely / insights (Hlídač Shopů styl) (DESIGN)

**Status:** Future — design dokument, NEIMPLEMENTOVAT v MVP

**Priorita:** Future · **Úsilí:** XL · **Dopad:** Produkt (dlouhodobá vize)

## Cíl

Zafixovat směr, kde TimePrice přestává být jen „náhrada cen za čas" a začíná injektovat **vlastní obsah** podobně jako Hlídač Shopů: vlastní boxy/panely na produktové stránce, finanční doporučení, analýza nákupu, historie cen, upozornění, personal finance insights. Vize z promptu — výslovně NE součást MVP.

## Kontext

- MVP má tvrdé pravidlo „neměnit vzhled webu" (jen in-place náhrada). Tento směr ho **vědomě porušuje** — přidává vlastní UI do cizí stránky. Proto je to velký krok a samostatná fáze, ne pokračování MVP.
- Architektonicky je to jiná disciplína: injektované UI musí být izolované (Shadow DOM), nesmí rozbít web, musí přežít re-rendery, a u „historie cen" se naráží na **privacy claim** — historie znamená ukládání dat o tom, co uživatel prohlížel.

## Návrh a otevřené otázky

### Injektované UI

- Vlastní panel (např. u ceny produktu): „Tento nákup = 30 h práce · 2,1 % měsíčního příjmu · doporučení".
- Renderovat do **Shadow DOM** kontejneru, aby styl webu neprosákl a náš styl neunikl. Svelte komponenta mountovaná do shadow root.
- Musí spolupracovat s observerem (task 08) — re-mount po SPA navigaci, cleanup při opuštění.

### Historie cen — KONFLIKT s privacy

- „Historie cen" vyžaduje ukládat ceny/produkty v čase. To je přesně to, co MVP slibuje **neukládat/neposílat**.
- Možné řešení: **čistě lokální** historie (`storage.local`/IndexedDB), nikdy neodeslaná, opt-in, jasně komunikovaná. Tím se privacy claim („neposíláme nic") udrží, ale „neukládáme nic" už ne — bude třeba claim upřesnit.
- Alternativa „historie cen jako u Hlídače Shopů" (cross-user data, kdy cenu hlídá server) je **mimo** filozofii projektu — vyžadovalo by backend a sběr dat. Vědomě nedoporučeno.

### Insights / doporučení

- „Tohle sis prohlížel 5×, stojí to 40 h, fakt to potřebuješ?" — behavioral nudge.
- Vše počítáno lokálně z lokální historie. Žádný cloud.

## Realistická kritika

- Tohle je **samostatný produkt**, ne feature. Posouvá TimePrice z „lehká utilita" do „personal finance nástroj", což je jiný trh, jiná konkurence, jiná údržba.
- Vysoké riziko rozbití webů (injektované UI na tisících různých layoutů).
- Údržbová zátěž obrovská. Dělat jen pokud MVP získá silnou základnu a uživatelé to reálně chtějí.

## Mimo scope

- Backend / cloud / cross-user data — proti filozofii projektu.
- Cokoliv, co by odeslalo browsing data ven.

## Hotovo když (jako design)

- Je zafixováno: panely = Future fáze za Shadow DOM, historie jen lokální opt-in, žádný backend, privacy claim se upřesní (neposíláme; ukládáme jen lokálně a opt-in).
- MVP nic neimplementuje, ale jeho abstrakce (observer lifecycle, settings) tomu nebrání.

## Reference

- Task 08 — observer lifecycle (re-mount panelů).
- Task 12 — privacy (historie = upřesnění claimu).
- Task 15 — panely/insights jako pravděpodobná Pro funkce.
- Hlídač Shopů jako referenční (ne kopírovaný — jiná data filozofie) příklad injektovaného UI.
