// ADR: ADR-0023
// Unit tests — player no-signal placeholder rendering (rndPlayer) for TASK-0045.
// Drives rndPlayer with the real IptvEmpty.resolveSignal resolver and captures
// the markup written to #player-idle / #player-err. Per R-0001, assertions are
// against the actual rendered markup the renderer produces.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const UI_SRC     = join(__dir, '../../client/ui.js');
const EMPTY_SRC  = join(__dir, '../../client/empty.js');

// ---------------------------------------------------------------------------
// loadUi — load empty.js (real resolver) + ui.js into a synthetic window whose
// document hands rndPlayer capturable #player-idle / #player-card / #player-err
// stubs (and a #player-video / #player-wrap). opts: { phase, cur, err }
// Returns { ui, idle, err, card, wrap, focused, retry }.
// ---------------------------------------------------------------------------
function loadUi(opts) {
  const o    = opts || {};
  const idle = { style: {}, innerHTML: '', addEventListener: function ael() {} };
  const err  = { style: {}, innerHTML: '', addEventListener: function ael() {} };
  const card = { style: {}, classList: { toggle: function tog() {} }, addEventListener: function ael() {} };
  const wrap = { style: {} };
  const vid  = { style: {} };
  const url  = { focus: function focus() { state.focused = true; }, addEventListener: function ael() {} };
  const state = { focused: false, retry: 0 };

  const els = {
    'player-idle':  idle,
    'player-err':   err,
    'player-card':  card,
    'player-wrap':  wrap,
    'player-video': vid,
    'f-url':        url,
  };

  const win = {
    IptvSt: {
      ST: { phase: o.phase || 'READY', cur: o.cur || null, err: o.err || null, chs: [], cats: [], favs: [], flt: 'all', srch: '' },
    },
    IptvSrch: { getChs: function getChs() { return []; } },
    IptvPlay: { goPlay: function goPlay() { state.retry += 1; } },
    document: {
      getElementById: function getEl(id) { return els[id] || null; },
      querySelector:  function qSel() { return null; },
      body: { classList: { add: function add() {}, remove: function rem() {} } },
      addEventListener: function ael() {},
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
  win.IptvUi.mkEL();
  win.IptvUi.rndPlayer();
  return { ui: win.IptvUi, idle, err, card, wrap, state };
}

// ---------------------------------------------------------------------------
// Idle placeholder — connected session (channels loaded, no channel selected)
// ---------------------------------------------------------------------------
describe('rndPlayer — idle, connected session', function () {
  it('keeps the visible "NO SIGNAL" title', function () {
    const ctx = loadUi({ phase: 'READY', cur: null });
    expect(ctx.idle.innerHTML).toContain('NO SIGNAL');
  });

  it('renders the pick-a-channel guidance body', function () {
    const ctx = loadUi({ phase: 'READY', cur: null });
    expect(ctx.idle.innerHTML).toContain('Pick a channel from the grid to start watching.');
  });

  it('renders a decorative aria-hidden icon', function () {
    const ctx = loadUi({ phase: 'READY', cur: null });
    expect(ctx.idle.innerHTML).toContain('aria-hidden="true"');
  });

  it('shows no Connect action when a session exists', function () {
    const ctx = loadUi({ phase: 'READY', cur: null });
    expect(ctx.idle.innerHTML).not.toContain('data-sig-act="connect"');
  });

  it('is the visible overlay (display not none)', function () {
    const ctx = loadUi({ phase: 'READY', cur: null });
    expect(ctx.idle.style.display).not.toBe('none');
  });
});

// ---------------------------------------------------------------------------
// Idle placeholder — no session (INIT)
// ---------------------------------------------------------------------------
describe('rndPlayer — idle, no session (INIT)', function () {
  it('renders the connect-a-source guidance body', function () {
    const ctx = loadUi({ phase: 'INIT', cur: null });
    expect(ctx.idle.innerHTML).toContain('Connect a playlist below to start watching.');
  });

  it('renders a focusable "Connect a source" action button', function () {
    const ctx = loadUi({ phase: 'INIT', cur: null });
    expect(ctx.idle.innerHTML).toContain('data-sig-act="connect"');
    expect(ctx.idle.innerHTML).toContain('Connect a source');
    expect(ctx.idle.innerHTML).toContain('<button type="button"');
  });

  it('keeps the visible "NO SIGNAL" title', function () {
    const ctx = loadUi({ phase: 'INIT', cur: null });
    expect(ctx.idle.innerHTML).toContain('NO SIGNAL');
  });
});

// ---------------------------------------------------------------------------
// Stream-error placeholder — phase ERR with a current channel
// ---------------------------------------------------------------------------
describe('rndPlayer — stream error', function () {
  const CH = { id: '1', name: 'News One', url: '', img: '', cat: '', num: 1 };

  it('shows the constant human-readable headline', function () {
    const ctx = loadUi({ phase: 'ERR', cur: CH, err: 'mediaError' });
    expect(ctx.err.innerHTML).toContain("This channel won't play");
  });

  it('shows the friendly explanation, not the raw token, as the body', function () {
    const ctx = loadUi({ phase: 'ERR', cur: CH, err: 'mediaError' });
    expect(ctx.err.innerHTML).toContain('The stream could not be loaded. It may be offline or temporarily unavailable.');
  });

  it('renders a Retry button carrying data-sig-act="retry"', function () {
    const ctx = loadUi({ phase: 'ERR', cur: CH, err: 'mediaError' });
    expect(ctx.err.innerHTML).toContain('data-sig-act="retry"');
    expect(ctx.err.innerHTML).toContain('>Retry<');
  });

  it('keeps the raw engine token as a dimmed secondary detail line', function () {
    const ctx = loadUi({ phase: 'ERR', cur: CH, err: 'mediaError' });
    expect(ctx.err.innerHTML).toContain('class="sig-detail"');
    expect(ctx.err.innerHTML).toContain('mediaError');
  });

  it('renders a decorative aria-hidden warning icon', function () {
    const ctx = loadUi({ phase: 'ERR', cur: CH, err: 'mediaError' });
    expect(ctx.err.innerHTML).toContain('aria-hidden="true"');
  });

  it('HTML-escapes the raw engine detail', function () {
    const ctx = loadUi({ phase: 'ERR', cur: CH, err: '<img src=x>' });
    expect(ctx.err.innerHTML).toContain('&lt;img src=x&gt;');
    expect(ctx.err.innerHTML).not.toContain('<img src=x>');
  });

  it('shows the error overlay and hides the idle overlay', function () {
    const ctx = loadUi({ phase: 'ERR', cur: CH, err: 'mediaError' });
    expect(ctx.err.style.display).not.toBe('none');
    expect(ctx.idle.style.display).toBe('none');
  });
});
