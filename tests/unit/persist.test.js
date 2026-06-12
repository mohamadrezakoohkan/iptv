// ADR: ADR-0003, ADR-0008, ADR-0013
// Unit tests — loadSt() and saveSt() persistence helpers (TASK-0010)
// + persisted login mode in iptv_creds and reconnect flag (TASK-0019)
// The forward accounts store (loadAccts, ADR-0013) is covered in
// tests/unit/acct.test.js. loadSt() still carries the legacy sel + favs + creds
// reconnect path so the runtime keeps working until the connect/reconnect
// wiring moves to the accounts store (TASK-0029).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const CFG_SRC    = join(__dir, '../../client/cfg.js');
const ST_SRC     = join(__dir, '../../client/st.js');
const UI_SRC     = join(__dir, '../../client/ui.js');
const MAIN_SRC   = join(__dir, '../../client/main.js');

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
describe('loadSt() — sel + favs keys present and valid', function () {
  let win, store;
  beforeEach(function () {
    const w = mkWin();
    win   = w.win;
    store = w.store;
    store['iptv_sel']   = '7';
    store['iptv_favs']  = JSON.stringify(['1', '3', '5']);
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
// loadSt — legacy iptv_creds reconnect path (carried until TASK-0029)
// ---------------------------------------------------------------------------
describe('loadSt() — legacy iptv_creds reconnect path', function () {
  let win, store;
  beforeEach(function () {
    const w = mkWin();
    win   = w.win;
    store = w.store;
  });

  it('returns creds null when iptv_creds is absent', function () {
    expect(win.IptvSt.loadSt().creds).toBeNull();
  });

  it('returns the stored creds with explicit m3u untouched', function () {
    store['iptv_creds'] = JSON.stringify({ url: 'http://portal', user: 'a', pass: 'b', m3u: false });
    expect(win.IptvSt.loadSt().creds).toEqual({ url: 'http://portal', user: 'a', pass: 'b', m3u: false });
  });

  it('resolves a missing m3u flag via getM3u (credential-less → m3u true)', function () {
    store['iptv_creds'] = JSON.stringify({ url: 'http://example.com/list', user: '', pass: '' });
    expect(win.IptvSt.loadSt().creds.m3u).toBe(true);
  });

  it('returns creds null when iptv_creds is corrupt JSON (no throw)', function () {
    store['iptv_creds'] = '{bad json';
    let err = null;
    let res = null;
    try { res = win.IptvSt.loadSt(); } catch (e) { err = e; }
    expect(err).toBeNull();
    expect(res.creds).toBeNull();
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

// ---------------------------------------------------------------------------
// getM3u — legacy iptv_creds migration rule (TASK-0019, ADR-0008)
// ---------------------------------------------------------------------------
describe('getM3u() — legacy migration rule', function () {
  let win;
  beforeEach(function () {
    win = mkWin().win;
  });

  it('empty creds + http URL derives m3u true', function () {
    expect(win.IptvSt.getM3u({ url: 'http://example.com/list', user: '', pass: '' })).toBe(true);
  });

  it('non-empty user/pass derives m3u false', function () {
    expect(win.IptvSt.getM3u({ url: 'http://portal', user: 'alice', pass: 'secret' })).toBe(false);
  });

  it('"demo" url derives m3u false even with empty creds', function () {
    expect(win.IptvSt.getM3u({ url: 'demo', user: '', pass: '' })).toBe(false);
  });

  it('"demo" comparison is case-insensitive and trimmed', function () {
    expect(win.IptvSt.getM3u({ url: ' DEMO ', user: '', pass: '' })).toBe(false);
  });

  it('explicit m3u:true is returned untouched (no re-derivation)', function () {
    expect(win.IptvSt.getM3u({ url: 'http://portal', user: 'alice', pass: 'secret', m3u: true })).toBe(true);
  });

  it('explicit m3u:false is returned untouched (no re-derivation)', function () {
    expect(win.IptvSt.getM3u({ url: 'http://example.com/list', user: '', pass: '', m3u: false })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// onOk via ui.js — stored creds shape includes the chosen login mode
// (TASK-0019, ADR-0008)
// ---------------------------------------------------------------------------

/** Minimal element stub for the ui.js harness. */
function mkElStub(id) {
  return {
    _id:         id,
    style:       { display: '' },
    classList:   { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() },
    disabled:    false,
    checked:     false,
    textContent: '',
    value:       '',
    innerHTML:   '',
    addEventListener: vi.fn(),
    getAttribute:     vi.fn(),
  };
}

/**
 * Execute client/ui.js with a synthetic window, mode radios, and a mocked
 * localStorage. opts: { m3u: boolean } — pre-selects the login mode.
 * Returns { el, api, store }.
 */
function mkUiWin(opts) {
  const m3u   = Boolean(opts && opts.m3u);
  const store = {};
  const ls = {
    getItem:    function getItem(k)    { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem:    function setItem(k, v) { store[k] = String(v); },
    removeItem: function removeItem(k) { delete store[k]; },
  };
  const elMap = {};
  const ids = [
    'ch-list', 'player-video', 'search', 'now-info', 'player-err',
    'grp-nav', 'footer', 'player-card', 'player-idle', 'player-wrap',
    'f-url', 'f-user', 'f-pass', 'footer-conn', 'footer-login',
    'footer-hint', 'footer-err', 'btn-conn', 'btn-disc', 'conn-text',
    'login-form', 'login-mode', 'mode-xtream', 'mode-m3u',
  ];
  for (let i = 0; i < ids.length; i += 1) elMap[ids[i]] = mkElStub(ids[i]);
  elMap['mode-m3u'].checked    = m3u;
  elMap['mode-xtream'].checked = !m3u;
  const stObj = {
    phase: 'INIT', chs: [], cats: [], host: '', user: '', err: null,
    favs: [], cur: null, srch: '', flt: 'all', vol: 1.0, muted: false,
  };
  const win = {
    S: { credsKey: 'iptv_creds', selKey: 'iptv_sel', favsKey: 'iptv_favs' },
    IptvSt: {
      ST: stObj,
      go:      function go(nxt) { stObj.phase = nxt; },
      setErr:  function setErr(msg) { stObj.err = msg; },
      setChs:  function setChs(c, ct, h, u) { stObj.chs = c; stObj.cats = ct; stObj.host = h; stObj.user = u; },
      setCur:  function setCur(ch) { stObj.cur = ch; },
      setSrch: function setSrch(q) { stObj.srch = q; },
      setFlt:  function setFlt(f) { stObj.flt = f; },
      setFavs: function setFavs(a) { stObj.favs = a; },
    },
    IptvSrch: { getChs: function getChs() { return []; } },
    IptvApi:  { connect: vi.fn() },
    IptvPlay: null,
    document: {
      getElementById: function getEl(id) { return elMap[id] || null; },
      querySelector:  function qSel()    { return null; },
      body: { classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() } },
    },
  };
  const src = readFileSync(UI_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'localStorage', '"use strict";\n' + src)(win, win.document, ls);
  win.IptvUi.mkEL();
  return { el: elMap, api: win.IptvApi, store };
}

/** Fire the registered login-form submit handler and wait one tick. */
async function runSubmit(el) {
  const calls = el['login-form'].addEventListener.mock.calls;
  const entry = calls.find(function bySubmit(c) { return c[0] === 'submit'; });
  entry[1]({ preventDefault: vi.fn() });
  await new Promise(function nextTick(res) { setTimeout(res, 0); });
}

describe('onOk — stored creds carry the chosen login mode', function () {
  it('xtream mode connect stores { url, user, pass, m3u:false }', async function () {
    const { el, api, store } = mkUiWin({ m3u: false });
    api.connect.mockResolvedValue({ ok: true, val: { host: 'http://portal', user: 'alice', categories: [], channels: [] } });
    el['f-url'].value  = 'http://portal';
    el['f-user'].value = 'alice';
    el['f-pass'].value = 'secret';
    await runSubmit(el);
    expect(JSON.parse(store['iptv_creds'])).toEqual({ url: 'http://portal', user: 'alice', pass: 'secret', m3u: false });
  });

  it('m3u mode connect stores { url, user, pass, m3u:true }', async function () {
    const { el, api, store } = mkUiWin({ m3u: true });
    api.connect.mockResolvedValue({ ok: true, val: { host: 'example.com', user: '', categories: [], channels: [] } });
    el['f-url'].value = 'http://example.com/list.m3u8';
    await runSubmit(el);
    expect(JSON.parse(store['iptv_creds'])).toEqual({ url: 'http://example.com/list.m3u8', user: '', pass: '', m3u: true });
  });

  it('demo connect in default xtream mode stores m3u:false', async function () {
    const { el, api, store } = mkUiWin({ m3u: false });
    api.connect.mockResolvedValue({ ok: true, val: { host: 'demo', user: 'demo', categories: [], channels: [] } });
    el['f-url'].value = 'demo';
    await runSubmit(el);
    expect(JSON.parse(store['iptv_creds']).m3u).toBe(false);
  });

  it('failed connect writes nothing to iptv_creds', async function () {
    const { el, api, store } = mkUiWin({ m3u: true });
    api.connect.mockResolvedValue({ ok: false, err: 'nope' });
    el['f-url'].value = 'http://example.com/list.m3u8';
    await runSubmit(el);
    expect(Object.prototype.hasOwnProperty.call(store, 'iptv_creds')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// main.js auto-reconnect — passes the stored m3u flag to connect
// (TASK-0019, ADR-0008)
// ---------------------------------------------------------------------------

/**
 * Execute client/main.js with stubbed modules and a loadSt() returning the
 * given creds; fires DOMContentLoaded. Returns the connect mock.
 */
function runMain(creds) {
  const listeners = {};
  const doc = {
    addEventListener: function addEvt(t, fn) { listeners[t] = fn; },
    getElementById:   function getEl()       { return null; },
  };
  const connect = vi.fn(function fakeConn() { return new Promise(function never() {}); });
  const win = {
    IptvSt: {
      ST: { chs: [], cats: [], favs: [], srch: '', flt: 'all', cur: null, phase: 'INIT' },
      go: vi.fn(), onPhase: vi.fn(), setChs: vi.fn(), setErr: vi.fn(), setCur: vi.fn(),
      loadSt: function loadStFake() { return { creds, sel: null }; },
    },
    IptvUi:   { mkEL: vi.fn(), onPhase: vi.fn(), rndPhase: vi.fn(), rndFoot: vi.fn(), rndSide: vi.fn(), rndGrid: vi.fn() },
    IptvPlay: { mkPlay: vi.fn() },
    IptvApi:  { connect },
    IptvSrch: { getChs: function getChs() { return []; } },
  };
  const src = readFileSync(MAIN_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', '"use strict";\n' + src)(win, doc);
  listeners['DOMContentLoaded']();
  return connect;
}

describe('auto-reconnect — stored m3u flag reaches IptvApi.connect', function () {
  it('m3u:true creds reconnect with m3u:true', function () {
    const connect = runMain({ url: 'http://example.com/tv', user: '', pass: '', m3u: true });
    expect(connect).toHaveBeenCalledWith('http://example.com/tv', { user: '', pass: '', m3u: true });
  });

  it('m3u:false creds reconnect with m3u:false', function () {
    const connect = runMain({ url: 'http://portal', user: 'alice', pass: 'secret', m3u: false });
    expect(connect).toHaveBeenCalledWith('http://portal', { user: 'alice', pass: 'secret', m3u: false });
  });

  it('no stored creds means no reconnect call', function () {
    const connect = runMain(null);
    expect(connect).not.toHaveBeenCalled();
  });
});
