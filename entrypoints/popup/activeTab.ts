// Resolve the host of the tab the user is looking at, for the popup's per-site toggle.
//
// Uses `activeTab` (not the broad `tabs` permission): opening the popup is the user gesture
// that grants read access to the active tab's URL, so `tabs.query` returns its `url` here.
// Popup-only — the service worker never queries tabs.

import { browser } from 'wxt/browser';

/**
 * The hostname of the active tab in the current window, or `null` when it can't or
 * shouldn't drive a per-site toggle — no tab, a missing URL, or a non-web page
 * (`chrome://`, `about:`, extension pages). Never throws.
 */
export async function getActiveTabHost(): Promise<string | null> {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0]?.url;
    if (!url) return null;
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.hostname;
  } catch {
    return null;
  }
}
