// ADR: ADR-0001
// Unit tests — mkCard + toggleFav for TASK-0006

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const UI_SRC     = join(__dir, '../../client/ui.js');

/**
 * Load client/ui.js with a synthetic window that provides IptvSt.ST.
 * opts: { favs, cur }
 */
function loadUi(opts) {
  const favs = opts && opts.favs ? opts.favs : [];
  const cur  = opts && opts.cur  ? opts.cur  : null;
  const win  = {
    IptvSt: {
      ST: { favs, cur, chs: [], phase: 'READY', flt: 'all', srch: '', vol: 1.0, muted: false, err: null, host: '', user: '', cats: [] },
      setFavs: function setFavs(arr) { win.IptvSt.ST.favs = arr; },
      setCur:  function setCur(ch)   { win.IptvSt.ST.cur  = ch;  },
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
  const src = readFileSync(UI_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', '"use strict";\n' + src)(win, win.document);
  return win.IptvUi;
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
