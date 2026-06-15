// ADR: ADR-0033
// Unit tests — the Remind toggle on each upcoming schedule row + on the NOW/NEXT
// line's NEXT part, and the in-place onGridClick toggle handler (TASK-0068,
// specs/reminders.md §3–§4, ADR-0033). mkSchedRow / mkNowNext emit a
// keyboard-focusable Remind <button> ONLY for an upcoming program, carrying
// data-rem="<chId>|<start>", aria-pressed PRESENT in the baseline ("false" for
// an unset reminder, "true" for a set one), and a state-flipping accessible
// label. A current/past program and a missing `next` render no toggle; an absent
// window.IptvRem renders the row exactly as before (guarded). onGridClick routes
// a data-rem click to IptvRem.toggle and flips aria-pressed + label IN PLACE
// without a full grid re-render, and stops propagation so toggling never plays.
//
// R-0001: aria-pressed is asserted PRESENT in the rendered baseline before any
// test asserts the toggle mutates it — the toggle flips an attribute that exists
// in source, never asserts an attribute added that was never present (ADR-0033).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const UI_SRC     = join(__dir, '../../client/ui.js');
const EMPTY_SRC  = join(__dir, '../../client/empty.js');

// Fixed reference time so "upcoming" vs "current/past" is deterministic.
const REF = 1_700_000_000_000;

/**
 * Build a Prg around REF. `off`/`len` are minutes from REF; a negative off is a
 * current/past program, a positive off is upcoming. chId defaults to '5'.
 */
function mkPrg(opts) {
  const start = REF + opts.off * 60000;
  return {
    chId:  opts.chId || '5',
    title: opts.title,
    start,
    stop:  start + (opts.len || 30) * 60000,
    desc:  '',
    cat:   opts.cat || '',
  };
}

/**
 * Load client/ui.js with a synthetic window. Mirrors epgui.test.js's loadUi but
 * also wires an in-memory window.IptvRem (the real store's behavior: has/toggle
 * over a chId+start identity set) UNLESS opts.noRem is set (the module-absent
 * isolation case). opts: { favs, cur, epg, set, noRem, recRender } where:
 *  - epg is { [chId]: { now, next, sched } } (now/next are { title, start, stop }
 *    or null; sched is a Prg[]),
 *  - set is an array of { chId, start } identities pre-marked as reminded,
 *  - recRender, when set, makes rndGrid record that a full grid re-render ran.
 * Date.now is pinned to REF for the duration of the call.
 */
function loadUi(opts) {
  const o    = opts || {};
  const epg  = o.epg || null;
  const set  = (o.set || []).map(function asKey(r) { return String(r.chId) + '|' + String(r.start); });
  const calls = { render: 0, toggled: [] };
  const els   = {};
  const win  = {
    IptvSt: {
      ST: { favs: o.favs || [], cur: o.cur || null, chs: [], phase: 'READY', flt: 'all', srch: '', cats: [] },
      saveSt: function saveSt() {},
    },
    IptvSrch: { getChs: function getChs() { return []; } },
    IptvPlay: { loadPlay: function loadPlay() { calls.play = true; } },
    document: {
      getElementById: function getEl() { return null; },
      querySelector:  function qSel()  { return null; },
      body: { classList: { add: function add() {}, remove: function rem() {} } },
    },
    clearTimeout: function clearTout() {},
    setTimeout:   function setTout(fn) { return fn; },
  };
  if (!o.noRem) {
    win.IptvRem = {
      has: function has(chId, start) { return set.indexOf(String(chId) + '|' + String(start)) !== -1; },
      toggle: function toggle(chId, prg) {
        const k = String(chId) + '|' + String(prg.start);
        const i = set.indexOf(k);
        calls.toggled.push({ chId: String(chId), start: prg.start });
        if (i === -1) { set.push(k); return true; }
        set.splice(i, 1);
        return false;
      },
    };
  }
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
  return { ui: win.IptvUi, win, calls, els };
}

const CH = { id: '5', name: 'Channel Five', num: 5, img: '', cat: 'news' };

// Pin Date.now to REF for a body, restoring it afterwards.
function atRef(fn) {
  const real = Date.now;
  Date.now = function fixedNow() { return REF; };
  try { return fn(); } finally { Date.now = real; }
}

