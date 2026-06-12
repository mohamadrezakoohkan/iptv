// ADR: ADR-0008
// Unit tests — footer login-mode selector (onMode/rndMode/runConn) for TASK-0018

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const UI_SRC     = join(__dir, '../../client/ui.js');

const HINT_XTR = 'Type "demo" to try a sample playlist.';
const HINT_M3U = 'Paste an .m3u / .m3u8 playlist URL — no login needed.';

// ---------------------------------------------------------------------------
// mkEl — lightweight DOM element stub (checked supports radio inputs)
// ---------------------------------------------------------------------------
function mkEl(id) {
  return {
    _id:              id,
    style:            { display: '' },
    classList:        { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() },
    disabled:         false,
    checked:          false,
    textContent:      '',
    value:            '',
    innerHTML:        '',
    addEventListener: vi.fn(),
    getAttribute:     vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// loadUi — execute client/ui.js on a synthetic window with a mocked IptvApi,
//          call mkEL(). Baseline: mode-xtream radio is checked (index.html).
// ---------------------------------------------------------------------------
function loadUi(phase) {
  const ph    = phase || 'INIT';
  const elMap = {};
  const ids   = [
    'ch-list', 'player-video', 'search', 'now-info', 'player-err',
    'grp-nav', 'footer', 'player-card', 'player-idle', 'player-wrap',
    'f-url', 'f-user', 'f-pass', 'footer-conn', 'footer-login',
    'footer-hint', 'footer-err', 'btn-conn', 'btn-disc', 'conn-text',
    'login-form', 'login-mode', 'mode-xtream', 'mode-m3u',
  ];
  for (let i = 0; i < ids.length; i += 1) {
    elMap[ids[i]] = mkEl(ids[i]);
  }
  elMap['mode-xtream'].checked = true;
  elMap['footer-hint'].textContent = HINT_XTR;

  const stObj = {
    phase: ph, chs: [], cats: [], host: '', user: '', err: null,
    favs: [], cur: null, srch: '', flt: 'all', vol: 1.0, muted: false,
  };

  const win = {
    IptvSt: {
      ST:      stObj,
      go:      function go(nxt) { stObj.phase = nxt; },
      setErr:  function setErr(msg) { stObj.err = msg; },
      setChs:  function setChs(c, ct, h, u) { stObj.chs = c; stObj.cats = ct; stObj.host = h; stObj.user = u; },
      setCur:  function setCur(ch) { stObj.cur = ch; },
      setSrch: function setSrch(q) { stObj.srch = q; },
      setFlt:  function setFlt(f) { stObj.flt = f; },
      setFavs: function setFavs(a) { stObj.favs = a; },
    },
    IptvSrch: { getChs: function getChs() { return []; } },
    IptvApi:  { connect: vi.fn() },
    IptvPlay: null,
    document: {
      getElementById: function getEl(id) { return elMap[id] || null; },
      querySelector:  function qSel() { return null; },
      body: { classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() } },
    },
    clearTimeout: function cTout() {},
    setTimeout:   function sTout(fn) { return fn; },
  };

  const uiSrc = readFileSync(UI_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', '"use strict";\n' + uiSrc)(win, win.document);
  win.IptvUi.mkEL();
  return { ui: win.IptvUi, el: elMap, st: stObj, api: win.IptvApi };
}

// ---------------------------------------------------------------------------
// Handler retrieval helpers
// ---------------------------------------------------------------------------
function getHandler(el, id, evtName) {
  const calls = el[id].addEventListener.mock.calls;
  const call  = calls.find(function byEvt(c) { return c[0] === evtName; });
  return call ? call[1] : null;
}

function setMode(el, mode) {
  el['mode-xtream'].checked = mode === 'xtream';
  el['mode-m3u'].checked    = mode === 'm3u';
}

async function submit(el) {
  const onSubmit = getHandler(el, 'login-form', 'submit');
  onSubmit({ preventDefault: vi.fn() });
  await new Promise(function resolveNext(res) { setTimeout(res, 0); });
}

// ---------------------------------------------------------------------------
// Default mode — xtream
// ---------------------------------------------------------------------------
describe('login mode — default', function () {
  it('getMode() returns xtream with baseline markup', function () {
    const { ui } = loadUi('INIT');
    expect(ui.getMode()).toBe('xtream');
  });

  it('a change listener is registered on #login-mode', function () {
    const { el } = loadUi('INIT');
    expect(getHandler(el, 'login-mode', 'change')).toBeTypeOf('function');
  });

  it('rndMode() in default mode removes is-m3u and keeps the default hint', function () {
    const { ui, el } = loadUi('INIT');
    ui.rndMode();
    expect(el['footer-login'].classList.remove).toHaveBeenCalledWith('is-m3u');
    expect(el['footer-login'].classList.add).not.toHaveBeenCalledWith('is-m3u');
    expect(el['footer-hint'].textContent).toBe(HINT_XTR);
  });
});

// ---------------------------------------------------------------------------
// onMode — selecting m3u
// ---------------------------------------------------------------------------
describe('onMode — m3u selected', function () {
  it('adds is-m3u class to footer-login', function () {
    const { el } = loadUi('INIT');
    setMode(el, 'm3u');
    getHandler(el, 'login-mode', 'change')();
    expect(el['footer-login'].classList.add).toHaveBeenCalledWith('is-m3u');
  });

  it('sets the m3u hint text', function () {
    const { el } = loadUi('INIT');
    setMode(el, 'm3u');
    getHandler(el, 'login-mode', 'change')();
    expect(el['footer-hint'].textContent).toBe(HINT_M3U);
  });
});

// ---------------------------------------------------------------------------
// onMode — switching back to xtream
// ---------------------------------------------------------------------------
describe('onMode — xtream re-selected', function () {
  it('removes is-m3u class and restores the default hint', function () {
    const { el } = loadUi('INIT');
    const onMode = getHandler(el, 'login-mode', 'change');
    setMode(el, 'm3u');
    onMode();
    setMode(el, 'xtream');
    onMode();
    expect(el['footer-login'].classList.remove).toHaveBeenCalledWith('is-m3u');
    expect(el['footer-hint'].textContent).toBe(HINT_XTR);
  });
});

// ---------------------------------------------------------------------------
// runConn — explicit m3u flag passed to IptvApi.connect (both modes)
// ---------------------------------------------------------------------------
describe('runConn — explicit mode flag', function () {
  it('xtream mode: connect called with m3u: false', async function () {
    const { el, api } = loadUi('INIT');
    api.connect.mockResolvedValue({ ok: true, val: { host: 'h', user: 'u', categories: [], channels: [] } });
    el['f-url'].value  = 'http://portal.example.com';
    el['f-user'].value = 'alice';
    el['f-pass'].value = 'pw';
    await submit(el);
    expect(api.connect).toHaveBeenCalledWith('http://portal.example.com',
      { user: 'alice', pass: 'pw', m3u: false });
  });

  it('m3u mode: connect called with m3u: true', async function () {
    const { el, api } = loadUi('INIT');
    api.connect.mockResolvedValue({ ok: true, val: { host: 'h', user: '', categories: [], channels: [] } });
    setMode(el, 'm3u');
    el['f-url'].value = 'https://example.com/list.m3u8';
    await submit(el);
    expect(api.connect).toHaveBeenCalledWith('https://example.com/list.m3u8',
      { user: '', pass: '', m3u: true });
  });

  it('demo URL in m3u mode: connect called with m3u: true and src demo', async function () {
    const { el, api } = loadUi('INIT');
    api.connect.mockResolvedValue({ ok: true, val: { host: 'demo', user: 'demo', categories: [], channels: [] } });
    setMode(el, 'm3u');
    el['f-url'].value = 'demo';
    await submit(el);
    expect(api.connect).toHaveBeenCalledWith('demo', { user: '', pass: '', m3u: true });
  });
});

// ---------------------------------------------------------------------------
// onUrlInput — URL shape never drives the mode (auto-detect removed)
// ---------------------------------------------------------------------------
describe('onUrlInput — no auto-detection', function () {
  it('typing a .m3u8 URL in xtream mode never adds is-m3u', function () {
    const { el } = loadUi('INIT');
    const onUrl = getHandler(el, 'f-url', 'input');
    el['f-url'].value = 'https://example.com/list.m3u8';
    onUrl();
    expect(el['footer-login'].classList.add).not.toHaveBeenCalledWith('is-m3u');
  });

  it('typing a .m3u8 URL in xtream mode leaves the hint unchanged', function () {
    const { el } = loadUi('INIT');
    const onUrl = getHandler(el, 'f-url', 'input');
    el['f-url'].value = 'https://example.com/list.m3u8';
    onUrl();
    expect(el['footer-hint'].textContent).toBe(HINT_XTR);
  });

  it('still enables the Connect button on non-empty URL', function () {
    const { el } = loadUi('INIT');
    const onUrl = getHandler(el, 'f-url', 'input');
    el['btn-conn'].disabled = true;
    el['f-url'].value = 'demo';
    onUrl();
    expect(el['btn-conn'].disabled).toBe(false);
  });

  it('updM3u is removed from client/ui.js', function () {
    const uiSrc = readFileSync(UI_SRC, 'utf8');
    expect(uiSrc).not.toContain('updM3u');
  });
});
