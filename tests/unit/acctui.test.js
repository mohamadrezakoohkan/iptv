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
