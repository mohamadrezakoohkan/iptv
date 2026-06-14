// ADR: ADR-0028
// Unit tests — playback failure-log button + slide-in panel shell (TASK-0058):
// mkEL resolves the new EL entries (lbtn, lcnt, lpnl, lscr, lcls, lclr, llst)
// and wires their listeners; onLogBtn toggles is-open on #log-panel + #log-scrim
// and flips #log-btn aria-expanded; onLogClose and Escape close it; opening the
// log panel leaves the account panel untouched (independent toggles, ADR-0028).
//
// TASK-0059 (below the shell blocks): rndLog renders the badge count/visibility
// + accessible name and the panel's entry rows newest-first / empty-state from
// a stubbed window.IptvErrLog with all entry text HTML-escaped; onLogClear
// empties the log and re-renders to the empty state; and the capture→rndLog
// wiring (play.js onEngErr → window.IptvUi.rndLog) is asserted against the real
// play.js + errlog.js + ui.js executed in one window.
//
// Per R-0001: the baseline markup ships aria-expanded="false" on #log-btn and
// aria-hidden="true" on #log-panel (index.html), so asserting those attributes
// toggle between "true"/"false" matches the source HTML — no attribute is
// asserted that the baseline does not declare. The badge's is-empty class and
// the button's aria-label are written by rndLog itself (the source markup ships
// #log-count with the is-empty class — index.html line 67 — which rndLog keeps
// at zero), so these assertions are of rendered output, not invented baseline.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const UI_SRC     = join(__dir, '../../client/ui.js');

// ---------------------------------------------------------------------------
// mkClassList — minimal classList with real is-open state tracking
// ---------------------------------------------------------------------------
function mkClassList() {
  const set = new Set();
  return {
    add:      function add(c)    { set.add(c); },
    remove:   function remove(c) { set.delete(c); },
    contains: function has(c)    { return set.has(c); },
    toggle:   function toggle(c, on) {
      const want = on === undefined ? !set.has(c) : on;
      if (want) { set.add(c); } else { set.delete(c); }
      return want;
    },
  };
}

// ---------------------------------------------------------------------------
// mkEl — DOM element stub with attribute + class state and listener capture
// ---------------------------------------------------------------------------
function mkEl(id, attrs) {
  const a = Object.assign({}, attrs);
  return {
    _id:          id,
    style:        { display: '' },
    classList:    mkClassList(),
    dataset:      {},
    disabled:     false,
    hidden:       false,
    textContent:  '',
    value:        '',
    innerHTML:    '',
    _listeners:   {},
    setAttribute: function setAttr(k, v) { a[k] = v; },
    getAttribute: function getAttr(k)    { return Object.prototype.hasOwnProperty.call(a, k) ? a[k] : null; },
    addEventListener: function addL(type, fn) { this._listeners[type] = fn; },
  };
}

// ---------------------------------------------------------------------------
// mkErrLog — a stubbed window.IptvErrLog backed by an in-memory entry array,
// matching the real errlog.js read API (list() newest-first, count(), clear()).
// `entries` is supplied newest-LAST (insertion order), so list() reverses it,
// exactly like the real store.
// ---------------------------------------------------------------------------
function mkErrLog(entries) {
  let store = (entries || []).slice();
  return {
    list:  function list()  { return store.slice().reverse(); },
    count: function count() { return store.length; },
    clear: vi.fn(function clear() { store = []; }),
  };
}

