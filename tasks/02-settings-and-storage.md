# 02 — Settings model + storage layer (`chrome.storage.sync`)

**Status:** Todo

**Priorita:** v1.0 · **Úsilí:** S · **Dopad:** Blokující

## Cíl

Definovat typovaný datový model nastavení (`AppSettings`) a tenkou vrstvu nad `chrome.storage.sync`, kterou používá popup (zápis) i content/background script (čtení + reakce na změny). Po dokončení lze odkudkoliv načíst aktuální nastavení, zapsat ho a přihlásit se k odběru změn, vše typově bezpečně a s defaulty.

## Kontext

- Settings jsou malá data (sazba, toggly, per-site mapy) → `chrome.storage.sync` (sdílí se mezi zařízeními uživatele, limit ~100 KB / 8 KB per item — bohatě stačí). Per-site override mapa může růst; pohlídat velikost a v případě limitu spadnout na `storage.local` (poznámka v rizicích).
- `webextension-polyfill` dává `browser.storage.sync` s Promise API a cross-browser kompatibilitou (důležité pro task 19).
- Toto je **jediný** zdroj pravdy pro konfiguraci. Content engine (tasky 06–11) z něj čte, nikdy si nedrží vlastní kopii bez invalidace.
- Schema musí být **dopředně kompatibilní**: přidání nové metriky (task 16) nebo premium flagu (task 15) nesmí vyžadovat migraci, jen rozšíření s defaultem. Proto verzované schema + merge s defaulty při čtení.

## Scope

### 1. Datový model — `src/settings/schema.ts`

```ts
export interface AppSettings {
  schemaVersion: number;          // pro budoucí migrace; teď 1
  enabled: boolean;               // global on/off (default true)
  netHourlyRateCzk: number | null; // čistá Kč/h; null = neonboardováno
  workdayHours: number;           // pro auto-scaling na "dny" (default 8)
  workweekDays: number;           // (default 5) — rezerva pro task 16
  rounding: 'auto' | 'tenths' | 'whole'; // jak zaokrouhlovat čas (default 'auto')
  siteOverrides: Record<string, SiteState>; // klíč = registrable domain
  blocklist: string[];            // user-přidané domény navíc k built-in (task 09)
}

export type SiteState = 'on' | 'off'; // per-doména override globálního enabled

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: 1,
  enabled: true,
  netHourlyRateCzk: null,
  workdayHours: 8,
  workweekDays: 5,
  rounding: 'auto',
  siteOverrides: {},
  blocklist: [],
};
```

- Presety sazby (500/1000/1500) **nejsou** v settings — to je UI konstanta v popupu (task 03). Settings drží jen vybranou hodnotu.
- `netHourlyRateCzk: null` je signál „uživatel ještě nenastavil sazbu" → content engine je no-op, popup ukáže onboarding (task 03).

### 2. Storage wrapper — `src/settings/store.ts`

API (vše Promise-based, přes `browser.storage.sync`):

```ts
export async function loadSettings(): Promise<AppSettings>;     // merge s DEFAULT_SETTINGS
export async function saveSettings(patch: Partial<AppSettings>): Promise<void>;
export function onSettingsChanged(cb: (s: AppSettings) => void): () => void; // vrací unsubscribe
export async function isActiveForHost(host: string): Promise<boolean>; // global + per-site + blocklist
```

- `loadSettings` **vždy** merguje uložená data přes `DEFAULT_SETTINGS` (chybějící klíče = default). Tím je čtení odolné proti starším/neúplným záznamům bez explicitní migrace.
- `onSettingsChanged` obaluje `browser.storage.onChanged` (filtruje na `area === 'sync'`), znovu načte a předá kompletní `AppSettings`. Content script tak reaguje živě na změnu sazby/toggle bez reloadu stránky.
- `isActiveForHost(host)` centralizuje rozhodovací logiku (použije ji content script v tasku 09): `enabled === true` AND host není v built-in blocklistu ani v `blocklist` AND `siteOverrides[domain] !== 'off'`. Built-in blocklist žije v `src/settings/blocklist.ts` (task 09 ho naplní; teď export prázdného pole + TODO).

### 3. Doménová normalizace — `src/settings/domain.ts`

- `registrableDomain(host: string): string` — z `www.alza.cz` → `alza.cz`. Pro MVP stačí heuristika „poslední dva labely", se seznamem známých dvojitých TLD (`co.uk`, `com.au`) jako malou tabulkou. **Nepřidávat** těžkou `psl`/public-suffix-list dependency v MVP (bundle size); dokumentovat jako limitaci a možný upgrade.
- Per-site overrides i blocklist klíčují přes `registrableDomain`, aby `www.`/subdomény sdílely stav.

### 4. Testy — `tests/unit/settings.test.ts`

- `loadSettings` merguje defaulty (mock `browser.storage.sync` přes `@webext-core/fake-browser` nebo ruční mock).
- `saveSettings` patchuje jen předané klíče, nemaže ostatní.
- `isActiveForHost`: global off → false; blocklist hit → false; per-site 'off' → false; jinak true.
- `registrableDomain`: `www.alza.cz` → `alza.cz`, `shop.example.co.uk` → `example.co.uk`.

## Mimo scope

- Žádné UI (task 03 popup, task 09 toggly).
- Žádný built-in blocklist obsah — jen prázdný export + struktura (naplní task 09).
- Žádná reálná migrace mezi schema verzemi (merge-with-defaults stačí pro v1.0; skutečný migrátor až bude `schemaVersion` 2).
- Žádné premium/licenční pole (task 15 ho přidá jako rozšíření schématu).

## Hotovo když

- `AppSettings`, `DEFAULT_SETTINGS`, store API a `registrableDomain` existují a jsou exportované.
- `loadSettings` vrací plný objekt i z prázdného storage (samé defaulty).
- `onSettingsChanged` doručí update při změně v jiném kontextu (popup → content).
- `isActiveForHost` respektuje global / per-site / blocklist.
- Unit testy v bodě 4 procházejí (`pnpm test`).
- ESLint guard potvrzuje, že `src/settings/**` neimportuje DOM API (běží i v service workeru).

## Rizika

- **`storage.sync` quota** (~8 KB/item, ~100 KB celkem). Velká `siteOverrides` mapa to teoreticky překročí u power userů. Mitigace: ukládat jen ne-default stavy (smazat klíč při návratu na default), a v rizikové větvi fallback na `storage.local`. Dokumentovat.
- **`onChanged` bouře** — častý zápis (např. živý slider sazby v popupu) spustí mnoho eventů v content scriptu. Popup musí zápis debouncovat (řeší task 03); content listener musí být idempotentní (řeší task 08).
- **Cross-browser**: `browser.storage.sync` ve Firefoxu vyžaduje `browser_specific_settings.gecko.id` (task 19). Teď přes polyfill OK pro Chrome.

## Reference

- `chrome.storage` API: <https://developer.chrome.com/docs/extensions/reference/api/storage>
- WXT storage utilities (alternativa k ručnímu wrapperu): <https://wxt.dev/guide/essentials/storage.html> — zvážit `wxt/storage`, ale ruční wrapper dává plnou typovou kontrolu nad schématem.
- `@webext-core/fake-browser` pro testy: <https://webext-core.aklinker1.io/fake-browser/>
