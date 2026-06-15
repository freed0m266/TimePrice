// External URLs and contact endpoints referenced from the UI and store listing.
//
// Kept in one pure module (no DOM, no browser APIs) so the popup, a future options page,
// and the store-listing docs all point at the same source of truth.

/**
 * Public privacy-policy URL — live. Source of truth for the content lives in
 * `marketing/privacy-policy.html`; this is the hosted, deployed copy the popup links to and the
 * Chrome Web Store listing references. Keep the two in sync when the policy text changes.
 */
export const PRIVACY_POLICY_URL = 'https://martinfreedom.com/timeprice/privacy-policy.html';

/** Contact address for privacy questions and support. Mirrored in the privacy policy. */
export const CONTACT_EMAIL = 'martin.svoboda026@gmail.com';

/** Issue tracker / support home. */
export const SUPPORT_URL = 'https://github.com/freed0m266/TimePrice';
