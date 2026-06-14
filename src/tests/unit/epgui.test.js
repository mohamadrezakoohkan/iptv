// ADR: ADR-0031
// Unit tests — mkCard now/next line on the channel card (TASK-0064,
// specs/epg.md §4). mkCard appends a now/next line ONLY when a guide is loaded
// for the channel (window.IptvEpg.has(ch.id)); the line is guarded so the card
// still renders when the EPG module is absent (test isolation). Titles come
// from getNowNext; a missing now/next part degrades gracefully; the markup is
// byte-identical to the guide-less card when no guide is present.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const UI_SRC     = join(__dir, '../../client/ui.js');
const EMPTY_SRC  = join(__dir, '../../client/empty.js');

/**
 * Load client/ui.js with a synthetic window providing IptvSt.ST and, when an
 * `epg` map is supplied, a minimal window.IptvEpg whose has()/getNowNext()
 * mirror the real selectors' contract (specs/epg.md §2). Omitting `epg` leaves
 * window.IptvEpg undefined — the EPG-module-absent isolation case.
 * opts: { favs, cur, epg } where epg is { [chId]: { now, next } } (programs are
 * { title } or null).
 */
function loadUi(opts) {
  const o    = opts || {};
  const epg  = o.epg || null;
  const win  = {
    IptvSt: {
      ST: { favs: o.favs || [], cur: o.cur || null, chs: [], phase: 'READY', flt: 'all', srch: '', cats: [] },
    },
    IptvSrch: { getChs: function getChs() { return []; } },
    IptvPlay: null,
    document: {
      getElementById: function getEl() { return null; },
      querySelector:  function qSel()  { return null; },
      body: { classList: { add: function add() {}, remove: function rem() {} } },
    },
    clearTimeout: function clearTout() {},
    setTimeout:   function setTout(fn) { return fn; },
  };
  if (epg) {
    win.IptvEpg = {
      has: function has(id) { return Boolean(epg[String(id)]); },
      getNowNext: function getNowNext(id) {
        const e = epg[String(id)];
        return e ? { now: e.now || null, next: e.next || null } : { now: null, next: null };
      },
    };
  }
  const emptySrc = readFileSync(EMPTY_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', '"use strict";\n' + emptySrc)(win);
  const src = readFileSync(UI_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', '"use strict";\n' + src)(win, win.document);
  return win.IptvUi;
}

const CH = { id: '5', name: 'Channel Five', num: 5, img: '', cat: 'news' };

// ---------------------------------------------------------------------------
// mkCard — now/next line present when a guide is loaded
// ---------------------------------------------------------------------------
describe('mkCard — now/next line present when a guide is loaded', function () {
  it('renders a now/next line with NOW + NEXT markers and program titles', function () {
    const ui = loadUi({ epg: { 5: { now: { title: 'Evening News' }, next: { title: 'Late Movie' } } } });
    const html = ui.mkCard(CH);
    expect(html).toContain('class="ch-nn"');
    expect(html).toContain('>NOW<');
    expect(html).toContain('>NEXT<');
    expect(html).toContain('>Evening News<');
    expect(html).toContain('>Late Movie<');
  });

  it('the now title comes from getNowNext().now, the next from .next', function () {
    const ui = loadUi({ epg: { 5: { now: { title: 'Now Show' }, next: { title: 'Next Show' } } } });
    const html = ui.mkCard(CH);
    expect(html).toMatch(/ch-nn-now[\s\S]*Now Show/);
    expect(html).toMatch(/ch-nn-nxt[\s\S]*Next Show/);
  });

  it('escapes program titles (no raw HTML injected from guide data)', function () {
    const ui = loadUi({ epg: { 5: { now: { title: '<b>X</b>' }, next: null } } });
    const html = ui.mkCard(CH);
    expect(html).toContain('&lt;b&gt;X&lt;/b&gt;');
    expect(html).not.toContain('<b>X</b>');
  });

  it('the now/next line is decorative (aria-hidden) — it carries no click target', function () {
    const ui = loadUi({ epg: { 5: { now: { title: 'A' }, next: { title: 'B' } } } });
    const html = ui.mkCard(CH);
    expect(html).toMatch(/<div class="ch-nn" aria-hidden="true">/);
    // The only data-id on the card is the card body itself (the click target).
    expect((html.match(/data-id=/g) || []).length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// mkCard — missing now/next parts degrade gracefully
// ---------------------------------------------------------------------------
describe('mkCard — missing now/next parts degrade gracefully', function () {
  it('omits the NEXT row when next is null (no "null"/"undefined" text)', function () {
    const ui = loadUi({ epg: { 5: { now: { title: 'Only Now' }, next: null } } });
    const html = ui.mkCard(CH);
    expect(html).toContain('>NOW<');
    expect(html).toContain('>Only Now<');
    expect(html).not.toContain('>NEXT<');
    expect(html).not.toContain('null');
    expect(html).not.toContain('undefined');
  });

  it('omits the NOW row when now is null but keeps NEXT', function () {
    const ui = loadUi({ epg: { 5: { now: null, next: { title: 'Coming Up' } } } });
    const html = ui.mkCard(CH);
    expect(html).not.toContain('>NOW<');
    expect(html).toContain('>NEXT<');
    expect(html).toContain('>Coming Up<');
  });

  it('omits the whole line when both now and next are null', function () {
    const ui = loadUi({ epg: { 5: { now: null, next: null } } });
    const html = ui.mkCard(CH);
    expect(html).not.toContain('class="ch-nn"');
  });
});

// ---------------------------------------------------------------------------
// mkCard — guide-less channels are byte-identical to before the now/next line
// ---------------------------------------------------------------------------
describe('mkCard — no now/next line without a loaded guide', function () {
  it('renders no now/next node when the channel has no loaded guide (has()===false)', function () {
    const ui = loadUi({ epg: { 99: { now: { title: 'Other' }, next: null } } });
    const html = ui.mkCard(CH); // ch.id 5 has no guide entry
    expect(html).not.toContain('class="ch-nn"');
  });

  it('renders no now/next node when the EPG module is absent (test isolation)', function () {
    const ui = loadUi({}); // no window.IptvEpg
    const html = ui.mkCard(CH);
    expect(html).not.toContain('class="ch-nn"');
  });

  it('markup is identical whether the EPG module is absent or a guide is empty', function () {
    const noModule = loadUi({}).mkCard(CH);
    const noGuide  = loadUi({ epg: { 99: { now: { title: 'X' }, next: null } } }).mkCard(CH);
    expect(noModule).toBe(noGuide);
  });
});
