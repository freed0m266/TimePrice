import { beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory fake of `browser.storage.sync` shared with the mock factory below.
// `vi.hoisted` lets us reference it from the hoisted `vi.mock` call safely.
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

import { DEFAULT_SETTINGS } from '@/settings/schema';
import {
  isActiveForHost,
  isHostActive,
  loadSettings,
  onSettingsChanged,
  saveSettings,
} from '@/settings/store';
import { registrableDomain } from '@/settings/domain';

beforeEach(() => {
  store.clear();
  listeners.clear();
});

describe('loadSettings', () => {
  it('returns all defaults from empty storage', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('merges stored values over the defaults', async () => {
    await saveSettings({ netHourlyRateCzk: 500, enabled: false });
    const settings = await loadSettings();
    expect(settings.netHourlyRateCzk).toBe(500);
    expect(settings.enabled).toBe(false);
    // Untouched fields keep their defaults.
    expect(settings.workdayHours).toBe(DEFAULT_SETTINGS.workdayHours);
    expect(settings.rounding).toBe(DEFAULT_SETTINGS.rounding);
  });

  it('ignores malformed / wrong-typed stored values', async () => {
    store.set('enabled', 'yes'); // wrong type
    store.set('workdayHours', 'eight'); // wrong type
    store.set('rounding', 'nonsense'); // invalid enum
    store.set('siteOverrides', { 'alza.cz': 'maybe', 'czc.cz': 'off' }); // partly invalid
    store.set('blocklist', ['ok.cz', 42, null]); // partly invalid
    store.set('unknownFutureKey', 123); // forward-compat: ignored

    const settings = await loadSettings();
    expect(settings.enabled).toBe(DEFAULT_SETTINGS.enabled);
    expect(settings.workdayHours).toBe(DEFAULT_SETTINGS.workdayHours);
    expect(settings.rounding).toBe('auto');
    expect(settings.siteOverrides).toEqual({ 'czc.cz': 'off' });
    expect(settings.blocklist).toEqual(['ok.cz']);
  });

  it('accepts null netHourlyRateCzk as the not-onboarded signal', async () => {
    await saveSettings({ netHourlyRateCzk: 1000 });
    await saveSettings({ netHourlyRateCzk: null });
    expect((await loadSettings()).netHourlyRateCzk).toBeNull();
  });
});

describe('saveSettings', () => {
  it('patches only the provided keys, leaving the rest intact', async () => {
    await saveSettings({ netHourlyRateCzk: 500 });
    await saveSettings({ enabled: false });

    const settings = await loadSettings();
    expect(settings.netHourlyRateCzk).toBe(500); // not wiped by the second patch
    expect(settings.enabled).toBe(false);
  });
});

describe('onSettingsChanged', () => {
  it('delivers the merged settings when storage changes', async () => {
    const received = new Promise<number | null>((resolve) => {
      onSettingsChanged((s) => resolve(s.netHourlyRateCzk));
    });
    await saveSettings({ netHourlyRateCzk: 1000 });
    expect(await received).toBe(1000);
  });

  it('stops delivering after unsubscribe', async () => {
    const cb = vi.fn();
    const unsubscribe = onSettingsChanged(cb);
    unsubscribe();
    await saveSettings({ netHourlyRateCzk: 1500 });
    // Give any pending microtasks a chance to flush.
    await Promise.resolve();
    expect(cb).not.toHaveBeenCalled();
  });

  it('ignores changes from non-sync areas', () => {
    const cb = vi.fn();
    onSettingsChanged(cb);
    listeners.forEach((l) => l({ enabled: { newValue: false } }, 'local'));
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('isActiveForHost', () => {
  it('is true by default', async () => {
    expect(await isActiveForHost('www.alza.cz')).toBe(true);
  });

  it('is false when globally disabled', async () => {
    await saveSettings({ enabled: false });
    expect(await isActiveForHost('www.alza.cz')).toBe(false);
  });

  it('is false for a user-blocklisted domain (matched on registrable domain)', async () => {
    await saveSettings({ blocklist: ['alza.cz'] });
    expect(await isActiveForHost('www.alza.cz')).toBe(false);
  });

  it('is false when the site is overridden off (matched on registrable domain)', async () => {
    await saveSettings({ siteOverrides: { 'alza.cz': 'off' } });
    expect(await isActiveForHost('www.alza.cz')).toBe(false);
  });

  it('is true when the site is overridden on', async () => {
    await saveSettings({ siteOverrides: { 'alza.cz': 'on' } });
    expect(await isActiveForHost('shop.alza.cz')).toBe(true);
  });
});

describe('isHostActive (pure)', () => {
  it('decides against already-loaded settings without touching storage', () => {
    expect(isHostActive(DEFAULT_SETTINGS, 'www.alza.cz')).toBe(true);
    expect(isHostActive({ ...DEFAULT_SETTINGS, enabled: false }, 'www.alza.cz')).toBe(false);
    expect(isHostActive(DEFAULT_SETTINGS, '')).toBe(false);
  });
});

describe('registrableDomain', () => {
  it('strips subdomains to the last two labels', () => {
    expect(registrableDomain('www.alza.cz')).toBe('alza.cz');
    expect(registrableDomain('alza.cz')).toBe('alza.cz');
    expect(registrableDomain('a.b.c.example.com')).toBe('example.com');
  });

  it('keeps three labels for known multi-label suffixes', () => {
    expect(registrableDomain('shop.example.co.uk')).toBe('example.co.uk');
    expect(registrableDomain('www.shop.com.au')).toBe('shop.com.au');
  });

  it('normalizes case, trailing dot, and port', () => {
    expect(registrableDomain('WWW.Alza.CZ')).toBe('alza.cz');
    expect(registrableDomain('www.alza.cz.')).toBe('alza.cz');
    expect(registrableDomain('www.alza.cz:8080')).toBe('alza.cz');
  });

  it('returns single-label hosts and IPv4 literals unchanged', () => {
    expect(registrableDomain('localhost')).toBe('localhost');
    expect(registrableDomain('192.168.0.1')).toBe('192.168.0.1');
    expect(registrableDomain('')).toBe('');
  });
});
