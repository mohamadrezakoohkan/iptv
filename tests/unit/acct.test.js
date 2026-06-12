// ADR: ADR-0013
// Unit tests — account store (TASK-0027): loadAccts / getAct / addAcct /
// rmAcct / mkAcct / saveAccts / saveAct + one-time legacy iptv_creds migration.
// No DOM in this task (per R-0001, no DOM-attribute-mutation assertions here).

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
 * Returns { win, store } where store is a plain object backing localStorage.
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

const ACCT_A = { id: '100', name: 'http://portal · alice', url: 'http://portal', user: 'alice', pass: 'secret', m3u: false };
const ACCT_B = { id: '200', name: 'example.com', url: 'http://example.com/list', user: '', pass: '', m3u: true };

// ---------------------------------------------------------------------------
// loadAccts — empty store
// ---------------------------------------------------------------------------
describe('loadAccts() — empty store', function () {
  let win;
  beforeEach(function () { win = mkWin().win; });

  it('returns empty accts and null actId', function () {
    expect(win.IptvSt.loadAccts()).toEqual({ accts: [], actId: null });
  });
});

// ---------------------------------------------------------------------------
// loadAccts — populated store
// ---------------------------------------------------------------------------
describe('loadAccts() — populated store', function () {
  let win, store;
  beforeEach(function () {
    const w = mkWin();
    win   = w.win;
    store = w.store;
    store['iptv_accts'] = JSON.stringify([ACCT_A, ACCT_B]);
    store['iptv_act']   = '200';
  });

  it('returns the stored accounts list', function () {
    expect(win.IptvSt.loadAccts().accts).toEqual([ACCT_A, ACCT_B]);
  });

  it('returns the stored active id', function () {
    expect(win.IptvSt.loadAccts().actId).toBe('200');
  });

  it('does not migrate when accounts already exist', function () {
    store['iptv_creds'] = JSON.stringify({ url: 'http://portal', user: 'x', pass: 'y' });
    win.IptvSt.loadAccts();
    expect(Object.prototype.hasOwnProperty.call(store, 'iptv_creds')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// loadAccts — corrupt JSON treated as absent
// ---------------------------------------------------------------------------
describe('loadAccts() — corrupt JSON dropped', function () {
  let win, store;
  beforeEach(function () {
    const w = mkWin();
    win   = w.win;
    store = w.store;
  });

  it('corrupt iptv_accts is treated as empty (no throw)', function () {
    store['iptv_accts'] = '[not json';
    let err = null;
    let res = null;
    try { res = win.IptvSt.loadAccts(); } catch (e) { err = e; }
    expect(err).toBeNull();
    expect(res).toEqual({ accts: [], actId: null });
  });

  it('non-array iptv_accts value is treated as empty', function () {
    store['iptv_accts'] = JSON.stringify({ not: 'an array' });
    expect(win.IptvSt.loadAccts().accts).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getAct
// ---------------------------------------------------------------------------
describe('getAct(accts, actId)', function () {
  let win;
  beforeEach(function () { win = mkWin().win; });

  it('returns the matching account', function () {
    expect(win.IptvSt.getAct([ACCT_A, ACCT_B], '200')).toEqual(ACCT_B);
  });

  it('returns null when no account matches the id', function () {
    expect(win.IptvSt.getAct([ACCT_A, ACCT_B], '999')).toBeNull();
  });

  it('returns null when actId is null', function () {
    expect(win.IptvSt.getAct([ACCT_A, ACCT_B], null)).toBeNull();
  });

  it('returns null for an empty accounts list', function () {
    expect(win.IptvSt.getAct([], '100')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// addAcct — append vs same-identity replace (dedupe)
// ---------------------------------------------------------------------------
describe('addAcct(accts, acct)', function () {
  let win;
  beforeEach(function () { win = mkWin().win; });

  it('appends a new (different-identity) account', function () {
    const out = win.IptvSt.addAcct([ACCT_A], ACCT_B);
    expect(out).toEqual([ACCT_A, ACCT_B]);
  });

  it('replaces an existing same-identity account (no duplicate)', function () {
    const upd = { id: '999', name: 'renamed', url: ACCT_A.url, user: ACCT_A.user, pass: 'changed', m3u: ACCT_A.m3u };
    const out = win.IptvSt.addAcct([ACCT_A, ACCT_B], upd);
    expect(out).toEqual([upd, ACCT_B]);
  });

  it('treats a differing m3u mode as a different identity', function () {
    const other = { id: '300', name: 'x', url: ACCT_A.url, user: ACCT_A.user, pass: ACCT_A.pass, m3u: true };
    const out = win.IptvSt.addAcct([ACCT_A], other);
    expect(out).toEqual([ACCT_A, other]);
  });

  it('does not mutate the input array', function () {
    const input = [ACCT_A];
    win.IptvSt.addAcct(input, ACCT_B);
    expect(input).toEqual([ACCT_A]);
  });
});

// ---------------------------------------------------------------------------
// rmAcct
// ---------------------------------------------------------------------------
describe('rmAcct(accts, id)', function () {
  let win;
  beforeEach(function () { win = mkWin().win; });

  it('returns a new array without the given id', function () {
    expect(win.IptvSt.rmAcct([ACCT_A, ACCT_B], '100')).toEqual([ACCT_B]);
  });

  it('is a no-op for an unknown id', function () {
    expect(win.IptvSt.rmAcct([ACCT_A, ACCT_B], '999')).toEqual([ACCT_A, ACCT_B]);
  });

  it('does not mutate the input array', function () {
    const input = [ACCT_A, ACCT_B];
    win.IptvSt.rmAcct(input, '100');
    expect(input).toEqual([ACCT_A, ACCT_B]);
  });
});

// ---------------------------------------------------------------------------
// mkAcct — name derivation + id minting
// ---------------------------------------------------------------------------
describe('mkAcct(opts) — name derivation and id minting', function () {
  let win;
  beforeEach(function () { win = mkWin().win; });

  it('derives Xtream name as "host · user"', function () {
    const acct = win.IptvSt.mkAcct({ url: 'http://portal', host: 'http://portal', user: 'alice', pass: 'secret' });
    expect(acct.name).toBe('http://portal · alice');
  });

  it('falls back to url for the host when host is absent', function () {
    const acct = win.IptvSt.mkAcct({ url: 'http://portal', user: 'bob', pass: 'p' });
    expect(acct.name).toBe('http://portal · bob');
  });

  it('derives playlist name as the host (no user)', function () {
    const acct = win.IptvSt.mkAcct({ url: 'http://example.com/list', host: 'example.com', user: '', pass: '', m3u: true });
    expect(acct.name).toBe('example.com');
  });

  it('derives "Demo" for the demo url', function () {
    const acct = win.IptvSt.mkAcct({ url: 'demo', user: 'demo', pass: '' });
    expect(acct.name).toBe('Demo');
  });

  it('mints a string id when none is provided', function () {
    const acct = win.IptvSt.mkAcct({ url: 'http://portal', user: 'a', pass: 'b' });
    expect(typeof acct.id).toBe('string');
    expect(acct.id.length).toBeGreaterThan(0);
  });

  it('keeps an explicit id untouched', function () {
    const acct = win.IptvSt.mkAcct({ id: '42', url: 'http://portal', user: 'a', pass: 'b' });
    expect(acct.id).toBe('42');
  });

  it('carries the resolved m3u mode (explicit flag respected)', function () {
    const acct = win.IptvSt.mkAcct({ url: 'http://x/list', user: '', pass: '', m3u: true });
    expect(acct.m3u).toBe(true);
  });

  it('derives m3u via the legacy rule when the flag is absent', function () {
    const acct = win.IptvSt.mkAcct({ url: 'http://x/list', user: '', pass: '' });
    expect(acct.m3u).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// saveAccts / saveAct
// ---------------------------------------------------------------------------
describe('saveAccts() / saveAct()', function () {
  let win, store;
  beforeEach(function () {
    const w = mkWin();
    win   = w.win;
    store = w.store;
  });

  it('saveAccts writes JSON to iptv_accts', function () {
    win.IptvSt.saveAccts([ACCT_A, ACCT_B]);
    expect(JSON.parse(store['iptv_accts'])).toEqual([ACCT_A, ACCT_B]);
  });

  it('saveAct writes the id string to iptv_act', function () {
    win.IptvSt.saveAct('200');
    expect(store['iptv_act']).toBe('200');
  });
});

// ---------------------------------------------------------------------------
// Legacy migration — one-time, read-time, via loadAccts()
// ---------------------------------------------------------------------------
describe('loadAccts() — legacy iptv_creds migration', function () {
  let win, store;
  beforeEach(function () {
    const w = mkWin();
    win   = w.win;
    store = w.store;
  });

  it('migrates a credentialled legacy record (m3u:false, no m3u flag)', function () {
    store['iptv_creds'] = JSON.stringify({ url: 'http://portal', user: 'alice', pass: 'secret' });
    const res = win.IptvSt.loadAccts();
    expect(res.accts.length).toBe(1);
    expect(res.accts[0].url).toBe('http://portal');
    expect(res.accts[0].user).toBe('alice');
    expect(res.accts[0].pass).toBe('secret');
    expect(res.accts[0].m3u).toBe(false);
    expect(res.actId).toBe(res.accts[0].id);
  });

  it('migrates a credential-less legacy record to m3u:true', function () {
    store['iptv_creds'] = JSON.stringify({ url: 'http://example.com/list', user: '', pass: '' });
    const res = win.IptvSt.loadAccts();
    expect(res.accts[0].m3u).toBe(true);
  });

  it('honours an explicit m3u flag on the legacy record', function () {
    store['iptv_creds'] = JSON.stringify({ url: 'http://example.com/tv', user: 'u', pass: 'p', m3u: true });
    const res = win.IptvSt.loadAccts();
    expect(res.accts[0].m3u).toBe(true);
  });

  it('migrates the legacy demo record (m3u:false, name "Demo")', function () {
    store['iptv_creds'] = JSON.stringify({ url: 'demo', user: 'demo', pass: '' });
    const res = win.IptvSt.loadAccts();
    expect(res.accts[0].m3u).toBe(false);
    expect(res.accts[0].name).toBe('Demo');
  });

  it('writes the new keys (iptv_accts + iptv_act) on migration', function () {
    store['iptv_creds'] = JSON.stringify({ url: 'http://portal', user: 'alice', pass: 'secret' });
    win.IptvSt.loadAccts();
    expect(Object.prototype.hasOwnProperty.call(store, 'iptv_accts')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(store, 'iptv_act')).toBe(true);
    expect(JSON.parse(store['iptv_accts']).length).toBe(1);
  });

  it('removes iptv_creds after migration', function () {
    store['iptv_creds'] = JSON.stringify({ url: 'http://portal', user: 'alice', pass: 'secret' });
    win.IptvSt.loadAccts();
    expect(Object.prototype.hasOwnProperty.call(store, 'iptv_creds')).toBe(false);
  });

  it('does nothing when iptv_creds is corrupt JSON (returns empty store)', function () {
    store['iptv_creds'] = '{bad json';
    const res = win.IptvSt.loadAccts();
    expect(res).toEqual({ accts: [], actId: null });
    expect(Object.prototype.hasOwnProperty.call(store, 'iptv_accts')).toBe(false);
  });
});