// ---------------------------------------------------------------------------
// loadUi — execute client/ui.js with a synthetic window providing the log
// panel DOM elements (plus the account panel, since the shared keydown handler
// reads both). Baseline attrs mirror index.html exactly (R-0001).
// ---------------------------------------------------------------------------
function loadUi(errlog) {
  const elMap = {};
  const ids = [
    'ch-list', 'player-video', 'search', 'now-info', 'player-err',
    'grp-nav', 'footer', 'player-card', 'player-idle', 'player-wrap',
    'f-url', 'f-user', 'f-pass', 'footer-conn', 'footer-login',
    'footer-hint', 'footer-err', 'btn-conn', 'btn-disc', 'conn-text',
    'login-form', 'fmt-chip', 'fmt-detail',
    'acct-scrim', 'acct-close', 'acct-add', 'acct-list', 'acct-conn',
    'log-count', 'log-scrim', 'log-close', 'log-clear', 'log-list',
  ];
  for (let i = 0; i < ids.length; i += 1) {
    elMap[ids[i]] = mkEl(ids[i]);
  }
  // baseline attributes exactly as shipped in index.html
  elMap['acct-btn']   = mkEl('acct-btn', { 'aria-expanded': 'false' });
  elMap['acct-panel'] = mkEl('acct-panel', { 'aria-hidden': 'true' });
  elMap['log-btn']    = mkEl('log-btn', { 'aria-expanded': 'false' });
  elMap['log-panel']  = mkEl('log-panel', { 'aria-hidden': 'true' });

  const docListeners = {};
  const win = {
    IptvSt:   { ST: { phase: 'INIT' } },
    IptvSrch: { getChs: function getChs() { return []; } },
    IptvEmpty: { resolveContent: function resolveContent() { return { icon: 'list', title: 'No channels', body: '' }; } },
    S: {},
    IptvApi:  { connect: vi.fn() },
    IptvErrLog: errlog || undefined,
    IptvPlay: null,
    document: {
      getElementById: function getEl(id) { return elMap[id] || null; },
      querySelector:  function qSel()    { return null; },
      addEventListener: function addL(type, fn) { docListeners[type] = fn; },
      body: { classList: mkClassList() },
    },
    clearTimeout: function cTout() {},
    setTimeout:   function sTout(fn) { return fn; },
  };

  const src = readFileSync(UI_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', '"use strict";\n' + src)(win, win.document);
  win.IptvUi.mkEL();
  return { ui: win.IptvUi, el: elMap, doc: docListeners };
}

// ---------------------------------------------------------------------------
// mkEL — resolves the new EL entries (verified via the wired listeners)
// ---------------------------------------------------------------------------
describe('mkEL() — log panel elements + listeners', function () {
  let el;
  beforeEach(function () { el = loadUi().el; });

  it('wires a click listener on #log-btn', function () {
    expect(typeof el['log-btn']._listeners.click).toBe('function');
  });

  it('wires a click listener on #log-close', function () {
    expect(typeof el['log-close']._listeners.click).toBe('function');
  });

  it('wires a click listener on #log-scrim', function () {
    expect(typeof el['log-scrim']._listeners.click).toBe('function');
  });

  it('wires a document keydown listener (shared Escape handler)', function () {
    const { doc } = loadUi();
    expect(typeof doc.keydown).toBe('function');
  });

  it('exposes setLog, onLogBtn and onLogClose on window.IptvUi', function () {
    const { ui } = loadUi();
    expect(typeof ui.setLog).toBe('function');
    expect(typeof ui.onLogBtn).toBe('function');
    expect(typeof ui.onLogClose).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// onLogBtn — toggles is-open + aria attributes
// ---------------------------------------------------------------------------
describe('onLogBtn() — open / toggle', function () {
  let ui, el;
  beforeEach(function () { const r = loadUi(); ui = r.ui; el = r.el; });

  it('adds is-open to #log-panel on open', function () {
    ui.onLogBtn();
    expect(el['log-panel'].classList.contains('is-open')).toBe(true);
  });

  it('adds is-open to #log-scrim on open', function () {
    ui.onLogBtn();
    expect(el['log-scrim'].classList.contains('is-open')).toBe(true);
  });

  it('flips #log-btn aria-expanded to "true" on open', function () {
    ui.onLogBtn();
    expect(el['log-btn'].getAttribute('aria-expanded')).toBe('true');
  });

  it('flips #log-panel aria-hidden to "false" on open', function () {
    ui.onLogBtn();
    expect(el['log-panel'].getAttribute('aria-hidden')).toBe('false');
  });

  it('a second click toggles the panel closed again', function () {
    ui.onLogBtn();
    ui.onLogBtn();
    expect(el['log-panel'].classList.contains('is-open')).toBe(false);
    expect(el['log-scrim'].classList.contains('is-open')).toBe(false);
    expect(el['log-btn'].getAttribute('aria-expanded')).toBe('false');
    expect(el['log-panel'].getAttribute('aria-hidden')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// onLogClose — closes an open panel and reverses all three signals
// ---------------------------------------------------------------------------
describe('onLogClose() — close', function () {
  let ui, el;
  beforeEach(function () { const r = loadUi(); ui = r.ui; el = r.el; ui.onLogBtn(); });

  it('removes is-open from panel and scrim', function () {
    ui.onLogClose();
    expect(el['log-panel'].classList.contains('is-open')).toBe(false);
    expect(el['log-scrim'].classList.contains('is-open')).toBe(false);
  });

  it('resets aria-expanded to "false" and aria-hidden to "true"', function () {
    ui.onLogClose();
    expect(el['log-btn'].getAttribute('aria-expanded')).toBe('false');
    expect(el['log-panel'].getAttribute('aria-hidden')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// Escape — the shared document keydown handler closes the log panel when open
// ---------------------------------------------------------------------------
describe('Escape (onAcctKey shared handler) — log panel', function () {
  let ui, el;
  beforeEach(function () { const r = loadUi(); ui = r.ui; el = r.el; });

  it('Escape closes the log panel when open', function () {
    ui.onLogBtn();
    ui.onAcctKey({ key: 'Escape' });
    expect(el['log-panel'].classList.contains('is-open')).toBe(false);
    expect(el['log-btn'].getAttribute('aria-expanded')).toBe('false');
    expect(el['log-panel'].getAttribute('aria-hidden')).toBe('true');
  });

  it('Escape is a no-op when the log panel is already closed', function () {
    ui.onAcctKey({ key: 'Escape' });
    expect(el['log-panel'].classList.contains('is-open')).toBe(false);
    expect(el['log-panel'].getAttribute('aria-hidden')).toBe('true');
  });

  it('a non-Escape key does not close an open log panel', function () {
    ui.onLogBtn();
    ui.onAcctKey({ key: 'Enter' });
    expect(el['log-panel'].classList.contains('is-open')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Independence — opening the log panel does not force the account panel closed,
// and vice versa (each is its own presentational toggle, ADR-0028).
// ---------------------------------------------------------------------------
describe('log + account panels are independent toggles', function () {
  let ui, el;
  beforeEach(function () { const r = loadUi(); ui = r.ui; el = r.el; });

  it('opening the log panel leaves an open account panel open', function () {
    ui.onAcctBtn();
    ui.onLogBtn();
    expect(el['acct-panel'].classList.contains('is-open')).toBe(true);
    expect(el['log-panel'].classList.contains('is-open')).toBe(true);
  });

  it('opening the account panel leaves an open log panel open', function () {
    ui.onLogBtn();
    ui.onAcctBtn();
    expect(el['log-panel'].classList.contains('is-open')).toBe(true);
    expect(el['acct-panel'].classList.contains('is-open')).toBe(true);
  });
});

// ===========================================================================
// TASK-0059 — render the log panel + button badge from window.IptvErrLog,
// the Clear action, and the capture→rndLog re-render wiring (ADR-0028).
// ===========================================================================

// A sample failure entry as errlog.mkEntry would produce it (newest-LAST in
// the array supplied to mkErrLog; list() reverses it, exactly like the store).
function mkSampleEntry(over) {
  return Object.assign({
    at:     Date.UTC(2026, 5, 13, 9, 30, 0),
    name:   'World News 24',
    num:    42,
    url:    'http://stream.test/news.m3u8',
    detail: 'manifestLoadError',
  }, over);
}

// ---------------------------------------------------------------------------
// rndLog — empty log: placeholder + hidden badge (ADR-0028)
// ---------------------------------------------------------------------------
describe('rndLog() — empty log', function () {
  let el;
  beforeEach(function () { el = loadUi(mkErrLog([])).el; });

  it('renders the calm empty-state placeholder into #log-list', function () {
    expect(el['log-list'].innerHTML).toContain('No playback failures this session.');
    expect(el['log-list'].innerHTML).toContain('log-empty');
  });

  it('renders no entry rows when the log is empty', function () {
    expect(el['log-list'].innerHTML).not.toContain('log-row');
  });

  it('sets the badge text to "0" and adds the is-empty (hidden) class', function () {
    expect(el['log-count'].textContent).toBe('0');
    expect(el['log-count'].classList.contains('is-empty')).toBe(true);
  });

  it('folds the zero count into the button accessible name (not colour-only)', function () {
    expect(el['log-btn'].getAttribute('aria-label')).toBe('Log, no playback failures');
  });
});

// ---------------------------------------------------------------------------
// rndLog — non-empty log: rows newest-first + visible badge (ADR-0028)
// ---------------------------------------------------------------------------
describe('rndLog() — non-empty log', function () {
  let el;
  beforeEach(function () {
    // supplied newest-LAST: "Old" first, "New" last → list() yields New, Old
    el = loadUi(mkErrLog([
      mkSampleEntry({ name: 'Old Channel', num: 1, detail: 'networkError' }),
      mkSampleEntry({ name: 'New Channel', num: 7, detail: 'mediaError' }),
    ])).el;
  });

  it('shows the count in the badge and removes the is-empty (hidden) class', function () {
    expect(el['log-count'].textContent).toBe('2');
    expect(el['log-count'].classList.contains('is-empty')).toBe(false);
  });

  it('renders one row per entry', function () {
    const rows = el['log-list'].innerHTML.split('log-row-name').length - 1;
    expect(rows).toBe(2);
  });

  it('renders rows newest-first (the newest entry appears before the oldest)', function () {
    const html = el['log-list'].innerHTML;
    expect(html.indexOf('New Channel')).toBeLessThan(html.indexOf('Old Channel'));
  });

  it('renders the channel name, number and engine detail in each row', function () {
    const html = el['log-list'].innerHTML;
    expect(html).toContain('New Channel');
    expect(html).toContain('#007'); // fmtNum pads to 3 digits
    expect(html).toContain('mediaError');
  });

  it('folds the count into the button accessible name with correct plural', function () {
    expect(el['log-btn'].getAttribute('aria-label')).toBe('Log, 2 playback failures');
  });

  it('uses the singular form when there is exactly one failure', function () {
    const r = loadUi(mkErrLog([mkSampleEntry({})]));
    expect(r.el['log-btn'].getAttribute('aria-label')).toBe('Log, 1 playback failure');
    expect(r.el['log-count'].textContent).toBe('1');
    expect(r.el['log-count'].classList.contains('is-empty')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// rndLog — HTML-escaping of entry-derived text (ADR-0028)
// ---------------------------------------------------------------------------
describe('rndLog() — escapes entry text', function () {
  it('escapes HTML in the channel name and the engine detail', function () {
    const el = loadUi(mkErrLog([
      mkSampleEntry({ name: '<img src=x onerror=alert(1)>', detail: '<b>boom</b>' }),
    ])).el;
    const html = el['log-list'].innerHTML;
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>boom</b>');
    expect(html).toContain('&lt;img src=x');
    expect(html).toContain('&lt;b&gt;boom&lt;/b&gt;');
  });
});

// ---------------------------------------------------------------------------
// rndLog — guarded when IptvErrLog is absent (test isolation, ADR-0028)
// ---------------------------------------------------------------------------
describe('rndLog() — guarded when IptvErrLog is absent', function () {
  it('no-ops without throwing and leaves the list untouched', function () {
    const r = loadUi(); // no errlog stub → window.IptvErrLog is undefined
    expect(function () { r.ui.rndLog(); }).not.toThrow();
    expect(r.el['log-list'].innerHTML).toBe('');
  });
});

// ---------------------------------------------------------------------------
// onLogClear — empties the log and re-renders to the empty state (ADR-0028)
// ---------------------------------------------------------------------------
describe('onLogClear() — clear + re-render', function () {
  it('calls IptvErrLog.clear() then re-renders to the empty state + hidden badge', function () {
    const errlog = mkErrLog([
      mkSampleEntry({ name: 'A', num: 1 }),
      mkSampleEntry({ name: 'B', num: 2 }),
    ]);
    const r = loadUi(errlog);
    // pre-condition: rows rendered + badge visible
    expect(r.el['log-list'].innerHTML).toContain('log-row');
    expect(r.el['log-count'].classList.contains('is-empty')).toBe(false);

    r.ui.onLogClear();

    expect(errlog.clear).toHaveBeenCalledTimes(1);
    expect(r.el['log-list'].innerHTML).toContain('No playback failures this session.');
    expect(r.el['log-list'].innerHTML).not.toContain('log-row');
    expect(r.el['log-count'].textContent).toBe('0');
    expect(r.el['log-count'].classList.contains('is-empty')).toBe(true);
    expect(r.el['log-btn'].getAttribute('aria-label')).toBe('Log, no playback failures');
  });

  it('the wired #log-clear click handler runs onLogClear', function () {
    const errlog = mkErrLog([mkSampleEntry({})]);
    const r = loadUi(errlog);
    r.el['log-clear']._listeners.click();
    expect(errlog.clear).toHaveBeenCalledTimes(1);
    expect(r.el['log-list'].innerHTML).toContain('No playback failures this session.');
  });
});

// ---------------------------------------------------------------------------
// rndLog wiring — runs on mkEL init so the badge/list are correct on load
// ---------------------------------------------------------------------------
describe('rndLog() — invoked on mkEL initialization', function () {
  it('renders the empty state and badge on load with an empty log', function () {
    const el = loadUi(mkErrLog([])).el;
    expect(el['log-list'].innerHTML).toContain('No playback failures this session.');
    expect(el['log-count'].classList.contains('is-empty')).toBe(true);
  });

  it('renders rows and a visible badge on load when the log already has entries', function () {
    const el = loadUi(mkErrLog([mkSampleEntry({ name: 'Boot Entry' })])).el;
    expect(el['log-list'].innerHTML).toContain('Boot Entry');
    expect(el['log-count'].textContent).toBe('1');
    expect(el['log-count'].classList.contains('is-empty')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// capture → rndLog re-render wiring (ADR-0028): play.js's onEngErr calls
// window.IptvUi.rndLog() (guarded, after add) so a new failure updates the
// badge and any open panel without a manual refresh. Asserted against the
// real play.js + errlog.js executed in one window alongside a real IptvUi.
// ---------------------------------------------------------------------------
describe('capture → rndLog wiring (onEngErr re-renders the log)', function () {
  it('a captured failure re-renders the badge + list live, no manual refresh', function () {
    // One window: real st.js, real errlog.js, real play.js, real ui.js, with
    // log-panel DOM elements wired through mkEL — exactly the runtime shape.
    const elMap = {};
    const ids = [
      'ch-list', 'player-video', 'search', 'now-info', 'player-err',
      'grp-nav', 'footer', 'player-card', 'player-idle', 'player-wrap',
      'f-url', 'f-user', 'f-pass', 'footer-conn', 'footer-login',
      'footer-hint', 'footer-err', 'btn-conn', 'btn-disc', 'conn-text',
      'login-form', 'fmt-chip', 'fmt-detail',
      'acct-scrim', 'acct-close', 'acct-add', 'acct-list', 'acct-conn',
      'log-count', 'log-scrim', 'log-close', 'log-clear', 'log-list',
    ];
    for (let i = 0; i < ids.length; i += 1) { elMap[ids[i]] = mkEl(ids[i]); }
    elMap['acct-btn']   = mkEl('acct-btn', { 'aria-expanded': 'false' });
    elMap['acct-panel'] = mkEl('acct-panel', { 'aria-hidden': 'true' });
    elMap['log-btn']    = mkEl('log-btn', { 'aria-expanded': 'false' });
    elMap['log-panel']  = mkEl('log-panel', { 'aria-hidden': 'true' });

    const win = {
      IptvSrch:  { getChs: function getChs() { return []; } },
      IptvEmpty: {
        resolveContent: function rc() { return { icon: 'list', title: '', body: '' }; },
        resolveSignal:  function rs() { return { icon: 'alert', title: '', body: '', action: null }; },
      },
      S: {},
      IptvApi: { connect: vi.fn() },
      document: {
        getElementById: function getEl(id) { return elMap[id] || null; },
        querySelector:  function qSel()    { return null; },
        addEventListener: function addL() {},
        body: { classList: mkClassList() },
      },
      clearTimeout: function cTout() {},
      setTimeout:   function sTout(fn) { return fn; },
    };

    const here = dirname(fileURLToPath(import.meta.url));
    const evalIn = function evalIn(rel) {
      const code = readFileSync(join(here, rel), 'utf8');
      // eslint-disable-next-line no-new-func
      new Function('window', 'document', '"use strict";\n' + code)(win, win.document);
    };
    evalIn('../../client/st.js');
    evalIn('../../client/errlog.js');
    evalIn('../../client/play.js');
    evalIn('../../client/ui.js');

    win.IptvSt.go('LOAD');
    win.IptvSt.go('READY');
    win.IptvUi.mkEL();

    // on load: empty
    expect(elMap['log-list'].innerHTML).toContain('No playback failures this session.');
    expect(elMap['log-count'].classList.contains('is-empty')).toBe(true);

    // a fatal engine failure funnels through onEngErr (no HLS support path)
    win.IptvSt.setCur({ id: '9', name: 'Capture Wire', num: 9, url: 'http://x/y.m3u8' });
    const vid = {
      src: '', canPlayType: function cpt() { return ''; },
      play: function play() { return Promise.resolve(); }, load: function load() {},
    };
    win.IptvPlay.mkPlay(vid);
    win.IptvPlay.loadPlay('http://x/y.m3u8'); // → onEngErr('HLS not supported')

    // the badge + open panel reflect the new entry without any manual refresh
    expect(win.IptvErrLog.count()).toBe(1);
    expect(elMap['log-count'].textContent).toBe('1');
    expect(elMap['log-count'].classList.contains('is-empty')).toBe(false);
    expect(elMap['log-list'].innerHTML).toContain('Capture Wire');
    expect(elMap['log-list'].innerHTML).toContain('HLS not supported');
  });
});
