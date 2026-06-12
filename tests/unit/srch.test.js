// ADR: ADR-0001, ADR-0017
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const SRCH_SRC   = join(__dir, '../../client/srch.js');

/** Execute client/srch.js against a fresh window, return window.IptvSrch. */
function loadSrch() {
  const win = {};
  const src = readFileSync(SRCH_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  const fn = new Function('window', '"use strict";\n' + src + '\nreturn window.IptvSrch;');
  return fn(win);
}

// ---------------------------------------------------------------------------
// Sample fixture data
// ---------------------------------------------------------------------------
const CHS = [
  { id: '1', name: 'World News 24',  cat: 'news',    num: 1  },
  { id: '2', name: 'Sports Arena HD', cat: 'sports', num: 2  },
  { id: '3', name: 'Cinema One',      cat: 'movies', num: 3  },
  { id: '4', name: 'Daily Headlines', cat: 'news',   num: 4  },
  { id: '5', name: 'Football Hub',    cat: 'sports', num: 5  },
  { id: '6', name: 'Action Movies HD', cat: 'movies', num: 6 },
];

// ---------------------------------------------------------------------------
// all-channels filter (flt === 'all')
// ---------------------------------------------------------------------------
describe('getChs — all filter', function () {
  let srch;
  beforeEach(function () { srch = loadSrch(); });

  it('returns all channels when flt is "all" and q is empty', function () {
    const res = srch.getChs(CHS, '', 'all', []);
    expect(res.length).toBe(CHS.length);
  });

  it('returns channels sorted by num ascending', function () {
    const res = srch.getChs(CHS, '', 'all', []);
    const nums = res.map(function getN(ch) { return ch.num; });
    expect(nums).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

// ---------------------------------------------------------------------------
// category filter (flt !== 'all' && flt !== 'favs')
// ---------------------------------------------------------------------------
describe('getChs — category filter', function () {
  let srch;
  beforeEach(function () { srch = loadSrch(); });

  it('filters to channels matching flt category', function () {
    const res = srch.getChs(CHS, '', 'news', []);
    expect(res.length).toBe(2);
    res.forEach(function chk(ch) { expect(ch.cat).toBe('news'); });
  });

  it('returns empty array when no channels match category', function () {
    const res = srch.getChs(CHS, '', 'documentary', []);
    expect(res.length).toBe(0);
  });

  it('category filter result is sorted by num', function () {
    const res = srch.getChs(CHS, '', 'sports', []);
    expect(res[0].num).toBe(2);
    expect(res[1].num).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// favourites filter (flt === 'favs')
// ---------------------------------------------------------------------------
describe('getChs — favs filter', function () {
  let srch;
  beforeEach(function () { srch = loadSrch(); });

  it('returns only channels whose id is in favs', function () {
    const res = srch.getChs(CHS, '', 'favs', ['1', '5']);
    expect(res.length).toBe(2);
    const ids = res.map(function getId(ch) { return ch.id; });
    expect(ids).toContain('1');
    expect(ids).toContain('5');
  });

  it('returns empty array when favs is empty', function () {
    const res = srch.getChs(CHS, '', 'favs', []);
    expect(res.length).toBe(0);
  });

  it('favs filter coerces id to string for comparison', function () {
    const chs = [{ id: 3, name: 'Cinema One', cat: 'movies', num: 3 }];
    const res = srch.getChs(chs, '', 'favs', ['3']);
    expect(res.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// search query filter
// ---------------------------------------------------------------------------
describe('getChs — search query filter', function () {
  let srch;
  beforeEach(function () { srch = loadSrch(); });

  it('filters by channel name (case-insensitive)', function () {
    const res = srch.getChs(CHS, 'arena', 'all', []);
    expect(res.length).toBe(1);
    expect(res[0].name.toLowerCase()).toContain('arena');
  });

  it('filters by channel number string match', function () {
    const res = srch.getChs(CHS, '3', 'all', []);
    const ids = res.map(function getId(ch) { return ch.id; });
    expect(ids).toContain('3');
  });

  it('returns empty array when query matches nothing', function () {
    const res = srch.getChs(CHS, 'zzznotfound', 'all', []);
    expect(res.length).toBe(0);
  });

  it('is case-insensitive for name match', function () {
    const res = srch.getChs(CHS, 'CINEMA', 'all', []);
    expect(res.length).toBe(1);
    expect(res[0].name).toBe('Cinema One');
  });
});

// ---------------------------------------------------------------------------
// combined: category + query
// ---------------------------------------------------------------------------
describe('getChs — combined category + query', function () {
  let srch;
  beforeEach(function () { srch = loadSrch(); });

  it('applies category filter first, then query', function () {
    const res = srch.getChs(CHS, 'arena', 'sports', []);
    expect(res.length).toBe(1);
    expect(res[0].name).toBe('Sports Arena HD');
  });

  it('returns empty when query does not match within category', function () {
    const res = srch.getChs(CHS, 'cinema', 'news', []);
    expect(res.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// empty results
// ---------------------------------------------------------------------------
describe('getChs — empty results', function () {
  let srch;
  beforeEach(function () { srch = loadSrch(); });

  it('returns empty array for empty chs input', function () {
    const res = srch.getChs([], '', 'all', []);
    expect(res.length).toBe(0);
  });

  it('returns empty array for no matches on q + category', function () {
    const res = srch.getChs(CHS, 'zzz', 'news', []);
    expect(res.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// SORTS — exported options list (ADR-0017)
// ---------------------------------------------------------------------------
describe('SORTS — exported options list', function () {
  let srch;
  beforeEach(function () { srch = loadSrch(); });

  it('is an array of exactly the four tokens in order', function () {
    const ids = srch.SORTS.map(function getId(o) { return o.id; });
    expect(ids).toEqual(['num-asc', 'name-asc', 'name-desc', 'fav-first']);
  });

  it('every entry has a non-empty string id and label', function () {
    srch.SORTS.forEach(function chk(o) {
      expect(typeof o.id).toBe('string');
      expect(o.id.length).toBeGreaterThan(0);
      expect(typeof o.label).toBe('string');
      expect(o.label.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// getChs — sort token ordering (ADR-0017)
// Fixture chosen so num order and name order differ, with a name tie.
// ---------------------------------------------------------------------------
const SCHS = [
  { id: '10', name: 'Zeta',  cat: 'a', num: 3 },
  { id: '20', name: 'alpha', cat: 'a', num: 1 },
  { id: '30', name: 'Beta',  cat: 'a', num: 5 },
  { id: '40', name: 'beta',  cat: 'a', num: 2 },
  { id: '50', name: 'Gamma', cat: 'a', num: 4 },
];

describe('getChs — sort tokens', function () {
  let srch;
  beforeEach(function () { srch = loadSrch(); });

  it('num-asc orders by channel number ascending', function () {
    const nums = srch.getChs(SCHS, '', 'all', [], 'num-asc').map(function n(c) { return c.num; });
    expect(nums).toEqual([1, 2, 3, 4, 5]);
  });

  it('name-asc orders by name A->Z case-insensitive with num tiebreak', function () {
    const out = srch.getChs(SCHS, '', 'all', [], 'name-asc');
    expect(out.map(function n(c) { return c.name; })).toEqual(['alpha', 'beta', 'Beta', 'Gamma', 'Zeta']);
    // 'beta'(num2) before 'Beta'(num5): equal name compare resolved by num asc
    expect(out[1].num).toBe(2);
    expect(out[2].num).toBe(5);
  });

  it('name-desc orders by name Z->A case-insensitive with num tiebreak', function () {
    const out = srch.getChs(SCHS, '', 'all', [], 'name-desc');
    expect(out.map(function n(c) { return c.name; })).toEqual(['Zeta', 'Gamma', 'beta', 'Beta', 'alpha']);
    // tie 'beta'/'Beta' still resolves num asc regardless of direction
    expect(out[2].num).toBe(2);
    expect(out[3].num).toBe(5);
  });

  it('fav-first puts favourites first then rest, each partition num asc', function () {
    const out = srch.getChs(SCHS, '', 'all', ['30', '40'], 'fav-first');
    // favs ids 30(num5) + 40(num2) -> partition num asc: 40 then 30
    expect(out[0].id).toBe('40');
    expect(out[1].id).toBe('30');
    // rest: 20(num1), 10(num3), 50(num4) -> num asc
    expect(out.slice(2).map(function n(c) { return c.num; })).toEqual([1, 3, 4]);
  });

  it('unknown sort token falls back to num-asc', function () {
    const nums = srch.getChs(SCHS, '', 'all', [], 'bogus-token').map(function n(c) { return c.num; });
    expect(nums).toEqual([1, 2, 3, 4, 5]);
  });

  it('omitted sort argument falls back to num-asc (current behaviour)', function () {
    const nums = srch.getChs(SCHS, '', 'all', []).map(function n(c) { return c.num; });
    expect(nums).toEqual([1, 2, 3, 4, 5]);
  });

  it('sort applies after filter + search', function () {
    const out = srch.getChs(SCHS, '', 'a', ['30'], 'name-asc');
    expect(out.map(function n(c) { return c.name; })).toEqual(['alpha', 'beta', 'Beta', 'Gamma', 'Zeta']);
  });
});

// ---------------------------------------------------------------------------
// getChs — purity (ADR-0017): no ST / window / DOM reads, input untouched
// ---------------------------------------------------------------------------
describe('getChs — purity', function () {
  let srch;
  beforeEach(function () { srch = loadSrch(); });

  it('does not mutate the input chs array or its order', function () {
    const input = SCHS.slice();
    const snapshot = input.map(function id(c) { return c.id; });
    srch.getChs(input, '', 'all', [], 'name-desc');
    expect(input.map(function id(c) { return c.id; })).toEqual(snapshot);
  });

  it('runs with no global ST / document present (loadSrch window has neither)', function () {
    // loadSrch builds a bare window {}; a non-pure read would throw here.
    let err = null;
    try { srch.getChs(SCHS, '', 'all', [], 'fav-first'); } catch (e) { err = e; }
    expect(err).toBeNull();
  });
});
