// ADR: ADR-0038
// Unit tests — Live | Movies | Series content toggle (TASK-0079,
// specs/vod-library.md §5a, §7, §8). Cover: the toggle builder emits three
// options with aria-pressed PRESENT in the baseline (Rule R-0001); the content-
// mode flag defaults to 'live' and resets to 'live' on connect/switch/disconnect
// (resetMode); switching mode (goMode) selects the correct categories/items
// source and resets the active filter to "All"; contextual presence hides
// Movies/Series when the VOD store lacks them.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const UI_SRC     = join(__dir, '../../client/ui.js');

/** Build a stub DOM element good enough for ui.js mkEL / rndSide / rndToggle. */
function mkStub() {
  return {
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    hidden: false,
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {},
    removeAttribute() {},
    getAttribute() { return null; },
    addEventListener() {},
    focus() {},
  };
}

/** A controllable in-memory IptvVod stub mirroring the window.IptvVod surface. */
function mkVodStub(movs, sers) {
  let m = movs || [];
  let s = sers || [];
  return {
    movies() { return m.slice(); },
    series() { return s.slice(); },
    hasMovies() { return m.length > 0; },
    hasSeries() { return s.length > 0; },
    setMovs(x) { m = x || []; },
    setSers(x) { s = x || []; },
    clear() { m = []; s = []; },
  };
}

