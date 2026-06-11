// UI-only constants for the popup. Per task 02/03 these are deliberately NOT part of
// `AppSettings` — the stored value is always a concrete number, presets are just
// convenient shortcuts in the UI.

/** Rate quick-pick buttons shown in the onboarding view (Kč/h). */
export const PRESET_RATES = [500, 1000, 1500] as const;

/** Sample prices used by the live preview block (Kč). */
export const SAMPLE_PRICES = [99, 1000, 30000] as const;

/**
 * Upper bound for the custom rate input. A typo like an extra zero shouldn't feed an
 * absurd number into the formatter; the real cap is "anything a human plausibly earns".
 */
export const MAX_RATE_CZK = 100000;
