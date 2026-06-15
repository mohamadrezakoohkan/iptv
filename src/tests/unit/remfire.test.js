// ADR: ADR-0034
// Unit tests — the reminder firing surface (TASK-0069, specs/reminders.md §5–§6,
// §8, ADR-0034). fireRem builds + shows the in-app toast from a Rem and fires a
// best-effort, permission-gated browser Notification; the toast Watch/Jump action
// routes to the EXISTING select+play path (setCur + saveSt('sel') + go('PLAY')
// when READY) and is a silent no-op for an unknown channel; the Notification is
// created ONLY when window.Notification exists with permission === 'granted' and
// is skipped (no throw) when absent / 'denied'; and the first-reminder permission
// request fires once, ONLY via the toggle gesture (toggleRem set branch), never on
// load.
//
// R-0001: the toast markup is built fresh (no baseline source HTML to mutate);
// the only attribute assertions are on attributes the firing code writes onto the
// toast it constructs (data-watch, aria-label) — never an attribute claimed added
// back to a source element that never carried it.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const UI_SRC     = join(__dir, '../../client/ui.js');
const EMPTY_SRC  = join(__dir, '../../client/empty.js');

const REF = 1_700_000_000_000;

// ---------------------------------------------------------------------------
// Minimal fake DOM — enough for the toast surface: createElement, appendChild /
// removeChild, innerHTML (captured verbatim), className, addEventListener, and
// closest/querySelector used by the delegated click handler in tests.
// ---------------------------------------------------------------------------
function mkEl(tag) {
  const el = {
    tag,
    className: '',
    innerHTML: '',
    parentNode: null,
    children: [],
    listeners: {},
    attrs: {},
    appendChild: function appendChild(c) { c.parentNode = el; el.children.push(c); return c; },
    removeChild: function removeChild(c) {
      const i = el.children.indexOf(c);
      if (i !== -1) el.children.splice(i, 1);
      c.parentNode = null;
      return c;
    },
    addEventListener: function addEventListener(t, fn) { el.listeners[t] = fn; },
    getAttribute: function getAttribute(k) { return el.attrs[k]; },
    setAttribute: function setAttribute(k, v) { el.attrs[k] = v; },
  };
  return el;
}

// Pin Date.now to REF for a body.
function atRef(fn) {
  const real = Date.now;
  Date.now = function fixedNow() { return REF; };
  try { return fn(); } finally { Date.now = real; }
}

