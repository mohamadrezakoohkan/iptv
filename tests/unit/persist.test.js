// ADR: ADR-0003, ADR-0008, ADR-0013
// Unit tests — loadSt() and saveSt() persistence helpers (TASK-0010)
// + the accounts-store connect/reconnect wiring (TASK-0029, ADR-0013).
// loadSt() now owns only iptv_sel + iptv_favs; the credential reconnect path
// moved to the accounts store (loadAccts / iptv_accts + iptv_act). The store
// helpers themselves are covered in tests/unit/acct.test.js; here we assert
// the runtime wiring: a successful footer connect saves + activates an
// account, a failed connect leaves the store untouched, disconnect preserves
// the accounts, and main.js reconnects the active account on load.

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
// loadSt — no longer carries a credential reconnect path (TASK-0029): the
// legacy iptv_creds key is gone from S and loadSt returns only { sel }.
// ---------------------------------------------------------------------------
describe('loadSt() — credential path removed (accounts store owns reconnect)', function () {
  let win, store;
  beforeEach(function () {
    const w = mkWin();
    win   = w.win;
    store = w.store;
  });

  it('returns no creds property at all', function () {
    expect(win.IptvSt.loadSt()).not.toHaveProperty('creds');
  });

  it('S.credsKey is no longer declared', function () {
    expect(win.S.credsKey).toBeUndefined();
  });

  it('does not touch a stray iptv_creds value (migration is loadAccts only)', function () {
    store['iptv_creds'] = JSON.stringify({ url: 'http://portal', user: 'a', pass: 'b' });
    win.IptvSt.loadSt();
    expect(Object.prototype.hasOwnProperty.call(store, 'iptv_creds')).toBe(true);
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
// onOk via ui.js — a successful footer connect saves + activates an account
// (TASK-0029, ADR-0013). The harness loads the REAL cfg.js + st.js so the
// account-store helpers run against the mocked localStorage.
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
 * Execute client/{cfg,st,ui}.js with a synthetic window, mode radios, and a
 * mocked localStorage. opts: { m3u: boolean } — pre-selects the login mode.
 * Returns { el, api, store, win }.
 */
function mkUiWin(opts) {
  const m3u   = Boolean(opts && opts.m3u);
  const store = {};
  const ls = {
    getItem:    function getItem(k)    { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem:    function setItem(k, v) { store[k] = String(v); },
    removeItem: function removeItem(k) { delete store[k]; },
    clear:      function clear()       { Object.keys(store).forEach(function del(k) { delete store[k]; }); },
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
  const win = {
    localStorage: ls,
    IptvSrch: { getChs: function getChs() { return []; } },
    IptvApi:  { connect: vi.fn() },
    IptvPlay: null,
    document: {
      getElementById: function getEl(id) { return elMap[id] || null; },
      querySelector:  function qSel()    { return null; },
      body: { classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() } },
    },
  };
  const cfgSrc = readFileSync(CFG_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', '"use strict";\n' + cfgSrc)(win);
  const stSrc = readFileSync(ST_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', '"use strict";\n' + stSrc)(win);
  const src = readFileSync(UI_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'localStorage', '"use strict";\n' + src)(win, win.document, ls);
  win.IptvUi.mkEL();
  return { el: elMap, api: win.IptvApi, store, win };
}

/** Fire the registered login-form submit handler and wait one tick. */
async function runSubmit(el) {
  const calls = el['login-form'].addEventListener.mock.calls;
  const entry = calls.find(function bySubmit(c) { return c[0] === 'submit'; });
  entry[1]({ preventDefault: vi.fn() });
  await new Promise(function nextTick(res) { setTimeout(res, 0); });
}

describe('onOk — successful connect saves + activates an account', function () {
  it('xtream connect appends an account carrying { url, user, pass, m3u:false }', async function () {
    const { el, api, store } = mkUiWin({ m3u: false });
    api.connect.mockResolvedValue({ ok: true, val: { host: 'http://portal', user: 'alice', categories: [], channels: [] } });
    el['f-url'].value  = 'http://portal';
    el['f-user'].value = 'alice';
    el['f-pass'].value = 'secret';
    await runSubmit(el);
    const accts = JSON.parse(store['iptv_accts']);
    expect(accts.length).toBe(1);
    expect(accts[0]).toMatchObject({ url: 'http://portal', user: 'alice', pass: 'secret', m3u: false });
  });

  it('sets the saved account active in iptv_act', async function () {
    const { el, api, store } = mkUiWin({ m3u: false });
    api.connect.mockResolvedValue({ ok: true, val: { host: 'http://portal', user: 'alice', categories: [], channels: [] } });
    el['f-url'].value  = 'http://portal';
    el['f-user'].value = 'alice';
    el['f-pass'].value = 'secret';
    await runSubmit(el);
    const accts = JSON.parse(store['iptv_accts']);
    expect(store['iptv_act']).toBe(accts[0].id);
  });

  it('m3u connect saves an account with m3u:true', async function () {
    const { el, api, store } = mkUiWin({ m3u: true });
    api.connect.mockResolvedValue({ ok: true, val: { host: 'example.com', user: '', categories: [], channels: [] } });
    el['f-url'].value = 'http://example.com/list.m3u8';
    await runSubmit(el);
    const accts = JSON.parse(store['iptv_accts']);
    expect(accts[0]).toMatchObject({ url: 'http://example.com/list.m3u8', user: '', pass: '', m3u: true });
  });

  it('demo connect in default xtream mode saves m3u:false', async function () {
    const { el, api, store } = mkUiWin({ m3u: false });
    api.connect.mockResolvedValue({ ok: true, val: { host: 'demo', user: 'demo', categories: [], channels: [] } });
    el['f-url'].value = 'demo';
    await runSubmit(el);
    expect(JSON.parse(store['iptv_accts'])[0].m3u).toBe(false);
  });

  it('re-connecting the same identity dedupes (one account, not two)', async function () {
    const { el, api, store } = mkUiWin({ m3u: false });
    api.connect.mockResolvedValue({ ok: true, val: { host: 'http://portal', user: 'alice', categories: [], channels: [] } });
    el['f-url'].value  = 'http://portal';
    el['f-user'].value = 'alice';
    el['f-pass'].value = 'secret';
    await runSubmit(el);
    await runSubmit(el);
    expect(JSON.parse(store['iptv_accts']).length).toBe(1);
  });

  it('failed connect writes nothing to the accounts store', async function () {
    const { el, api, store } = mkUiWin({ m3u: true });
    api.connect.mockResolvedValue({ ok: false, err: 'nope' });
    el['f-url'].value = 'http://example.com/list.m3u8';
    await runSubmit(el);
    expect(Object.prototype.hasOwnProperty.call(store, 'iptv_accts')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(store, 'iptv_act')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(store, 'iptv_creds')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// onDisc — disconnect clears the active id but preserves the saved accounts,
// sel, and favs (TASK-0029, ADR-0013).
// ---------------------------------------------------------------------------
describe('onDisc — preserves accounts, clears active id', function () {
  /** Fire the registered btn-disc click handler. */
  function runDisc(el) {
    const calls = el['btn-disc'].addEventListener.mock.calls;
    const entry = calls.find(function byClick(c) { return c[0] === 'click'; });
    entry[1]();
  }

  it('removes iptv_act but keeps iptv_accts, iptv_sel, iptv_favs', async function () {
    const { el, api, store } = mkUiWin({ m3u: false });
    api.connect.mockResolvedValue({ ok: true, val: { host: 'http://portal', user: 'alice', categories: [], channels: [] } });
    el['f-url'].value  = 'http://portal';
    el['f-user'].value = 'alice';
    el['f-pass'].value = 'secret';
    await runSubmit(el);
    store['iptv_sel']  = '7';
    store['iptv_favs'] = JSON.stringify(['1', '2']);
    expect(Object.prototype.hasOwnProperty.call(store, 'iptv_act')).toBe(true);
    runDisc(el);
    expect(Object.prototype.hasOwnProperty.call(store, 'iptv_act')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(store, 'iptv_accts')).toBe(true);
    expect(store['iptv_sel']).toBe('7');
    expect(store['iptv_favs']).toBe(JSON.stringify(['1', '2']));
  });
});

// ---------------------------------------------------------------------------
// goSwitch / onAcctRm — account switch + remove wiring (TASK-0029, ADR-0013).
// ---------------------------------------------------------------------------
const SW_A = { id: '100', name: 'A', url: 'http://a', user: 'ua', pass: 'pa', m3u: false };
const SW_B = { id: '200', name: 'B', url: 'http://b', user: 'ub', pass: 'pb', m3u: false };

describe('goSwitch — replays a saved account', function () {
  it('reconnects the selected account replaying its m3u and sets it active', async function () {
    const { el, api, store, win } = mkUiWin({ m3u: false });
    void el;
    store['iptv_accts'] = JSON.stringify([SW_A, SW_B]);
    store['iptv_act']   = '100';
    api.connect.mockResolvedValue({ ok: true, val: { host: 'http://b', user: 'ub', categories: [], channels: [] } });
    win.IptvUi.goSwitch('200');
    await new Promise(function nextTick(res) { setTimeout(res, 0); });
    expect(api.connect).toHaveBeenCalledWith('http://b', { user: 'ub', pass: 'pb', m3u: false });
    expect(store['iptv_act']).toBe('200');
  });

  it('is a no-op for the already-active account (no connect call)', async function () {
    const { api, store, win } = mkUiWin({ m3u: false });
    store['iptv_accts'] = JSON.stringify([SW_A, SW_B]);
    store['iptv_act']   = '100';
    win.IptvUi.goSwitch('100');
    await new Promise(function nextTick(res) { setTimeout(res, 0); });
    expect(api.connect).not.toHaveBeenCalled();
    expect(store['iptv_act']).toBe('100');
  });

  it('failed switch leaves the active id untouched', async function () {
    const { api, store, win } = mkUiWin({ m3u: false });
    store['iptv_accts'] = JSON.stringify([SW_A, SW_B]);
    store['iptv_act']   = '100';
    api.connect.mockResolvedValue({ ok: false, err: 'boom' });
    win.IptvUi.goSwitch('200');
    await new Promise(function nextTick(res) { setTimeout(res, 0); });
    expect(store['iptv_act']).toBe('100');
  });
});

describe('onAcctRm — removes a saved account', function () {
  it('removing the active account clears the active id and the session', function () {
    const { store, win } = mkUiWin({ m3u: false });
    store['iptv_accts'] = JSON.stringify([SW_A, SW_B]);
    store['iptv_act']   = '100';
    win.IptvUi.onAcctRm('100');
    expect(JSON.parse(store['iptv_accts'])).toEqual([SW_B]);
    expect(Object.prototype.hasOwnProperty.call(store, 'iptv_act')).toBe(false);
  });

  it('removing a non-active account leaves the active id intact', function () {
    const { store, win } = mkUiWin({ m3u: false });
    store['iptv_accts'] = JSON.stringify([SW_A, SW_B]);
    store['iptv_act']   = '100';
    win.IptvUi.onAcctRm('200');
    expect(JSON.parse(store['iptv_accts'])).toEqual([SW_A]);
    expect(store['iptv_act']).toBe('100');
  });
});

// ---------------------------------------------------------------------------
// main.js auto-reconnect — reconnects the ACTIVE account on load, replaying
// its stored m3u flag (TASK-0029, ADR-0013/ADR-0008)
// ---------------------------------------------------------------------------

/**
 * Execute client/main.js with stubbed modules and a loadAccts()/getAct()
 * resolving the given active account; fires DOMContentLoaded. Returns the
 * connect mock. acct === null models "no accounts saved".
 */
function runMain(acct) {
  const listeners = {};
  const doc = {
    addEventListener: function addEvt(t, fn) { listeners[t] = fn; },
    getElementById:   function getEl()       { return null; },
  };
  const connect = vi.fn(function fakeConn() { return new Promise(function never() {}); });
  const accts = acct ? [acct] : [];
  const win = {
    IptvSt: {
      ST: { chs: [], cats: [], favs: [], srch: '', flt: 'all', cur: null, phase: 'INIT' },
      go: vi.fn(), onPhase: vi.fn(), setChs: vi.fn(), setErr: vi.fn(), setCur: vi.fn(),
      loadSt:    function loadStFake()  { return { sel: null }; },
      loadAccts: function loadAcctsFake() { return { accts, actId: acct ? acct.id : null }; },
      getAct:    function getActFake(list, id) { return list.find(function byId(a) { return a.id === id; }) || null; },
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

describe('auto-reconnect — active account replays through IptvApi.connect', function () {
  it('m3u:true account reconnects with m3u:true', function () {
    const connect = runMain({ id: '1', name: 'x', url: 'http://example.com/tv', user: '', pass: '', m3u: true });
    expect(connect).toHaveBeenCalledWith('http://example.com/tv', { user: '', pass: '', m3u: true });
  });

  it('m3u:false account reconnects with m3u:false', function () {
    const connect = runMain({ id: '2', name: 'y', url: 'http://portal', user: 'alice', pass: 'secret', m3u: false });
    expect(connect).toHaveBeenCalledWith('http://portal', { user: 'alice', pass: 'secret', m3u: false });
  });

  it('no active account means no reconnect call', function () {
    const connect = runMain(null);
    expect(connect).not.toHaveBeenCalled();
  });
});
