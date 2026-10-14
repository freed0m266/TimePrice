// Typed configuration model for TimePrice.
//
// This is the SINGLE source of truth for user configuration. The popup writes it,
// the content/background scripts read it and react to changes. The schema is
// forward-compatible: new fields (future metrics, premium flags) are added with a
// default and picked up by merge-with-defaults on read — no migration required until
// `schemaVersion` actually bumps to 2.
//
// Runs in the popup AND the service worker, so this file stays free of DOM APIs.

/** Per-domain override of the global `enabled` switch. Keyed on registrable domain. */
export type SiteState = 'on' | 'off';

/** How the converter rounds the resulting work-time value (consumed in task 05). */
export type Rounding = 'auto' | 'tenths' | 'whole';

export interface AppSettings {
  /** Schema version for future migrations; currently 1. */
  schemaVersion: number;
  /** Global on/off switch (default true). */
  enabled: boolean;
  /** Net CZK earned per hour; `null` means the user has not onboarded yet. */
  netHourlyRateCzk: number | null;
  /** Hours in a workday, used to auto-scale to "days" (default 8). */
  workdayHours: number;
  /** Days in a workweek (default 5); reserved for task 16. */
  workweekDays: number;
  /** Time rounding strategy (default 'auto'). */
  rounding: Rounding;
  /**
   * Price-first mode (task 20/21; key name kept for stored-settings compat). `false` (default,
   * time-first): pages show the time, the tooltip shows the original price. `true`: pages show the
   * original price, the tooltip shows the time.
   * Display-only — it never changes what gets converted, just which face is shown at rest.
   */
  invertHover: boolean;
  /** Per-domain overrides of the global switch. Key = registrable domain. */
  siteOverrides: Record<string, SiteState>;
  /** User-added blocked domains, on top of the built-in blocklist (task 09). */
  blocklist: string[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: 1,
  enabled: true,
  netHourlyRateCzk: null,
  workdayHours: 8,
  workweekDays: 5,
  rounding: 'auto',
  invertHover: false,
  siteOverrides: {},
  blocklist: [],
};
