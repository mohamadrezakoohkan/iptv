// ADR: ADR-0034
// Unit tests — the client reminder timer wired on page load (TASK-0070,
// specs/reminders.md §5, ADR-0034). main.js starts a single coarse interval on
// DOMContentLoaded; each tick reads IptvRem.due(now), fires each newly-due
// reminder once through window.IptvUi.fireRem, then removes it from the store so
// it never re-fires. Boot also restores the persisted store (IptvRem.load) so
// reminders survive a reload. With a mocked clock and a stubbed IptvRem we assert:
// due reminders fire once (not twice across ticks), an empty store is a silent
// no-op, an absent IptvRem is a guarded no-op, and boot calls load + starts one
// interval at S.remTick.
//
// R-0001: no DOM-attribute assertions here — the timer is non-visual.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const MAIN_SRC   = join(__dir, '../../client/main.js');

const REF = 1_700_000_000_000;

// ---------------------------------------------------------------------------
// loadMain — execute client/main.js with a synthetic window + document, a
// captured setInterval (no real timer is scheduled), and a stubbed IptvRem whose
// due()/rm()/load() calls are recorded. opts:
//   rem:  the IptvRem stub (when omitted, window.IptvRem is absent),
//   noUi: when true, window.IptvUi.fireRem is absent (still must not throw).
// Returns { win, calls, tick } where tick() invokes the registered interval
// callback (one timer tick) and calls.boot fires DOMContentLoaded.
// ---------------------------------------------------------------------------
function loadMain(opts) {
  const o = opts || {};
  const listeners = {};
  const calls = { fired: [], removed: [], loaded: 0, interval: null, intervalMs: null };
  const doc = {
    addEventListener: function addEvt(t, fn) { listeners[t] = fn; },
    getElementById:   function getEl()       { return null; },
  };
  const win = {
    IptvSt: {
      ST: { chs: [], cats: [], favs: [], srch: '', flt: 'all', cur: null, phase: 'INIT' },
      go: function go() {}, onPhase: function onPhase() {}, setChs: function setChs() {},
      setErr: function setErr() {}, setCur: function setCur() {},
      loadSt:    function loadStFake()    { return { sel: null }; },
      loadTheme: function loadThemeFake() { return 'dark'; },
      loadAccts: function loadAcctsFake() { return { accts: [], actId: null }; },
      getAct:    function getActFake()    { return null; },
    },
    IptvUi: {
      mkEL: function mkEL() {}, onPhase: function onPhase() {}, rndPhase: function rndPhase() {},
      rndFoot: function rndFoot() {}, rndSide: function rndSide() {}, rndGrid: function rndGrid() {},
      rndAcct: function rndAcct() {}, rndSort: function rndSort() {}, rndTheme: function rndTheme() {},
      rndHead: function rndHead() {},
    },
    IptvPlay: { mkPlay: function mkPlay() {} },
    IptvApi:  { connect: function connect() { return new Promise(function never() {}); } },
    IptvSrch: { getChs: function getChs() { return []; } },
    S: { remTick: 20000, toastMs: 8000 },
  };
  if (!o.noUi) win.IptvUi.fireRem = function fireRem(rem) { calls.fired.push(rem); };
  if (o.rem) win.IptvRem = o.rem;
  // main.js reads the bare global setInterval (a browser global); inject a
  // capture stub into the function scope so no real timer is scheduled and the
  // tick callback is captured for the tests.
  function setInt(fn, ms) { calls.interval = fn; calls.intervalMs = ms; return 1; }
  const src = readFileSync(MAIN_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'setInterval', '"use strict";\n' + src)(win, doc, setInt);
  return {
    win,
    calls,
    boot: function boot() { listeners['DOMContentLoaded'](); },
    tick: function tick() { if (calls.interval) calls.interval(); },
  };
}

// A stubbed IptvRem whose store is the given Rem[]; due(now) returns the entries
// whose start <= now and rm(chId,start) drops them (mirroring the real store).
function mkRem(initial) {
  const store = (initial || []).slice();
  return {
    store,
    loaded: 0,
    due: function due(now) { return store.filter(function inDue(r) { return r.start <= now; }); },
    rm:  function rm(chId, start) {
      for (let i = store.length - 1; i >= 0; i -= 1) {
        if (store[i].chId === chId && store[i].start === start) store.splice(i, 1);
      }
    },
    load: function load() { this.loaded += 1; },
  };
}

// mkRemReal is mkRem (same contract); a distinct name documents that it backs
// the genuine-interval (fake-timer) test rather than the capture-stub harness.
const mkRemReal = mkRem;

