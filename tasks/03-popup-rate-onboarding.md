# 03 — Popup: onboarding sazby + live preview (Svelte)

**Status:** Todo

**Priorita:** v1.0 · **Úsilí:** M · **Dopad:** Vysoký

## Cíl

Svelte popup, ve kterém uživatel nastaví svou čistou hodinovou sazbu (presety + custom input) a uvidí živý náhled převodu („1 000 Kč → 1 h"). Popup je jediná onboarding obrazovka MVP. Po zadání sazby a kliknutí mimo onboarding stav přejde do „kompaktního" režimu (sazba + global toggle + per-site toggle — ty toggly dotáhne task 09).

## Kontext

- `netHourlyRateCzk === null` (task 02) = uživatel neonboardovaný → popup ukáže onboarding krok. Jakmile je sazba nastavená, popup ukazuje kompaktní ovládání.
- Popup je první (a v MVP jediný) dotyk produktu s uživatelem. Musí během 5 sekund vysvětlit „zadej hodinovku, koukni jak se ceny mění na čas".
- Presety 500 / 1000 / 1500 Kč/h jsou **UI konstanty** v popupu, ne v settings (task 02 rozhodnutí). Uložená hodnota je vždy konkrétní číslo.
- Live preview používá **stejný `Converter` + formatter jako content engine** (task 05). Aby ale task 03 nebyl blokovaný taskem 05, dočasně použít jednoduchý inline výpočet a po dokončení tasku 05 přepojit na sdílený `formatTime()`. Poznámka v kódu `// TODO(task05): swap for shared formatter`.

## Scope

### 1. Stav a data flow — `entrypoints/popup/`

- Při mountu `loadSettings()` (task 02). Držet lokální reaktivní kopii ve Svelte store.
- Zápis přes `saveSettings()` **debounced 300 ms** (slider/typing nesmí spamovat `storage.sync` — viz riziko v tasku 02).
- Žádný vlastní routing; jedna komponenta `App.svelte` přepíná mezi `OnboardingView` a `CompactView` podle `netHourlyRateCzk`.

### 2. `OnboardingView.svelte`

- Nadpis + jednovětný claim: „Kolik vyděláš čistého za hodinu? Ceny na webech ti převedeme na čas."
- Tři preset tlačítka: 500 / 1 000 / 1 500 Kč/h.
- Custom number input („nebo zadej vlastní"), validace: kladné číslo, rozumný horní strop (např. ≤ 100 000) aby překlep nerozbil formatter.
- Live preview blok: ukázkové ceny (např. 99 Kč, 1 000 Kč, 30 000 Kč) → převedené na čas aktuální sazbou, aktualizuje se při psaní.
- CTA „Hotovo" → uloží sazbu, přepne do CompactView. (Nebo automaticky, jakmile je validní hodnota — preferovat auto, méně tření.)
- Mikrocopy: „Zadej **čistou** sazbu (co ti reálně přijde). Daně nepočítáme za tebe." — protože task rozhodl proti daňovému enginu.

### 3. `CompactView.svelte`

- Zobrazit aktuální sazbu + tlačítko „Změnit" (vrátí do edit režimu sazby).
- Global on/off toggle (váže na `settings.enabled`). **Funkční drát** na settings teď; vizuální/logické dotažení per-site toggle a „vypnout na téhle doméně" je task 09 — tady připravit místo (disabled placeholder s textem „přijde v dalším kroku") nebo rovnou jednoduchý global toggle, per-site nechat tasku 09.
- Drobný náhled: „Na tomhle webu uvidíš čas místo cen." + odkaz/či text statusu.

### 4. Styl — `src/ui/` + popup CSS

- Šířka popupu ~320 px, čistý light/dark přes `prefers-color-scheme`.
- Žádná těžká UI knihovna; pár sdílených komponent (`Button.svelte`, `NumberField.svelte`, `Toggle.svelte`) v `src/ui/`.
- Respektovat „neměnit pocit" estetiku — popup je nenáročný, žádné animace navíc.

### 5. Přístupnost

- Inputy s `<label>`, preset tlačítka jako `role="radiogroup"`, focus management, klávesová obsluha (Enter potvrdí).

## Mimo scope

- Per-site toggle logika a blocklist UI (task 09) — tady jen global toggle a místo pro ně.
- Žádný options page (settings se vejdou do popupu v MVP).
- Žádné premium UI (task 15).
- Žádné další metriky v preview (jen čas; dny/% jsou task 16).
- Reálný formatter — dočasný inline, přepojí se v tasku 05.

## Hotovo když

- Čerstvá instalace → popup ukáže onboarding; po zadání sazby se uloží do `storage.sync` a popup přejde do kompaktního režimu.
- Live preview se mění při psaní/výběru presetu, debounced zápis neflooduje storage.
- Global toggle přepíná `settings.enabled` a změna je čitelná z content scriptu (ověřeno přes `onSettingsChanged`).
- Po reopen popupu se načte uložený stav (sazba, toggle).
- `pnpm check` (svelte-check) a `pnpm lint` čisté; popup funguje light i dark.

## Rizika

- **Sdílení formatteru s content enginem** — duplikace logiky do doby tasku 05 hrozí rozjetím. Mitigace: TODO marker + přepojení je první krok po tasku 05.
- **`storage.sync` flood** při psaní do number inputu — debounce 300 ms povinný.
- **Lokalizace** — MVP je česky (CZK only). Texty držet v jednom `strings.ts`, ne rozházené, ať jde později i18n (mimo MVP scope).

## Reference

- Task 02 — settings store API (`loadSettings`/`saveSettings`/`onSettingsChanged`).
- Task 05 — `formatTime()` / `Converter` (cílový sdílený formatter pro preview).
- WXT Svelte popup příklad: <https://wxt.dev/guide/essentials/frontend-frameworks.html>
- Keymoji `tasks/11-host-app-onboarding.md` — analogický onboarding flow (jiná platforma).
