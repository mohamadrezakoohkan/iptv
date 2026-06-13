// ADR: ADR-0028
// Unit tests — playback failure-log button + slide-in panel shell (TASK-0058):
// mkEL resolves the new EL entries (lbtn, lcnt, lpnl, lscr, lcls, lclr, llst)
// and wires their listeners; onLogBtn toggles is-open on #log-panel + #log-scrim
// and flips #log-btn aria-expanded; onLogClose and Escape close it; opening the
// log panel leaves the account panel untouched (independent toggles, ADR-0028).
//
// Per R-0001: the baseline markup ships aria-expanded="false" on #log-btn and
// aria-hidden="true" on #log-panel (index.html), so asserting those attributes
// toggle between "true"/"false" matches the source HTML — no attribute is
// asserted that the baseline does not declare.

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
// loadUi — execute client/ui.js with a synthetic window providing the log
// panel DOM elements (plus the account panel, since the shared keydown handler
// reads both). Baseline attrs mirror index.html exactly (R-0001).
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
    'log-count', 'log-scrim', 'log-close', 'log-clear', 'log-list',
  ];
  for (let i = 0; i < ids.length; i += 1) {
    elMap[ids[i]] = mkEl(ids[i]);
  }
  // baseline attributes exactly as shipped in index.html
  elMap['acct-btn']   = mkEl('acct-btn', { 'aria-expanded': 'false' });
  elMap['acct-panel'] = mkEl('acct-panel', { 'aria-hidden': 'true' });
  elMap['log-btn']    = mkEl('log-btn', { 'aria-expanded': 'false' });
  elMap['log-panel']  = mkEl('log-panel', { 'aria-hidden': 'true' });

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
// mkEL — resolves the new EL entries (verified via the wired listeners)
// ---------------------------------------------------------------------------
describe('mkEL() — log panel elements + listeners', function () {
  let el;
  beforeEach(function () { el = loadUi().el; });

  it('wires a click listener on #log-btn', function () {
    expect(typeof el['log-btn']._listeners.click).toBe('function');
  });

  it('wires a click listener on #log-close', function () {
    expect(typeof el['log-close']._listeners.click).toBe('function');
  });

  it('wires a click listener on #log-scrim', function () {
    expect(typeof el['log-scrim']._listeners.click).toBe('function');
  });

  it('wires a document keydown listener (shared Escape handler)', function () {
    const { doc } = loadUi();
    expect(typeof doc.keydown).toBe('function');
  });

  it('exposes setLog, onLogBtn and onLogClose on window.IptvUi', function () {
    const { ui } = loadUi();
    expect(typeof ui.setLog).toBe('function');
    expect(typeof ui.onLogBtn).toBe('function');
    expect(typeof ui.onLogClose).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// onLogBtn — toggles is-open + aria attributes
// ---------------------------------------------------------------------------
describe('onLogBtn() — open / toggle', function () {
  let ui, el;
  beforeEach(function () { const r = loadUi(); ui = r.ui; el = r.el; });

  it('adds is-open to #log-panel on open', function () {
    ui.onLogBtn();
    expect(el['log-panel'].classList.contains('is-open')).toBe(true);
  });

  it('adds is-open to #log-scrim on open', function () {
    ui.onLogBtn();
    expect(el['log-scrim'].classList.contains('is-open')).toBe(true);
  });

  it('flips #log-btn aria-expanded to "true" on open', function () {
    ui.onLogBtn();
    expect(el['log-btn'].getAttribute('aria-expanded')).toBe('true');
  });

  it('flips #log-panel aria-hidden to "false" on open', function () {
    ui.onLogBtn();
    expect(el['log-panel'].getAttribute('aria-hidden')).toBe('false');
  });

  it('a second click toggles the panel closed again', function () {
    ui.onLogBtn();
    ui.onLogBtn();
    expect(el['log-panel'].classList.contains('is-open')).toBe(false);
    expect(el['log-scrim'].classList.contains('is-open')).toBe(false);
    expect(el['log-btn'].getAttribute('aria-expanded')).toBe('false');
    expect(el['log-panel'].getAttribute('aria-hidden')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// onLogClose — closes an open panel and reverses all three signals
// ---------------------------------------------------------------------------
describe('onLogClose() — close', function () {
  let ui, el;
  beforeEach(function () { const r = loadUi(); ui = r.ui; el = r.el; ui.onLogBtn(); });

  it('removes is-open from panel and scrim', function () {
    ui.onLogClose();
    expect(el['log-panel'].classList.contains('is-open')).toBe(false);
    expect(el['log-scrim'].classList.contains('is-open')).toBe(false);
  });

  it('resets aria-expanded to "false" and aria-hidden to "true"', function () {
    ui.onLogClose();
    expect(el['log-btn'].getAttribute('aria-expanded')).toBe('false');
    expect(el['log-panel'].getAttribute('aria-hidden')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// Escape — the shared document keydown handler closes the log panel when open
// ---------------------------------------------------------------------------
describe('Escape (onAcctKey shared handler) — log panel', function () {
  let ui, el;
  beforeEach(function () { const r = loadUi(); ui = r.ui; el = r.el; });

  it('Escape closes the log panel when open', function () {
    ui.onLogBtn();
    ui.onAcctKey({ key: 'Escape' });
    expect(el['log-panel'].classList.contains('is-open')).toBe(false);
    expect(el['log-btn'].getAttribute('aria-expanded')).toBe('false');
    expect(el['log-panel'].getAttribute('aria-hidden')).toBe('true');
  });

  it('Escape is a no-op when the log panel is already closed', function () {
    ui.onAcctKey({ key: 'Escape' });
    expect(el['log-panel'].classList.contains('is-open')).toBe(false);
    expect(el['log-panel'].getAttribute('aria-hidden')).toBe('true');
  });

  it('a non-Escape key does not close an open log panel', function () {
    ui.onLogBtn();
    ui.onAcctKey({ key: 'Enter' });
    expect(el['log-panel'].classList.contains('is-open')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Independence — opening the log panel does not force the account panel closed,
// and vice versa (each is its own presentational toggle, ADR-0028).
// ---------------------------------------------------------------------------
describe('log + account panels are independent toggles', function () {
  let ui, el;
  beforeEach(function () { const r = loadUi(); ui = r.ui; el = r.el; });

  it('opening the log panel leaves an open account panel open', function () {
    ui.onAcctBtn();
    ui.onLogBtn();
    expect(el['acct-panel'].classList.contains('is-open')).toBe(true);
    expect(el['log-panel'].classList.contains('is-open')).toBe(true);
  });

  it('opening the account panel leaves an open log panel open', function () {
    ui.onLogBtn();
    ui.onAcctBtn();
    expect(el['log-panel'].classList.contains('is-open')).toBe(true);
    expect(el['acct-panel'].classList.contains('is-open')).toBe(true);
  });
});
