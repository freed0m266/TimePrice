// External URLs and contact endpoints referenced from the UI and store listing.
//
// Kept in one pure module (no DOM, no browser APIs) so the popup, a future options page,
// and the store-listing docs all point at the same source of truth.

/**
 * Public privacy-policy URL. Source lives in `marketing/privacy-policy.html`; it is hosted
 * on GitHub Pages at store-submission time (task 13/14, "Mimo scope" of task 12 — the file
 * here is the content, the deploy is separate). This is the conventional project-pages URL
 * for the repo; confirm/finalize it when the page actually goes live.
 */
export const PRIVACY_POLICY_URL = 'https://freed0m266.github.io/TimePrice/privacy-policy.html';

/** Contact address for privacy questions and support. Mirrored in the privacy policy. */
export const CONTACT_EMAIL = 'martin.svoboda026@gmail.com';

/** Issue tracker / support home. */
export const SUPPORT_URL = 'https://github.com/freed0m266/TimePrice';
