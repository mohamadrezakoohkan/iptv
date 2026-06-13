// ADR: ADR-0027
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const PLAY_SRC   = join(__dir, '../../client/play.js');
const ST_SRC     = join(__dir, '../../client/st.js');
const ERRLOG_SRC = join(__dir, '../../client/errlog.js');
const HTML_SRC   = join(__dir, '../../index.html');

// Proxy wrapping expected for every absolute stream URL (ADR-0010)
function prxOf(url) {
  return '/api/xtream?url=' + encodeURIComponent(url);
}

// ---------------------------------------------------------------------------
// loadPlay — execute play.js (and optionally errlog.js) in an isolated window.
// opts: { hls, ts, native, errlog: boolean } — when errlog is true the real
// errlog.js store is evaluated against the same window before play.js, so
// onEngErr's guarded capture writes into a fresh, isolated IptvErrLog.
// ---------------------------------------------------------------------------
function loadPlay(opts) {
  const win = {};

  const stSrc = readFileSync(ST_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  const stFn = new Function('window', '"use strict";\n' + stSrc + '\nreturn window.IptvSt;');
  stFn(win);
  win.IptvSt.go('LOAD');
  win.IptvSt.go('READY');

  if (opts.errlog) {
    const elSrc = readFileSync(ERRLOG_SRC, 'utf8');
    // eslint-disable-next-line no-new-func
    const elFn = new Function('window', '"use strict";\n' + elSrc);
    elFn(win);
  }

  if (opts.hls) win.Hls    = opts.hls;
  if (opts.ts)  win.mpegts = opts.ts;

  const src = readFileSync(PLAY_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  const fn = new Function('window', '"use strict";\n' + src + '\nreturn window.IptvPlay;');
  const iptvPlay = fn(win);

  const vid = {
    src: '',
    canPlayType: function canPlayType() { return opts.native ? 'probably' : ''; },
    play:        function play() { return Promise.resolve(); },
    load:        function load() {},
  };

  iptvPlay.mkPlay(vid);
  return { iptvPlay, vid, win };
}

// mkHlsStub — minimal hls.js stub; supported controls isSupported() and lets
// the fatal ERROR handler be captured for the hls.js failure path.
function mkHlsStub(supported) {
  const log = { onCalls: [], destroyCalls: 0 };
  function HlsCtor() {
    this.loadSource  = function loadSource() {};
    this.attachMedia = function attachMedia() {};
    this.on          = function on(evt, cb) { log.onCalls.push({ evt, cb }); };
    this.destroy     = function destroy()   { log.destroyCalls += 1; };
  }
  HlsCtor.isSupported = function isSupported() { return supported; };
  HlsCtor.Events      = { MANIFEST_PARSED: 'hlsManifestParsed', ERROR: 'hlsError' };
  HlsCtor.log         = log;
  return HlsCtor;
}

// mkTsStub — minimal mpegts.js stub exposing the ERROR subscription.
function mkTsStub(supported) {
  const log = { onCalls: [], destroyCalls: 0 };
  const stub = {
    Events: { ERROR: 'tsError' },
    getFeatureList: function getFeatureList() { return { mseLivePlayback: supported }; },
    createPlayer: function createPlayer() {
      return {
        attachMediaElement: function attachMediaElement() {},
        on:      function on(evt, cb) { log.onCalls.push({ evt, cb }); },
        load:    function load()      {},
        play:    function play()      { return Promise.resolve(); },
        destroy: function destroy()   { log.destroyCalls += 1; },
      };
    },
    log,
  };
  return stub;
}

// Sample channel that ST.cur holds at the moment of failure.
const CH = { id: '42', name: 'World News 24', url: 'http://stream.test/news.m3u8', img: '', cat: '', num: 42 };

// ---------------------------------------------------------------------------
// onEngErr capture — records exactly one entry, only on failure (ADR-0027)
// ---------------------------------------------------------------------------
describe('onEngErr capture — failure records into IptvErrLog (ADR-0027)', function () {
  let ctx;

  beforeEach(function () {
    // No HLS support at all → loadPlay funnels into onEngErr (the dead-end path).
    ctx = loadPlay({ hls: null, ts: null, native: false, errlog: true });
    ctx.win.IptvSt.setCur(CH);
  });

  it('records exactly one entry when a playback attempt fails', function () {
    ctx.iptvPlay.loadPlay(CH.url); // .m3u8, no HLS support → onEngErr('HLS not supported')
    expect(ctx.win.IptvErrLog.count()).toBe(1);
  });

  it('captures the failed channel name / num / url and the engine detail', function () {
    ctx.iptvPlay.loadPlay(CH.url);
    const e = ctx.win.IptvErrLog.list()[0];
    expect(e.name).toBe('World News 24');
    expect(e.num).toBe(42);
    expect(e.url).toBe('http://stream.test/news.m3u8');
    expect(e.detail).toBe('HLS not supported');
  });

  it('records before teardown so ST.cur is still the failed channel', function () {
    ctx.iptvPlay.loadPlay(CH.url);
    // exactly one entry, and it carries the channel that was current at failure
    expect(ctx.win.IptvErrLog.count()).toBe(1);
    expect(ctx.win.IptvErrLog.list()[0].name).toBe(CH.name);
  });

  it('records via the fatal hls.js ERROR path with detail === the engine token', function () {
    const hls = mkHlsStub(true);
    const c   = loadPlay({ hls, ts: null, native: false, errlog: true });
    c.win.IptvSt.setCur(CH);
    c.iptvPlay.loadPlay(CH.url); // success so far — nothing logged yet
    expect(c.win.IptvErrLog.count()).toBe(0);
    const handler = hls.log.onCalls.find(function byEvt(o) { return o.evt === 'hlsError'; });
    handler.cb('hlsError', { fatal: true, details: 'manifestLoadError' });
    expect(c.win.IptvErrLog.count()).toBe(1);
    expect(c.win.IptvErrLog.list()[0].detail).toBe('manifestLoadError');
  });

  it('records via the fatal mpegts.js ERROR path with detail === mediaError', function () {
    const ts = mkTsStub(true);
    const c  = loadPlay({ hls: mkHlsStub(true), ts, native: false, errlog: true });
    c.win.IptvSt.setCur(CH);
    c.iptvPlay.loadPlay('http://stream.test/news.ts'); // mpegts path, success so far
    expect(c.win.IptvErrLog.count()).toBe(0);
    const handler = ts.log.onCalls.find(function byEvt(o) { return o.evt === 'tsError'; });
    handler.cb('NetworkError', 'mediaError');
    expect(c.win.IptvErrLog.count()).toBe(1);
    expect(c.win.IptvErrLog.list()[0].detail).toBe('mediaError');
  });
});

// ---------------------------------------------------------------------------
// onEngErr capture — null current channel → "Unknown channel" (ADR-0027)
// ---------------------------------------------------------------------------
describe('onEngErr capture — null ST.cur', function () {
  it('records an "Unknown channel" entry when ST.cur is null at failure', function () {
    const ctx = loadPlay({ hls: null, ts: null, native: false, errlog: true });
    ctx.win.IptvSt.setCur(null);
    ctx.iptvPlay.loadPlay('http://stream.test/news.m3u8');
    expect(ctx.win.IptvErrLog.count()).toBe(1);
    const e = ctx.win.IptvErrLog.list()[0];
    expect(e.name).toBe('Unknown channel');
    expect(e.num).toBeNull();
    expect(e.url).toBe('');
    expect(e.detail).toBe('HLS not supported');
  });
});

// ---------------------------------------------------------------------------
// onEngErr — guarded: works when IptvErrLog is absent (test isolation)
// ---------------------------------------------------------------------------
describe('onEngErr — guarded when IptvErrLog is absent', function () {
  it('does not throw on a failure when window.IptvErrLog is undefined', function () {
    const ctx = loadPlay({ hls: null, ts: null, native: false, errlog: false });
    ctx.win.IptvSt.setCur(CH);
    expect(ctx.win.IptvErrLog).toBeUndefined();
    expect(function () { ctx.iptvPlay.loadPlay(CH.url); }).not.toThrow();
    // the failure still transitions to ERR as before
    expect(ctx.win.IptvSt.ST.phase).toBe('ERR');
    expect(ctx.win.IptvSt.ST.err).toBe('HLS not supported');
  });
});

// ---------------------------------------------------------------------------
// success path — a successful play records nothing (only failures logged)
// ---------------------------------------------------------------------------
describe('success path — nothing is logged on a successful play (ADR-0027)', function () {
  it('a successful HLS loadPlay records no entry', function () {
    const ctx = loadPlay({ hls: mkHlsStub(true), ts: null, native: false, errlog: true });
    ctx.win.IptvSt.setCur(CH);
    const res = ctx.iptvPlay.loadPlay(CH.url);
    expect(res).toEqual({ ok: true, val: null });
    expect(ctx.win.IptvErrLog.count()).toBe(0);
  });

  it('a successful native-HLS loadPlay records no entry', function () {
    const ctx = loadPlay({ hls: mkHlsStub(false), ts: null, native: true, errlog: true });
    ctx.win.IptvSt.setCur(CH);
    ctx.iptvPlay.loadPlay(CH.url);
    expect(ctx.win.IptvErrLog.count()).toBe(0);
  });

  it('a successful mpegts loadPlay records no entry', function () {
    const ctx = loadPlay({ hls: mkHlsStub(true), ts: mkTsStub(true), native: false, errlog: true });
    ctx.win.IptvSt.setCur(CH);
    ctx.iptvPlay.loadPlay('http://stream.test/news.ts');
    expect(ctx.win.IptvErrLog.count()).toBe(0);
  });

  it('a successful retry (goPlay) of the current channel records no entry', function () {
    const ctx = loadPlay({ hls: mkHlsStub(true), ts: null, native: false, errlog: true });
    ctx.win.IptvSt.setCur(CH);
    ctx.win.IptvSt.go('ERR');
    ctx.win.IptvSt.setErr('mediaError');
    ctx.iptvPlay.goPlay();
    expect(ctx.win.IptvErrLog.count()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// index.html load order — errlog.js loads before play.js and before ui.js
// ---------------------------------------------------------------------------
describe('index.html — errlog.js load order', function () {
  let html;
  beforeEach(function () { html = readFileSync(HTML_SRC, 'utf8'); });

  it('includes the /errlog.js script', function () {
    expect(html).toContain('<script src="/errlog.js"></script>');
  });

  it('loads /errlog.js before /play.js', function () {
    expect(html.indexOf('/errlog.js')).toBeGreaterThan(-1);
    expect(html.indexOf('/errlog.js')).toBeLessThan(html.indexOf('/play.js'));
  });

  it('loads /errlog.js before /ui.js', function () {
    expect(html.indexOf('/errlog.js')).toBeLessThan(html.indexOf('/ui.js'));
  });

  it('the HTML ADR comment lists ADR-0027', function () {
    const head = html.slice(0, html.indexOf('<!DOCTYPE'));
    expect(head).toContain('ADR-0027');
  });
});
