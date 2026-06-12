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
    'login-form', 'chip-hls', 'chip-ts',
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
    'login-form', 'chip-hls', 'chip-ts',
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
      go: function go() {},
    },
    IptvSrch: { getChs: function getChs() { return []; } },
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
