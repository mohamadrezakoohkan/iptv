// ADR: ADR-0021
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const EMPTY_SRC  = join(__dir, '../../client/empty.js');

/** Execute client/empty.js against a fresh window, return window.IptvEmpty. */
function loadEmpty() {
  const win = {};
  const src = readFileSync(EMPTY_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  const fn = new Function('window', '"use strict";\n' + src + '\nreturn window.IptvEmpty;');
  return fn(win);
}

// Fixed action-kind vocabulary (specs/empty-states.md §1).
const KINDS = ['clear-search', 'view-all', 'retry', 'connect'];

// ---------------------------------------------------------------------------
// resolveContent — non-empty grid returns null
// ---------------------------------------------------------------------------
describe('resolveContent — non-empty grid', function () {
  let empty;
  beforeEach(function () { empty = loadEmpty(); });

  it('returns null when shown > 0', function () {
    const res = empty.resolveContent({ total: 10, shown: 3, flt: 'all', srch: '', favs: [] });
    expect(res).toBeNull();
  });

  it('returns null even with an active search if there are matches', function () {
    const res = empty.resolveContent({ total: 10, shown: 1, flt: 'all', srch: 'news', favs: [] });
    expect(res).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveContent — no search match (highest priority)
// ---------------------------------------------------------------------------
describe('resolveContent — no search match', function () {
  let empty;
  beforeEach(function () { empty = loadEmpty(); });

  it('returns the search EmptyState with icon, title and clear-search action', function () {
    const res = empty.resolveContent({ total: 10, shown: 0, flt: 'all', srch: 'zzz', favs: [] });
    expect(res.icon).toBe('search');
    expect(res.title).toBe('No matches');
    expect(res.action.kind).toBe('clear-search');
    expect(res.action.label).toBe('Clear search');
  });

  it('embeds the HTML-escaped query in the body', function () {
    const res = empty.resolveContent({ total: 10, shown: 0, flt: 'all', srch: '<b>&"x', favs: [] });
    expect(res.body).toContain('&lt;b&gt;&amp;&quot;x');
    expect(res.body).not.toContain('<b>');
  });

  it('takes precedence over an active category filter', function () {
    const res = empty.resolveContent({ total: 10, shown: 0, flt: 'news', srch: 'q', favs: [] });
    expect(res.title).toBe('No matches');
    expect(res.icon).toBe('search');
  });

  it('takes precedence over the favourites filter', function () {
    const res = empty.resolveContent({ total: 10, shown: 0, flt: 'favs', srch: 'q', favs: [] });
    expect(res.title).toBe('No matches');
  });
});

// ---------------------------------------------------------------------------
// resolveContent — favourites filter empty
// ---------------------------------------------------------------------------
describe('resolveContent — favourites empty', function () {
  let empty;
  beforeEach(function () { empty = loadEmpty(); });

  it('returns the favourites EmptyState with star icon and view-all action', function () {
    const res = empty.resolveContent({ total: 10, shown: 0, flt: 'favs', srch: '', favs: [] });
    expect(res.icon).toBe('star');
    expect(res.title).toBe('No favourites yet');
    expect(res.body).toBe('Tap the star on any channel to add it here.');
    expect(res.action.kind).toBe('view-all');
    expect(res.action.label).toBe('Browse all channels');
  });
});

// ---------------------------------------------------------------------------
// resolveContent — specific category empty
// ---------------------------------------------------------------------------
describe('resolveContent — category empty', function () {
  let empty;
  beforeEach(function () { empty = loadEmpty(); });

  it('returns the category EmptyState with list icon and view-all action', function () {
    const res = empty.resolveContent({ total: 10, shown: 0, flt: 'news', srch: '', favs: [] });
    expect(res.icon).toBe('list');
    expect(res.title).toBe('Nothing in this category');
    expect(res.body).toBe('This category has no channels right now.');
    expect(res.action.kind).toBe('view-all');
  });
});

// ---------------------------------------------------------------------------
// resolveContent — zero-channel source
// ---------------------------------------------------------------------------
describe('resolveContent — zero-channel source', function () {
  let empty;
  beforeEach(function () { empty = loadEmpty(); });

  it('returns the no-channels EmptyState with no action', function () {
    const res = empty.resolveContent({ total: 0, shown: 0, flt: 'all', srch: '', favs: [] });
    expect(res.icon).toBe('list');
    expect(res.title).toBe('No channels');
    expect(res.body).toBe('This playlist returned no channels. Try another source.');
    expect(res.action).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveSignal — idle with session, idle no session, stream error
// ---------------------------------------------------------------------------
describe('resolveSignal — idle with session', function () {
  let empty;
  beforeEach(function () { empty = loadEmpty(); });

  it('returns the idle EmptyState with no action when a session exists', function () {
    const res = empty.resolveSignal({ phase: 'READY', cur: null });
    expect(res.icon).toBe('antenna');
    expect(res.title).toBe('No signal');
    expect(res.body).toBe('Pick a channel from the grid to start watching.');
    expect(res.action).toBeUndefined();
  });
});

describe('resolveSignal — idle no session', function () {
  let empty;
  beforeEach(function () { empty = loadEmpty(); });

  it('returns the idle EmptyState with a connect action at INIT', function () {
    const res = empty.resolveSignal({ phase: 'INIT', cur: null });
    expect(res.icon).toBe('antenna');
    expect(res.title).toBe('No signal');
    expect(res.body).toBe('Connect a playlist below to start watching.');
    expect(res.action.kind).toBe('connect');
    expect(res.action.label).toBe('Connect a source');
  });
});

describe('resolveSignal — stream error', function () {
  let empty;
  beforeEach(function () { empty = loadEmpty(); });

  it('returns the stream-error EmptyState with constant headline and retry action', function () {
    const cur = { id: '1', name: 'World News 24' };
    const res = empty.resolveSignal({ phase: 'ERR', cur: cur });
    expect(res.icon).toBe('alert');
    expect(res.title).toBe("This channel won't play");
    expect(res.body).toBe('The stream could not be loaded. It may be offline or temporarily unavailable.');
    expect(res.action.kind).toBe('retry');
    expect(res.action.label).toBe('Retry');
  });

  it('falls back to the idle EmptyState when ERR has no current channel', function () {
    const res = empty.resolveSignal({ phase: 'ERR', cur: null });
    expect(res.title).toBe('No signal');
    expect(res.icon).toBe('antenna');
  });
});

// ---------------------------------------------------------------------------
// action.kind vocabulary — every emitted action.kind is in the fixed set
// ---------------------------------------------------------------------------
describe('action.kind vocabulary', function () {
  let empty;
  beforeEach(function () { empty = loadEmpty(); });

  it('every content/signal action uses only the fixed kinds', function () {
    const states = [
      empty.resolveContent({ total: 10, shown: 0, flt: 'all', srch: 'zzz', favs: [] }),
      empty.resolveContent({ total: 10, shown: 0, flt: 'favs', srch: '', favs: [] }),
      empty.resolveContent({ total: 10, shown: 0, flt: 'news', srch: '', favs: [] }),
      empty.resolveSignal({ phase: 'INIT', cur: null }),
      empty.resolveSignal({ phase: 'ERR', cur: { id: '1' } }),
    ];
    states.forEach(function chk(s) {
      expect(KINDS).toContain(s.action.kind);
    });
  });
});

// ---------------------------------------------------------------------------
// purity — same inputs → same output, no DOM, no extra globals
// ---------------------------------------------------------------------------
describe('purity', function () {
  let empty;
  beforeEach(function () { empty = loadEmpty(); });

  it('resolveContent is deterministic for the same input', function () {
    const inp = { total: 10, shown: 0, flt: 'news', srch: '', favs: [] };
    expect(empty.resolveContent(inp)).toEqual(empty.resolveContent(inp));
  });

  it('resolveSignal is deterministic for the same input', function () {
    const inp = { phase: 'ERR', cur: { id: '1' } };
    expect(empty.resolveSignal(inp)).toEqual(empty.resolveSignal(inp));
  });

  it('runs with no global document present (loadEmpty window has none)', function () {
    let err = null;
    try {
      empty.resolveContent({ total: 0, shown: 0, flt: 'all', srch: '', favs: [] });
      empty.resolveSignal({ phase: 'INIT', cur: null });
    } catch (e) { err = e; }
    expect(err).toBeNull();
  });

  it('exposes only the two resolvers on the export', function () {
    expect(Object.keys(empty).sort()).toEqual(['resolveContent', 'resolveSignal']);
  });
});
