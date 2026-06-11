// ADR: ADR-0001
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
