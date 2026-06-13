// ADR: ADR-0019
// Unit tests — sun/moon theme-toggle behaviour (TASK-0038): rndTheme(theme)
// sets/removes data-theme on <html> and updates the toggle's state class +
// ARIA; onTheme() flips dark↔light, applies via rndTheme, and persists via the
// TASK-0037 saveTheme writer. mkEL wires the click listener on #theme-toggle.
//
// Per Rule R-0001: the JSDOM-equivalent baseline mirrors index.html exactly —
// <html> ships with NO data-theme attribute (so rndTheme is asserted to ADD it
// for 'light' and REMOVE it for 'dark', never to restore an attribute that was
// never present), and #theme-toggle ships aria-checked="false". The stub
// document.documentElement tracks the attribute the same way the real <html>
// does, so the add/remove assertions hold against the true source baseline.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const UI_SRC     = join(__dir, '../../client/ui.js');

// ---------------------------------------------------------------------------
// mkClassList — minimal classList with real state tracking
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
    _listeners:   {},
    setAttribute: function setAttr(k, v) { a[k] = v; },
    getAttribute: function getAttr(k)    { return Object.prototype.hasOwnProperty.call(a, k) ? a[k] : null; },
    removeAttribute: function rmAttr(k)  { delete a[k]; },
    addEventListener: function addL(type, fn) { this._listeners[type] = fn; },
  };
}

// ---------------------------------------------------------------------------
// loadUi — execute client/ui.js with a synthetic window. The toggle baseline
// mirrors index.html exactly (R-0001): #theme-toggle ships aria-checked="false"
// and <html> ships with no data-theme attribute.
// ---------------------------------------------------------------------------
function loadUi() {
  const elMap = {};
  const ids = [
    'ch-list', 'ch-sort', 'player-video', 'search', 'now-info',
    'player-err', 'grp-nav', 'footer', 'player-card', 'player-idle',
    'player-wrap', 'f-url', 'f-user', 'f-pass', 'footer-conn', 'footer-login',
    'footer-hint', 'footer-err', 'btn-conn', 'btn-disc', 'conn-text',
    'login-mode', 'mode-xtream', 'mode-m3u', 'login-form', 'chip-hls', 'chip-ts',
    'acct-panel', 'acct-btn', 'acct-scrim', 'acct-close', 'acct-add',
    'acct-list', 'acct-conn', 'acct-psts',
  ];
  for (let i = 0; i < ids.length; i += 1) {
    elMap[ids[i]] = mkEl(ids[i]);
  }
  // baseline attributes exactly as shipped in index.html
  elMap['theme-toggle'] = mkEl('theme-toggle', { 'role': 'switch', 'aria-checked': 'false', 'aria-label': 'Toggle light theme' });

  // documentElement (<html>) stub — no data-theme in the baseline (R-0001)
  const root = mkEl('html');
  const saveTheme = vi.fn();
  const win = {
    IptvSt:   { ST: { phase: 'INIT' }, saveTheme },
    IptvSrch: { getChs: function getChs() { return []; } },
    IptvEmpty: { resolveContent: function resolveContent() { return { icon: 'list', title: 'No channels', body: '' }; } },
    S: {},
    IptvApi:  { connect: vi.fn() },
    IptvPlay: null,
    document: {
      documentElement: root,
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
  return { ui: win.IptvUi, el: elMap, root, saveTheme };
}

// ---------------------------------------------------------------------------
// Baseline (R-0001) — confirm the source markup before asserting mutations
// ---------------------------------------------------------------------------
describe('baseline markup (R-0001)', function () {
  it('<html> ships with no data-theme attribute', function () {
    const { root } = loadUi();
    expect(root.getAttribute('data-theme')).toBeNull();
  });

  it('#theme-toggle ships aria-checked="false"', function () {
    const { el } = loadUi();
    expect(el['theme-toggle'].getAttribute('aria-checked')).toBe('false');
  });
});

// ---------------------------------------------------------------------------
// mkEL — wires the click listener on #theme-toggle
// ---------------------------------------------------------------------------
describe('mkEL() — theme-toggle wiring', function () {
  it('wires a click listener on #theme-toggle', function () {
    const { el } = loadUi();
    expect(typeof el['theme-toggle']._listeners.click).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// rndTheme — applies a theme token to <html> + the toggle
// ---------------------------------------------------------------------------
describe('rndTheme(theme)', function () {
  let ui, el, root;
  beforeEach(function () { const r = loadUi(); ui = r.ui; el = r.el; root = r.root; });

  it('sets data-theme="light" on <html> for "light"', function () {
    ui.rndTheme('light');
    expect(root.getAttribute('data-theme')).toBe('light');
  });

  it('emphasises the sun (is-light + aria-checked="true") for "light"', function () {
    ui.rndTheme('light');
    expect(el['theme-toggle'].classList.contains('is-light')).toBe(true);
    expect(el['theme-toggle'].getAttribute('aria-checked')).toBe('true');
  });

  it('removes data-theme from <html> for "dark" (never restores an absent attr)', function () {
    ui.rndTheme('light');
    ui.rndTheme('dark');
    expect(root.getAttribute('data-theme')).toBeNull();
  });

  it('emphasises the moon (no is-light + aria-checked="false") for "dark"', function () {
    ui.rndTheme('light');
    ui.rndTheme('dark');
    expect(el['theme-toggle'].classList.contains('is-light')).toBe(false);
    expect(el['theme-toggle'].getAttribute('aria-checked')).toBe('false');
  });

  it('applying "dark" on the baseline leaves <html> with no data-theme', function () {
    ui.rndTheme('dark');
    expect(root.getAttribute('data-theme')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// onTheme — flips the theme, applies it, and persists the new token
// ---------------------------------------------------------------------------
describe('onTheme()', function () {
  let ui, el, root, saveTheme;
  beforeEach(function () { const r = loadUi(); ui = r.ui; el = r.el; root = r.root; saveTheme = r.saveTheme; });

  it('first click flips dark→light: sets data-theme="light"', function () {
    ui.onTheme();
    expect(root.getAttribute('data-theme')).toBe('light');
  });

  it('first click persists "light" via saveTheme', function () {
    ui.onTheme();
    expect(saveTheme).toHaveBeenCalledWith('light');
  });

  it('second click flips light→dark: removes data-theme and persists "dark"', function () {
    ui.onTheme();
    ui.onTheme();
    expect(root.getAttribute('data-theme')).toBeNull();
    expect(saveTheme).toHaveBeenLastCalledWith('dark');
  });

  it('the toggle state class follows each flip', function () {
    ui.onTheme();
    expect(el['theme-toggle'].classList.contains('is-light')).toBe(true);
    ui.onTheme();
    expect(el['theme-toggle'].classList.contains('is-light')).toBe(false);
  });
});
