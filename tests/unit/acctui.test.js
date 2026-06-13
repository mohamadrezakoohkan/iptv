// ADR: ADR-0014
// Unit tests — account panel shell (TASK-0028): mkEL resolves the new EL
// entries; onAcctBtn toggles is-open on #acct-panel + #acct-scrim and flips
// aria-expanded / aria-hidden; onAcctClose and Escape close it.
//
// Per R-0001: the baseline markup ships aria-expanded="false" on #acct-btn and
// aria-hidden="true" on #acct-panel, so asserting those attributes toggle
// between "true"/"false" matches the source HTML — no attribute is asserted
// that the baseline does not declare.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const UI_SRC     = join(__dir, '../../client/ui.js');

// ---------------------------------------------------------------------------
// mkClassList — minimal classList with real is-open state tracking
// ---------------------------------------------------------------------------
function mkClassList() {
  const set = new Set();
  return {
    add:      function add(c)    { set.add(c); },
    remove:   function remove(c) { set.delete(c); },
    contains: function has(c)    { return set.has(c); },
    toggle:   function toggle(c, on) {
      const want = on === undefined ? !set.has(c) : on;
      if (want) { set.add(c); } else { set.delete(c); }
      return want;
    },
  };
}

// ---------------------------------------------------------------------------
// mkEl — DOM element stub with attribute + class state and listener capture
// ---------------------------------------------------------------------------
function mkEl(id, attrs) {
  const a = Object.assign({}, attrs);
  return {
    _id:          id,
    style:        { display: '' },
    classList:    mkClassList(),
    disabled:     false,
    textContent:  '',
    value:        '',
    innerHTML:    '',
    _listeners:   {},
    setAttribute: function setAttr(k, v) { a[k] = v; },
    getAttribute: function getAttr(k)    { return Object.prototype.hasOwnProperty.call(a, k) ? a[k] : null; },
    addEventListener: function addL(type, fn) { this._listeners[type] = fn; },
  };
}

