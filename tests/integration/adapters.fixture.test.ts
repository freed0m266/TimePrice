// Adapter regression on fixtures (task 14 §3).
//
// Each shipped adapter has a saved e-shop snapshot in tests/fixtures/sites/. These tests run the
// adapter against its fixture and assert exactly which prices convert. They are an EARLY-WARNING
// layer: if an e-shop ships a markup redesign and an adapter selector stops matching, the fixture
// (re-snapshotted on the next refresh) makes the relevant assertion go red — before a user ever
// sees a blank/over-converted page. They also pin every ignoreSelector (the fixtures nest the
// comparison / without-VAT / unit prices inside a price container, where `ignore` actually fires)
// and the stale-markup → generic-fallback safety net (§5).

import { afterEach, describe, expect, it } from 'vitest';

import { adapterScan } from '@/content/adapters/engine';
import { getAdapter } from '@/content/adapters/registry';
import { applyAll, revertAll } from '@/content/mutator';
import { alza } from '@/content/adapters/sites/alza';
import { mall } from '@/content/adapters/sites/mall';
import { datart } from '@/content/adapters/sites/datart';
import { czc } from '@/content/adapters/sites/czc';
import { notino } from '@/content/adapters/sites/notino';
import type { SiteAdapter } from '@/content/adapters/types';

import { CTX, convertedValues, loadFixture } from './_fixtures';

afterEach(() => {
  document.body.innerHTML = '';
  document.getElementById('tp-style')?.remove();
});

interface Case {
  name: string;
  /** A host the adapter must bind to (proves registry resolution on the real registrable domain). */
  host: string;
  adapter: SiteAdapter;
  fixture: string;
  /** Prices (by value) the adapter must convert. */
  converts: number[];
  /** Price strings that must stay raw on the page (ignored or out-of-container). */
  untouched: string[];
  /** The product-detail price — must survive even via the stale-selectors generic fallback. */
  detailValue: number;
}

const CASES: Case[] = [
  {
    name: 'alza',
    host: 'www.alza.cz',
    adapter: alza,
    fixture: 'sites/alza.html',
    converts: [1990, 7000, 30000],
    untouched: ['35 000 Kč', '24 793 Kč', '9 000 Kč', '79 Kč'],
    detailValue: 30000,
  },
  {
    name: 'mall',
    host: 'www.mall.cz',
    adapter: mall,
    fixture: 'sites/mall.html',
    converts: [1000, 2500, 12000],
    untouched: ['15 000 Kč', '1 400 Kč', '1 500 Kč', '49 Kč'],
    detailValue: 12000,
  },
  {
    name: 'datart',
    host: 'www.datart.cz',
    adapter: datart,
    fixture: 'sites/datart.html',
    converts: [3000, 4990, 8000],
    untouched: ['5 990 Kč', '250 Kč', '2 000 Kč', '49 Kč'],
    detailValue: 4990,
  },
  {
    name: 'czc',
    host: 'www.czc.cz',
    adapter: czc,
    fixture: 'sites/czc.html',
    converts: [3000, 6500, 12000],
    untouched: ['9 917 Kč', '14 000 Kč', '3 500 Kč', '59 Kč'],
    detailValue: 12000,
  },
  {
    name: 'notino',
    host: 'www.notino.cz',
    adapter: notino,
    fixture: 'sites/notino.html',
    converts: [499, 1200, 2000],
    untouched: ['699 Kč', '1 500 Kč', '39 Kč'],
    detailValue: 499,
  },
];

describe('adapter regression — selectors still hit their fixture', () => {
  for (const c of CASES) {
    describe(c.name, () => {
      it('binds to its host by registrable domain', () => {
        expect(getAdapter(c.host)).toBe(c.adapter);
      });

      it('converts exactly its price selectors, skipping ignored & out-of-container prices', () => {
        loadFixture(c.fixture);
        applyAll(adapterScan(c.adapter, document.body), CTX);

        // The set of converted prices is exact — a selector that stopped matching drops a value
        // (markup drift early-warning); one that got too greedy adds one (over-conversion).
        expect(convertedValues()).toEqual(c.converts);

        // Each ignored / out-of-container price is still present as raw text and never wrapped.
        for (const raw of c.untouched) {
          expect(document.body.textContent).toContain(raw);
          const wrapped = [...document.querySelectorAll('[data-timeprice]')].some(
            (el) => el.getAttribute('data-tp-original') === raw,
          );
          expect(wrapped, `${raw} must not be converted`).toBe(false);
        }
      });

      it('reverts to byte-identical original markup (reversibility on real HTML)', () => {
        loadFixture(c.fixture);
        const original = document.body.textContent;
        applyAll(adapterScan(c.adapter, document.body), CTX);
        expect(document.body.textContent).not.toBe(original); // sanity: something converted
        revertAll();
        expect(document.body.textContent).toBe(original);
        expect(document.querySelectorAll('[data-timeprice]')).toHaveLength(0);
      });

      it('falls back to the generic anchored scan when its selectors go stale', () => {
        // Simulate the e-shop moving its price into new markup: the adapter keeps its (now
        // stale) ignore selectors but its price selectors match nothing. The engine must still
        // find the detail price via the generic anchored scan — the page is never left blank.
        const stale: SiteAdapter = { ...c.adapter, priceSelectors: ['.tp-stale-none-xyz'] };
        loadFixture(c.fixture);
        applyAll(adapterScan(stale, document.body), CTX);
        expect(convertedValues()).toContain(c.detailValue);
      });
    });
  }
});
