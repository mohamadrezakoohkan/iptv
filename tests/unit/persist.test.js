// ADR: ADR-0003
// Unit tests — loadSt() and saveSt() persistence helpers (TASK-0010)

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const CFG_SRC    = join(__dir, '../../client/cfg.js');
const ST_SRC     = join(__dir, '../../client/st.js');

/**
 * Build a fresh window with mocked localStorage, window.S, window.IptvSt.
 * Returns { win, store } where store is a plain Map backing localStorage.
 */
function mkWin() {
  const store = {};
  const ls = {
    getItem:    function getItem(k)    { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem:    function setItem(k, v) { store[k] = String(v); },
    removeItem: function removeItem(k) { delete store[k]; },
    clear:      function clear()       { Object.keys(store).forEach(function del(k) { delete store[k]; }); },
  };
  const win = { localStorage: ls };
  const cfgSrc = readFileSync(CFG_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', '"use strict";\n' + cfgSrc)(win);
  const stSrc = readFileSync(ST_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', '"use strict";\n' + stSrc)(win);
  return { win, store };
}

// ---------------------------------------------------------------------------
// loadSt — all three keys present and valid
// ---------------------------------------------------------------------------
describe('loadSt() — all three keys present and valid', function () {
  let win, store;
  beforeEach(function () {
    const w = mkWin();
    win   = w.win;
    store = w.store;
    store['iptv_creds'] = JSON.stringify({ url: 'http://portal', user: 'alice', pass: 'secret' });
    store['iptv_sel']   = '7';
    store['iptv_favs']  = JSON.stringify(['1', '3', '5']);
  });

  it('returns correct creds object', function () {
    const res = win.IptvSt.loadSt();
    expect(res.creds).toEqual({ url: 'http://portal', user: 'alice', pass: 'secret' });
  });

  it('returns correct sel string', function () {
    const res = win.IptvSt.loadSt();
    expect(res.sel).toBe('7');
  });

  it('populates ST.favs from iptv_favs', function () {
    win.IptvSt.loadSt();
    expect(win.IptvSt.ST.favs).toEqual(['1', '3', '5']);
  });
});

// ---------------------------------------------------------------------------
// loadSt — all keys absent
// ---------------------------------------------------------------------------
describe('loadSt() — all keys absent', function () {
  let win;
  beforeEach(function () {
    const w = mkWin();
    win = w.win;
  });

  it('returns creds as null', function () {
    const res = win.IptvSt.loadSt();
    expect(res.creds).toBeNull();
  });

  it('returns sel as null', function () {
    const res = win.IptvSt.loadSt();
    expect(res.sel).toBeNull();
  });

  it('ST.favs stays []', function () {
    win.IptvSt.loadSt();
    expect(win.IptvSt.ST.favs).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// loadSt — malformed JSON in credsKey
// ---------------------------------------------------------------------------
describe('loadSt() — malformed JSON in credsKey', function () {
  let win, store;
  beforeEach(function () {
    const w = mkWin();
    win   = w.win;
    store = w.store;
    store['iptv_creds'] = '{bad json';
  });

  it('returns creds as null (no exception thrown)', function () {
    let err = null;
    let res = null;
    try { res = win.IptvSt.loadSt(); } catch (e) { err = e; }
    expect(err).toBeNull();
    expect(res.creds).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// loadSt — malformed JSON in favsKey
// ---------------------------------------------------------------------------
describe('loadSt() — malformed JSON in favsKey', function () {
  let win, store;
  beforeEach(function () {
    const w = mkWin();
    win   = w.win;
    store = w.store;
    store['iptv_favs'] = '[not valid';
  });

  it('ST.favs stays [] (no exception thrown)', function () {
    let err = null;
    try { win.IptvSt.loadSt(); } catch (e) { err = e; }
    expect(err).toBeNull();
    expect(win.IptvSt.ST.favs).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// saveSt('favs') — writes correct key and serialized value
// ---------------------------------------------------------------------------
describe("saveSt('favs')", function () {
  let win, store;
  beforeEach(function () {
    const w = mkWin();
    win   = w.win;
    store = w.store;
    win.IptvSt.setFavs(['2', '9']);
  });

  it('writes JSON.stringify(ST.favs) to iptv_favs', function () {
    win.IptvSt.saveSt('favs');
    expect(store['iptv_favs']).toBe('["2","9"]');
  });
});

// ---------------------------------------------------------------------------
// saveSt('sel') — no-op when ST.cur is null
// ---------------------------------------------------------------------------
describe("saveSt('sel') — no-op when ST.cur is null", function () {
  let win, store;
  beforeEach(function () {
    const w = mkWin();
    win   = w.win;
    store = w.store;
  });

  it('does not write iptv_sel when ST.cur is null', function () {
    win.IptvSt.saveSt('sel');
    expect(Object.prototype.hasOwnProperty.call(store, 'iptv_sel')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// saveSt('sel') — writes stream id when ST.cur is set
// ---------------------------------------------------------------------------
describe("saveSt('sel') — writes id when ST.cur is set", function () {
  let win, store;
  beforeEach(function () {
    const w = mkWin();
    win   = w.win;
    store = w.store;
    win.IptvSt.setCur({ id: '42', name: 'Sports Arena HD', url: '', img: '', cat: 'sports', num: 6 });
  });

  it('writes String(ST.cur.id) to iptv_sel', function () {
    win.IptvSt.saveSt('sel');
    expect(store['iptv_sel']).toBe('42');
  });
});
