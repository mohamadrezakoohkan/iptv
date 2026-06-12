// ADR: ADR-0010
// Unit tests — rndSide category-shape glue for TASK-0024:
// normalized Xtream/M3U cats { category_id, category_name } (ADR-0009)
// and demo cats { id, name } must both render real labels.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const UI_SRC     = join(__dir, '../../client/ui.js');

/** Build a stub DOM element good enough for ui.js mkEL/rndSide. */
function mkStub() {
  return {
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
  };
}

/** Load client/ui.js against a synthetic window/document, return { ui, els }. */
function loadUi() {
  const els = {};
  const doc = {
    getElementById: function getEl(id) {
      if (!els[id]) els[id] = mkStub();
      return els[id];
    },
    querySelector: function qSel() { return null; },
    addEventListener() {},
    body: { classList: { add() {}, remove() {} } },
  };
  const win = {
    IptvSt: {
      ST: { favs: [], cur: null, chs: [], phase: 'READY', flt: 'all', srch: '', vol: 1.0, muted: false, err: null, host: '', user: '', cats: [] },
      setFavs() {}, setCur() {}, setFlt() {}, setSrch() {}, go() {},
    },
    IptvSrch: { getChs: function getChs() { return []; }, getCats: function getCats(cats) { return cats.slice(); } },
    S: { catFltMin: 12 },
    IptvPlay: null,
    document: doc,
    clearTimeout() {},
    setTimeout(fn) { return fn; },
  };
  const src = readFileSync(UI_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', '"use strict";\n' + src)(win, doc);
  win.IptvUi.mkEL();
  return { ui: win.IptvUi, els };
}

describe('rndSide — normalized Xtream/M3U categories (TASK-0024 glue)', function () {
  it('renders category_name labels and category_id data-cat values', function () {
    const { ui, els } = loadUi();
    const cats = [
      { category_id: '7',  category_name: 'News' },
      { category_id: '12', category_name: 'Sports' },
    ];
    const chs = [
      { id: '1', name: 'World News', cat: '7',  num: 1, img: '' },
      { id: '2', name: 'Football',   cat: '12', num: 2, img: '' },
      { id: '3', name: 'Headlines',  cat: '7',  num: 3, img: '' },
    ];
    ui.rndSide(cats, chs, []);
    const html = els['grp-nav'].innerHTML;
    expect(html).toContain('data-cat="7"');
    expect(html).toContain('data-cat="12"');
    expect(html).toContain('<span class="cat-label">News</span>');
    expect(html).toContain('<span class="cat-label">Sports</span>');
    expect(html).not.toContain('undefined');
  });

  it('counts channels per normalized category_id', function () {
    const { ui, els } = loadUi();
    const cats = [{ category_id: '7', category_name: 'News' }];
    const chs = [
      { id: '1', name: 'A', cat: '7', num: 1, img: '' },
      { id: '2', name: 'B', cat: '7', num: 2, img: '' },
      { id: '3', name: 'C', cat: '9', num: 3, img: '' },
    ];
    ui.rndSide(cats, chs, []);
    const html = els['grp-nav'].innerHTML;
    expect(html).toContain('data-cat="7"');
    expect(html).toContain('<span class="cat-count">2</span>');
  });

  it('still renders demo-shaped categories { id, name }', function () {
    const { ui, els } = loadUi();
    const cats = [{ id: 'news', name: 'News' }];
    const chs  = [{ id: '1', name: 'World News', cat: 'news', num: 1, img: '' }];
    ui.rndSide(cats, chs, []);
    const html = els['grp-nav'].innerHTML;
    expect(html).toContain('data-cat="news"');
    expect(html).toContain('<span class="cat-label">News</span>');
    expect(html).not.toContain('undefined');
  });
});