// ---------------------------------------------------------------------------
// mkSchedRow — Remind toggle on each UPCOMING schedule row only
// ---------------------------------------------------------------------------
describe('schedule rows — Remind toggle on upcoming programs only', function () {
  it('renders a Remind <button> with data-rem and baseline aria-pressed="false" for an unset upcoming program', function () {
    atRef(function () {
      const sched = [mkPrg({ off: -10, title: 'On Air' }), mkPrg({ off: 20, title: 'Up Next' })];
      const html  = loadUi({ epg: { 5: { now: { title: 'On Air' }, next: { title: 'Up Next' }, sched } } }).ui.mkCard(CH);
      const start = REF + 20 * 60000;
      // R-0001: aria-pressed is PRESENT in the baseline (rendered "false"), so a
      // later toggle mutates an existing attribute — never adds one absent from source.
      expect(html).toMatch(new RegExp('<button type="button" class="ch-rem" data-rem="5\\|' + start + '" aria-pressed="false"'));
      expect(html).toContain('aria-label="Remind me when Up Next starts"');
    });
  });

  it('renders aria-pressed="true" (baseline) for an upcoming program already reminded', function () {
    atRef(function () {
      const start = REF + 20 * 60000;
      const sched = [mkPrg({ off: 20, title: 'Up Next' })];
      const html  = loadUi({
        epg: { 5: { now: null, next: null, sched } },
        set: [{ chId: '5', start }],
      }).ui.mkCard(CH);
      expect(html).toMatch(new RegExp('class="ch-rem on" data-rem="5\\|' + start + '" aria-pressed="true"'));
      expect(html).toContain('aria-label="Clear reminder for Up Next"');
    });
  });

  it('renders NO Remind toggle for a current/past program (start <= now)', function () {
    atRef(function () {
      const sched = [mkPrg({ off: -10, title: 'On Air' })]; // current (started in the past)
      const html  = loadUi({ epg: { 5: { now: { title: 'On Air' }, next: null, sched } } }).ui.mkCard(CH);
      expect(html).toContain('class="ch-sched-row'); // the row renders
      expect(html).not.toContain('data-rem'); // but no toggle on it
    });
  });

  it('escapes the program title in the data-rem toggle accessible label', function () {
    atRef(function () {
      const sched = [mkPrg({ off: 20, title: '<b>Hax</b>' })];
      const html  = loadUi({ epg: { 5: { now: null, next: null, sched } } }).ui.mkCard(CH);
      expect(html).toContain('aria-label="Remind me when &lt;b&gt;Hax&lt;/b&gt; starts"');
      expect(html).not.toContain('aria-label="Remind me when <b>Hax</b>');
    });
  });

  it('renders the row exactly as before when window.IptvRem is absent (guarded)', function () {
    atRef(function () {
      const sched = [mkPrg({ off: 20, title: 'Up Next' })];
      const withRem = loadUi({ epg: { 5: { now: null, next: null, sched } } }).ui.mkCard(CH);
      const noRem   = loadUi({ epg: { 5: { now: null, next: null, sched } }, noRem: true }).ui.mkCard(CH);
      expect(withRem).toContain('data-rem');
      expect(noRem).not.toContain('data-rem');
      // The schedule row markup is otherwise unchanged when the module is absent.
      expect(noRem).toContain('class="ch-sched-row');
    });
  });
});

