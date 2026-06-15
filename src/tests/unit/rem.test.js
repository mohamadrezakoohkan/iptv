// ADR: ADR-0032
// Unit tests — client/rem.js reminders store (TASK-0067). Covers the Rem
// builder/identity, the store mutators + de-dup + toggle return value,
// count/clear, load() validation + drop-malformed + never-throws (incl. a
// throwing localStorage stub), iptv_rems persistence (mocked localStorage),
// and the pure due(now) selector. No DOM-attribute assertions here (R-0001
// does not apply — this is a pure/store module).

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const CFG_SRC    = join(__dir, '../../client/cfg.js');
const REM_SRC    = join(__dir, '../../client/rem.js');

/**
 * Build a fresh window with mocked localStorage + window.S, then evaluate
 * cfg.js and rem.js against it. opts.ls lets a test inject a throwing stub.
 * Returns { rem, store, win }. A fresh evaluation gives each test its own
 * isolated in-memory reminder store.
 */
function mkWin(opts) {
  const store = {};
  const ls = (opts && opts.ls) || {
    getItem:    function getItem(k)    { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem:    function setItem(k, v) { store[k] = String(v); },
    removeItem: function removeItem(k) { delete store[k]; },
    clear:      function clear()       { Object.keys(store).forEach(function del(k) { delete store[k]; }); },
  };
  const win = { localStorage: ls };
  // eslint-disable-next-line no-new-func
  new Function('window', '"use strict";\n' + readFileSync(CFG_SRC, 'utf8'))(win);
  // eslint-disable-next-line no-new-func
  new Function('window', '"use strict";\n' + readFileSync(REM_SRC, 'utf8'))(win);
  return { rem: win.IptvRem, store: store, win: win };
}

/** A throwing localStorage stub — every access raises. */
function mkThrowLs() {
  return {
    getItem:    function getItem()  { throw new Error('boom'); },
    setItem:    function setItem()  { throw new Error('boom'); },
    removeItem: function removeItem(){ throw new Error('boom'); },
    clear:      function clear()    { throw new Error('boom'); },
  };
}

// ---------------------------------------------------------------------------
// mkRem + key — builders / identity
// ---------------------------------------------------------------------------
describe('mkRem / key — builders and identity', function () {
  let rem;
  beforeEach(function () { rem = mkWin().rem; });

  it('mkRem builds { chId, start, title } from a Prg', function () {
    const r = rem.mkRem('ch1', { chId: 'ch1', title: 'News', start: 1700000000000, stop: 1700003600000 });
    expect(r).toEqual({ chId: 'ch1', start: 1700000000000, title: 'News' });
  });

  it('mkRem coerces chId to string and defaults a missing title to ""', function () {
    const r = rem.mkRem(42, { start: 1700000000000 });
    expect(r.chId).toBe('42');
    expect(r.title).toBe('');
  });

  it('key formats "<chId>|<start>"', function () {
    expect(rem.key('ch1', 1700000000000)).toBe('ch1|1700000000000');
  });
});

// ---------------------------------------------------------------------------
// add / has / rm — including de-dup by identity
// ---------------------------------------------------------------------------
describe('add / has / rm — de-dup by identity', function () {
  let rem;
  beforeEach(function () { rem = mkWin().rem; });

  it('add stores a reminder and has() reports it', function () {
    rem.add({ chId: 'ch1', start: 100, title: 'A' });
    expect(rem.has('ch1', 100)).toBe(true);
    expect(rem.count()).toBe(1);
  });

  it('add of a duplicate identity does not create a second entry', function () {
    rem.add({ chId: 'ch1', start: 100, title: 'A' });
    rem.add({ chId: 'ch1', start: 100, title: 'A again' });
    expect(rem.count()).toBe(1);
  });

  it('a different start on the same channel is a distinct identity', function () {
    rem.add({ chId: 'ch1', start: 100, title: 'A' });
    rem.add({ chId: 'ch1', start: 200, title: 'B' });
    expect(rem.count()).toBe(2);
  });

  it('has() is false for an unset identity', function () {
    rem.add({ chId: 'ch1', start: 100, title: 'A' });
    expect(rem.has('ch1', 999)).toBe(false);
    expect(rem.has('ch2', 100)).toBe(false);
  });

  it('rm removes the matching identity', function () {
    rem.add({ chId: 'ch1', start: 100, title: 'A' });
    rem.add({ chId: 'ch1', start: 200, title: 'B' });
    rem.rm('ch1', 100);
    expect(rem.has('ch1', 100)).toBe(false);
    expect(rem.has('ch1', 200)).toBe(true);
    expect(rem.count()).toBe(1);
  });

  it('add ignores a malformed reminder', function () {
    rem.add({ chId: '', start: 100 });
    rem.add({ chId: 'ch1', start: NaN });
    rem.add(null);
    expect(rem.count()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// toggle — add/remove + return value
// ---------------------------------------------------------------------------
describe('toggle — add/remove and pressed return', function () {
  let rem;
  beforeEach(function () { rem = mkWin().rem; });

  it('toggle of an unset reminder adds it and returns true', function () {
    const pressed = rem.toggle('ch1', { start: 100, title: 'A' });
    expect(pressed).toBe(true);
    expect(rem.has('ch1', 100)).toBe(true);
  });

  it('toggle of a set reminder removes it and returns false', function () {
    rem.toggle('ch1', { start: 100, title: 'A' });
    const pressed = rem.toggle('ch1', { start: 100, title: 'A' });
    expect(pressed).toBe(false);
    expect(rem.has('ch1', 100)).toBe(false);
    expect(rem.count()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// list / count / clear
// ---------------------------------------------------------------------------
describe('list / count / clear', function () {
  let rem;
  beforeEach(function () { rem = mkWin().rem; });

  it('list returns a fresh array copy (mutating the array never affects the store)', function () {
    rem.add({ chId: 'ch1', start: 100, title: 'A' });
    const copy = rem.list();
    copy.push({ chId: 'x', start: 1, title: 'x' });
    expect(rem.count()).toBe(1);
    expect(rem.list()).toHaveLength(1);
    expect(rem.list()[0].title).toBe('A');
  });

  it('clear empties the store', function () {
    rem.add({ chId: 'ch1', start: 100, title: 'A' });
    rem.add({ chId: 'ch1', start: 200, title: 'B' });
    rem.clear();
    expect(rem.count()).toBe(0);
    expect(rem.list()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Persistence — writes iptv_rems through guarded write
// ---------------------------------------------------------------------------
describe('persistence — iptv_rems', function () {
  it('add persists the store under iptv_rems', function () {
    const w = mkWin();
    w.rem.add({ chId: 'ch1', start: 100, title: 'A' });
    expect(JSON.parse(w.store.iptv_rems)).toEqual([{ chId: 'ch1', start: 100, title: 'A' }]);
  });

  it('rm and clear persist the resulting store', function () {
    const w = mkWin();
    w.rem.add({ chId: 'ch1', start: 100, title: 'A' });
    w.rem.add({ chId: 'ch1', start: 200, title: 'B' });
    w.rem.rm('ch1', 100);
    expect(JSON.parse(w.store.iptv_rems)).toEqual([{ chId: 'ch1', start: 200, title: 'B' }]);
    w.rem.clear();
    expect(JSON.parse(w.store.iptv_rems)).toEqual([]);
  });

  it('a throwing localStorage is swallowed — mutators never throw (in-memory only)', function () {
    const w = mkWin({ ls: mkThrowLs() });
    expect(function () { w.rem.add({ chId: 'ch1', start: 100, title: 'A' }); }).not.toThrow();
    // The store still degrades to in-memory and tracks the reminder.
    expect(w.rem.has('ch1', 100)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// load — validates, drops malformed, never throws
// ---------------------------------------------------------------------------
describe('load — validate / drop-malformed / never-throws', function () {
  it('load reads valid reminders from iptv_rems', function () {
    const w = mkWin();
    w.store.iptv_rems = JSON.stringify([{ chId: 'ch1', start: 100, title: 'A' }]);
    w.rem.load();
    expect(w.rem.count()).toBe(1);
    expect(w.rem.has('ch1', 100)).toBe(true);
  });

  it('load drops malformed / non-object entries', function () {
    const w = mkWin();
    w.store.iptv_rems = JSON.stringify([
      { chId: 'ch1', start: 100, title: 'A' },
      { chId: '', start: 200 },        // empty chId
      { chId: 'ch2' },                 // no start
      'nope',                          // non-object
      null,                            // null
      { chId: 'ch3', start: 300, title: 'C' },
    ]);
    w.rem.load();
    expect(w.rem.count()).toBe(2);
    expect(w.rem.has('ch1', 100)).toBe(true);
    expect(w.rem.has('ch3', 300)).toBe(true);
  });

  it('load tolerates a non-array / garbage payload without throwing', function () {
    const w = mkWin();
    w.store.iptv_rems = '{not json';
    expect(function () { w.rem.load(); }).not.toThrow();
    expect(w.rem.count()).toBe(0);
    w.store.iptv_rems = JSON.stringify({ not: 'an array' });
    expect(function () { w.rem.load(); }).not.toThrow();
    expect(w.rem.count()).toBe(0);
  });

  it('load against a throwing localStorage never throws and leaves the store empty', function () {
    const w = mkWin({ ls: mkThrowLs() });
    expect(function () { w.rem.load(); }).not.toThrow();
    expect(w.rem.count()).toBe(0);
  });

  it('load normalizes loaded entries to the Rem shape (title defaulted)', function () {
    const w = mkWin();
    w.store.iptv_rems = JSON.stringify([{ chId: 'ch1', start: 100 }]);
    w.rem.load();
    expect(w.rem.list()[0]).toEqual({ chId: 'ch1', start: 100, title: '' });
  });
});

// ---------------------------------------------------------------------------
// due(now) — pure selector, in-window only
// ---------------------------------------------------------------------------
describe('due(now) — pure due selector', function () {
  let rem;
  const NOW = 1700000000000;
  beforeEach(function () { rem = mkWin().rem; });

  it('selects reminders whose start is at/before now and within the grace window', function () {
    rem.add({ chId: 'ch1', start: NOW - 1000, title: 'just due' });   // due
    rem.add({ chId: 'ch1', start: NOW, title: 'exactly now' });        // due
    rem.add({ chId: 'ch1', start: NOW + 60000, title: 'future' });     // not yet
    const due = rem.due(NOW);
    const titles = due.map(function t(r) { return r.title; });
    expect(titles).toContain('just due');
    expect(titles).toContain('exactly now');
    expect(titles).not.toContain('future');
  });

  it('ignores long-past reminders (older than the grace window)', function () {
    rem.add({ chId: 'ch1', start: NOW - (60 * 60 * 1000), title: 'long past' });
    expect(rem.due(NOW)).toEqual([]);
  });

  it('does not mutate the store and is repeatable', function () {
    rem.add({ chId: 'ch1', start: NOW - 1000, title: 'A' });
    const first = rem.due(NOW);
    const second = rem.due(NOW);
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(rem.count()).toBe(1);
  });

  it('does not persist (no write) when called', function () {
    const w = mkWin();
    w.rem.add({ chId: 'ch1', start: NOW - 1000, title: 'A' });
    const before = w.store.iptv_rems;
    w.rem.due(NOW);
    expect(w.store.iptv_rems).toBe(before);
  });

  it('defaults to Date.now() when called with no argument', function () {
    rem.add({ chId: 'ch1', start: Date.now() - 1000, title: 'A' });
    expect(rem.due()).toHaveLength(1);
  });
});
