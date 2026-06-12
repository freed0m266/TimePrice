import { afterEach, describe, expect, it } from 'vitest';

import { scan } from '@/content/scanner';

// Build a fresh body for each test and return it. Tests assert on the candidates `scan`
// returns; the body is reset afterwards so document-order checks stay deterministic.
function render(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

afterEach(() => {
  document.body.innerHTML = '';
});

/** Convenience: the text content of each candidate node, in returned order. */
const texts = (cands: ReturnType<typeof scan>) => cands.map((c) => c.node.data);
/** Convenience: every match value across all candidates, flattened. */
const values = (cands: ReturnType<typeof scan>) =>
  cands.flatMap((c) => c.matches.map((m) => m.value));

describe('scan — basic detection', () => {
  it('finds a price in a simple <span>', () => {
    render('<span>30 000 Kč</span>');
    const cands = scan();
    expect(cands).toHaveLength(1);
    expect(cands[0]!.node.data).toBe('30 000 Kč');
    expect(cands[0]!.matches).toHaveLength(1);
    expect(cands[0]!.matches[0]!.value).toBe(30000);
  });

  it('preserves the offset invariant on the returned match', () => {
    render('<p>Cena je 1 299 Kč včetně DPH</p>');
    const [cand] = scan();
    const m = cand!.matches[0]!;
    expect(cand!.node.data.slice(m.start, m.end)).toBe(m.raw);
    expect(m.value).toBe(1299);
  });

  it('reports multiple matches within a single text node', () => {
    render('<span>Od 199 Kč do 1 499 Kč</span>');
    const cands = scan();
    expect(cands).toHaveLength(1);
    expect(values(cands)).toEqual([199, 1499]);
  });

  it('returns candidates in document order', () => {
    render(`
      <div>299 Kč</div>
      <div><span>nested 1 000 Kč</span></div>
      <div>49,90 Kč</div>
    `);
    expect(values(scan())).toEqual([299, 1000, 49.9]);
  });

  it('returns an empty array when no priced text is present', () => {
    render('<p>Žádné ceny tady — jen rok 2026 a 100 W.</p>');
    expect(scan()).toEqual([]);
  });
});

describe('scan — forbidden contexts', () => {
  it('ignores <script> content', () => {
    render('<script>var p = "30000 Kč";</script><span>30000 Kč</span>');
    expect(texts(scan())).toEqual(['30000 Kč']);
  });

  it('ignores <style> content', () => {
    render('<style>.x::after { content: "9 Kč"; }</style><span>9 Kč</span>');
    expect(values(scan())).toEqual([9]);
  });

  it('ignores <noscript> content', () => {
    render('<noscript>500 Kč</noscript><span>600 Kč</span>');
    expect(values(scan())).toEqual([600]);
  });

  it('ignores <textarea> content', () => {
    render('<textarea>30000 Kč</textarea><span>700 Kč</span>');
    expect(values(scan())).toEqual([700]);
  });

  it('ignores <select>/<option> content', () => {
    render('<select><option>100 Kč</option><option>200 Kč</option></select><span>300 Kč</span>');
    expect(values(scan())).toEqual([300]);
  });

  it('ignores contenteditable regions (true / empty / nested children)', () => {
    render(`
      <div contenteditable="true">800 Kč</div>
      <div contenteditable>900 Kč</div>
      <div contenteditable="true"><span>950 Kč</span></div>
      <span>1 000 Kč</span>
    `);
    expect(values(scan())).toEqual([1000]);
  });

  it('still scans inside contenteditable="false" (and its non-editable descendants)', () => {
    render('<div contenteditable="false"><span>1 234 Kč</span></div>');
    expect(values(scan())).toEqual([1234]);
  });

  it('does not scan a contenteditable="false" island nested in an editable region', () => {
    // The editable ancestor wins for the bare text; only the explicitly non-editable
    // island is scannable.
    render(`
      <div contenteditable="true">
        editable 111 Kč
        <span contenteditable="false">222 Kč</span>
      </div>
    `);
    expect(values(scan())).toEqual([222]);
  });
});

describe('scan — idempotency guards', () => {
  it('ignores a subtree already marked data-timeprice', () => {
    render(
      '<span data-timeprice><span data-tp-original>30 000 Kč</span> = 30 h</span><span>500 Kč</span>',
    );
    expect(values(scan())).toEqual([500]);
  });

  it('ignores a subtree opted out via data-timeprice-skip', () => {
    render('<div data-timeprice-skip><span>30 000 Kč</span></div><span>400 Kč</span>');
    expect(values(scan())).toEqual([400]);
  });
});

describe('scan — options', () => {
  it('scans only the given root subtree', () => {
    render('<section id="a">111 Kč</section><section id="b">222 Kč</section>');
    const root = document.getElementById('b')!;
    expect(values(scan({ root }))).toEqual([222]);
  });

  it('drops matches below minValue', () => {
    render('<span>49 Kč</span><span>5 000 Kč</span>');
    expect(values(scan({ minValue: 100 }))).toEqual([5000]);
  });

  it('accepts a Document as root', () => {
    render('<span>1 500 Kč</span>');
    expect(values(scan({ root: document }))).toContain(1500);
  });

  it('scans a text node passed directly as root (observer characterData path)', () => {
    render('<span>2 499 Kč</span>');
    const textNode = document.querySelector('span')!.firstChild as Text;
    const cands = scan({ root: textNode });
    expect(cands).toHaveLength(1);
    expect(cands[0]!.node).toBe(textNode);
    expect(values(cands)).toEqual([2499]);
  });

  it('rejects a text-node root that sits in a forbidden context', () => {
    render('<div contenteditable="true">3 200 Kč</div>');
    const textNode = document.querySelector('div')!.firstChild as Text;
    expect(scan({ root: textNode })).toEqual([]);
  });
});

describe('scan — read-only contract', () => {
  it('does not mutate the page', () => {
    const html = '<div><span>30 000 Kč</span> a <span>1 299 Kč</span></div>';
    render(html);
    const before = document.body.innerHTML;
    scan();
    expect(document.body.innerHTML).toBe(before);
  });
});

describe('scan — split price (deferred to adapters, task 10)', () => {
  it('does not match an anchor split across sibling elements', () => {
    // No currency anchor inside the number's own text node ⇒ conservatively ignored.
    render('<span>30 000</span><span> Kč</span>');
    expect(scan()).toEqual([]);
  });
});