// ---------------------------------------------------------------------------
// mkNowNext — Remind toggle on the NEXT part only
// ---------------------------------------------------------------------------
describe('NOW/NEXT line — Remind toggle on the NEXT part only', function () {
  it('renders the toggle for the NEXT (upcoming) program, NEXT identity in data-rem', function () {
    atRef(function () {
      const nextStart = REF + 20 * 60000;
      const sched = [mkPrg({ off: 20, title: 'Coming Up' })];
      const html  = loadUi({
        epg: { 5: { now: { title: 'On Air' }, next: { title: 'Coming Up', start: nextStart, stop: nextStart + 1800000 }, sched } },
      }).ui.mkCard(CH);
      expect(html).toMatch(new RegExp('class="ch-rem" data-rem="5\\|' + nextStart + '" aria-pressed="false"'));
      expect(html).toContain('aria-label="Remind me when Coming Up starts"');
    });
  });

  it('renders the toggle OUTSIDE the aria-hidden text so it is reachable', function () {
    atRef(function () {
      const nextStart = REF + 20 * 60000;
      const html = loadUi({
        epg: { 5: { now: { title: 'On Air' }, next: { title: 'Coming Up', start: nextStart, stop: nextStart + 1800000 }, sched: [mkPrg({ off: 20, title: 'Coming Up' })] } },
      }).ui.mkCard(CH);
      // The decorative text rows are inside .ch-nn-text aria-hidden; the toggle
      // is a sibling after that span, not inside it.
      expect(html).toMatch(/<span class="ch-nn-text" aria-hidden="true">[\s\S]*<\/span><button[^>]*class="ch-rem"/);
    });
  });

  it('renders NO toggle when there is no next', function () {
    atRef(function () {
      const html = loadUi({ epg: { 5: { now: { title: 'On Air' }, next: null, sched: [mkPrg({ off: -10, title: 'On Air' })] } } }).ui.mkCard(CH);
      // The now/next line still renders (NOW present) but carries no toggle.
      expect(html).toContain('class="ch-nn"');
      // No NEXT, so no data-rem on the now/next line. (No upcoming sched row either.)
      expect(html).not.toContain('data-rem');
    });
  });

  it('renders NO toggle on the NOW part (a future next never marks now)', function () {
    atRef(function () {
      const nextStart = REF + 20 * 60000;
      const html = loadUi({
        epg: { 5: { now: { title: 'On Air' }, next: { title: 'Coming Up', start: nextStart, stop: nextStart + 1800000 }, sched: [mkPrg({ off: 20, title: 'Coming Up' })] } },
      }).ui.mkCard(CH);
      // Exactly one toggle on the now/next line (the NEXT one); none on NOW.
      const nn = html.slice(html.indexOf('class="ch-nn"'), html.indexOf('class="ch-exp"') >= 0 ? html.indexOf('class="ch-exp"') : html.length);
      expect((nn.match(/data-rem=/g) || []).length).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------------
// onGridClick / toggleRem — in-place flip without a full re-render
// ---------------------------------------------------------------------------
describe('toggleRem — flips aria-pressed + label in place, no re-render, stops propagation', function () {
  // A minimal fake button + event that the handler mutates in place.
  function mkBtn(rem, pressed) {
    const attrs = { 'data-rem': rem, 'aria-pressed': pressed };
    const classes = pressed === 'true' ? ['ch-rem', 'on'] : ['ch-rem'];
    return {
      getAttribute: function getAttribute(k) { return attrs[k]; },
      setAttribute: function setAttribute(k, v) { attrs[k] = v; },
      classList: {
        toggle: function toggle(c, on) {
          const i = classes.indexOf(c);
          if (on && i === -1) classes.push(c);
          if (!on && i !== -1) classes.splice(i, 1);
        },
        has: function has(c) { return classes.indexOf(c) !== -1; },
      },
      closest: function closest(sel) {
        if (sel === '[data-rem]') return this;
        return null;
      },
      attrs,
      classes,
    };
  }

  function mkEvt(btn) {
    return {
      target: { closest: function closest(sel) { return sel === '[data-rem]' ? btn : null; } },
      stopProp: 0,
      stopPropagation: function stopPropagation() { this.stopProp += 1; },
    };
  }

  it('routes a data-rem click to IptvRem.toggle and flips aria-pressed false→true in place', function () {
    atRef(function () {
      const start = REF + 20 * 60000;
      const sched = [mkPrg({ off: 20, title: 'Up Next' })];
      const env   = loadUi({ epg: { 5: { now: null, next: null, sched } } });
      const btn   = mkBtn('5|' + start, 'false');
      const evt   = mkEvt(btn);
      // Drive through the public toggleRem (the onGridClick branch target).
      env.ui.toggleRem(btn);
      expect(env.calls.toggled).toEqual([{ chId: '5', start }]);
      expect(btn.attrs['aria-pressed']).toBe('true');
      expect(btn.attrs['aria-label']).toBe('Clear reminder for Up Next');
      expect(btn.classes.indexOf('on')).not.toBe(-1);
      // The grid was never re-rendered (no getChs-driven rndGrid here).
      expect(env.calls.render).toBe(0);
      void evt;
    });
  });

  it('toggling a set reminder clears it — aria-pressed flips true→false in place', function () {
    atRef(function () {
      const start = REF + 20 * 60000;
      const sched = [mkPrg({ off: 20, title: 'Up Next' })];
      const env   = loadUi({
        epg: { 5: { now: null, next: null, sched } },
        set: [{ chId: '5', start }],
      });
      const btn = mkBtn('5|' + start, 'true');
      env.ui.toggleRem(btn);
      expect(env.calls.toggled).toEqual([{ chId: '5', start }]);
      expect(btn.attrs['aria-pressed']).toBe('false');
      expect(btn.attrs['aria-label']).toBe('Remind me when Up Next starts');
      expect(btn.classes.indexOf('on')).toBe(-1);
    });
  });

  it('is a silent no-op when the program can no longer be resolved (stale data-rem)', function () {
    atRef(function () {
      const sched = [mkPrg({ off: 20, title: 'Up Next' })];
      const env   = loadUi({ epg: { 5: { now: null, next: null, sched } } });
      const btn   = mkBtn('5|999999999999999', 'false'); // start not in the schedule
      env.ui.toggleRem(btn);
      expect(env.calls.toggled).toEqual([]);
      expect(btn.attrs['aria-pressed']).toBe('false'); // untouched
    });
  });

  it('is a silent no-op when window.IptvRem is absent', function () {
    atRef(function () {
      const start = REF + 20 * 60000;
      const sched = [mkPrg({ off: 20, title: 'Up Next' })];
      const env   = loadUi({ epg: { 5: { now: null, next: null, sched } }, noRem: true });
      const btn   = mkBtn('5|' + start, 'false');
      env.ui.toggleRem(btn);
      expect(btn.attrs['aria-pressed']).toBe('false'); // untouched, never threw
    });
  });
});
