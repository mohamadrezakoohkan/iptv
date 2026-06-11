// ADR: ADR-0005
// Unit tests — updM3u footer adaptation for TASK-0013

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const UI_SRC     = join(__dir, '../../client/ui.js');
const API_SRC    = join(__dir, '../../client/api.js');

// ---------------------------------------------------------------------------
// mkEl — lightweight DOM element stub
// ---------------------------------------------------------------------------
function mkEl(id) {
  const attrs = {};
  return {
    _id:              id,
    style:            { display: '' },
    classList:        { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() },
    disabled:         false,
    textContent:      '',
    value:            '',
    innerHTML:        '',
    addEventListener: vi.fn(),
    getAttribute:     vi.fn(),
    removeAttribute:  vi.fn(function rmAttr(name) { delete attrs[name]; }),
    setAttribute:     vi.fn(function setAttr(name, val) { attrs[name] = val; }),
    _attrs:           attrs,
  };
}

// ---------------------------------------------------------------------------
// loadBoth — execute api.js then ui.js on a synthetic window, call mkEL()
// ---------------------------------------------------------------------------
function loadBoth(phase) {
  const ph    = phase || 'INIT';
  const elMap = {};
  const ids   = [
    'ch-list', 'player-video', 'search', 'now-info', 'player-err',
    'grp-nav', 'footer', 'player-card', 'player-idle', 'player-wrap',
    'f-url', 'f-user', 'f-pass', 'footer-conn', 'footer-login',
    'footer-hint', 'footer-err', 'btn-conn', 'btn-disc', 'conn-text',
    'login-form',
  ];
  for (let i = 0; i < ids.length; i += 1) {
    elMap[ids[i]] = mkEl(ids[i]);
  }

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
    IptvPlay: null,
    document: {
      getElementById: function getEl(id) { return elMap[id] || null; },
      querySelector:  function qSel() { return null; },
      body: { classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() } },
    },
    clearTimeout:       function cTout() {},
    setTimeout:         function sTout(fn) { return fn; },
    URL:                URL,
    encodeURIComponent: encodeURIComponent,
    fetch:              vi.fn(),
    AbortController:    AbortController,
  };

  // execute api.js so IptvApi is registered on win
  const apiSrc = readFileSync(API_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function(
    'window', 'fetch', 'AbortController', 'encodeURIComponent',
    'clearTimeout', 'setTimeout', 'Promise', 'URL',
    '"use strict";\n' + apiSrc
  )(win, win.fetch, AbortController, encodeURIComponent,
    function cTout() {}, function sTout(fn) { return fn; }, Promise, URL);

  // execute ui.js so IptvUi is registered on win
  const uiSrc = readFileSync(UI_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', '"use strict";\n' + uiSrc)(win, win.document);
  win.IptvUi.mkEL();
  return { ui: win.IptvUi, el: elMap, st: stObj, win };
}

// ---------------------------------------------------------------------------
// Helpers to retrieve the registered input handler on f-url
// ---------------------------------------------------------------------------
function getUrlInputHandler(el) {
  const calls = el['f-url'].addEventListener.mock.calls;
  const call  = calls.find(function byInput(c) { return c[0] === 'input'; });
  return call ? call[1] : null;
}

// ---------------------------------------------------------------------------
// updM3u — M3U URL (.m3u extension) → is-m3u class added, required removed
// ---------------------------------------------------------------------------
describe('updM3u — M3U URL (.m3u extension)', function () {
  it('adds is-m3u class to footer-login element', function () {
    const { el } = loadBoth('INIT');
    const handler = getUrlInputHandler(el);
    el['f-url'].value = 'https://example.com/playlist.m3u';
    handler();
    expect(el['footer-login'].classList.add).toHaveBeenCalledWith('is-m3u');
  });

  it('removes required from username input', function () {
    const { el } = loadBoth('INIT');
    const handler = getUrlInputHandler(el);
    el['f-url'].value = 'https://example.com/playlist.m3u8';
    handler();
    expect(el['f-user'].removeAttribute).toHaveBeenCalledWith('required');
  });

  it('removes required from password input', function () {
    const { el } = loadBoth('INIT');
    const handler = getUrlInputHandler(el);
    el['f-url'].value = 'https://example.com/playlist.m3u8';
    handler();
    expect(el['f-pass'].removeAttribute).toHaveBeenCalledWith('required');
  });

  it('sets M3U hint text', function () {
    const { el } = loadBoth('INIT');
    const handler = getUrlInputHandler(el);
    el['f-url'].value = 'https://example.com/playlist.m3u';
    handler();
    expect(el['footer-hint'].textContent).toBe('M3U URL detected — username and password not needed.');
  });

  it('handles uppercase .M3U8 extension', function () {
    const { el } = loadBoth('INIT');
    const handler = getUrlInputHandler(el);
    el['f-url'].value = 'https://example.com/LIST.M3U8';
    handler();
    expect(el['footer-login'].classList.add).toHaveBeenCalledWith('is-m3u');
  });
});

// ---------------------------------------------------------------------------
// updM3u — non-M3U inputs (empty string, demo keyword) → is-m3u class removed
// ---------------------------------------------------------------------------
describe('updM3u — non-M3U input (empty / demo keyword)', function () {
  it('empty URL: removes is-m3u class from footer-login', function () {
    const { el } = loadBoth('INIT');
    const handler = getUrlInputHandler(el);
    el['f-url'].value = '';
    handler();
    expect(el['footer-login'].classList.remove).toHaveBeenCalledWith('is-m3u');
  });

  it('empty URL: removes required attribute on username input', function () {
    const { el } = loadBoth('INIT');
    const handler = getUrlInputHandler(el);
    el['f-url'].value = '';
    handler();
    expect(el['f-user'].removeAttribute).toHaveBeenCalledWith('required');
  });

  it('empty URL: removes required attribute on password input', function () {
    const { el } = loadBoth('INIT');
    const handler = getUrlInputHandler(el);
    el['f-url'].value = '';
    handler();
    expect(el['f-pass'].removeAttribute).toHaveBeenCalledWith('required');
  });

  it('empty URL: reverts hint text to default', function () {
    const { el } = loadBoth('INIT');
    const handler = getUrlInputHandler(el);
    el['f-url'].value = '';
    handler();
    expect(el['footer-hint'].textContent).toBe('Type "demo" to try a sample playlist.');
  });

  it('demo keyword: removes is-m3u class', function () {
    const { el } = loadBoth('INIT');
    const handler = getUrlInputHandler(el);
    el['f-url'].value = 'demo';
    handler();
    expect(el['footer-login'].classList.remove).toHaveBeenCalledWith('is-m3u');
  });

  it('demo keyword: removes required attribute on username input', function () {
    const { el } = loadBoth('INIT');
    const handler = getUrlInputHandler(el);
    el['f-url'].value = 'demo';
    handler();
    expect(el['f-user'].removeAttribute).toHaveBeenCalledWith('required');
  });
});