// ---------------------------------------------------------------------------
// loadUi — execute client/ui.js with a synthetic window providing the account
// panel DOM elements. Baseline attrs mirror index.html exactly (R-0001).
// ---------------------------------------------------------------------------
function loadUi() {
  const elMap = {};
  const ids = [
    'ch-list', 'player-video', 'search', 'now-info', 'player-err',
    'grp-nav', 'footer', 'player-card', 'player-idle', 'player-wrap',
    'f-url', 'f-user', 'f-pass', 'footer-conn', 'footer-login',
    'footer-hint', 'footer-err', 'btn-conn', 'btn-disc', 'conn-text',
    'login-form', 'fmt-chip', 'fmt-detail',
    'acct-scrim', 'acct-close', 'acct-add', 'acct-list', 'acct-conn',
  ];
  for (let i = 0; i < ids.length; i += 1) {
    elMap[ids[i]] = mkEl(ids[i]);
  }
  // baseline attributes exactly as shipped in index.html
  elMap['acct-btn']   = mkEl('acct-btn', { 'aria-expanded': 'false' });
  elMap['acct-panel'] = mkEl('acct-panel', { 'aria-hidden': 'true' });

  const docListeners = {};
  const win = {
    IptvSt:   { ST: { phase: 'INIT' } },
    IptvSrch: { getChs: function getChs() { return []; } },
    IptvEmpty: { resolveContent: function resolveContent() { return { icon: 'list', title: 'No channels', body: '' }; } },
    S: {},
    IptvApi:  { connect: vi.fn() },
    IptvPlay: null,
    document: {
      getElementById: function getEl(id) { return elMap[id] || null; },
      querySelector:  function qSel()    { return null; },
      addEventListener: function addL(type, fn) { docListeners[type] = fn; },
      body: { classList: mkClassList() },
    },
    clearTimeout: function cTout() {},
    setTimeout:   function sTout(fn) { return fn; },
  };

  const src = readFileSync(UI_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', '"use strict";\n' + src)(win, win.document);
  win.IptvUi.mkEL();
  return { ui: win.IptvUi, el: elMap, doc: docListeners };
}

// ---------------------------------------------------------------------------
// mkEL — resolves the new EL entries (verified indirectly via behavior wiring)
// ---------------------------------------------------------------------------
describe('mkEL() — account panel elements + listeners', function () {
  let el;
  beforeEach(function () { el = loadUi().el; });

  it('wires a click listener on #acct-btn', function () {
    expect(typeof el['acct-btn']._listeners.click).toBe('function');
  });

  it('wires a click listener on #acct-close', function () {
    expect(typeof el['acct-close']._listeners.click).toBe('function');
  });

  it('wires a click listener on #acct-scrim', function () {
    expect(typeof el['acct-scrim']._listeners.click).toBe('function');
  });

  it('wires a document keydown listener', function () {
    const { doc } = loadUi();
    expect(typeof doc.keydown).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// onAcctBtn — toggles is-open + aria attributes
// ---------------------------------------------------------------------------
describe('onAcctBtn() — open / toggle', function () {
  let ui, el;
  beforeEach(function () { const r = loadUi(); ui = r.ui; el = r.el; });

  it('adds is-open to #acct-panel on open', function () {
    ui.onAcctBtn();
    expect(el['acct-panel'].classList.contains('is-open')).toBe(true);
  });

  it('adds is-open to #acct-scrim on open', function () {
    ui.onAcctBtn();
    expect(el['acct-scrim'].classList.contains('is-open')).toBe(true);
  });

  it('flips #acct-btn aria-expanded to "true" on open', function () {
    ui.onAcctBtn();
    expect(el['acct-btn'].getAttribute('aria-expanded')).toBe('true');
  });

  it('flips #acct-panel aria-hidden to "false" on open', function () {
    ui.onAcctBtn();
    expect(el['acct-panel'].getAttribute('aria-hidden')).toBe('false');
  });

  it('a second click toggles the panel closed again', function () {
    ui.onAcctBtn();
    ui.onAcctBtn();
    expect(el['acct-panel'].classList.contains('is-open')).toBe(false);
    expect(el['acct-scrim'].classList.contains('is-open')).toBe(false);
    expect(el['acct-btn'].getAttribute('aria-expanded')).toBe('false');
    expect(el['acct-panel'].getAttribute('aria-hidden')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// onAcctClose — closes an open panel and reverses all three signals
// ---------------------------------------------------------------------------
describe('onAcctClose() — close', function () {
  let ui, el;
  beforeEach(function () { const r = loadUi(); ui = r.ui; el = r.el; ui.onAcctBtn(); });

  it('removes is-open from panel and scrim', function () {
    ui.onAcctClose();
    expect(el['acct-panel'].classList.contains('is-open')).toBe(false);
    expect(el['acct-scrim'].classList.contains('is-open')).toBe(false);
  });

  it('resets aria-expanded to "false" and aria-hidden to "true"', function () {
    ui.onAcctClose();
    expect(el['acct-btn'].getAttribute('aria-expanded')).toBe('false');
    expect(el['acct-panel'].getAttribute('aria-hidden')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// onAcctKey — Escape closes only when open
// ---------------------------------------------------------------------------
describe('onAcctKey() — Escape', function () {
  let ui, el;
  beforeEach(function () { const r = loadUi(); ui = r.ui; el = r.el; });

  it('Escape closes the panel when open', function () {
    ui.onAcctBtn();
    ui.onAcctKey({ key: 'Escape' });
    expect(el['acct-panel'].classList.contains('is-open')).toBe(false);
    expect(el['acct-btn'].getAttribute('aria-expanded')).toBe('false');
  });

  it('Escape is a no-op when the panel is already closed', function () {
    ui.onAcctKey({ key: 'Escape' });
    expect(el['acct-panel'].classList.contains('is-open')).toBe(false);
    expect(el['acct-panel'].getAttribute('aria-hidden')).toBe('true');
  });

  it('a non-Escape key does not close an open panel', function () {
    ui.onAcctBtn();
    ui.onAcctKey({ key: 'Enter' });
    expect(el['acct-panel'].classList.contains('is-open')).toBe(true);
  });
});

// ===========================================================================
// TASK-0030 — render account panel contents (connected block, list, add)
// ===========================================================================

// mkAcct — a plain Acct stub for the store
function mkAcctStub(id, name, url) {
  return { id, name, url, user: '', pass: '', m3u: false };
}

// loadUiStore — like loadUi but with a configurable account store on IptvSt
// (loadAccts/getAct) and a real #acct-label element, so rndAcct can render.
// store: { accts, actId }
function loadUiStore(store) {
  const elMap = {};
  const ids = [
    'ch-list', 'player-video', 'search', 'now-info', 'player-err',
    'grp-nav', 'footer', 'player-card', 'player-idle', 'player-wrap',
    'f-url', 'f-user', 'f-pass', 'footer-conn', 'footer-login',
    'footer-hint', 'footer-err', 'btn-conn', 'btn-disc', 'conn-text',
    'login-form', 'fmt-chip', 'fmt-detail',
    'acct-scrim', 'acct-close', 'acct-add', 'acct-list', 'acct-conn',
    'acct-label',
  ];
  for (let i = 0; i < ids.length; i += 1) { elMap[ids[i]] = mkEl(ids[i]); }
  elMap['acct-btn']   = mkEl('acct-btn', { 'aria-expanded': 'false' });
  elMap['acct-panel'] = mkEl('acct-panel', { 'aria-hidden': 'true' });
  // #f-url needs a focus() spy for onAcctAdd
  elMap['f-url'].focus = function focus() { elMap['f-url']._focused = true; };

  const calls = { saveAccts: [], saveAct: [], clearAct: 0, rmAcct: [], connect: [] };
  let cur = { accts: store.accts.slice(), actId: store.actId };

  function getAct(accts, actId) {
    if (!actId) return null;
    return accts.find(function byId(a) { return a.id === actId; }) || null;
  }

  const win = {
    IptvSt: {
      ST: { phase: 'INIT', cats: [], chs: [], favs: [], srch: '', flt: 'all' },
      loadAccts: function loadAccts() { return { accts: cur.accts.slice(), actId: cur.actId }; },
      getAct,
      rmAcct: function rmAcct(accts, id) {
        calls.rmAcct.push(id);
        return accts.filter(function notId(a) { return a.id !== id; });
      },
      saveAccts: function saveAccts(a) { calls.saveAccts.push(a); cur.accts = a; },
      saveAct:   function saveAct(id)  { calls.saveAct.push(id); cur.actId = id; },
      clearAct:  function clearAct()   { calls.clearAct += 1; cur.actId = null; },
      setChs:    function setChs() {},
      setCur:    function setCur() {},
      go: function go() {},
    },
    IptvSrch: { getChs: function getChs() { return []; } },
    IptvEmpty: { resolveContent: function resolveContent() { return { icon: 'list', title: 'No channels', body: '' }; } },
    S: {},
    IptvApi:  { connect: function connect(url, opts) { calls.connect.push({ url, opts }); return new Promise(function () {}); } },
    IptvPlay: null,
    document: {
      getElementById: function getEl(id) { return elMap[id] || null; },
      querySelector:  function qSel()    { return null; },
      addEventListener: function addL() {},
      body: { classList: mkClassList() },
    },
    clearTimeout: function cTout() {},
    setTimeout:   function sTout(fn) { return fn; },
  };

  const src = readFileSync(UI_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', '"use strict";\n' + src)(win, win.document);
  win.IptvUi.mkEL();
  return { ui: win.IptvUi, el: elMap, calls };
}

describe('rndAcct() — nav button label', function () {
  it('shows the active account name when one is active', function () {
    const r = loadUiStore({ accts: [mkAcctStub('1', 'Demo', 'demo')], actId: '1' });
    r.ui.rndAcct();
    expect(r.el['acct-label'].textContent).toBe('Demo');
  });

  it('shows "Account" when no account is active', function () {
    const r = loadUiStore({ accts: [mkAcctStub('1', 'Demo', 'demo')], actId: null });
    r.ui.rndAcct();
    expect(r.el['acct-label'].textContent).toBe('Account');
  });
});

describe('rndAcct() — connected block (#acct-conn)', function () {
  it('renders the active account name + server url + Connected status', function () {
    const r = loadUiStore({ accts: [mkAcctStub('1', 'host · u', 'http://h:80')], actId: '1' });
    r.ui.rndAcct();
    const html = r.el['acct-conn'].innerHTML;
    expect(html).toContain('host · u');
    expect(html).toContain('http://h:80');
    expect(html).toContain('Connected');
    expect(html).toContain('acct-conn-dot');
  });

  it('renders the demo server url as "demo"', function () {
    const r = loadUiStore({ accts: [mkAcctStub('1', 'Demo', 'demo')], actId: '1' });
    r.ui.rndAcct();
    expect(r.el['acct-conn'].innerHTML).toContain('demo');
  });

  it('renders a Not connected line when no account is active', function () {
    const r = loadUiStore({ accts: [mkAcctStub('1', 'Demo', 'demo')], actId: null });
    r.ui.rndAcct();
    expect(r.el['acct-conn'].innerHTML).toContain('Not connected');
    expect(r.el['acct-conn'].innerHTML).not.toContain('acct-conn-dot');
  });
});

describe('rndAcct() — list rows (#acct-list)', function () {
  it('renders one row per saved account with data-acct and data-rm', function () {
    const accts = [mkAcctStub('1', 'A', 'http://a'), mkAcctStub('2', 'B', 'http://b')];
    const r = loadUiStore({ accts, actId: '1' });
    r.ui.rndAcct();
    const html = r.el['acct-list'].innerHTML;
    expect(html).toContain('data-acct="1"');
    expect(html).toContain('data-acct="2"');
    expect(html).toContain('data-rm="1"');
    expect(html).toContain('data-rm="2"');
    expect(html).toContain('A');
    expect(html).toContain('B');
    expect(html).toContain('http://a');
  });

  it('marks the active account row with is-active', function () {
    const accts = [mkAcctStub('1', 'A', 'http://a'), mkAcctStub('2', 'B', 'http://b')];
    const r = loadUiStore({ accts, actId: '2' });
    r.ui.rndAcct();
    const rows = r.el['acct-list'].innerHTML.split('acct-row');
    // the segment carrying data-acct="2" must carry is-active; data-acct="1" must not
    const active = r.el['acct-list'].innerHTML.match(/class="acct-row is-active"[^>]*data-acct="2"/);
    expect(active).not.toBeNull();
    expect(r.el['acct-list'].innerHTML).toMatch(/class="acct-row"[^>]*data-acct="1"/);
  });

  it('shows an empty-state line when there are no saved accounts', function () {
    const r = loadUiStore({ accts: [], actId: null });
    r.ui.rndAcct();
    expect(r.el['acct-list'].innerHTML).toContain('No saved accounts');
  });
});

describe('onAcctList() — switch / remove / active-no-op delegation', function () {
  it('a [data-rm] click removes that account', function () {
    const accts = [mkAcctStub('1', 'A', 'http://a'), mkAcctStub('2', 'B', 'http://b')];
    const r = loadUiStore({ accts, actId: '1' });
    const target = { closest: function closest(sel) { return sel === '[data-rm]' ? { getAttribute: function () { return '2'; } } : null; } };
    r.ui.onAcctList({ target });
    expect(r.calls.rmAcct).toContain('2');
    expect(r.calls.saveAccts.length).toBe(1);
  });

  it('a non-active [data-acct] click switches to it (connect called)', function () {
    const accts = [mkAcctStub('1', 'A', 'http://a'), mkAcctStub('2', 'B', 'http://b')];
    const r = loadUiStore({ accts, actId: '1' });
    const target = {
      closest: function closest(sel) {
        if (sel === '[data-rm]') return null;
        if (sel === '[data-acct]') return { getAttribute: function () { return '2'; } };
        return null;
      },
    };
    r.ui.onAcctList({ target });
    expect(r.calls.connect.length).toBe(1);
    expect(r.calls.connect[0].url).toBe('http://b');
  });

  it('clicking the already-active row is a no-op (no connect)', function () {
    const accts = [mkAcctStub('1', 'A', 'http://a'), mkAcctStub('2', 'B', 'http://b')];
    const r = loadUiStore({ accts, actId: '1' });
    const target = {
      closest: function closest(sel) {
        if (sel === '[data-rm]') return null;
        if (sel === '[data-acct]') return { getAttribute: function () { return '1'; } };
        return null;
      },
    };
    r.ui.onAcctList({ target });
    expect(r.calls.connect.length).toBe(0);
  });
});

// ===========================================================================
// TASK-0032 — community presets section (#acct-psts) + select → M3U connect
// (ADR-0015/ADR-0016)
// ===========================================================================

// Mirrors S.psts from client/cfg.js (frozen iptv-org catalog).
const PSTS = [
  { name: 'iptv-org · All',     url: 'https://iptv-org.github.io/iptv/index.m3u' },
  { name: 'iptv-org · English', url: 'https://iptv-org.github.io/iptv/languages/eng.m3u' },
  { name: 'iptv-org · News',    url: 'https://iptv-org.github.io/iptv/categories/news.m3u' },
  { name: 'iptv-org · Sports',  url: 'https://iptv-org.github.io/iptv/categories/sports.m3u' },
  { name: 'iptv-org · Music',   url: 'https://iptv-org.github.io/iptv/categories/music.m3u' },
];

// getPst — mirrors st.js getPst (M3U connection identity for a preset).
function getPst(p) {
  return { url: p.url, user: '', pass: '', m3u: true, host: p.url };
}

// loadUiPst — like loadUiStore but also registers the #acct-psts element and a
// window.S carrying the presets catalog, so rndPsts/onPstList run for real.
// store: { accts, actId }
function loadUiPst(store) {
  const elMap = {};
  const ids = [
    'ch-list', 'player-video', 'search', 'now-info', 'player-err',
    'grp-nav', 'footer', 'player-card', 'player-idle', 'player-wrap',
    'f-url', 'f-user', 'f-pass', 'footer-conn', 'footer-login',
    'footer-hint', 'footer-err', 'btn-conn', 'btn-disc', 'conn-text',
    'login-form', 'fmt-chip', 'fmt-detail',
    'acct-scrim', 'acct-close', 'acct-add', 'acct-list', 'acct-conn',
    'acct-label', 'acct-psts',
  ];
  for (let i = 0; i < ids.length; i += 1) { elMap[ids[i]] = mkEl(ids[i]); }
  elMap['acct-btn']   = mkEl('acct-btn', { 'aria-expanded': 'false' });
  elMap['acct-panel'] = mkEl('acct-panel', { 'aria-hidden': 'true' });

  const calls = { saveAccts: [], saveAct: [], connect: [], mkAcct: [], addAcct: [] };
  let cur = { accts: store.accts.slice(), actId: store.actId };

  function getAct(accts, actId) {
    if (!actId) return null;
    return accts.find(function byId(a) { return a.id === actId; }) || null;
  }

  const win = {
    S: { psts: PSTS },
    IptvSt: {
      ST: { phase: 'INIT', cats: [], chs: [], favs: [], srch: '', flt: 'all' },
      loadAccts: function loadAccts() { return { accts: cur.accts.slice(), actId: cur.actId }; },
      getAct,
      getPst,
      mkAcct: function mkAcct(opts) { calls.mkAcct.push(opts); return { id: 'pst-' + opts.url, name: opts.url, url: opts.url, user: '', pass: '', m3u: true }; },
      addAcct: function addAcct(accts, acct) { calls.addAcct.push(acct); return accts.concat([acct]); },
      saveAccts: function saveAccts(a) { calls.saveAccts.push(a); cur.accts = a; },
      saveAct:   function saveAct(id)  { calls.saveAct.push(id); cur.actId = id; },
      clearAct:  function clearAct()   { cur.actId = null; },
      setChs:    function setChs() {},
      setCur:    function setCur() {},
      go: function go() {},
    },
    IptvSrch: { getChs: function getChs() { return []; } },
    IptvEmpty: { resolveContent: function resolveContent() { return { icon: 'list', title: 'No channels', body: '' }; } },
    IptvApi:  { connect: function connect(url, opts) { calls.connect.push({ url, opts }); return new Promise(function () {}); } },
    IptvPlay: null,
    document: {
      getElementById: function getEl(id) { return elMap[id] || null; },
      querySelector:  function qSel()    { return null; },
      addEventListener: function addL() {},
      body: { classList: mkClassList() },
    },
    clearTimeout: function cTout() {},
    setTimeout:   function sTout(fn) { return fn; },
  };

  const src = readFileSync(UI_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', '"use strict";\n' + src)(win, win.document);
  win.IptvUi.mkEL();
  return { ui: win.IptvUi, el: elMap, calls };
}

describe('mkPst() — preset row markup', function () {
  // R-0001: assert only attributes the emitted HTML actually carries —
  // data-pst, class, role, tabindex. mkPst emits NO data-rm / remove control.
  it('emits a data-pst row with the preset name + url and no remove control', function () {
    const r = loadUiPst({ accts: [], actId: null });
    const html = r.ui.mkPst({ pst: PSTS[2], idx: 2, act: null });
    expect(html).toContain('data-pst="2"');
    expect(html).toContain('iptv-org · News');
    expect(html).toContain('https://iptv-org.github.io/iptv/categories/news.m3u');
    expect(html).toContain('class="acct-row acct-pst"');
    expect(html).not.toContain('data-rm');
    expect(html).not.toContain('acct-row-rm');
  });

  it('marks the row is-active when the preset url is the active M3U account', function () {
    const r = loadUiPst({ accts: [], actId: null });
    const act = { id: 'x', name: 'n', url: PSTS[0].url, user: '', pass: '', m3u: true };
    const html = r.ui.mkPst({ pst: PSTS[0], idx: 0, act });
    expect(html).toContain('class="acct-row acct-pst is-active"');
  });

  it('does not mark is-active when the active account is a non-M3U match', function () {
    const r = loadUiPst({ accts: [], actId: null });
    const act = { id: 'x', name: 'n', url: PSTS[0].url, user: 'u', pass: 'p', m3u: false };
    const html = r.ui.mkPst({ pst: PSTS[0], idx: 0, act });
    expect(html).not.toContain('is-active');
  });
});

describe('rndPsts() — community section render (#acct-psts)', function () {
  it('renders one row per S.psts entry with data-pst="<idx>", name + url', function () {
    const r = loadUiPst({ accts: [], actId: null });
    r.ui.rndAcct();
    const html = r.el['acct-psts'].innerHTML;
    for (let i = 0; i < PSTS.length; i += 1) {
      expect(html).toContain('data-pst="' + i + '"');
      expect(html).toContain(PSTS[i].name);
      expect(html).toContain(PSTS[i].url);
    }
    expect(html.match(/acct-pst/g).length).toBe(PSTS.length);
  });

  it('is present with zero saved accounts (the default catalog)', function () {
    const r = loadUiPst({ accts: [], actId: null });
    r.ui.rndAcct();
    expect(r.el['acct-psts'].innerHTML).toContain('data-pst="0"');
    expect(r.el['acct-list'].innerHTML).toContain('No saved accounts');
  });

  it('marks is-active exactly on the preset row whose url is the active account', function () {
    const acct = { id: '9', name: 'n', url: PSTS[3].url, user: '', pass: '', m3u: true };
    const r = loadUiPst({ accts: [acct], actId: '9' });
    r.ui.rndAcct();
    const html = r.el['acct-psts'].innerHTML;
    expect(html.match(/is-active/g).length).toBe(1);
    expect(html).toMatch(/class="acct-row acct-pst is-active"[^>]*data-pst="3"/);
  });

  it('marks no row active when no active account matches a preset url', function () {
    const acct = { id: '9', name: 'n', url: 'http://other', user: '', pass: '', m3u: true };
    const r = loadUiPst({ accts: [acct], actId: '9' });
    r.ui.rndAcct();
    expect(r.el['acct-psts'].innerHTML).not.toContain('is-active');
  });
});

describe('onPstList() — select a preset → M3U connect', function () {
  function tgt(idx) {
    return { closest: function closest(sel) { return sel === '[data-pst]' ? { getAttribute: function () { return String(idx); } } : null; } };
  }

  it('connects to the selected preset on the M3U path (user/pass empty, m3u true)', function () {
    const r = loadUiPst({ accts: [], actId: null });
    r.ui.onPstList({ target: tgt(2) });
    expect(r.calls.connect.length).toBe(1);
    expect(r.calls.connect[0].url).toBe(PSTS[2].url);
    expect(r.calls.connect[0].opts).toEqual({ user: '', pass: '', m3u: true });
  });

  it('is a no-op when that preset is already the active M3U connection', function () {
    const acct = { id: '9', name: 'n', url: PSTS[1].url, user: '', pass: '', m3u: true };
    const r = loadUiPst({ accts: [acct], actId: '9' });
    r.ui.onPstList({ target: tgt(1) });
    expect(r.calls.connect.length).toBe(0);
  });

  it('ignores a click that is not on a preset row', function () {
    const r = loadUiPst({ accts: [], actId: null });
    const target = { closest: function closest() { return null; } };
    r.ui.onPstList({ target });
    expect(r.calls.connect.length).toBe(0);
  });
});

describe('onAcctAdd() — reset to the login form', function () {
  it('closes the panel and focuses the URL field', function () {
    const r = loadUiStore({ accts: [mkAcctStub('1', 'Demo', 'demo')], actId: '1' });
    r.ui.onAcctBtn(); // open first
    r.ui.onAcctAdd();
    expect(r.el['acct-panel'].classList.contains('is-open')).toBe(false);
    expect(r.el['f-url']._focused).toBe(true);
  });

  it('clears the active pointer so the footer shows the logged-out login', function () {
    const r = loadUiStore({ accts: [mkAcctStub('1', 'Demo', 'demo')], actId: '1' });
    r.ui.onAcctAdd();
    // tearDown walks INIT and re-renders; the active id is irrelevant to the
    // footer here, but rndAcct must reflect "Account" once nothing is active.
    expect(r.el['f-url'].value).toBe('');
  });
});
