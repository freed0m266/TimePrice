// Thin, typed wrapper over `browser.storage.sync` — the only place that touches storage.
//
// Settings are stored as FLAT top-level keys (one storage item per `AppSettings` field)
// rather than a single blob, so a large `siteOverrides` map lives in its own item and
// stays clear of the ~8 KB/item sync quota. `loadSettings` always merges over
// `DEFAULT_SETTINGS`, which makes reads resilient to older/partial records with no
// explicit migration.

import { browser } from 'wxt/browser';
import { isBuiltinBlocked } from './blocklist';
import { registrableDomain } from './domain';
import { DEFAULT_SETTINGS, type AppSettings, type Rounding, type SiteState } from './schema';

const SYNC_AREA = 'sync';

/** Load the full settings object, merging stored values over the defaults. */
export async function loadSettings(): Promise<AppSettings> {
  const stored = await browser.storage.sync.get(null);
  return mergeSettings(stored);
}

/**
 * Persist only the provided keys. Other stored keys are left untouched, because each
 * field is its own storage item.
 */
export async function saveSettings(patch: Partial<AppSettings>): Promise<void> {
  await browser.storage.sync.set(patch);
}

/**
 * Subscribe to settings changes made from any context (e.g. popup → content). The
 * callback receives the freshly merged, complete `AppSettings`. Returns an unsubscribe
 * function.
 */
export function onSettingsChanged(cb: (settings: AppSettings) => void): () => void {
  const listener: Parameters<typeof browser.storage.onChanged.addListener>[0] = (
    _changes,
    area,
  ) => {
    if (area !== SYNC_AREA) return;
    void loadSettings().then(cb);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

/**
 * Decide whether TimePrice should run on `host`: globally enabled, not blocked
 * (built-in or user blocklist), and not turned off per-site. Loads settings; for the
 * synchronous form against already-loaded settings use {@link isHostActive}.
 */
export async function isActiveForHost(host: string): Promise<boolean> {
  return isHostActive(await loadSettings(), host);
}

/**
 * Pure activation decision against already-loaded settings — for the content engine,
 * which holds the latest settings from {@link onSettingsChanged} and must not hit
 * storage on every check.
 */
export function isHostActive(settings: AppSettings, host: string): boolean {
  if (!settings.enabled) return false;
  const domain = registrableDomain(host);
  if (domain === '') return false;
  // Built-in sensitive-domain gate: hard, not user-overridable (task 09 security default).
  if (isBuiltinBlocked(domain)) return false;
  // User blocklist: a future options page may populate this; in the MVP the per-site "off"
  // override below is the only UI that turns a domain off, and it covers the everyday need.
  if (settings.blocklist.includes(domain)) return false;
  if (settings.siteOverrides[domain] === 'off') return false;
  return true;
}

/** Merge a raw stored record over the defaults, validating each known field's type. */
function mergeSettings(stored: Record<string, unknown>): AppSettings {
  const merged: AppSettings = {
    ...DEFAULT_SETTINGS,
    siteOverrides: { ...DEFAULT_SETTINGS.siteOverrides },
    blocklist: [...DEFAULT_SETTINGS.blocklist],
  };

  if (typeof stored.schemaVersion === 'number') merged.schemaVersion = stored.schemaVersion;
  if (typeof stored.enabled === 'boolean') merged.enabled = stored.enabled;
  if (stored.netHourlyRateCzk === null || typeof stored.netHourlyRateCzk === 'number') {
    merged.netHourlyRateCzk = stored.netHourlyRateCzk;
  }
  if (typeof stored.workdayHours === 'number') merged.workdayHours = stored.workdayHours;
  if (typeof stored.workweekDays === 'number') merged.workweekDays = stored.workweekDays;
  if (isRounding(stored.rounding)) merged.rounding = stored.rounding;

  const siteOverrides = sanitizeSiteOverrides(stored.siteOverrides);
  if (siteOverrides) merged.siteOverrides = siteOverrides;
  const blocklist = sanitizeBlocklist(stored.blocklist);
  if (blocklist) merged.blocklist = blocklist;

  return merged;
}

function isRounding(v: unknown): v is Rounding {
  return v === 'auto' || v === 'tenths' || v === 'whole';
}

function sanitizeSiteOverrides(v: unknown): Record<string, SiteState> | null {
  if (typeof v !== 'object' || v === null) return null;
  const out: Record<string, SiteState> = {};
  for (const [key, value] of Object.entries(v)) {
    if (value === 'on' || value === 'off') out[key] = value;
  }
  return out;
}

function sanitizeBlocklist(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  return v.filter((x): x is string => typeof x === 'string');
}
