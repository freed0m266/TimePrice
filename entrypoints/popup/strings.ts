// All user-facing popup copy lives here, in one place. The MVP is Czech (CZK only),
// but keeping strings centralised means a later i18n pass (out of MVP scope) won't have
// to hunt them out of the components.

export const STRINGS = {
  appName: 'TimePrice',

  onboarding: {
    claim: 'Kolik vyděláš čistého za hodinu? Ceny na webech ti převedeme na čas.',
    presetLegend: 'Rychlá volba sazby',
    customLabel: 'nebo zadej vlastní',
    rateSuffix: 'Kč/h',
    previewHeading: 'Náhled',
    previewEmpty: 'Vyber nebo zadej sazbu a uvidíš náhled.',
    cta: 'Hotovo',
    netHint: 'Zadej čistou sazbu (co ti reálně přijde). Daně nepočítáme za tebe.',
    invalidRate: 'Zadej kladné číslo do 100 000.',
  },

  compact: {
    rateLabel: 'Tvoje sazba',
    rateSuffix: 'Kč/h',
    change: 'Změnit',
    globalToggle: 'TimePrice zapnutý',
    globalToggleHint: 'Na tomhle webu uvidíš čas místo cen.',
    globalOffHint: 'Vypnuto — ceny se nepřevádějí nikde.',
    perSiteToggle: 'Vypnout na téhle doméně',
    perSitePlaceholder: 'přijde v dalším kroku',
  },
} as const;
