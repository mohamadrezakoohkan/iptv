// ADR: ADR-0001
// Unit tests — mkCard + toggleFav for TASK-0006

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const UI_SRC     = join(__dir, '../../client/ui.js');
const EMPTY_SRC  = join(__dir, '../../client/empty.js');

/**
 * Load client/ui.js (and the real client/empty.js, so rndGrid's empty path
 * uses the genuine resolver) with a synthetic window that provides IptvSt.ST.
 * opts: { favs, cur, chs, flt, srch }
 */
function loadUi(opts) {
  const o    = opts || {};
  const favs = o.favs ? o.favs : [];
  const cur  = o.cur  ? o.cur  : null;
  const win  = {
    IptvSt: {
      ST: { favs, cur, chs: o.chs || [], phase: 'READY', flt: o.flt || 'all', srch: o.srch || '', vol: 1.0, muted: false, err: null, host: '', user: '', cats: [] },
      setFavs: function setFavs(arr) { win.IptvSt.ST.favs = arr; },
      setCur:  function setCur(ch)   { win.IptvSt.ST.cur  = ch;  },
      setFlt:  function setFlt(c)    { win.IptvSt.ST.flt  = c;   },
      setSrch: function setSrch(q)   { win.IptvSt.ST.srch = q;   },
      go:      function go()         {},
    },
    IptvSrch: { getChs: function getChs() { return []; } },
    IptvPlay: null,
    document: {
      getElementById:    function getEl()   { return null; },
      querySelector:     function qSel()    { return null; },
      body: { classList: { add: function add() {}, remove: function rem() {} } },
    },
    clearTimeout: function clearTout() {},
    setTimeout:   function setTout(fn) { return fn; },
  };
  const emptySrc = readFileSync(EMPTY_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', '"use strict";\n' + emptySrc)(win);
  const src = readFileSync(UI_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', '"use strict";\n' + src)(win, win.document);
  return win.IptvUi;
}

/**
 * Render the empty grid and capture the HTML written to a fake #ch-list.
 * loadUi's synthetic document returns null for getElementById, so rndGrid's
 * `if (!EL.list) return` short-circuits; instead drive rndGrid through a
 * minimal list stub injected after mkEL by re-loading with a captured list.
 */
function emptyHtml(opts) {
  const captured = { innerHTML: '', addEventListener: function ael() {} };
  const win = {};
  const o   = opts || {};
  win.IptvSt = {
    ST: { favs: o.favs || [], cur: null, chs: o.chs || [], phase: 'READY', flt: o.flt || 'all', srch: o.srch || '', cats: [] },
  };
  win.IptvSrch = { getChs: function getChs() { return []; } };
  win.IptvPlay = null;
  win.document = {
    getElementById: function getEl(id) { return id === 'ch-list' ? captured : null; },
    querySelector:  function qSel() { return null; },
    body: { classList: { add: function add() {}, remove: function rem() {} } },
    addEventListener: function ael() {},
  };
  win.clearTimeout = function clearTout() {};
  win.setTimeout   = function setTout(fn) { return fn; };
  const emptySrc = readFileSync(EMPTY_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', '"use strict";\n' + emptySrc)(win);
  const src = readFileSync(UI_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', '"use strict";\n' + src)(win, win.document);
  win.IptvUi.mkEL();
  win.IptvUi.rndGrid([]);
  return captured.innerHTML;
}

// ---------------------------------------------------------------------------
// mkCard — number padding
// ---------------------------------------------------------------------------
describe('mkCard — number padding', function () {
  let ui;
  beforeEach(function () { ui = loadUi({}); });

  it('pads num=1 to "001"', function () {
    const html = ui.mkCard({ id: '1', name: 'News', num: 1, img: '', cat: 'news' });
    expect(html).toContain('>001<');
  });

  it('pads num=10 to "010"', function () {
    const html = ui.mkCard({ id: '10', name: 'Sports', num: 10, img: '', cat: 'sports' });
    expect(html).toContain('>010<');
  });

  it('pads num=100 to "100"', function () {
    const html = ui.mkCard({ id: '100', name: 'Movies', num: 100, img: '', cat: 'movies' });
    expect(html).toContain('>100<');
  });

  it('pads num=999 to "999"', function () {
    const html = ui.mkCard({ id: '999', name: 'Kids', num: 999, img: '', cat: 'kids' });
    expect(html).toContain('>999<');
  });
});

// ---------------------------------------------------------------------------
// mkCard — favourite star class
// ---------------------------------------------------------------------------
describe('mkCard — favourite star', function () {
  it('star has class "on" when ch is in favs', function () {
    const ui  = loadUi({ favs: ['5'] });
    const html = ui.mkCard({ id: '5', name: 'Channel Five', num: 5, img: '', cat: 'news' });
    expect(html).toContain('ch-fav on');
  });

  it('star does not have class "on" when ch is not in favs', function () {
    const ui   = loadUi({ favs: [] });
    const html = ui.mkCard({ id: '5', name: 'Channel Five', num: 5, img: '', cat: 'news' });
    expect(html).not.toContain('ch-fav on');
    expect(html).toContain('class="ch-fav"');
  });

  it('star has "on" only for matching id, not others', function () {
    const ui   = loadUi({ favs: ['3'] });
    const html = ui.mkCard({ id: '5', name: 'Channel Five', num: 5, img: '', cat: 'news' });
    expect(html).not.toContain('ch-fav on');
  });
});

// ---------------------------------------------------------------------------
// mkCard — star aria-label
// ---------------------------------------------------------------------------
describe('mkCard — star aria-label', function () {
  it('aria-label is "Add to favourites" when ch is not in favs', function () {
    const ui   = loadUi({ favs: [] });
    const html = ui.mkCard({ id: '1', name: 'News', num: 1, img: '', cat: 'news' });
    expect(html).toContain('aria-label="Add to favourites"');
  });

  it('aria-label is "Remove from favourites" when ch is in favs', function () {
    const ui   = loadUi({ favs: ['1'] });
    const html = ui.mkCard({ id: '1', name: 'News', num: 1, img: '', cat: 'news' });
    expect(html).toContain('aria-label="Remove from favourites"');
  });
});

// ---------------------------------------------------------------------------
// mkCard — active class
// ---------------------------------------------------------------------------
describe('mkCard — active class', function () {
  it('card has ch-active when ch matches ST.cur', function () {
    const cur  = { id: '7', name: 'Active Ch', num: 7, img: '', cat: 'news' };
    const ui   = loadUi({ cur });
    const html = ui.mkCard(cur);
    expect(html).toContain('ch-card ch-active');
  });

  it('card does not have ch-active when ch does not match ST.cur', function () {
    const cur  = { id: '7', name: 'Active Ch', num: 7, img: '', cat: 'news' };
    const ui   = loadUi({ cur });
    const html = ui.mkCard({ id: '2', name: 'Other', num: 2, img: '', cat: 'news' });
    expect(html).not.toContain('ch-active');
  });

  it('card has no ch-active when ST.cur is null', function () {
    const ui   = loadUi({ cur: null });
    const html = ui.mkCard({ id: '1', name: 'News', num: 1, img: '', cat: 'news' });
    expect(html).not.toContain('ch-active');
  });
});

// ---------------------------------------------------------------------------
// mkCard — data-id and role attributes
// ---------------------------------------------------------------------------
describe('mkCard — accessibility attributes', function () {
  let ui;
  beforeEach(function () { ui = loadUi({}); });

  it('card has role="button"', function () {
    const html = ui.mkCard({ id: '1', name: 'News', num: 1, img: '', cat: 'news' });
    expect(html).toContain('role="button"');
  });

  it('card has tabindex="0"', function () {
    const html = ui.mkCard({ id: '1', name: 'News', num: 1, img: '', cat: 'news' });
    expect(html).toContain('tabindex="0"');
  });

  it('card has data-id matching ch.id', function () {
    const html = ui.mkCard({ id: '42', name: 'Test', num: 42, img: '', cat: 'news' });
    expect(html).toContain('data-id="42"');
  });

  it('star has data-fav matching ch.id', function () {
    const html = ui.mkCard({ id: '42', name: 'Test', num: 42, img: '', cat: 'news' });
    expect(html).toContain('data-fav="42"');
  });
});

// ---------------------------------------------------------------------------
// rndGrid — contextual empty-state placeholders (ADR-0022, TASK-0044).
// Asserts the actual rendered markup of each empty case (R-0001).
// ---------------------------------------------------------------------------
describe('rndGrid — contextual empty placeholders', function () {
  it('no-match search: "No matches" + escaped query + Clear search button', function () {
    const html = emptyHtml({ chs: [{ id: '1' }], flt: 'all', srch: 'spo<rt>' });
    expect(html).toContain('role="status"');
    expect(html).toContain('No matches');
    expect(html).toContain('No channels match "spo&lt;rt&gt;". Try a different search.');
    expect(html).toContain('data-empty-act="clear-search"');
    expect(html).toContain('>Clear search<');
  });

  it('empty favourites: "No favourites yet" + Browse all channels (view-all)', function () {
    const html = emptyHtml({ chs: [{ id: '1' }], flt: 'favs', srch: '' });
    expect(html).toContain('No favourites yet');
    expect(html).toContain('data-empty-act="view-all"');
    expect(html).toContain('>Browse all channels<');
  });

  it('empty category: "Nothing in this category" + view-all action', function () {
    const html = emptyHtml({ chs: [{ id: '1' }], flt: 'news', srch: '' });
    expect(html).toContain('Nothing in this category');
    expect(html).toContain('data-empty-act="view-all"');
  });

  it('zero-channel source: "No channels" + no action button', function () {
    const html = emptyHtml({ chs: [], flt: 'all', srch: '' });
    expect(html).toContain('No channels');
    expect(html).not.toContain('data-empty-act');
    expect(html).not.toContain('ch-empty-btn');
  });

  it('placeholder container has role="status" and aria-hidden icon', function () {
    const html = emptyHtml({ chs: [], flt: 'all', srch: '' });
    expect(html).toContain('class="ch-empty" role="status"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('ch-empty-ico');
  });

  it('action button is a real <button> (keyboard-focusable) with a label', function () {
    const html = emptyHtml({ chs: [{ id: '1' }], flt: 'favs', srch: '' });
    expect(html).toMatch(/<button[^>]*class="ch-empty-btn"[^>]*>Browse all channels<\/button>/);
  });

  it('search precedence: a query overrides an active category filter', function () {
    const html = emptyHtml({ chs: [{ id: '1' }], flt: 'news', srch: 'zzz' });
    expect(html).toContain('No matches');
    expect(html).not.toContain('Nothing in this category');
  });
});
