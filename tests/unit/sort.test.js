// ADR: ADR-0017
// Unit tests — mkSort: the pure helper that builds the sort-select <option>
// HTML from SORTS, marking the option matching the active token selected
// (TASK-0035). Asserts only the markup mkSort actually produces (R-0001): a
// value attribute on every option and the `selected` attribute on exactly the
// option whose id equals the current token.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const UI_SRC     = join(__dir, '../../client/ui.js');

// The canonical SORTS list (ADR-0017) — mirrors client/srch.js. mkSort takes
// the list as a parameter, so the unit test passes it explicitly.
const SORTS = [
  { id: 'num-asc',   label: 'Number ↑' },
  { id: 'name-asc',  label: 'Name A–Z' },
  { id: 'name-desc', label: 'Name Z–A' },
  { id: 'fav-first', label: 'Favourites first' },
];

/** Load client/ui.js against a minimal synthetic window; return IptvUi. */
function loadUi() {
  const win = {
    IptvSt: {
      ST: { favs: [], cur: null, chs: [], phase: 'READY', flt: 'all', srch: '', sort: 'num-asc', vol: 1.0, muted: false, err: null, host: '', user: '', cats: [] },
      setFavs: function setFavs() {},
      setCur:  function setCur() {},
      setSort: function setSort() {},
      saveSt:  function saveSt() {},
      go:      function go() {},
    },
    IptvSrch: { getChs: function getChs() { return []; }, SORTS },
    IptvPlay: null,
    document: {
      getElementById: function getEl() { return null; },
      querySelector:  function qSel() { return null; },
      addEventListener: function addEl() {},
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
// mkSort — option set
// ---------------------------------------------------------------------------
describe('mkSort — option set from SORTS', function () {
  let ui;
  beforeEach(function () { ui = loadUi(); });

  it('renders one <option> per SORTS entry', function () {
    const html = ui.mkSort({ sorts: SORTS, cur: 'num-asc' });
    const count = (html.match(/<option /g) || []).length;
    expect(count).toBe(SORTS.length);
  });

  it('each option carries value=id and label text', function () {
    const html = ui.mkSort({ sorts: SORTS, cur: 'num-asc' });
    SORTS.forEach(function chk(o) {
      expect(html).toContain('value="' + o.id + '"');
      expect(html).toContain('>' + o.label + '</option>');
    });
  });

  it('options render in SORTS order', function () {
    const html = ui.mkSort({ sorts: SORTS, cur: 'num-asc' });
    const idxA = html.indexOf('value="num-asc"');
    const idxB = html.indexOf('value="name-asc"');
    const idxC = html.indexOf('value="name-desc"');
    const idxD = html.indexOf('value="fav-first"');
    expect(idxA).toBeLessThan(idxB);
    expect(idxB).toBeLessThan(idxC);
    expect(idxC).toBeLessThan(idxD);
  });
});

// ---------------------------------------------------------------------------
// mkSort — current selection marked
// ---------------------------------------------------------------------------
describe('mkSort — current selection', function () {
  let ui;
  beforeEach(function () { ui = loadUi(); });

  it('marks the option matching cur as selected', function () {
    const html = ui.mkSort({ sorts: SORTS, cur: 'name-asc' });
    expect(html).toContain('value="name-asc" selected>');
  });

  it('marks exactly one option selected', function () {
    const html = ui.mkSort({ sorts: SORTS, cur: 'fav-first' });
    const count = (html.match(/ selected>/g) || []).length;
    expect(count).toBe(1);
  });

  it('leaves non-matching options without selected', function () {
    const html = ui.mkSort({ sorts: SORTS, cur: 'name-asc' });
    expect(html).toContain('value="num-asc">');
    expect(html).not.toContain('value="num-asc" selected>');
  });

  it('marks no option selected for an unknown token', function () {
    const html = ui.mkSort({ sorts: SORTS, cur: 'bogus' });
    const count = (html.match(/ selected>/g) || []).length;
    expect(count).toBe(0);
  });
});
