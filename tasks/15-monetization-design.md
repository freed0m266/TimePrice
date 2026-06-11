# 15 — Monetizace: free/premium, Stripe, license keys, abuse protection (DESIGN)

**Status:** Future — design dokument, NEIMPLEMENTOVAT v MVP

**Priorita:** Future · **Úsilí:** L (až se bude stavět) · **Dopad:** Business

## Cíl

Zafixovat **technický** návrh monetizace tak, aby (a) architektura MVP nešla proti němu, (b) neporušil privacy claim z tasku 12, (c) byl realistický pro jednočlenný projekt. Marketing a go-to-market dle promptu řešíme jinde; tady čistě „jak by to šlo technicky a jestli to vůbec může vydělávat".

## Realistický verdikt (kritika, ne hype)

- **Ochota platit za tuhle extension je nízká.** Je to „novelty utility" — uživatel ji použije, řekne „aha, hezký", a po týdnu na ni zapomene. Retence je hlavní problém, ne konverze. Behavioral-finance hodnota („odradí mě od nákupu") je reálná, ale těžko se za ni platí předem.
- **Free uživatelská základna je nutná podmínka**, než vůbec dává smysl řešit premium. Bez tisíců aktivních uživatelů je jakákoliv konverze šum.
- **Nejpravděpodobnější životaschopný model**: free core navždy + jednorázová „Pro" licence (ne subscription) za malou částku za pokročilé metriky/panely (tasky 16, 17). Subscription pro tenhle typ nástroje nemá opodstatnění (žádné průběžné náklady, žádný server v MVP) a zvyšuje tření.
- **Závěr**: monetizace je realistická jen jako **doplněk** k produktu, který nejdřív získá uživatele. Stavět platby dřív než produkt má trakci = předčasná optimalizace. Proto Future.

## Návrh (až bude trakce)

### Free vs Pro hranice

- **Free navždy**: core převod ceny → čas, jedna sazba, smart jednotka, top eshop adaptéry, toggly, privacy. (Tj. celé MVP.)
- **Pro (jednorázově)**: víc metrik současně (% příjmu, dny, spoření — task 16), vlastní panely/insights (task 17), historie cen, víc sazeb/profilů, export. Tj. nadstavby, ne core.

### Technické varianty výběru platby

1. **Chrome Web Store „in-app purchases"** — Google je **deprecoval/zrušil** (Licensing API pro placené extension skončilo). Nelze spoléhat. ❌
2. **Stripe Payment Link / Checkout + license key**:
   - Uživatel koupí přes Stripe hosted checkout (mimo extension, na landing page).
   - Webhook → vygeneruje **offline-ověřitelný license key** (podepsaný tokenem, např. Ed25519: payload = email/ID + tier + expiry, podpis privátním klíčem; extension validuje veřejným klíčem **lokálně**, bez serveru).
   - Uživatel vloží key do extension; gating odemkne Pro.
   - **Privacy zachováno**: validace je offline kryptografická, žádný call domů při běhu. Jediný síťový moment je nákup na webu, mimo content script.
3. **Gumroad / Lemon Squeezy** jako merchant of record (řeší DPH/VAT, faktury) — pro EU prodej výrazně jednodušší než vlastní Stripe + daňová compliance. Vydají license key, který validujeme stejně offline. **Preferovaná varianta** pro jednotlivce (vyřeší VAT MOSS).

### Ochrana proti zneužití (realistická)

- Žádné DRM není neprůstřelné u client-side extension — kód jde přečíst. Cíl: **„dost dobré, aby se to nevyplatilo crackovat"**, ne dokonalost.
- Podepsaný license key (offline ověření) brání triviálnímu generování klíčů.
- Smířit se s tím, že odhodlaný uživatel Pro odemkne. To je OK — hodnota je v pohodlí poctivých, ne v boji s piráty.
- Žádný always-online license check (porušil by privacy claim a štval by uživatele).

## Implikace pro MVP architekturu (co teď NEpokazit)

- `AppSettings` schema (task 02) je rozšiřitelné → přidání `license: { tier, key } | null` bude jen další pole s defaultem, žádná migrace.
- `Converter` registry (task 05) → Pro metriky jsou jen další `Converter` implementace za gatingem.
- Panely (task 17) jsou aditivní vrstva, nezasahují do core.
- Privacy claim (task 12) → license validace **musí** zůstat offline. Zafixovat jako tvrdý constraint.

## Mimo scope (i tohoto design tasku)

- Konkrétní cena/tiery — produktové rozhodnutí až s daty.
- Marketing, akvizice, ASO — mimo (prompt).
- Vlastní license server / účty / cloud — vědomě se mu vyhýbáme (privacy + náklady + provoz).

## Hotovo když (jako design)

- Tým má jasno: free MVP teď, Pro jednorázová licence (Gumroad/Lemon Squeezy + offline podepsaný key) až s trakcí.
- MVP architektura je ověřená, že tyhle kroky neblokuje (schema, converter, privacy).

## Reference

- Task 02 — rozšiřitelné settings schema.
- Task 05 — Converter registry (Pro metriky).
- Task 12 — privacy constraint (offline license validace).
- Task 16/17 — kandidáti na Pro funkce.
- Chrome Web Store payments deprecation: <https://developer.chrome.com/docs/webstore/cws-payments-deprecation>
- Ed25519 offline license keys pattern; Lemon Squeezy / Gumroad licensing API.
