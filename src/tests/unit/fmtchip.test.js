// ADR: ADR-0025
// Unit tests — contextual format chip (TASK-0052): IptvUi.rndChip surfaces a
// single chip labelled for the resolved engine ('hls' -> HLS, 'ts' -> TS),
// hides it (and collapses its detail) for an empty/unknown engine, and
// onFmtChip toggles the inline detail + aria-expanded without touching
// IptvSt.ST.phase or the running engine.
//
// Per R-0001: the baseline #fmt-chip in index.html ships aria-expanded="false"
// and the `hidden` attribute, so the toggles asserted here (aria-expanded
// true/false, hidden true/false) match attributes actually present in source —
// no restoration of an attribute the markup never declared is asserted.

import { describe, it, expect, beforeEach } from 'vitest';
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
// mkEl — element stub mirroring the chip's baseline attrs (aria-expanded,
// hidden) plus dataset + textContent + classList state.
// ---------------------------------------------------------------------------
function mkEl(attrs) {
  const a = Object.assign({}, attrs);
  return {
    style:        { display: '' },
    classList:    mkClassList(),
    dataset:      {},
    hidden:       Object.prototype.hasOwnProperty.call(a, 'hidden'),
    textContent:  '',
    innerHTML:    '',
    _listeners:   {},
    setAttribute: function setAttr(k, v) { a[k] = v; },
    getAttribute: function getAttr(k)    { return Object.prototype.hasOwnProperty.call(a, k) ? a[k] : null; },
    addEventListener: function addL(type, fn) { this._listeners[type] = fn; },
  };
}

// ---------------------------------------------------------------------------
// loadUi — execute client/ui.js with a synthetic window exposing #fmt-chip and
// #fmt-detail with their baseline attributes (R-0001).
// ---------------------------------------------------------------------------
function loadUi() {
  const elMap = {};
  const base = [
    'ch-list', 'player-video', 'search', 'now-info', 'player-err',
    'grp-nav', 'footer', 'player-card', 'player-idle', 'player-wrap',
    'f-url', 'f-user', 'f-pass', 'footer-conn', 'footer-login',
    'footer-hint', 'footer-err', 'btn-conn', 'btn-disc', 'conn-text',
    'login-form', 'acct-scrim', 'acct-close', 'acct-add', 'acct-list',
    'acct-conn', 'login-mode', 'mode-xtream', 'mode-m3u', 'theme-toggle',
    'acct-psts', 'ch-sort',
  ];
  for (let i = 0; i < base.length; i += 1) elMap[base[i]] = mkEl();
  elMap['acct-btn']   = mkEl({ 'aria-expanded': 'false' });
  elMap['acct-panel'] = mkEl({ 'aria-hidden': 'true' });
  // baseline #fmt-chip ships aria-expanded="false" and the hidden attribute
  elMap['fmt-chip']   = mkEl({ 'aria-expanded': 'false', hidden: '' });
  elMap['fmt-detail'] = mkEl({ hidden: '' });

  const docListeners = {};
  const win = {
    IptvSt:   { ST: { phase: 'INIT' } },
    IptvSrch: { getChs: function getChs() { return []; } },
    IptvEmpty: { resolveContent: function resolveContent() { return { icon: 'list', title: '', body: '' }; } },
    S: {},
    IptvApi:  {},
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
  return { ui: win.IptvUi, el: elMap, win };
}

// ---------------------------------------------------------------------------
// mkEL — wires a click listener on the chip
// ---------------------------------------------------------------------------
describe('mkEL() — contextual format chip', function () {
  it('wires a click listener on #fmt-chip', function () {
    const { el } = loadUi();
    expect(typeof el['fmt-chip']._listeners.click).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// rndChip — resolution → label + visibility
// ---------------------------------------------------------------------------
describe('rndChip() — engine resolution surfaces the chip', function () {
  let ctx;
  beforeEach(function () { ctx = loadUi(); });

  it("'hls' shows the chip labelled HLS and marks it active", function () {
    ctx.ui.rndChip('hls');
    const c = ctx.el['fmt-chip'];
    expect(c.hidden).toBe(false);
    expect(c.textContent).toBe('HLS');
    expect(c.classList.contains('active')).toBe(true);
  });

  it("'ts' shows the chip labelled TS and marks it active", function () {
    ctx.ui.rndChip('ts');
    const c = ctx.el['fmt-chip'];
    expect(c.hidden).toBe(false);
    expect(c.textContent).toBe('TS');
    expect(c.classList.contains('active')).toBe(true);
  });

  it("remuxed .ts surfaces 'hls' → chip shows HLS (ADR-0012)", function () {
    ctx.ui.rndChip('hls');
    expect(ctx.el['fmt-chip'].textContent).toBe('HLS');
    expect(ctx.el['fmt-chip'].hidden).toBe(false);
  });

  it("empty engine hides the chip and collapses the detail", function () {
    ctx.ui.rndChip('hls');
    ctx.ui.onFmtChip();              // open the detail first
    ctx.ui.rndChip('');
    const c = ctx.el['fmt-chip'];
    const d = ctx.el['fmt-detail'];
    expect(c.hidden).toBe(true);
    expect(c.classList.contains('active')).toBe(false);
    expect(c.getAttribute('aria-expanded')).toBe('false');
    expect(d.hidden).toBe(true);
    expect(d.textContent).toBe('');
  });

  it("unknown engine token hides the chip", function () {
    ctx.ui.rndChip('hls');
    ctx.ui.rndChip('mp4');
    expect(ctx.el['fmt-chip'].hidden).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// onFmtChip — presentational toggle, never touches phase
// ---------------------------------------------------------------------------
describe('onFmtChip() — toggles inline detail + aria-expanded', function () {
  let ctx;
  beforeEach(function () {
    ctx = loadUi();
    ctx.ui.rndChip('hls');
  });

  it('first click reveals the detail naming the engine + aria-expanded true', function () {
    ctx.ui.onFmtChip();
    const c = ctx.el['fmt-chip'];
    const d = ctx.el['fmt-detail'];
    expect(c.getAttribute('aria-expanded')).toBe('true');
    expect(d.hidden).toBe(false);
    expect(d.textContent).toBe('Playing via hls.js');
  });

  it('second click hides the detail + aria-expanded false', function () {
    ctx.ui.onFmtChip();
    ctx.ui.onFmtChip();
    const c = ctx.el['fmt-chip'];
    const d = ctx.el['fmt-detail'];
    expect(c.getAttribute('aria-expanded')).toBe('false');
    expect(d.hidden).toBe(true);
    expect(d.textContent).toBe('');
  });

  it("'ts' engine detail names mpegts.js", function () {
    ctx.ui.rndChip('ts');
    ctx.ui.onFmtChip();
    expect(ctx.el['fmt-detail'].textContent).toBe('Playing via mpegts.js');
  });

  it('toggling never changes IptvSt.ST.phase', function () {
    const before = ctx.win.IptvSt.ST.phase;
    ctx.ui.onFmtChip();
    ctx.ui.onFmtChip();
    expect(ctx.win.IptvSt.ST.phase).toBe(before);
  });
});
