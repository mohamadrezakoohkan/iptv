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
  const ep = new Map();
  return {
    movies() { return m.slice(); },
    series() { return s.slice(); },
    hasMovies() { return m.length > 0; },
    hasSeries() { return s.length > 0; },
    setMovs(x) { m = x || []; },
    setSers(x) { s = x || []; },
    episodes(id) { const l = ep.get(String(id)); return l ? l.slice() : []; },
    setEpis(id, x) { ep.set(String(id), x || []); },
    clear() { m = []; s = []; ep.clear(); },
  };
}

/** Load client/ui.js against a synthetic window/document, return { ui, els, win }. */
function loadUi(vod, api) {
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
    IptvApi: api || null,
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

// ---------------------------------------------------------------------------
// TASK-0081 — Series browse + seasons/episodes drill-down (ADR-0038,
// specs/vod-library.md §5b). Cover: series mode renders series categories +
// series poster cards (reusing the sidebar/grid surface); opening a series
// triggers the on-demand loadSerInfo loader and renders its seasons/episodes;
// the back control returns to the series list; an empty/failed series-info shows
// the empty state without throwing; episode entries route distinctly from series
// cards in onGridClick. R-0001: the back control's aria-label is present in the
// baseline markup and never toggled; series cards / episode entries carry NO
// toggled aria attribute (one-shot controls), asserted on the emitted markup.
// ---------------------------------------------------------------------------

const SERS = [
  { id: 's1', name: 'My Show',  grp: 'Drama',  img: 'http://x/s1.png', cat: '3' },
  { id: 's2', name: 'Doc Life', grp: 'Docs',   img: '',                cat: '5' },
];

const EPIS = [
  { id: 'e1', name: 'My Show · S1E1 Pilot',  grp: 'S1', url: 'u1', img: '', cat: '1', num: 1, kind: 'episode' },
  { id: 'e2', name: 'My Show · S1E2 Second', grp: 'S1', url: 'u2', img: '', cat: '1', num: 2, kind: 'episode' },
  { id: 'e3', name: 'My Show · S2E1 Return', grp: 'S2', url: 'u3', img: '', cat: '2', num: 1, kind: 'episode' },
];

/** A loadSerInfo-bearing IptvApi stub: records the call and fills the store. */
function mkApiStub(vod, opts) {
  const o = opts || {};
  return {
    calls: [],
    async loadSerInfo(arg) {
      this.calls.push(arg);
      if (o.fail) return { ok: false, err: 'series info fetch failed' };
      vod.setEpis(arg.id, (o.epis || []).slice());
      return { ok: true, val: (o.epis || []).length };
    },
  };
}

/** Set the connected account context the drill-down needs (mirrors goVod). */
function connectVod(ui) {
  ui.goVod({ src: 'http://h', user: 'u', pass: 'p', ext: 'ts', m3u: false });
}

describe('series browse — rndSide lists series categories, rndGrid renders series cards', function () {
  it('series mode renders one series category button per distinct category', function () {
    const { ui, els } = loadUi(mkVodStub([], SERS.slice()));
    ui.goMode('series');
    const side = els['grp-nav'].innerHTML;
    expect(side).toContain('data-cat="all"');
    expect(side).toContain('data-cat="3"');
    expect(side).toContain('data-cat="5"');
    expect(side).toContain('>Drama<');
    expect(side).toContain('>Docs<');
  });

  it('series mode renders a Series card (data-ser, NOT data-id) per series', function () {
    const { ui, els } = loadUi(mkVodStub([], SERS.slice()));
    ui.goMode('series');
    const html = els['ch-list'].innerHTML;
    // One card per series, keyed by data-ser so onGridClick opens (not plays).
    const cards = html.match(/data-ser="/g) || [];
    expect(cards.length).toBe(2);
    expect(html).toContain('data-ser="s1"');
    expect(html).toContain('data-ser="s2"');
    // A series browse entry is never playable: no data-id select+play target.
    expect(html).not.toContain('data-id=');
  });

  it('series card shows poster from img with letter-tile fallback, title from name', function () {
    const { ui, els } = loadUi(mkVodStub([], SERS.slice()));
    ui.goMode('series');
    const html = els['ch-list'].innerHTML;
    expect(html).toContain('>My Show<');
    expect(html).toContain('>Doc Life<');
    expect(html).toContain('src="http://x/s1.png"');   // s1 has a poster
    expect(html).toContain('ch-logo-fb');               // s2 falls back to letter tile
  });
});

describe('series drill-down — opening a series fetches + renders seasons/episodes', function () {
  it('opening a series triggers the on-demand loadSerInfo loader with the account context', async function () {
    const vod = mkVodStub([], SERS.slice());
    const api = mkApiStub(vod, { epis: EPIS.slice() });
    const { ui } = loadUi(vod, api);
    connectVod(ui);
    ui.goMode('series');
    await ui.goSerOpen('s1');
    // loadSerInfo was invoked once with the opened series id + connected context.
    expect(api.calls.length).toBe(1);
    expect(api.calls[0].id).toBe('s1');
    expect(api.calls[0].src).toBe('http://h');
    expect(api.calls[0].user).toBe('u');
    expect(api.calls[0].pass).toBe('p');
  });

  it('renders the seasons + selectable episode entries grouped by season', async function () {
    const vod = mkVodStub([], SERS.slice());
    const api = mkApiStub(vod, { epis: EPIS.slice() });
    const { ui, els } = loadUi(vod, api);
    connectVod(ui);
    ui.goMode('series');
    await ui.goSerOpen('s1');
    const html = els['ch-list'].innerHTML;
    // Two season groups (cat '1' and '2'), three episode entries.
    expect(html).toContain('Season 1');
    expect(html).toContain('Season 2');
    const eps = html.match(/data-id="/g) || [];
    expect(eps.length).toBe(3);
    expect(html).toContain('data-id="e1"');
    expect(html).toContain('data-id="e3"');
    // Episode titles render from the normalized name.
    expect(html).toContain('My Show · S1E1 Pilot');
  });

  it('groupBySeason groups episodes in first-seen season order', function () {
    const { ui } = loadUi(mkVodStub([], []));
    const groups = ui.groupBySeason(EPIS.slice());
    expect(groups.length).toBe(2);
    expect(groups[0].season).toBe('1');
    expect(groups[0].epis.length).toBe(2);
    expect(groups[1].season).toBe('2');
    expect(groups[1].epis.length).toBe(1);
  });
});

describe('series drill-down — back affordance returns to the series list', function () {
  it('the drill-down emits a keyboard-focusable back control with a baseline aria-label (R-0001)', async function () {
    const vod = mkVodStub([], SERS.slice());
    const api = mkApiStub(vod, { epis: EPIS.slice() });
    const { ui, els } = loadUi(vod, api);
    connectVod(ui);
    ui.goMode('series');
    await ui.goSerOpen('s1');
    const html = els['ch-list'].innerHTML;
    // Back is a real <button> carrying data-back, with aria-label PRESENT in the
    // emitted baseline markup (never toggled / added at runtime — Rule R-0001).
    expect(html).toContain('data-back="1"');
    expect(html).toMatch(/<button[^>]*class="ser-back"[^>]*aria-label="Back to series list"/);
  });

  it('goSerBack clears the drill-down and re-renders the series list', async function () {
    const vod = mkVodStub([], SERS.slice());
    const api = mkApiStub(vod, { epis: EPIS.slice() });
    const { ui, els } = loadUi(vod, api);
    connectVod(ui);
    ui.goMode('series');
    await ui.goSerOpen('s1');
    expect(els['ch-list'].innerHTML).toContain('data-back="1"');
    ui.goSerBack();
    const html = els['ch-list'].innerHTML;
    // Back to the series list: series cards again, no drill-down back control.
    expect(html).not.toContain('data-back=');
    expect(html).toContain('data-ser="s1"');
    expect(html).toContain('data-ser="s2"');
  });

  it('onGridClick routes a series card click to open the drill-down (not select+play)', async function () {
    const vod = mkVodStub([], SERS.slice());
    const api = mkApiStub(vod, { epis: EPIS.slice() });
    const { ui, els } = loadUi(vod, api);
    connectVod(ui);
    ui.goMode('series');
    // A delegated grid click whose target resolves only [data-ser]="s1" must
    // route to the drill-down OPEN path, never the [data-id] select+play path.
    const evt = { target: { closest(sel) {
      return sel === '[data-ser]' ? { getAttribute() { return 's1'; } } : null;
    } } };
    ui.onGridClick(evt);
    await Promise.resolve();
    await Promise.resolve();
    expect(api.calls.length).toBe(1);
    expect(api.calls[0].id).toBe('s1');
    expect(els['ch-list'].innerHTML).toContain('data-back="1"');
  });
});

describe('series drill-down — empty / failed series-info degrades silently', function () {
  it('an empty episode set shows the empty state, never throwing', async function () {
    const vod = mkVodStub([], SERS.slice());
    const api = mkApiStub(vod, { epis: [] });
    const { ui, els } = loadUi(vod, api);
    connectVod(ui);
    ui.goMode('series');
    await ui.goSerOpen('s1');
    const html = els['ch-list'].innerHTML;
    expect(html).toContain('No episodes available');
    expect(html).not.toContain('data-id=');   // no episode entries
    expect(html).toContain('data-back="1"');   // back is still present
  });

  it('a failed series-info fetch still shows the empty drill-down without crashing', async function () {
    const vod = mkVodStub([], SERS.slice());
    const api = mkApiStub(vod, { fail: true });
    const { ui, els } = loadUi(vod, api);
    connectVod(ui);
    ui.goMode('series');
    await ui.goSerOpen('s1');
    const html = els['ch-list'].innerHTML;
    expect(html).toContain('No episodes available');
    expect(html).toContain('data-back="1"');
  });

  it('opening a series with no IptvApi loader present is a silent no-op (empty drill-down)', async function () {
    const vod = mkVodStub([], SERS.slice());
    const { ui, els } = loadUi(vod, null);
    connectVod(ui);
    ui.goMode('series');
    await ui.goSerOpen('s1');
    const html = els['ch-list'].innerHTML;
    expect(html).toContain('No episodes available');
    expect(html).toContain('data-back="1"');
  });
});
