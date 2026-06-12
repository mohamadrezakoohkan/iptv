// ADR: ADR-0001, ADR-0008
// Unit tests — rndFoot + connect/disconnect handlers for TASK-0008

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const UI_SRC     = join(__dir, '../../client/ui.js');

// ---------------------------------------------------------------------------
// mkEl — lightweight DOM element stub with style, classList, disabled, value
// ---------------------------------------------------------------------------
function mkEl(id) {
  return {
    _id:         id,
    style:       { display: '' },
    classList:   { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() },
    disabled:    false,
    textContent: '',
    value:       '',
    innerHTML:   '',
    addEventListener: vi.fn(),
    getAttribute:     vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// loadUi — execute client/ui.js with a synthetic window that provides footer
//          DOM elements and a controllable IptvSt.
//
// opts: { phase, chs, cats, host, user, err }
// ---------------------------------------------------------------------------
function loadUi(opts) {
  const phase  = (opts && opts.phase) ? opts.phase : 'INIT';
  const chs    = (opts && opts.chs)   ? opts.chs   : [];
  const cats   = (opts && opts.cats)  ? opts.cats  : [];
  const host   = (opts && opts.host)  ? opts.host  : '';
  const user   = (opts && opts.user)  ? opts.user  : '';
  const err    = (opts && opts.err !== undefined) ? opts.err : null;

  const elMap  = {};
  const ids = [
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
    phase, chs, cats, host, user, err,
    favs: [], cur: null, srch: '', flt: 'all', vol: 1.0, muted: false,
  };

  const win = {
    IptvSt: {
      ST: stObj,
      go:        function go(nxt) { stObj.phase = nxt; },
      setErr:    function setErr(msg) { stObj.err = msg; },
      setChs:    function setChs(c, ct, h, u) { stObj.chs = c; stObj.cats = ct; stObj.host = h; stObj.user = u; },
      setCur:    function setCur(ch) { stObj.cur = ch; },
      setSrch:   function setSrch(q) { stObj.srch = q; },
      setFlt:    function setFlt(f) { stObj.flt = f; },
      setFavs:   function setFavs(a) { stObj.favs = a; },
    },
    IptvSrch: { getChs: function getChs() { return []; } },
    IptvApi:  { connect: vi.fn() },
    IptvPlay: null,
    document: {
      getElementById:  function getEl(id) { return elMap[id] || null; },
      querySelector:   function qSel()    { return null; },
      body: { classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() } },
    },
    clearTimeout: function cTout() {},
    setTimeout:   function sTout(fn) { return fn; },
  };

  const src = readFileSync(UI_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', '"use strict";\n' + src)(win, win.document);
  win.IptvUi.mkEL();
  return { ui: win.IptvUi, el: elMap, st: stObj, api: win.IptvApi, iptvSt: win.IptvSt };
}

// ---------------------------------------------------------------------------
// rndFoot — INIT phase: footer-login visible, footer-conn hidden
// ---------------------------------------------------------------------------
describe('rndFoot() — INIT phase', function () {
  it('footer-login is visible (display empty string)', function () {
    const { ui, el } = loadUi({ phase: 'INIT' });
    ui.rndFoot();
    expect(el['footer-login'].style.display).toBe('');
  });

  it('footer-conn is hidden (display none)', function () {
    const { ui, el } = loadUi({ phase: 'INIT' });
    ui.rndFoot();
    expect(el['footer-conn'].style.display).toBe('none');
  });

  it('footer-err is hidden when ST.err is null', function () {
    const { ui, el } = loadUi({ phase: 'INIT', err: null });
    ui.rndFoot();
    expect(el['footer-err'].style.display).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// rndFoot — ERR phase: footer-login visible, footer-err shows ST.err
// ---------------------------------------------------------------------------
describe('rndFoot() — ERR phase', function () {
  it('footer-login is visible', function () {
    const { ui, el } = loadUi({ phase: 'ERR', err: 'Login failed' });
    ui.rndFoot();
    expect(el['footer-login'].style.display).toBe('');
  });

  it('footer-conn is hidden', function () {
    const { ui, el } = loadUi({ phase: 'ERR', err: 'Login failed' });
    ui.rndFoot();
    expect(el['footer-conn'].style.display).toBe('none');
  });

  it('footer-err shows ST.err message', function () {
    const { ui, el } = loadUi({ phase: 'ERR', err: 'Login failed' });
    ui.rndFoot();
    expect(el['footer-err'].style.display).toBe('');
    expect(el['footer-err'].textContent).toBe('Login failed');
  });
});

// ---------------------------------------------------------------------------
// rndFoot — READY phase: footer-conn visible, footer-login hidden
// ---------------------------------------------------------------------------
describe('rndFoot() — READY phase', function () {
  it('footer-conn is visible', function () {
    const { ui, el } = loadUi({ phase: 'READY', host: 'demo', user: 'alice', chs: [{}, {}, {}], cats: [{}, {}] });
    ui.rndFoot();
    expect(el['footer-conn'].style.display).toBe('');
  });

  it('footer-login is hidden', function () {
    const { ui, el } = loadUi({ phase: 'READY', host: 'demo', user: 'alice', chs: [], cats: [] });
    ui.rndFoot();
    expect(el['footer-login'].style.display).toBe('none');
  });

  it('conn-text contains host and user', function () {
    const { ui, el } = loadUi({ phase: 'READY', host: 'demo', user: 'alice', chs: [{}], cats: [{}] });
    ui.rndFoot();
    expect(el['conn-text'].textContent).toContain('demo');
    expect(el['conn-text'].textContent).toContain('alice');
  });

  it('conn-text contains channel count', function () {
    const chs = [{}, {}, {}];
    const { ui, el } = loadUi({ phase: 'READY', host: 'demo', user: 'u', chs, cats: [] });
    ui.rndFoot();
    expect(el['conn-text'].textContent).toContain('3 channels');
  });

  it('conn-text contains category count', function () {
    const cats = [{}, {}, {}, {}];
    const { ui, el } = loadUi({ phase: 'READY', host: 'demo', user: 'u', chs: [], cats });
    ui.rndFoot();
    expect(el['conn-text'].textContent).toContain('4 categories');
  });
});

// ---------------------------------------------------------------------------
// rndFoot — PLAY phase: footer-conn visible
// ---------------------------------------------------------------------------
describe('rndFoot() — PLAY phase', function () {
  it('footer-conn is visible', function () {
    const { ui, el } = loadUi({ phase: 'PLAY', host: 'h', user: 'u', chs: [], cats: [] });
    ui.rndFoot();
    expect(el['footer-conn'].style.display).toBe('');
  });

  it('footer-login is hidden', function () {
    const { ui, el } = loadUi({ phase: 'PLAY', host: 'h', user: 'u', chs: [], cats: [] });
    ui.rndFoot();
    expect(el['footer-login'].style.display).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// Connect handler — success path
// ---------------------------------------------------------------------------
describe('connect handler — ok:true result', function () {
  it('calls IptvApi.connect with url and credentials', async function () {
    const { el, api, st } = loadUi({ phase: 'INIT' });
    const cats = [{ id: 'news', name: 'News' }];
    const chs  = [{ id: '1', name: 'World News', grp: 'news', url: '', img: '', cat: 'news', num: 1 }];
    api.connect.mockResolvedValue({ ok: true, val: { host: 'demo', user: 'demo', categories: cats, channels: chs } });
    el['f-url'].value   = 'demo';
    el['f-user'].value  = 'demo';
    el['f-pass'].value  = '';
    // simulate form submit via the registered event handler
    const frm = el['login-form'];
    const submitHandler = frm.addEventListener.mock.calls.find(function bySubmit(c) { return c[0] === 'submit'; });
    expect(submitHandler).toBeDefined();
    const onSubmit = submitHandler[1];
    const fakeEvt  = { preventDefault: vi.fn() };
    onSubmit(fakeEvt);
    // wait for the async runConn to settle
    await new Promise(function resolveNext(res) { setTimeout(res, 0); });
    expect(fakeEvt.preventDefault).toHaveBeenCalled();
    expect(api.connect).toHaveBeenCalledWith('demo', { user: 'demo', pass: '', m3u: false });
  });

  it('calls setChs with channels, categories, host, user on success', async function () {
    const { el, api, iptvSt } = loadUi({ phase: 'INIT' });
    const cats = [{ id: 'news', name: 'News' }];
    const chs  = [{ id: '1', name: 'World News', grp: 'news', url: '', img: '', cat: 'news', num: 1 }];
    api.connect.mockResolvedValue({ ok: true, val: { host: 'myhost', user: 'bob', categories: cats, channels: chs } });
    el['f-url'].value = 'demo';
    const frm = el['login-form'];
    const submitHandler = frm.addEventListener.mock.calls.find(function bySubmit(c) { return c[0] === 'submit'; });
    const onSubmit = submitHandler[1];
    onSubmit({ preventDefault: vi.fn() });
    await new Promise(function resolveNext(res) { setTimeout(res, 0); });
    expect(iptvSt.ST.chs).toBe(chs);
    expect(iptvSt.ST.cats).toBe(cats);
    expect(iptvSt.ST.host).toBe('myhost');
    expect(iptvSt.ST.user).toBe('bob');
  });

  it('transitions to READY on success', async function () {
    const { el, api, st } = loadUi({ phase: 'INIT' });
    api.connect.mockResolvedValue({ ok: true, val: { host: 'h', user: 'u', categories: [], channels: [] } });
    el['f-url'].value = 'demo';
    const frm = el['login-form'];
    const submitHandler = frm.addEventListener.mock.calls.find(function bySubmit(c) { return c[0] === 'submit'; });
    submitHandler[1]({ preventDefault: vi.fn() });
    await new Promise(function resolveNext(res) { setTimeout(res, 0); });
    expect(st.phase).toBe('READY');
  });
});

// ---------------------------------------------------------------------------
// Connect handler — failure path
// ---------------------------------------------------------------------------
describe('connect handler — ok:false result', function () {
  it('transitions to ERR on failure', async function () {
    const { el, api, st } = loadUi({ phase: 'INIT' });
    api.connect.mockResolvedValue({ ok: false, err: 'Login failed' });
    el['f-url'].value = 'demo';
    const frm = el['login-form'];
    const submitHandler = frm.addEventListener.mock.calls.find(function bySubmit(c) { return c[0] === 'submit'; });
    submitHandler[1]({ preventDefault: vi.fn() });
    await new Promise(function resolveNext(res) { setTimeout(res, 0); });
    expect(st.phase).toBe('ERR');
  });

  it('calls setErr with error message on failure', async function () {
    const { el, api, st } = loadUi({ phase: 'INIT' });
    api.connect.mockResolvedValue({ ok: false, err: 'Bad credentials' });
    el['f-url'].value = 'demo';
    const frm = el['login-form'];
    const submitHandler = frm.addEventListener.mock.calls.find(function bySubmit(c) { return c[0] === 'submit'; });
    submitHandler[1]({ preventDefault: vi.fn() });
    await new Promise(function resolveNext(res) { setTimeout(res, 0); });
    expect(st.err).toBe('Bad credentials');
  });

  it('shows error in footer-err element on failure', async function () {
    const { el, api } = loadUi({ phase: 'INIT' });
    api.connect.mockResolvedValue({ ok: false, err: 'Login failed' });
    el['f-url'].value = 'demo';
    const frm = el['login-form'];
    const submitHandler = frm.addEventListener.mock.calls.find(function bySubmit(c) { return c[0] === 'submit'; });
    submitHandler[1]({ preventDefault: vi.fn() });
    await new Promise(function resolveNext(res) { setTimeout(res, 0); });
    expect(el['footer-err'].textContent).toBe('Login failed');
    expect(el['footer-err'].style.display).toBe('');
  });

  it('re-enables btn-conn after failure', async function () {
    const { el, api } = loadUi({ phase: 'INIT' });
    api.connect.mockResolvedValue({ ok: false, err: 'fail' });
    el['f-url'].value = 'demo';
    const frm = el['login-form'];
    const submitHandler = frm.addEventListener.mock.calls.find(function bySubmit(c) { return c[0] === 'submit'; });
    submitHandler[1]({ preventDefault: vi.fn() });
    await new Promise(function resolveNext(res) { setTimeout(res, 0); });
    expect(el['btn-conn'].disabled).toBe(false);
  });
});