// loadMainReal — like loadMain but lets main.js use the genuine global
// setInterval (so vitest fake timers can advance it). Captures fired reminders
// via the same IptvUi.fireRem stub. Returns { calls, boot }.
function loadMainReal(opts) {
  const o = opts || {};
  const listeners = {};
  const calls = { fired: [] };
  const doc = {
    addEventListener: function addEvt(t, fn) { listeners[t] = fn; },
    getElementById:   function getEl()       { return null; },
  };
  const win = {
    IptvSt: {
      ST: { chs: [], cats: [], favs: [], srch: '', flt: 'all', cur: null, phase: 'INIT' },
      go: function go() {}, onPhase: function onPhase() {}, setChs: function setChs() {},
      setErr: function setErr() {}, setCur: function setCur() {},
      loadSt:    function loadStFake()    { return { sel: null }; },
      loadTheme: function loadThemeFake() { return 'dark'; },
      loadAccts: function loadAcctsFake() { return { accts: [], actId: null }; },
      getAct:    function getActFake()    { return null; },
    },
    IptvUi: {
      mkEL: function mkEL() {}, onPhase: function onPhase() {}, rndPhase: function rndPhase() {},
      rndFoot: function rndFoot() {}, rndSide: function rndSide() {}, rndGrid: function rndGrid() {},
      rndAcct: function rndAcct() {}, rndSort: function rndSort() {}, rndTheme: function rndTheme() {},
      rndHead: function rndHead() {},
      fireRem: function fireRem(rem) { calls.fired.push(rem); },
    },
    IptvPlay: { mkPlay: function mkPlay() {} },
    IptvApi:  { connect: function connect() { return new Promise(function never() {}); } },
    IptvSrch: { getChs: function getChs() { return []; } },
    S: { remTick: 20000, toastMs: 8000 },
  };
  if (o.rem) win.IptvRem = o.rem;
  const src = readFileSync(MAIN_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', '"use strict";\n' + src)(win, doc);
  return { calls, boot: function boot() { listeners['DOMContentLoaded'](); } };
}

const REM_A = { chId: '5', start: REF - 1000, title: 'Evening News' };
const REM_B = { chId: '9', start: REF + 600000, title: 'Late Film' }; // future, not due

// ---------------------------------------------------------------------------
// Boot wiring — load() + a single interval at S.remTick
// ---------------------------------------------------------------------------
describe('reminder timer — boot wiring on page load', function () {
  it('restores the persisted store via IptvRem.load() on boot', function () {
    const rem = mkRem([]);
    const env = loadMain({ rem });
    env.boot();
    expect(rem.loaded).toBe(1);
  });

  it('starts exactly one interval at S.remTick', function () {
    const env = loadMain({ rem: mkRem([]) });
    env.boot();
    expect(typeof env.calls.interval).toBe('function');
    expect(env.calls.intervalMs).toBe(20000);
  });
});

// ---------------------------------------------------------------------------
// Tick behaviour — fire each due reminder once, never twice
// ---------------------------------------------------------------------------
describe('reminder timer — tick fires due reminders once then removes them', function () {
  it('fires each newly-due reminder once and removes it from the store', function () {
    const rem = mkRem([REM_A, REM_B]);
    const env = loadMain({ rem });
    const real = Date.now;
    Date.now = function fixedNow() { return REF; };
    try {
      env.boot();
      env.tick();
      expect(env.calls.fired).toEqual([REM_A]);   // only the due one fired
      expect(rem.store).toEqual([REM_B]);          // fired reminder removed, future kept
    } finally {
      Date.now = real;
    }
  });

  it('does NOT re-fire a reminder on a later tick (fired once across ticks)', function () {
    const rem = mkRem([REM_A]);
    const env = loadMain({ rem });
    const real = Date.now;
    Date.now = function fixedNow() { return REF; };
    try {
      env.boot();
      env.tick();
      env.tick(); // second tick — the store is now empty for that reminder
      expect(env.calls.fired).toEqual([REM_A]); // exactly once, not twice
      expect(rem.store).toEqual([]);
    } finally {
      Date.now = real;
    }
  });

  it('under fake timers a real interval fires the tick automatically and once', function () {
    vi.useFakeTimers();
    vi.setSystemTime(REF);
    try {
      // Drive the genuine global setInterval (faked by vitest) rather than the
      // capture stub, so the clock-driven tick path is exercised end to end.
      const rem = mkRemReal([REM_A]);
      const env = loadMainReal({ rem });
      env.boot();
      vi.advanceTimersByTime(20000); // one tick
      expect(env.calls.fired).toEqual([REM_A]);
      expect(rem.store).toEqual([]);
      vi.advanceTimersByTime(20000); // second tick — must not re-fire
      expect(env.calls.fired).toEqual([REM_A]);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// Silent degradation — empty store, no guide, absent globals
// ---------------------------------------------------------------------------
describe('reminder timer — degrades silently', function () {
  it('an empty store is a silent no-op (nothing fired, nothing removed)', function () {
    const rem = mkRem([]);
    const env = loadMain({ rem });
    const real = Date.now;
    Date.now = function fixedNow() { return REF; };
    try {
      env.boot();
      expect(function noThrow() { env.tick(); }).not.toThrow();
      expect(env.calls.fired).toEqual([]);
      expect(rem.store).toEqual([]);
    } finally {
      Date.now = real;
    }
  });

  it('a future-only store fires nothing (no reminder is yet due)', function () {
    const rem = mkRem([REM_B]);
    const env = loadMain({ rem });
    const real = Date.now;
    Date.now = function fixedNow() { return REF; };
    try {
      env.boot();
      env.tick();
      expect(env.calls.fired).toEqual([]);
      expect(rem.store).toEqual([REM_B]);
    } finally {
      Date.now = real;
    }
  });

  it('is a guarded no-op when window.IptvRem is absent (test isolation) — never throws', function () {
    const env = loadMain({}); // no rem stub
    env.boot();
    expect(function noThrow() { env.tick(); }).not.toThrow();
    expect(env.calls.fired).toEqual([]);
  });

  it('removes due reminders even when the firing surface (IptvUi.fireRem) is absent — never throws', function () {
    const rem = mkRem([REM_A]);
    const env = loadMain({ rem, noUi: true });
    const real = Date.now;
    Date.now = function fixedNow() { return REF; };
    try {
      env.boot();
      expect(function noThrow() { env.tick(); }).not.toThrow();
      expect(rem.store).toEqual([]); // still removed so it cannot re-fire later
    } finally {
      Date.now = real;
    }
  });
});
