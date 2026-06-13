// ADR: ADR-0015
// Unit tests — community presets data layer (TASK-0031): S.psts curated list,
// the Pst typedef shape, and the pure getPst() helper. No DOM in this task
// (per R-0001, no DOM-attribute-mutation assertions here).

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
 * Mirrors acct.test.js so cfg.js + st.js execute exactly as in the browser.
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
  // eslint-disable-next-line no-new-func
  new Function('window', '"use strict";\n' + readFileSync(CFG_SRC, 'utf8'))(win);
  // eslint-disable-next-line no-new-func
  new Function('window', '"use strict";\n' + readFileSync(ST_SRC, 'utf8'))(win);
  return { win, store };
}

const EXPECTED = [
  { name: 'iptv-org · All',     url: 'https://iptv-org.github.io/iptv/index.m3u' },
  { name: 'iptv-org · English', url: 'https://iptv-org.github.io/iptv/languages/eng.m3u' },
  { name: 'iptv-org · News',    url: 'https://iptv-org.github.io/iptv/categories/news.m3u' },
  { name: 'iptv-org · Sports',  url: 'https://iptv-org.github.io/iptv/categories/sports.m3u' },
  { name: 'iptv-org · Music',   url: 'https://iptv-org.github.io/iptv/categories/music.m3u' },
];

// ---------------------------------------------------------------------------
// S.psts — curated list contents + immutability
// ---------------------------------------------------------------------------
describe('S.psts — community presets catalog', function () {
  let win;
  beforeEach(function () { win = mkWin().win; });

  it('is exactly the five expected { name, url } entries', function () {
    expect(win.S.psts).toEqual(EXPECTED);
  });

  it('every entry carries only name and url (no credentials)', function () {
    win.S.psts.forEach(function chk(p) {
      expect(Object.keys(p).sort()).toEqual(['name', 'url']);
      expect(typeof p.name).toBe('string');
      expect(p.name.length).toBeGreaterThan(0);
    });
  });

  it('every url is a non-empty https iptv-org M3U string', function () {
    win.S.psts.forEach(function chk(p) {
      expect(typeof p.url).toBe('string');
      expect(p.url.length).toBeGreaterThan(0);
      expect(p.url.startsWith('https://iptv-org.github.io/iptv/')).toBe(true);
    });
  });

  it('the psts array is frozen', function () {
    expect(Object.isFrozen(win.S.psts)).toBe(true);
  });

  it('each preset object is frozen', function () {
    win.S.psts.forEach(function chk(p) { expect(Object.isFrozen(p)).toBe(true); });
  });

  it('S itself remains frozen', function () {
    expect(Object.isFrozen(win.S)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getPst(pst) — pure connection-identity resolver
// ---------------------------------------------------------------------------
describe('getPst(pst)', function () {
  let win;
  beforeEach(function () { win = mkWin().win; });

  it('returns the M3U connection identity { url, user, pass, m3u, host }', function () {
    const pst = win.S.psts[0];
    expect(win.IptvSt.getPst(pst)).toEqual({
      url:  pst.url,
      user: '',
      pass: '',
      m3u:  true,
      host: pst.url,
    });
  });

  it('always connects on the M3U path with blank credentials', function () {
    win.S.psts.forEach(function chk(pst) {
      const id = win.IptvSt.getPst(pst);
      expect(id.m3u).toBe(true);
      expect(id.user).toBe('');
      expect(id.pass).toBe('');
      expect(id.host).toBe(pst.url);
    });
  });

  it('is pure — does not mutate its input', function () {
    const pst = { name: 'iptv-org · All', url: 'https://iptv-org.github.io/iptv/index.m3u' };
    const snap = JSON.stringify(pst);
    win.IptvSt.getPst(pst);
    expect(JSON.stringify(pst)).toBe(snap);
  });

  it('round-trips into a valid Acct via mkAcct (m3u playlist, host name)', function () {
    const pst  = win.S.psts[0];
    const acct = win.IptvSt.mkAcct(win.IptvSt.getPst(pst));
    expect(acct.url).toBe(pst.url);
    expect(acct.user).toBe('');
    expect(acct.pass).toBe('');
    expect(acct.m3u).toBe(true);
    expect(acct.name).toBe(pst.url);
    expect(typeof acct.id).toBe('string');
    expect(acct.id.length).toBeGreaterThan(0);
  });

  it('re-selecting the same preset dedupes by url+user+m3u (no duplicate)', function () {
    const pst = win.S.psts[0];
    const a   = win.IptvSt.mkAcct(win.IptvSt.getPst(pst));
    const b   = win.IptvSt.mkAcct(win.IptvSt.getPst(pst));
    const out = win.IptvSt.addAcct(win.IptvSt.addAcct([], a), b);
    expect(out.length).toBe(1);
  });
});
