import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory fake of `browser.storage.sync`, same shape as tests/unit/settings.test.ts, so
// the engine's `onSettingsChanged` reaction can be driven by writing to storage.
type ChangeListener = (
  changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
  area: string,
) => void;

const { store, listeners } = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  listeners: new Set<ChangeListener>(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      sync: {
        get(keys: string | string[] | null) {
          if (keys === null || keys === undefined) {
            return Promise.resolve(Object.fromEntries(store));
          }
          const wanted = Array.isArray(keys) ? keys : [keys];
          const out: Record<string, unknown> = {};
          for (const k of wanted) {
            if (store.has(k)) out[k] = store.get(k);
          }
          return Promise.resolve(out);
        },
        set(items: Record<string, unknown>) {
          const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
          for (const [k, v] of Object.entries(items)) {
            changes[k] = { oldValue: store.get(k), newValue: v };
            store.set(k, v);
          }
          listeners.forEach((l) => l(changes, 'sync'));
          return Promise.resolve();
        },
      },
      onChanged: {
        addListener(l: ChangeListener) {
          listeners.add(l);
        },
        removeListener(l: ChangeListener) {
          listeners.delete(l);
        },
      },
    },
  },
}));

import { run } from '@/content/index';
import { registrableDomain } from '@/settings/domain';
import { saveSettings } from '@/settings/store';

import { visibleText } from '../visible-text';

// `onSettingsChanged` reacts via `loadSettings().then(...)`, so a settings write takes a few
// microtasks to land. Drain enough of them before asserting.
const settle = async (): Promise<void> => {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
};

let teardown: (() => void) | null = null;

beforeEach(() => {
  store.clear();
  listeners.clear();
  // jsdom drives requestAnimationFrame off a real timer; stub it to an inert queue so no
  // stray frame fires between tests. The engine performs its mutations while the observer is
  // detached, so nothing here ever needs a frame to flush.
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  teardown?.();
  teardown = null;
  document.body.innerHTML = '';
  document.getElementById('tp-style')?.remove();
  document.documentElement.removeAttribute('data-tp-invert');
  vi.unstubAllGlobals();
});

describe('content engine — activation lifecycle', () => {
  it('stays inactive without an onboarded rate, then activates live when one is set', async () => {
    document.body.innerHTML = '<span>30 000 Kč</span>';

    teardown = await run(); // rate is null → engine inactive
    expect(document.body.textContent).toBe('30 000 Kč');

    await saveSettings({ netHourlyRateCzk: 1000 }); // onboard while the page is open
    await settle();
    expect(visibleText(document.body)).toBe('30 h');
    expect(document.querySelectorAll('[data-timeprice]')).toHaveLength(1);
  });

  it('re-formats already-converted spans on a rate change (no re-parse)', async () => {
    await saveSettings({ netHourlyRateCzk: 1000 });
    document.body.innerHTML = '<span>30 000 Kč</span>';

    teardown = await run();
    expect(visibleText(document.body)).toBe('30 h');
    const span = document.querySelector('[data-timeprice]') as HTMLElement;

    await saveSettings({ netHourlyRateCzk: 2000 }); // 30 000 / 2000 = 15 h
    await settle();

    expect(visibleText(document.body)).toBe('15 h');
    expect(span.getAttribute('data-tp-value')).toBe('30000'); // stored value untouched
    expect(span.getAttribute('data-tp-original')).toBe('30 000 Kč');
  });

  it('switches to price-first mode live without reverting the converted spans', async () => {
    await saveSettings({ netHourlyRateCzk: 1000 });
    document.body.innerHTML = '<span>30 000 Kč</span>';

    teardown = await run();
    expect(visibleText(document.body)).toBe('30 h');
    expect(document.documentElement.hasAttribute('data-tp-invert')).toBe(false);
    const span = document.querySelector('[data-timeprice]') as HTMLElement;

    await saveSettings({ invertHover: true });
    await settle();
    // CSS-only flip: the root marker is set and the span (with its stored data) is untouched —
    // no revert, no reformat. Which face actually shows is covered by the Playwright E2E.
    expect(document.documentElement.hasAttribute('data-tp-invert')).toBe(true);
    expect(document.querySelectorAll('[data-timeprice]')).toHaveLength(1);
    expect(span.getAttribute('data-tp-original')).toBe('30 000 Kč');

    await saveSettings({ invertHover: false });
    await settle();
    expect(document.documentElement.hasAttribute('data-tp-invert')).toBe(false);
  });

  it('reverts on disable and re-applies on re-enable', async () => {
    await saveSettings({ netHourlyRateCzk: 1000 });
    document.body.innerHTML = '<span>30 000 Kč</span>';

    teardown = await run();
    expect(visibleText(document.body)).toBe('30 h');

    await saveSettings({ enabled: false });
    await settle();
    expect(document.body.textContent).toBe('30 000 Kč'); // reverted to original text
    expect(document.querySelectorAll('[data-timeprice]')).toHaveLength(0);

    await saveSettings({ enabled: true });
    await settle();
    expect(visibleText(document.body)).toBe('30 h');
  });

  it('reverts live when the active domain is turned off per-site, and re-applies when back on', async () => {
    await saveSettings({ netHourlyRateCzk: 1000 });
    document.body.innerHTML = '<span>30 000 Kč</span>';

    teardown = await run();
    expect(visibleText(document.body)).toBe('30 h');

    // Key the override on the real registrable domain of the jsdom location, so the test
    // doesn't hardcode the test-runner's URL.
    const domain = registrableDomain(location.host);
    await saveSettings({ siteOverrides: { [domain]: 'off' } });
    await settle();
    expect(document.body.textContent).toBe('30 000 Kč'); // reverted, no reload
    expect(document.querySelectorAll('[data-timeprice]')).toHaveLength(0);

    await saveSettings({ siteOverrides: {} }); // back to default-on
    await settle();
    expect(visibleText(document.body)).toBe('30 h');
  });

  it('stops reacting once torn down', async () => {
    await saveSettings({ netHourlyRateCzk: 1000 });
    document.body.innerHTML = '<span>30 000 Kč</span>';

    teardown = await run();
    expect(visibleText(document.body)).toBe('30 h');

    teardown();
    teardown = null;

    await saveSettings({ netHourlyRateCzk: 5000 }); // would re-format to 6 h if still live
    await settle();
    expect(visibleText(document.body)).toBe('30 h'); // unchanged → listener removed
  });
});
