// ADR: ADR-0018 (DELETED at E11)
// These suites cover the removed ADR-0018 filterable genre sidebar + content-head
// genre chip (TASK-0040 removed the markup, styles, and JS). They are skipped
// here to keep the suite green and are deleted wholesale in TASK-0041 (the
// dedicated genre-test cleanup task). They assert behaviour that no longer
// exists by design — they are not a regression gate.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const CFG_SRC    = join(__dir, '../../client/cfg.js');
const SRCH_SRC   = join(__dir, '../../client/srch.js');
const UI_SRC     = join(__dir, '../../client/ui.js');

/** Stub DOM element. genre-chip ships with the `hidden` attribute (R-0001). */
function mkStub(id) {
  return {
    id,
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    hidden: id === 'genre-chip',
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    setAttribute() {},
  };
}

/**
 * Load real cfg.js + srch.js + ui.js against one synthetic window so S and
 * IptvSrch.getCats are the production implementations (not stubs). Returns
 * { ui, els, st }. ST is a mutable plain object the tests poke directly.
 */
function loadUi() {
  const els = {};
  const st  = { phase: 'READY', flt: 'all', srch: '', sort: 'num-asc', favs: [], cur: null, chs: [], cats: [] };
  function getEl(id) {
    if (!els[id]) {
      els[id] = mkStub(id);
      // #cat-list is created inside #grp-nav innerHTML at runtime; expose it.
    }
    return els[id];
  }
  const doc = {
    getElementById: getEl,
    querySelector() { return null; },
    addEventListener() {},
    body: { classList: { add() {}, remove() {} } },
  };
  const win = {
    document: doc,
    IptvSt: { ST: st, setSrch() {}, setFlt() {}, setCur() {}, go() {} },
    IptvPlay: null,
    clearTimeout() {},
    setTimeout(fn) { return fn; },
  };
  // eslint-disable-next-line no-new-func
  new Function('window', '"use strict";\n' + readFileSync(CFG_SRC, 'utf8'))(win);
  // eslint-disable-next-line no-new-func
  new Function('window', '"use strict";\n' + readFileSync(SRCH_SRC, 'utf8'))(win);
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', '"use strict";\n' + readFileSync(UI_SRC, 'utf8'))(win, doc);
  win.IptvUi.mkEL();
  return { ui: win.IptvUi, els, st };
}

/** Build n demo-shaped categories { id, name }. */
function mkCats(n) {
  const out = [];
  for (let i = 0; i < n; i += 1) out.push({ id: 'c' + i, name: 'Genre ' + String.fromCharCode(65 + (i % 26)) + i });
  return out;
}

// ---------------------------------------------------------------------------
// Pinned All Channels / Favourites entries (never filtered or reordered)
// ---------------------------------------------------------------------------
describe.skip('rndSide — pinned All Channels / Favourites', function () {
  it('always renders "All Channels" first with the total channel count', function () {
    const { ui, els } = loadUi();
    const chs = [{ id: '1', name: 'A', cat: 'c0', num: 1 }, { id: '2', name: 'B', cat: 'c1', num: 2 }];
    ui.rndSide(mkCats(3), chs, []);
    const html = els['grp-nav'].innerHTML;
    expect(html).toContain('data-cat="all"');
    expect(html).toContain('<span class="cat-label">All Channels</span>');
    // "All Channels" precedes the first genre button
    expect(html.indexOf('data-cat="all"')).toBeLessThan(html.indexOf('data-cat="c0"'));
  });

  it('renders "Favourites" (pinned) only when there are favourites', function () {
    const { ui, els } = loadUi();
    ui.rndSide(mkCats(3), [], ['1']);
    expect(els['grp-nav'].innerHTML).toContain('data-cat="favs"');
  });

  it('keeps "All Channels"/"Favourites" pinned in the cat-list alongside the genre buttons (large catalog)', function () {
    const { ui, els } = loadUi();
    const cats = mkCats(13);
    ui.rndSide(cats, [], ['1']);
    const html = els['grp-nav'].innerHTML;
    // the pinned buttons live inside the re-renderable #cat-list wrapper,
    // before any genre button, so a filter re-render keeps them pinned
    expect(html).toContain('id="cat-list"');
    const list = html.slice(html.indexOf('id="cat-list"'));
    expect(list).toContain('data-cat="all"');
    expect(list).toContain('data-cat="favs"');
    expect(list.indexOf('data-cat="all"')).toBeLessThan(list.indexOf('data-cat="c0"'));
  });
});

// ---------------------------------------------------------------------------
// Genre buttons render in the source's own delivery order (pre-E9 behaviour)
// ---------------------------------------------------------------------------
describe.skip('rndSide — genre buttons in source order', function () {
  it('renders the genre buttons in the source category order (no reordering)', function () {
    const { ui, els } = loadUi();
    const cats = [
      { id: 'z', name: 'Zeta' }, { id: 'a', name: 'Alpha' }, { id: 'm', name: 'Movies' },
    ];
    ui.rndSide(cats, [], []);
    const html = els['grp-nav'].innerHTML;
    const pz = html.indexOf('data-cat="z"');
    const pa = html.indexOf('data-cat="a"');
    const pm = html.indexOf('data-cat="m"');
    expect(pz).toBeGreaterThan(-1);
    expect(pz).toBeLessThan(pa);
    expect(pa).toBeLessThan(pm);
  });
});

// ---------------------------------------------------------------------------
// rndHead — active-genre chip text from the current channel's grp
// ---------------------------------------------------------------------------
describe.skip('rndHead — active-genre chip', function () {
  it('shows the current channel grp and reveals the chip (hidden=false)', function () {
    const { ui, els, st } = loadUi();
    st.cur = { id: '1', name: 'World News 24', grp: 'News' };
    ui.rndHead();
    expect(els['genre-chip'].textContent).toBe('News');
    expect(els['genre-chip'].hidden).toBe(false);
    expect(els['now-info'].textContent).toBe('World News 24');
  });

  it('hides the chip and clears its text when no channel is selected', function () {
    const { ui, els, st } = loadUi();
    st.cur = null;
    ui.rndHead();
    expect(els['genre-chip'].textContent).toBe('');
    expect(els['genre-chip'].hidden).toBe(true);
    expect(els['now-info'].textContent).toBe('');
  });

  it('hides the chip when the current channel has an empty grp', function () {
    const { ui, els, st } = loadUi();
    st.cur = { id: '1', name: 'No Genre', grp: '' };
    ui.rndHead();
    expect(els['genre-chip'].textContent).toBe('');
    expect(els['genre-chip'].hidden).toBe(true);
  });
});
