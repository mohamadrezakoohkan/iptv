// ADR: ADR-0027
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const ERRLOG_SRC = join(__dir, '../../client/errlog.js');

/** Execute client/errlog.js against a fresh window, return window.IptvErrLog.
 *  A fresh evaluation gives each test its own isolated in-memory LOG. */
function loadErrLog() {
  const win = {};
  const src = readFileSync(ERRLOG_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  const fn = new Function('window', '"use strict";\n' + src + '\nreturn window.IptvErrLog;');
  return fn(win);
}

// ---------------------------------------------------------------------------
// mkEntry — normalization of full / partial / null channels
// ---------------------------------------------------------------------------
describe('mkEntry — normalization', function () {
  let log;
  beforeEach(function () { log = loadErrLog(); });

  it('normalizes a full channel into the ErrEntry shape', function () {
    const cur = { name: 'World News 24', num: 42, url: 'http://x/stream.m3u8' };
    const e = log.mkEntry(cur, 'manifestLoadError');
    expect(e.name).toBe('World News 24');
    expect(e.num).toBe(42);
    expect(e.url).toBe('http://x/stream.m3u8');
    expect(e.detail).toBe('manifestLoadError');
    expect(typeof e.at).toBe('number');
  });

  it('applies defaults for a partial channel (missing num and url)', function () {
    const e = log.mkEntry({ name: 'Sports HD' }, 'networkError');
    expect(e.name).toBe('Sports HD');
    expect(e.num).toBeNull();
    expect(e.url).toBe('');
    expect(e.detail).toBe('networkError');
    expect(typeof e.at).toBe('number');
  });

  it('tolerates a null channel with correct defaults and no throw', function () {
    let e = null;
    let err = null;
    try { e = log.mkEntry(null, 'fatal'); } catch (ex) { err = ex; }
    expect(err).toBeNull();
    expect(e.name).toBe('Unknown channel');
    expect(e.num).toBeNull();
    expect(e.url).toBe('');
    expect(e.detail).toBe('fatal');
    expect(typeof e.at).toBe('number');
  });

  it('tolerates an undefined channel without throwing', function () {
    let err = null;
    try { log.mkEntry(undefined, 'x'); } catch (ex) { err = ex; }
    expect(err).toBeNull();
  });

  it('coerces a non-string detail to a string', function () {
    const e = log.mkEntry({ name: 'A' }, 500);
    expect(e.detail).toBe('500');
    const e2 = log.mkEntry({ name: 'A' }, null);
    expect(e2.detail).toBe('null');
  });

  it('stamps at with the current time (Date.now)', function () {
    const before = Date.now();
    const e = log.mkEntry({ name: 'A' }, 'd');
    const after = Date.now();
    expect(e.at).toBeGreaterThanOrEqual(before);
    expect(e.at).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// add / count — accumulation
// ---------------------------------------------------------------------------
describe('add / count — accumulation', function () {
  let log;
  beforeEach(function () { log = loadErrLog(); });

  it('starts empty', function () {
    expect(log.count()).toBe(0);
  });

  it('count() rises by one per add', function () {
    log.add(log.mkEntry({ name: 'A' }, '1'));
    expect(log.count()).toBe(1);
    log.add(log.mkEntry({ name: 'B' }, '2'));
    expect(log.count()).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// add — 50-entry cap drops the oldest, keeps the newest 50
// ---------------------------------------------------------------------------
describe('add — 50-entry cap', function () {
  let log;
  beforeEach(function () { log = loadErrLog(); });

  it('caps the log at 50 entries', function () {
    for (let i = 0; i < 60; i++) {
      log.add(log.mkEntry({ name: 'ch' + i }, String(i)));
    }
    expect(log.count()).toBe(50);
  });

  it('drops the oldest and keeps the newest 50', function () {
    for (let i = 0; i < 60; i++) {
      log.add(log.mkEntry({ name: 'ch' + i }, String(i)));
    }
    const entries = log.list(); // newest-first
    // newest added was ch59, oldest retained should be ch10 (0..9 dropped)
    expect(entries[0].name).toBe('ch59');
    expect(entries[entries.length - 1].name).toBe('ch10');
    // none of the dropped entries (ch0..ch9) remain
    const names = entries.map(function nm(e) { return e.name; });
    expect(names).not.toContain('ch0');
    expect(names).not.toContain('ch9');
  });
});

// ---------------------------------------------------------------------------
// list — newest-first, and a defensive copy
// ---------------------------------------------------------------------------
describe('list — newest-first copy', function () {
  let log;
  beforeEach(function () { log = loadErrLog(); });

  it('returns entries newest-first', function () {
    log.add(log.mkEntry({ name: 'first' }, '1'));
    log.add(log.mkEntry({ name: 'second' }, '2'));
    log.add(log.mkEntry({ name: 'third' }, '3'));
    const entries = log.list();
    expect(entries.map(function nm(e) { return e.name; })).toEqual(['third', 'second', 'first']);
  });

  it('returns a fresh array — mutating it leaves count() unchanged', function () {
    log.add(log.mkEntry({ name: 'A' }, '1'));
    log.add(log.mkEntry({ name: 'B' }, '2'));
    const entries = log.list();
    entries.push({ name: 'injected' });
    entries.pop();
    entries.pop();
    expect(log.count()).toBe(2);
    expect(log.list().length).toBe(2);
  });

  it('two list() calls return distinct array instances', function () {
    log.add(log.mkEntry({ name: 'A' }, '1'));
    expect(log.list()).not.toBe(log.list());
  });
});

// ---------------------------------------------------------------------------
// clear — empties the log
// ---------------------------------------------------------------------------
describe('clear — empties the log', function () {
  let log;
  beforeEach(function () { log = loadErrLog(); });

  it('count() becomes 0 after clear', function () {
    log.add(log.mkEntry({ name: 'A' }, '1'));
    log.add(log.mkEntry({ name: 'B' }, '2'));
    expect(log.count()).toBe(2);
    log.clear();
    expect(log.count()).toBe(0);
    expect(log.list()).toEqual([]);
  });

  it('the log is usable again after clear', function () {
    log.add(log.mkEntry({ name: 'A' }, '1'));
    log.clear();
    log.add(log.mkEntry({ name: 'B' }, '2'));
    expect(log.count()).toBe(1);
    expect(log.list()[0].name).toBe('B');
  });
});

// ---------------------------------------------------------------------------
// API surface — only the decided members are exposed
// ---------------------------------------------------------------------------
describe('API surface', function () {
  let log;
  beforeEach(function () { log = loadErrLog(); });

  it('exposes exactly add / clear / count / list / mkEntry', function () {
    expect(Object.keys(log).sort()).toEqual(['add', 'clear', 'count', 'list', 'mkEntry']);
  });
});
