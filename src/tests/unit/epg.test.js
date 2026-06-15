// ADR: ADR-0030
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const EPG_SRC    = join(__dir, '../../client/epg.js');

/** Execute client/epg.js against a fresh window, return window.IptvEpg.
 *  A fresh evaluation gives each test its own isolated in-memory store. */
function loadEpg() {
  const win = {};
  const src = readFileSync(EPG_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  const fn = new Function('window', '"use strict";\n' + src + '\nreturn window.IptvEpg;');
  return fn(win);
}

/** UTF-8-safe base64 encode (matches the module's decoder). */
function b64(text) {
  return Buffer.from(text, 'utf8').toString('base64');
}

/** Build a minimal XMLTV document from programme tuples. */
function mkXmltv(rows) {
  const body = rows.map(function row(r) {
    return '<programme channel="' + r.ch + '" start="' + r.start + '" stop="' + r.stop + '">'
      + '<title>' + (r.title || '') + '</title>'
      + (r.desc ? '<desc>' + r.desc + '</desc>' : '')
      + (r.cat ? '<category>' + r.cat + '</category>' : '')
      + '</programme>';
  }).join('');
  return '<?xml version="1.0"?><tv>' + body + '</tv>';
}

// ---------------------------------------------------------------------------
// parsXtEpg — Xtream get_simple_data_table
// ---------------------------------------------------------------------------
describe('parsXtEpg — Xtream short-EPG parse', function () {
  let epg;
  beforeEach(function () { epg = loadEpg(); });

  it('reads *_timestamp seconds and converts to unix ms', function () {
    const raw = { epg_listings: [
      { title: b64('News'), description: b64('Top stories'),
        start_timestamp: '1700000000', stop_timestamp: '1700003600' },
    ] };
    const prgs = epg.parsXtEpg(raw, 'ch1');
    expect(prgs).toHaveLength(1);
    expect(prgs[0].start).toBe(1700000000 * 1000);
    expect(prgs[0].stop).toBe(1700003600 * 1000);
  });

  it('base64-decodes title and description (UTF-8 safe)', function () {
    const raw = { epg_listings: [
      { title: b64('News 📺'), description: b64('Détails'),
        start_timestamp: 1700000000, stop_timestamp: 1700003600 },
    ] };
    const prgs = epg.parsXtEpg(raw, 'ch1');
    expect(prgs[0].title).toBe('News 📺');
    expect(prgs[0].desc).toBe('Détails');
  });

  it('sets chId on every listing and conforms to PRG_DEF shape', function () {
    const raw = { epg_listings: [
      { title: b64('A'), description: b64('d'),
        start_timestamp: 1700000000, stop_timestamp: 1700003600 },
    ] };
    const p = epg.parsXtEpg(raw, 'sid-9')[0];
    expect(p.chId).toBe('sid-9');
    expect(typeof p.title).toBe('string');
    expect(typeof p.desc).toBe('string');
    expect(typeof p.cat).toBe('string');
    expect(typeof p.start).toBe('number');
    expect(typeof p.stop).toBe('number');
  });

  it('returns the list sorted ascending by start', function () {
    const raw = { epg_listings: [
      { title: b64('late'),  start_timestamp: 1700003600, stop_timestamp: 1700007200 },
      { title: b64('early'), start_timestamp: 1700000000, stop_timestamp: 1700003600 },
    ] };
    const prgs = epg.parsXtEpg(raw, 'ch1');
    expect(prgs.map(function t(p) { return p.title; })).toEqual(['early', 'late']);
  });

  it('drops malformed listings (missing/zero timestamps, stop<=start)', function () {
    const raw = { epg_listings: [
      { title: b64('ok'),   start_timestamp: 1700000000, stop_timestamp: 1700003600 },
      { title: b64('no-ts') },
      { title: b64('rev'),  start_timestamp: 1700003600, stop_timestamp: 1700000000 },
    ] };
    const prgs = epg.parsXtEpg(raw, 'ch1');
    expect(prgs).toHaveLength(1);
    expect(prgs[0].title).toBe('ok');
  });

  it('tolerates a missing or empty epg_listings', function () {
    expect(epg.parsXtEpg({}, 'ch1')).toEqual([]);
    expect(epg.parsXtEpg({ epg_listings: [] }, 'ch1')).toEqual([]);
    expect(epg.parsXtEpg(null, 'ch1')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// parsXmltv — XMLTV
// ---------------------------------------------------------------------------
describe('parsXmltv — XMLTV parse', function () {
  let epg;
  beforeEach(function () { epg = loadEpg(); });

  it('parses YYYYMMDDHHMMSS ±HHMM to unix ms honoring the offset', function () {
    const xml = mkXmltv([
      { ch: 'bbc', title: 'News', start: '20240101120000 +0000', stop: '20240101130000 +0000' },
    ]);
    const map = epg.parsXmltv(xml);
    expect(map.bbc[0].start).toBe(Date.UTC(2024, 0, 1, 12, 0, 0));
    expect(map.bbc[0].stop).toBe(Date.UTC(2024, 0, 1, 13, 0, 0));
  });

  it('honors a non-zero offset (shifts the absolute instant)', function () {
    const utc = epg.parsXmltv(mkXmltv([
      { ch: 'a', title: 'x', start: '20240101120000 +0000', stop: '20240101130000 +0000' },
    ]));
    const plus2 = epg.parsXmltv(mkXmltv([
      { ch: 'a', title: 'x', start: '20240101120000 +0200', stop: '20240101130000 +0200' },
    ]));
    expect(utc.a[0].start - plus2.a[0].start).toBe(2 * 60 * 60 * 1000);
  });

  it('keys by channel, maps title/desc/category, sets chId', function () {
    const map = epg.parsXmltv(mkXmltv([
      { ch: 'c1', title: 'T', desc: 'D', cat: 'Movie',
        start: '20240101120000 +0000', stop: '20240101130000 +0000' },
    ]));
    const p = map.c1[0];
    expect(p.chId).toBe('c1');
    expect(p.title).toBe('T');
    expect(p.desc).toBe('D');
    expect(p.cat).toBe('Movie');
  });

  it('groups multiple channels into separate per-id lists', function () {
    const map = epg.parsXmltv(mkXmltv([
      { ch: 'a', title: 'a1', start: '20240101100000 +0000', stop: '20240101110000 +0000' },
      { ch: 'b', title: 'b1', start: '20240101100000 +0000', stop: '20240101110000 +0000' },
    ]));
    expect(Object.keys(map).sort()).toEqual(['a', 'b']);
  });

  it('sorts each per-id list ascending by start', function () {
    const map = epg.parsXmltv(mkXmltv([
      { ch: 'a', title: 'late',  start: '20240101140000 +0000', stop: '20240101150000 +0000' },
      { ch: 'a', title: 'early', start: '20240101100000 +0000', stop: '20240101110000 +0000' },
    ]));
    expect(map.a.map(function t(p) { return p.title; })).toEqual(['early', 'late']);
  });

  it('drops malformed entries (bad timestamps)', function () {
    const map = epg.parsXmltv(mkXmltv([
      { ch: 'a', title: 'ok',  start: '20240101100000 +0000', stop: '20240101110000 +0000' },
      { ch: 'a', title: 'bad', start: 'notadate', stop: 'notadate' },
    ]));
    expect(map.a).toHaveLength(1);
    expect(map.a[0].title).toBe('ok');
  });

  it('returns {} for empty / non-programme text', function () {
    expect(epg.parsXmltv('')).toEqual({});
    expect(epg.parsXmltv('<tv></tv>')).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// store — set / setAll / get-copy isolation / has / count / clear
// ---------------------------------------------------------------------------
describe('store — mutators and reads', function () {
  let epg;
  beforeEach(function () { epg = loadEpg(); });

  function prg(start, stop) {
    return { chId: 'c', title: 't', start, stop, desc: '', cat: '' };
  }

  it('set stores a list and replaces any prior list', function () {
    epg.set('c', [prg(1, 2)]);
    expect(epg.get('c')).toHaveLength(1);
    epg.set('c', [prg(3, 4), prg(5, 6)]);
    expect(epg.get('c')).toHaveLength(2);
  });

  it('set sorts the stored list ascending by start', function () {
    epg.set('c', [prg(5, 6), prg(1, 2)]);
    expect(epg.get('c').map(function s(p) { return p.start; })).toEqual([1, 5]);
  });

  it('setAll bulk-stores a map', function () {
    epg.setAll({ a: [prg(1, 2)], b: [prg(1, 2)] });
    expect(epg.has('a')).toBe(true);
    expect(epg.has('b')).toBe(true);
    expect(epg.count()).toBe(2);
  });

  it('get returns a fresh copy — mutating it never affects the store', function () {
    epg.set('c', [prg(1, 2)]);
    const copy = epg.get('c');
    copy.push(prg(3, 4));
    copy[0].title = 'mutated';
    expect(epg.get('c')).toHaveLength(1);
  });

  it('get returns [] when no guide is stored', function () {
    expect(epg.get('missing')).toEqual([]);
  });

  it('has is true only for a non-empty stored guide', function () {
    epg.set('c', [prg(1, 2)]);
    epg.set('empty', []);
    expect(epg.has('c')).toBe(true);
    expect(epg.has('empty')).toBe(false);
    expect(epg.has('never')).toBe(false);
  });

  it('count counts only channels with a non-empty guide', function () {
    epg.set('a', [prg(1, 2)]);
    epg.set('b', []);
    expect(epg.count()).toBe(1);
  });

  it('clear empties the store', function () {
    epg.setAll({ a: [prg(1, 2)], b: [prg(1, 2)] });
    epg.clear();
    expect(epg.count()).toBe(0);
    expect(epg.has('a')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getNowNext — selector
// ---------------------------------------------------------------------------
describe('getNowNext — now/next selector', function () {
  let epg;
  beforeEach(function () { epg = loadEpg(); });

  function prg(title, start, stop) {
    return { chId: 'c', title, start, stop, desc: '', cat: '' };
  }

  it('returns the airing program as now and the following as next', function () {
    epg.set('c', [prg('a', 100, 200), prg('b', 200, 300), prg('d', 300, 400)]);
    const r = epg.getNowNext('c', 150);
    expect(r.now.title).toBe('a');
    expect(r.next.title).toBe('b');
  });

  it('next-only when now is before the first program', function () {
    epg.set('c', [prg('a', 100, 200), prg('b', 200, 300)]);
    const r = epg.getNowNext('c', 50);
    expect(r.now).toBeNull();
    expect(r.next.title).toBe('a');
  });

  it('now-only when the airing program is the last one', function () {
    epg.set('c', [prg('a', 100, 200)]);
    const r = epg.getNowNext('c', 150);
    expect(r.now.title).toBe('a');
    expect(r.next).toBeNull();
  });

  it('both null in a gap between programs', function () {
    epg.set('c', [prg('a', 100, 200), prg('b', 300, 400)]);
    const r = epg.getNowNext('c', 250);
    expect(r.now).toBeNull();
    expect(r.next.title).toBe('b');
  });

  it('both null when no guide is stored', function () {
    const r = epg.getNowNext('missing', 100);
    expect(r.now).toBeNull();
    expect(r.next).toBeNull();
  });

  it('does not return the airing program as its own next on an exact start boundary', function () {
    epg.set('c', [prg('a', 100, 200), prg('b', 200, 300)]);
    const r = epg.getNowNext('c', 100);
    expect(r.now.title).toBe('a');
    expect(r.next.title).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// getSched — selector
// ---------------------------------------------------------------------------
describe('getSched — upcoming schedule selector', function () {
  let epg;
  beforeEach(function () { epg = loadEpg(); });

  function prg(title, start, stop) {
    return { chId: 'c', title, start, stop, desc: '', cat: '' };
  }

  it('includes the current program and filters fully-past ones', function () {
    epg.set('c', [prg('past', 0, 50), prg('cur', 100, 200), prg('soon', 200, 300)]);
    const sched = epg.getSched('c', 150);
    expect(sched.map(function t(p) { return p.title; })).toEqual(['cur', 'soon']);
  });

  it('returns programs ascending by start', function () {
    epg.set('c', [prg('a', 100, 200), prg('b', 200, 300), prg('d', 300, 400)]);
    const sched = epg.getSched('c', 0);
    expect(sched.map(function s(p) { return p.start; })).toEqual([100, 200, 300]);
  });

  it('returns [] when no guide is stored', function () {
    expect(epg.getSched('missing', 100)).toEqual([]);
  });

  it('returns [] when every program has already stopped', function () {
    epg.set('c', [prg('a', 0, 50), prg('b', 50, 100)]);
    expect(epg.getSched('c', 200)).toEqual([]);
  });
});
