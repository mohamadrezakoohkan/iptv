// ADR: ADR-0031
// Unit tests — mkCard now/next line + expandable per-channel schedule on the
// channel card (TASK-0064, TASK-0065, specs/epg.md §4–§5). mkCard appends a
// now/next line AND an expand control + schedule list ONLY when a guide is
// loaded for the channel (window.IptvEpg.has(ch.id)); both are guarded so the
// card still renders when the EPG module is absent (test isolation). Titles
// come from getNowNext; schedule rows from getSched (time range + title +
// optional category, current program marked); a missing now/next part degrades
// gracefully; the markup is byte-identical to the guide-less card when no guide
// is present.

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
 * `epg` map is supplied, a minimal window.IptvEpg whose has()/getNowNext()/
 * getSched() mirror the real selectors' contract (specs/epg.md §2). Omitting
 * `epg` leaves window.IptvEpg undefined — the EPG-module-absent isolation case.
 * opts: { favs, cur, epg } where epg is { [chId]: { now, next, sched } } —
 * `now`/`next` are { title } or null; `sched` is a Prg[] (defaults to []).
 * A channel id is "guided" (has() === true) when present in the map AND its
 * sched is non-empty OR it carries now/next (mirrors the real has(): a
 * non-empty stored list). For schedule tests, supply a non-empty `sched`.
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
      getSched: function getSched(id) {
        const e = epg[String(id)];
        return (e && e.sched) ? e.sched.slice() : [];
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

// ---------------------------------------------------------------------------
// mkCard — expandable schedule: the expand control (TASK-0065, specs/epg.md §5)
// ---------------------------------------------------------------------------

// Build a Prg around a fixed reference time so the "current" marker is
// deterministic. `now` is the reference; `off`/`len` are minutes from `now`.
const REF = 1_700_000_000_000; // fixed unix ms reference for deterministic rows
function mkPrg(opts) {
  const start = REF + opts.off * 60000;
  return {
    chId:  '5',
    title: opts.title,
    start,
    stop:  start + (opts.len || 30) * 60000,
    desc:  '',
    cat:   opts.cat || '',
  };
}

describe('mkCard — expand control present only when a guide is loaded', function () {
  it('renders a focusable <button> expand control with aria-expanded="false" and a label', function () {
    const sched = [mkPrg({ off: -10, title: 'On Air' }), mkPrg({ off: 20, title: 'Up Next' })];
    const ui   = loadUi({ epg: { 5: { now: { title: 'On Air' }, next: { title: 'Up Next' }, sched } } });
    const html = ui.mkCard(CH);
    // R-0001: the baseline expand control is collapsed — aria-expanded is "false"
    // in the source markup (the control toggles it to "true" on activation; the
    // attribute is always present, not added back from nothing).
    expect(html).toMatch(/<button type="button" class="ch-exp" data-exp="5" aria-expanded="false"/);
    expect(html).toContain('aria-label="Show guide for Channel Five"');
  });

  it('the expand control carries data-exp matching the channel id (its toggle hook)', function () {
    const sched = [mkPrg({ off: -10, title: 'On Air' })];
    const ui   = loadUi({ epg: { 5: { now: null, next: null, sched } } });
    const html = ui.mkCard(CH);
    expect(html).toContain('data-exp="5"');
  });

  it('renders no expand control when the channel has no loaded guide (has()===false)', function () {
    const ui   = loadUi({ epg: { 99: { now: null, next: null, sched: [mkPrg({ off: 0, title: 'X' })] } } });
    const html = ui.mkCard(CH); // ch.id 5 has no guide entry
    expect(html).not.toContain('class="ch-exp"');
    expect(html).not.toContain('class="ch-sched"');
  });

  it('renders no expand control when the EPG module is absent (test isolation)', function () {
    const html = loadUi({}).mkCard(CH);
    expect(html).not.toContain('class="ch-exp"');
  });

  it('renders no expand control when the guide schedule is empty (nothing upcoming)', function () {
    const ui   = loadUi({ epg: { 5: { now: { title: 'Past' }, next: null, sched: [] } } });
    const html = ui.mkCard(CH);
    // has() is true (now/next exist) but getSched is empty → no expand affordance.
    expect(html).not.toContain('class="ch-exp"');
    expect(html).not.toContain('class="ch-sched"');
  });
});

// ---------------------------------------------------------------------------
// mkCard — expandable schedule: the schedule rows (TASK-0065, specs/epg.md §5)
// ---------------------------------------------------------------------------
describe('mkCard — schedule rows render time range, title, category', function () {
  it('renders one row per getSched program, hidden via aria-hidden by default', function () {
    const sched = [
      mkPrg({ off: -10, title: 'On Air' }),
      mkPrg({ off: 20, title: 'Up Next' }),
      mkPrg({ off: 50, title: 'Later' }),
    ];
    const ui   = loadUi({ epg: { 5: { now: { title: 'On Air' }, next: { title: 'Up Next' }, sched } } });
    const html = ui.mkCard(CH);
    expect(html).toMatch(/<ul class="ch-sched" aria-hidden="true">/);
    expect((html.match(/class="ch-sched-row/g) || []).length).toBe(3);
    expect(html).toContain('>On Air<');
    expect(html).toContain('>Up Next<');
    expect(html).toContain('>Later<');
  });

  it('each row shows a local-time start–stop range', function () {
    const sched = [mkPrg({ off: -10, title: 'On Air', len: 30 })];
    const ui   = loadUi({ epg: { 5: { now: { title: 'On Air' }, next: null, sched } } });
    const html = ui.mkCard(CH);
    // The range is "<start>–<stop>" inside ch-sched-time; both are clock strings
    // joined by an en dash. We assert the dash + a 2-digit:2-digit clock shape.
    expect(html).toMatch(/class="ch-sched-time">[^<]*\d{1,2}:\d{2}[^<]*–[^<]*\d{1,2}:\d{2}/);
  });

  it('renders the optional category when present and omits it when empty', function () {
    const withCat = [mkPrg({ off: -10, title: 'On Air', cat: 'Sports' })];
    const noCat    = [mkPrg({ off: -10, title: 'On Air', cat: '' })];
    const a = loadUi({ epg: { 5: { now: null, next: null, sched: withCat } } }).mkCard(CH);
    const b = loadUi({ epg: { 5: { now: null, next: null, sched: noCat } } }).mkCard(CH);
    expect(a).toContain('class="ch-sched-cat"');
    expect(a).toContain('>Sports<');
    expect(b).not.toContain('class="ch-sched-cat"');
  });

  it('marks the currently-airing program (start <= now < stop) with ch-sched-cur', function () {
    // Row 0 spans REF-10min..REF+20min (current at REF); row 1 starts at REF+30min.
    const sched = [mkPrg({ off: -10, title: 'On Air', len: 30 }), mkPrg({ off: 30, title: 'Up Next' })];
    const ui   = loadUi({ epg: { 5: { now: { title: 'On Air' }, next: { title: 'Up Next' }, sched } } });
    // Pin Date.now to REF so the "current" computation is deterministic.
    const realNow = Date.now;
    Date.now = function fixedNow() { return REF; };
    try {
      const html = ui.mkCard(CH);
      // Exactly one current marker, and it wraps the On Air row, not Up Next.
      expect((html.match(/ch-sched-cur/g) || []).length).toBe(1);
      // The current marker is on the On Air row's <li> (no other tag opens
      // between the marker class and the On Air title).
      expect(html).toMatch(/ch-sched-row ch-sched-cur"[^]*?On Air/);
      // The Up Next row's <li> opens without the cur marker class.
      expect(html).toMatch(/<li class="ch-sched-row">[^]*?Up Next/);
    } finally {
      Date.now = realNow;
    }
  });

  it('escapes schedule program titles and categories (no raw HTML from guide data)', function () {
    const sched = [mkPrg({ off: -10, title: '<i>Hax</i>', cat: '<b>C</b>' })];
    const ui   = loadUi({ epg: { 5: { now: null, next: null, sched } } });
    const html = ui.mkCard(CH);
    expect(html).toContain('&lt;i&gt;Hax&lt;/i&gt;');
    expect(html).toContain('&lt;b&gt;C&lt;/b&gt;');
    expect(html).not.toContain('<i>Hax</i>');
  });

  it('escapes the channel name in the expand control accessible label', function () {
    const ch    = { id: '5', name: 'A & B "X"', num: 5, img: '', cat: 'news' };
    const sched = [mkPrg({ off: -10, title: 'On Air' })];
    const ui   = loadUi({ epg: { 5: { now: null, next: null, sched } } });
    const html = ui.mkCard(ch);
    expect(html).toContain('aria-label="Show guide for A &amp; B &quot;X&quot;"');
  });

  it('the only data-id on the card stays the card body (expand control is data-exp, not a play target)', function () {
    const sched = [mkPrg({ off: -10, title: 'On Air' })];
    const ui   = loadUi({ epg: { 5: { now: null, next: null, sched } } });
    const html = ui.mkCard(CH);
    expect((html.match(/data-id=/g) || []).length).toBe(1);
    expect((html.match(/data-exp=/g) || []).length).toBe(1);
  });
});