// ---------------------------------------------------------------------------
// loadUi — load client/ui.js with a synthetic window + minimal fake DOM. opts:
//  - chs:   ST.chs for goRemWatch resolution,
//  - phase: ST.phase (default 'READY'),
//  - note:  Notification mock spec { permission, perm: requestPermission return }
//           — when omitted, window.Notification is absent.
// Captures: store mutations (setCur/saveSt/go/loadPlay), the Notification
// constructor calls, and the requestPermission calls.
// ---------------------------------------------------------------------------
function loadUi(opts) {
  const o = opts || {};
  const calls = { cur: [], saved: [], went: [], played: [], notes: [], asked: 0, goneReady: o.phase || 'READY' };
  const toasts = mkEl('div');
  toasts.id = 'rem-toasts';
  const doc = {
    getElementById: function getEl(id) { return id === 'rem-toasts' ? toasts : null; },
    createElement: mkEl,
    querySelector: function qSel() { return null; },
    addEventListener: function addEl() {},
    body: { classList: { add: function add() {}, remove: function rem() {} } },
  };
  const win = {
    IptvSt: {
      ST: { chs: o.chs || [], cur: null, favs: [], phase: o.phase || 'READY', flt: 'all', srch: '', cats: [] },
      setCur: function setCur(ch) { win.IptvSt.ST.cur = ch; calls.cur.push(ch); },
      saveSt: function saveSt(f) { calls.saved.push(f); },
      go: function go(p) { win.IptvSt.ST.phase = p; calls.went.push(p); },
    },
    IptvSrch: { getChs: function getChs() { return []; } },
    IptvPlay: { loadPlay: function loadPlay(u) { calls.played.push(u); } },
    IptvRem: {
      has: function has() { return false; },
      toggle: function toggle() { return true; },
    },
    S: { toastMs: 8000 },
    document: doc,
    clearTimeout: function clearTout() {},
    setTimeout: function setTout(fn) { calls.autoDismiss = fn; return 1; },
  };
  if (o.note) {
    const N = function Note(title, body) { calls.notes.push({ title, body }); };
    N.permission = o.note.permission;
    N.requestPermission = function requestPermission() {
      calls.asked += 1;
      return o.note.perm === undefined ? undefined : Promise.resolve(o.note.perm);
    };
    win.Notification = N;
  }
  const emptySrc = readFileSync(EMPTY_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', '"use strict";\n' + emptySrc)(win);
  const src = readFileSync(UI_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', '"use strict";\n' + src)(win, win.document);
  win.IptvUi.mkEL();
  return { ui: win.IptvUi, win, calls, toasts };
}

const REM = { chId: '5', start: REF, title: 'Evening News' };
const CH5 = { id: '5', name: 'Channel Five', num: 5, url: 'http://example/5.m3u8', img: '', cat: 'news' };

// ---------------------------------------------------------------------------
// fireRem — builds + shows the toast
// ---------------------------------------------------------------------------
describe('fireRem — in-app toast from a Rem', function () {
  it('appends a toast carrying the program copy, local start time, Watch action, and dismiss', function () {
    atRef(function () {
      const env  = loadUi({ chs: [CH5] });
      const el   = env.ui.fireRem(REM);
      expect(env.toasts.children).toContain(el);
      expect(el.className).toBe('rem-toast');
      expect(el.innerHTML).toContain('Evening News');
      expect(el.innerHTML).toContain('data-watch="5"');
      expect(el.innerHTML).toContain('rem-toast-watch');
      expect(el.innerHTML).toContain('rem-toast-close');
      // Local start time is rendered via fmtPrgTime (non-empty for a valid stamp).
      expect(el.innerHTML).toContain('rem-toast-time');
    });
  });

  it('escapes the program title in the toast (guide data)', function () {
    atRef(function () {
      const env = loadUi({ chs: [CH5] });
      const el  = env.ui.fireRem({ chId: '5', start: REF, title: '<b>Hax</b>' });
      expect(el.innerHTML).toContain('&lt;b&gt;Hax&lt;/b&gt;');
      expect(el.innerHTML).not.toContain('<b>Hax</b>');
    });
  });

  it('arms an auto-dismiss timeout that removes the toast', function () {
    vi.useFakeTimers();
    try {
      const real = Date.now;
      Date.now = function fixedNow() { return REF; };
      const env = loadUi({ chs: [CH5] });
      const el  = env.ui.fireRem(REM);
      expect(env.toasts.children).toContain(el);
      // The toast auto-dismisses after S.toastMs (bare setTimeout, faked here).
      vi.advanceTimersByTime(8000);
      expect(env.toasts.children).not.toContain(el);
      Date.now = real;
    } finally {
      vi.useRealTimers();
    }
  });

  it('is a silent no-op (returns null, never throws) for a null/absent reminder', function () {
    atRef(function () {
      const env = loadUi({ chs: [CH5] });
      expect(env.ui.fireRem(null)).toBe(null);
      expect(env.toasts.children.length).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// goRemWatch — the Watch/Jump action reuses the select+play path
// ---------------------------------------------------------------------------
describe('goRemWatch — reuses the existing select+play path', function () {
  it('resolves the Ch and runs setCur + saveSt("sel") + go("PLAY") when READY, then loadPlay', function () {
    atRef(function () {
      const env = loadUi({ chs: [CH5], phase: 'READY' });
      env.ui.goRemWatch('5');
      expect(env.calls.cur).toEqual([CH5]);
      expect(env.calls.saved).toEqual(['sel']);
      expect(env.calls.went).toEqual(['PLAY']);
      expect(env.calls.played).toEqual(['http://example/5.m3u8']);
    });
  });

  it('does NOT transition to PLAY when phase is not READY (e.g. already PLAY)', function () {
    atRef(function () {
      const env = loadUi({ chs: [CH5], phase: 'PLAY' });
      env.ui.goRemWatch('5');
      expect(env.calls.cur).toEqual([CH5]);
      expect(env.calls.went).toEqual([]); // no go('PLAY') from PLAY
      expect(env.calls.played).toEqual(['http://example/5.m3u8']);
    });
  });

  it('is a silent no-op for an unknown channel (no longer loaded)', function () {
    atRef(function () {
      const env = loadUi({ chs: [CH5] });
      env.ui.goRemWatch('999');
      expect(env.calls.cur).toEqual([]);
      expect(env.calls.went).toEqual([]);
      expect(env.calls.played).toEqual([]);
    });
  });

  it('the toast Watch button click jumps then dismisses the toast', function () {
    atRef(function () {
      const env  = loadUi({ chs: [CH5] });
      const el   = env.ui.fireRem(REM);
      // Synthetic delegated event: target.closest resolves the watch button and
      // the owning toast (mirrors how onToastClick reads the DOM).
      const evt = { target: { closest: function closest(sel) {
        if (sel === '.rem-toast') return el;
        if (sel === '[data-watch]') return { getAttribute: function g() { return '5'; } };
        if (sel === '.rem-toast-close') return null;
        return null;
      } } };
      env.toasts.listeners.click(evt);
      expect(env.calls.cur).toEqual([CH5]);
      expect(env.toasts.children).not.toContain(el);
    });
  });

  it('the toast close button click dismisses the toast without jumping', function () {
    atRef(function () {
      const env = loadUi({ chs: [CH5] });
      const el  = env.ui.fireRem(REM);
      const closeEl = {};
      const evt = { target: { closest: function closest(sel) {
        if (sel === '.rem-toast') return el;
        if (sel === '[data-watch]') return null;
        if (sel === '.rem-toast-close') return closeEl;
        return null;
      } } };
      env.toasts.listeners.click(evt);
      expect(env.calls.cur).toEqual([]); // no jump
      expect(env.toasts.children).not.toContain(el); // dismissed
    });
  });
});

// ---------------------------------------------------------------------------
// fireNote — the best-effort, permission-gated browser Notification
// ---------------------------------------------------------------------------
describe('fireRem — best-effort permission-gated Notification', function () {
  it('creates a Notification ONLY when window.Notification exists and permission === "granted"', function () {
    atRef(function () {
      const env = loadUi({ chs: [CH5], note: { permission: 'granted' } });
      env.ui.fireRem(REM);
      expect(env.calls.notes.length).toBe(1);
      expect(env.calls.notes[0].title).toBe('Evening News');
    });
  });

  it('skips the Notification (no throw) when permission === "denied" — the toast still fires', function () {
    atRef(function () {
      const env = loadUi({ chs: [CH5], note: { permission: 'denied' } });
      const el  = env.ui.fireRem(REM);
      expect(env.calls.notes.length).toBe(0);
      expect(env.toasts.children).toContain(el); // toast still shown
    });
  });

  it('skips the Notification (no throw) when window.Notification is absent — the toast still fires', function () {
    atRef(function () {
      const env = loadUi({ chs: [CH5] }); // no note
      const el  = env.ui.fireRem(REM);
      expect(env.calls.notes.length).toBe(0);
      expect(env.toasts.children).toContain(el);
    });
  });

  it('does NOT create a Notification when permission is the default "default" state', function () {
    atRef(function () {
      const env = loadUi({ chs: [CH5], note: { permission: 'default', perm: 'granted' } });
      env.ui.fireRem(REM);
      expect(env.calls.notes.length).toBe(0); // firing never requests; granted-only
    });
  });
});

// ---------------------------------------------------------------------------
// askRemPerm — the first-reminder permission request, gated to the toggle gesture
// ---------------------------------------------------------------------------
describe('first-reminder permission request — gated to the toggle gesture, never on load', function () {
  it('requests permission once when a reminder is SET and permission is still "default"', function () {
    atRef(function () {
      const env = loadUi({ chs: [CH5], note: { permission: 'default', perm: 'granted' } });
      // toggleRem set branch — model IptvRem.toggle returning true (set) and a
      // resolvable program. The button + IptvEpg path is exercised in remui.test
      // already; here we drive the public toggleRem to confirm it asks once.
      env.win.IptvEpg = {
        getSched: function getSched() { return [{ chId: '5', title: 'Up Next', start: REF + 60000, stop: REF + 120000 }]; },
      };
      const btn = {
        getAttribute: function getAttribute(k) { return k === 'data-rem' ? '5|' + (REF + 60000) : null; },
        setAttribute: function setAttribute() {},
        classList: { toggle: function toggle() {} },
      };
      env.ui.toggleRem(btn);
      expect(env.calls.asked).toBe(1);
    });
  });

  it('does NOT request permission when the toggle CLEARS a reminder (toggle returns false)', function () {
    atRef(function () {
      const env = loadUi({ chs: [CH5], note: { permission: 'default', perm: 'granted' } });
      env.win.IptvRem.toggle = function toggle() { return false; }; // clearing
      env.win.IptvEpg = {
        getSched: function getSched() { return [{ chId: '5', title: 'Up Next', start: REF + 60000, stop: REF + 120000 }]; },
      };
      const btn = {
        getAttribute: function getAttribute(k) { return k === 'data-rem' ? '5|' + (REF + 60000) : null; },
        setAttribute: function setAttribute() {},
        classList: { toggle: function toggle() {} },
      };
      env.ui.toggleRem(btn);
      expect(env.calls.asked).toBe(0);
    });
  });

  it('does NOT request permission when it is already granted/denied (not "default")', function () {
    atRef(function () {
      const env = loadUi({ chs: [CH5], note: { permission: 'granted' } });
      env.win.IptvEpg = {
        getSched: function getSched() { return [{ chId: '5', title: 'Up Next', start: REF + 60000, stop: REF + 120000 }]; },
      };
      const btn = {
        getAttribute: function getAttribute(k) { return k === 'data-rem' ? '5|' + (REF + 60000) : null; },
        setAttribute: function setAttribute() {},
        classList: { toggle: function toggle() {} },
      };
      env.ui.toggleRem(btn);
      expect(env.calls.asked).toBe(0);
    });
  });

  it('never requests permission merely on load (mkEL ran in loadUi; asked stays 0)', function () {
    atRef(function () {
      const env = loadUi({ chs: [CH5], note: { permission: 'default', perm: 'granted' } });
      // loadUi already ran mkEL() — the only path that could auto-request. None did.
      expect(env.calls.asked).toBe(0);
    });
  });
});