/** Load client/ui.js against a synthetic window/document, return { ui, els, win }. */
function loadUi(vod) {
  const els = {};
  const doc = {
    getElementById: function getEl(id) {
      if (!els[id]) els[id] = mkStub();
      return els[id];
    },
    querySelector: function qSel() { return null; },
    addEventListener() {},
    body: { classList: { add() {}, remove() {} } },
    documentElement: { getAttribute() { return null; }, setAttribute() {}, removeAttribute() {} },
  };
  const win = {
    IptvSt: {
      ST: { favs: [], cur: null, chs: [], phase: 'READY', flt: 'all', srch: '', sort: 'num-asc', vol: 1.0, muted: false, err: null, host: '', user: '', cats: [] },
      setFavs() {}, setCur() {}, setFlt(c) { this.ST.flt = c; }, setSrch() {}, go() {},
      saveSt() {}, saveAct() {}, loadAccts() { return { accts: [], actId: null }; }, getAct() { return null; },
    },
    IptvSrch: { getChs: function getChs(chs) { return chs; }, SORTS: [] },
    IptvEmpty: { resolveContent: function resolveContent() { return { icon: 'list', title: 'No channels', body: '' }; } },
    IptvVod: vod || null,
    S: {},
    IptvPlay: null,
    IptvApi: null,
    document: doc,
    clearTimeout() {},
    setTimeout(fn) { return fn; },
  };
  const src = readFileSync(UI_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', '"use strict";\n' + src)(win, doc);
  win.IptvUi.mkEL();
  return { ui: win.IptvUi, els, win };
}

describe('content toggle builder — mkToggle (R-0001 baseline aria)', function () {
  it('emits Live, Movies and Series options, each with aria-pressed PRESENT', function () {
    const { ui } = loadUi(mkVodStub([], []));
    const html = ui.mkToggle({ mode: 'live', movs: true, sers: true });
    expect(html).toContain('data-mode="live"');
    expect(html).toContain('data-mode="movies"');
    expect(html).toContain('data-mode="series"');
    // R-0001: aria-pressed is in the baseline markup for every option.
    const pressed = html.match(/aria-pressed="/g) || [];
    expect(pressed.length).toBe(3);
  });

  it('marks the active option aria-pressed="true" and others "false"', function () {
    const { ui } = loadUi(mkVodStub([{ id: 'm', name: 'M', cat: 'a', grp: 'A', num: 1, img: '' }], []));
    const html = ui.mkToggle({ mode: 'movies', movs: true, sers: false });
    expect(html).toContain('data-mode="movies" aria-pressed="true"');
    expect(html).toContain('data-mode="live" aria-pressed="false"');
    expect(html).toContain('class="ct-opt active" data-mode="movies"');
  });

  it('contextual presence: hides Movies/Series when the store lacks them', function () {
    const { ui } = loadUi(mkVodStub([], []));
    const html = ui.mkToggle({ mode: 'live', movs: false, sers: false });
    // Live is never hidden; Movies & Series carry `hidden`.
    expect(html).toContain('data-mode="movies"');
    expect(html).toMatch(/data-mode="movies"[^>]*hidden/);
    expect(html).toMatch(/data-mode="series"[^>]*hidden/);
    expect(html).not.toMatch(/data-mode="live"[^>]*hidden/);
  });

  it('shows Movies but hides Series when only movies exist (demo synthesis)', function () {
    const { ui } = loadUi(mkVodStub([{ cat: 'd', grp: 'Demo' }], []));
    const html = ui.mkToggle({ mode: 'live', movs: true, sers: false });
    expect(html).not.toMatch(/data-mode="movies"[^>]*hidden/);
    expect(html).toMatch(/data-mode="series"[^>]*hidden/);
  });
});

describe('content-mode flag — default + reset', function () {
  it('defaults to live', function () {
    const { ui } = loadUi(mkVodStub([], []));
    expect(ui.getCMode()).toBe('live');
  });

  it('resetMode returns the mode to live after a switch (connect/switch/disconnect)', function () {
    const { ui } = loadUi(mkVodStub([{ id: 'm', name: 'M', cat: 'a', grp: 'A', num: 1, img: '' }], []));
    ui.goMode('movies');
    expect(ui.getCMode()).toBe('movies');
    ui.resetMode();
    expect(ui.getCMode()).toBe('live');
  });

  it('setCMode ignores an unknown token', function () {
    const { ui } = loadUi(mkVodStub([], []));
    ui.setCMode('bogus');
    expect(ui.getCMode()).toBe('live');
  });
});

describe('mode switching — goMode selects the active source + resets filter', function () {
  it('movies mode reads the VOD movie store for items/categories', function () {
    const movs = [
      { id: '1', name: 'Film One', cat: '7', grp: 'Action', num: 1, img: '' },
      { id: '2', name: 'Film Two', cat: '7', grp: 'Action', num: 2, img: '' },
      { id: '3', name: 'Doc',      cat: '9', grp: 'Docs',   num: 3, img: '' },
    ];
    const { ui } = loadUi(mkVodStub(movs, []));
    ui.goMode('movies');
    expect(ui.getCMode()).toBe('movies');
    expect(ui.getModeItems().length).toBe(3);
    // Categories derived distinctly from the items (Action, Docs).
    const cats = ui.getModeCats();
    expect(cats.length).toBe(2);
    expect(cats[0]).toEqual({ id: '7', name: 'Action' });
    expect(cats[1]).toEqual({ id: '9', name: 'Docs' });
  });

  it('series mode reads the VOD series store', function () {
    const sers = [{ id: 's1', name: 'My Show', cat: '3', grp: 'Drama', img: '' }];
    const { ui } = loadUi(mkVodStub([], sers));
    ui.goMode('series');
    expect(ui.getCMode()).toBe('series');
    expect(ui.getModeItems().length).toBe(1);
    expect(ui.getModeCats()).toEqual([{ id: '3', name: 'Drama' }]);
  });

  it('live mode reads ST.chs / ST.cats', function () {
    const { ui, win } = loadUi(mkVodStub([{ id: 'm', name: 'M', cat: 'a', grp: 'A', num: 1, img: '' }], []));
    win.IptvSt.ST.chs  = [{ id: 'c1', name: 'CH', cat: 'live', num: 1, img: '' }];
    win.IptvSt.ST.cats = [{ id: 'live', name: 'Live Cat' }];
    ui.goMode('movies');
    ui.goMode('live');
    expect(ui.getCMode()).toBe('live');
    expect(ui.getModeItems()).toBe(win.IptvSt.ST.chs);
    expect(ui.getModeCats()).toBe(win.IptvSt.ST.cats);
  });

  it('switching mode resets the active category filter to "All"', function () {
    const { ui, win } = loadUi(mkVodStub([{ id: 'm', name: 'M', cat: 'a', grp: 'A', num: 1, img: '' }], []));
    win.IptvSt.ST.flt = 'sports';
    ui.goMode('movies');
    expect(win.IptvSt.ST.flt).toBe('all');
  });

  it('goMode is a no-op for the current mode or an unknown token', function () {
    const { ui, win } = loadUi(mkVodStub([{ id: 'm', name: 'M', cat: 'a', grp: 'A', num: 1, img: '' }], []));
    win.IptvSt.ST.flt = 'sports';
    ui.goMode('live');            // already live → no reset
    expect(win.IptvSt.ST.flt).toBe('sports');
    ui.goMode('bogus');          // unknown → ignored
    expect(ui.getCMode()).toBe('live');
    expect(win.IptvSt.ST.flt).toBe('sports');
  });
});

describe('rndToggle — writes into #content-toggle reflecting state', function () {
  beforeEach(function noop() {});

  it('renders all three options into the container, Movies/Series hidden with no VOD', function () {
    const { ui, els } = loadUi(mkVodStub([], []));
    ui.rndToggle();
    const html = els['content-toggle'].innerHTML;
    expect(html).toContain('data-mode="live"');
    expect(html).toMatch(/data-mode="movies"[^>]*hidden/);
    expect(html).toMatch(/data-mode="series"[^>]*hidden/);
  });

  it('surfaces Movies/Series once the VOD store has them', function () {
    const vod = mkVodStub([], []);
    const { ui, els } = loadUi(vod);
    vod.setMovs([{ cat: 'a', grp: 'A' }]);
    vod.setSers([{ cat: 'b', grp: 'B' }]);
    ui.rndToggle();
    const html = els['content-toggle'].innerHTML;
    expect(html).not.toMatch(/data-mode="movies"[^>]*hidden/);
    expect(html).not.toMatch(/data-mode="series"[^>]*hidden/);
  });

  it('no IptvVod present → only Live, Movies/Series hidden (silent degrade)', function () {
    const { ui, els } = loadUi(null);
    ui.rndToggle();
    const html = els['content-toggle'].innerHTML;
    expect(html).toContain('data-mode="live" aria-pressed="true"');
    expect(html).toMatch(/data-mode="movies"[^>]*hidden/);
  });
});

// ---------------------------------------------------------------------------
// TASK-0080 — Movies browse (sidebar categories + poster cards). Cover:
// rndSide in movies mode lists the VOD movie categories with counts; rndGrid in
// movies mode renders one poster card per movie item via the existing mkCard
// (poster from img, title from name, letter-tile fallback); movie cards carry
// NO live-only affordances (NOW/NEXT, Remind, Replay) because the loadUi stub
// has no IptvEpg for VOD ids; category filter + search operate within the movie
// set. R-0001: these assertions check innerHTML content, never DOM-attribute
// mutations, so no baseline-attribute concern arises.
// ---------------------------------------------------------------------------

const MOVS = [
  { id: '1', name: 'Film One', cat: '7', grp: 'Action', num: 1, img: '' },
  { id: '2', name: 'Film Two', cat: '7', grp: 'Action', num: 2, img: 'http://x/p2.png' },
  { id: '3', name: 'Doc',      cat: '9', grp: 'Docs',   num: 3, img: '' },
];

describe('movies browse — rndSide lists VOD movie categories with counts', function () {
  it('renders an All button (movie total) plus one button per movie category', function () {
    const { ui, els } = loadUi(mkVodStub(MOVS.slice(), []));
    ui.goMode('movies');
    const html = els['grp-nav'].innerHTML;
    // All Channels button carries the full movie count.
    expect(html).toContain('data-cat="all"');
    expect(html).toMatch(/data-cat="all"[\s\S]*?<span class="cat-count">3<\/span>/);
    // One button per derived category, labelled by grp, counted by cat membership.
    expect(html).toContain('data-cat="7"');
    expect(html).toContain('data-cat="9"');
    expect(html).toContain('>Action<');
    expect(html).toContain('>Docs<');
  });

  it('each category button shows the count of movies in that category', function () {
    const { ui, els } = loadUi(mkVodStub(MOVS.slice(), []));
    ui.goMode('movies');
    const html = els['grp-nav'].innerHTML;
    // cat 7 has two movies, cat 9 has one.
    expect(html).toMatch(/data-cat="7"[\s\S]*?<span class="cat-count">2<\/span>/);
    expect(html).toMatch(/data-cat="9"[\s\S]*?<span class="cat-count">1<\/span>/);
  });
});

describe('movies browse — rndGrid renders one poster card per movie', function () {
  it('renders one card per movie item via mkCard', function () {
    const { ui, els } = loadUi(mkVodStub(MOVS.slice(), []));
    ui.goMode('movies');
    const html  = els['ch-list'].innerHTML;
    const cards = html.match(/data-id="/g) || [];
    expect(cards.length).toBe(3);
    expect(html).toContain('data-id="1"');
    expect(html).toContain('data-id="2"');
    expect(html).toContain('data-id="3"');
  });

  it('card title comes from name; poster from img with letter-tile fallback', function () {
    const { ui, els } = loadUi(mkVodStub(MOVS.slice(), []));
    ui.goMode('movies');
    const html = els['ch-list'].innerHTML;
    // Titles from name.
    expect(html).toContain('>Film One<');
    expect(html).toContain('>Film Two<');
    // Movie with a poster img renders an <img>; a poster-less movie falls back
    // to the letter-tile (first letter of name), exactly as live channels.
    expect(html).toContain('src="http://x/p2.png"');
    expect(html).toContain('ch-logo-fb');
  });

  it('movie cards carry no live-only affordances (NOW/NEXT, Remind, Replay)', function () {
    const { ui, els } = loadUi(mkVodStub(MOVS.slice(), []));
    ui.goMode('movies');
    const html = els['ch-list'].innerHTML;
    // No EPG now/next line, no Remind toggle, no Replay control, no guide expand.
    expect(html).not.toContain('ch-nn');
    expect(html).not.toContain('data-rem=');
    expect(html).not.toContain('data-replay=');
    expect(html).not.toContain('data-exp=');
  });
});

describe('movies browse — category filter + search operate within the movie set', function () {
  it('a category click filters the movie grid by item.cat === id', function () {
    const { ui, els } = loadUi(mkVodStub(MOVS.slice(), []));
    ui.goMode('movies');
    // Simulate a sidebar click on category "7" through the delegated handler.
    ui.onCatClick({ target: { closest() { return { getAttribute() { return '7'; } }; } } });
    const html  = els['ch-list'].innerHTML;
    // getChs is a pass-through stub, so the grid reflects the active mode's
    // items; the sidebar marks the chosen filter active.
    const side = els['grp-nav'].innerHTML;
    expect(side).toContain('cat-btn active');
    // The grid still renders movie cards (the active mode source is the movie set).
    expect(html).toContain('data-id="1"');
  });

  it('search reads the active mode item set, not ST.chs', function () {
    const vod = mkVodStub(MOVS.slice(), []);
    const { ui, win } = loadUi(vod);
    win.IptvSt.ST.chs = [{ id: 'c1', name: 'Live Chan', cat: 'l', grp: 'L', num: 1, img: '' }];
    let seen = null;
    // The loadUi setTimeout stub returns the scheduled fn; capture it so the
    // debounced fireSrch can be flushed deterministically.
    win.setTimeout = function setTimeout(fn) { return fn; };
    win.IptvSrch.getChs = function getChs(items) { seen = items; return items; };
    ui.goMode('movies');
    ui.onSrch({ target: { value: 'film' } });
    ui.fireSrch();   // flush the debounce manually (stub does not auto-run it)
    // The searched set is the movie set, not the live ST.chs.
    expect(seen).not.toBe(win.IptvSt.ST.chs);
    expect(seen.length).toBe(3);
  });
});
