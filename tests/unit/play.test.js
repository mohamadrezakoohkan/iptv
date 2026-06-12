// ADR: ADR-0004, ADR-0010
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const PLAY_SRC   = join(__dir, '../../client/play.js');
const ST_SRC     = join(__dir, '../../client/st.js');

// Proxy wrapping expected for every absolute stream URL (ADR-0010)
function prxOf(url) {
  return '/api/xtream?url=' + encodeURIComponent(url);
}

// ---------------------------------------------------------------------------
// loadPlay — execute play.js in isolated window context
// opts: { hls: HlsStub|null, ts: mpegtsStub|null, native: boolean }
// ---------------------------------------------------------------------------
function loadPlay(opts) {
  const win = {};

  const stSrc = readFileSync(ST_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  const stFn = new Function('window', '"use strict";\n' + stSrc + '\nreturn window.IptvSt;');
  stFn(win);
  win.IptvSt.go('LOAD');
  win.IptvSt.go('READY');

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

// ---------------------------------------------------------------------------
// mkHlsStub — stub constructor that tracks calls via shared call-log objects
// ---------------------------------------------------------------------------
function mkHlsStub(supported) {
  const log = {
    loadSourceCalls:  [],
    attachMediaCalls: [],
    destroyCalls:     0,
    onCalls:          [],
  };

  function HlsCtor() {
    this.loadSource  = function loadSource(u)  { log.loadSourceCalls.push(u); };
    this.attachMedia = function attachMedia(e)  { log.attachMediaCalls.push(e); };
    this.on          = function on(evt, cb)     { log.onCalls.push({ evt, cb }); };
    this.destroy     = function destroy()       { log.destroyCalls += 1; };
  }

  HlsCtor.isSupported = function isSupported() { return supported; };
  HlsCtor.Events      = { MANIFEST_PARSED: 'hlsManifestParsed', ERROR: 'hlsError' };
  HlsCtor.log         = log;

  return HlsCtor;
}

// ---------------------------------------------------------------------------
// mkTsStub — stub mpegts global tracking createPlayer/player calls
// ---------------------------------------------------------------------------
function mkTsStub(supported) {
  const log = {
    createCalls:  [],
    attachCalls:  [],
    loadCalls:    0,
    playCalls:    0,
    destroyCalls: 0,
    onCalls:      [],
  };

  const stub = {
    Events: { ERROR: 'tsError' },
    getFeatureList: function getFeatureList() { return { mseLivePlayback: supported }; },
    createPlayer: function createPlayer(o) {
      log.createCalls.push(o);
      return {
        attachMediaElement: function attachMediaElement(el) { log.attachCalls.push(el); },
        on:      function on(evt, cb) { log.onCalls.push({ evt, cb }); },
        load:    function load()      { log.loadCalls += 1; },
        play:    function play()      { log.playCalls += 1; return Promise.resolve(); },
        destroy: function destroy()   { log.destroyCalls += 1; },
      };
    },
    log,
  };

  return stub;
}

// ---------------------------------------------------------------------------
// getEng() — engine selection from URL extension, query ignored
// ---------------------------------------------------------------------------
describe('getEng() — engine selection', function () {
  let ctx;

  beforeEach(function () {
    ctx = loadPlay({ hls: mkHlsStub(true), ts: null, native: false });
  });

  it('selects hls for a .m3u8 URL', function () {
    expect(ctx.iptvPlay.getEng('http://h.test/live/u/p/1.m3u8')).toBe('hls');
  });

  it('selects hls for a .m3u8 URL with a query string', function () {
    expect(ctx.iptvPlay.getEng('http://h.test/live.m3u8?token=a.ts')).toBe('hls');
  });

  it('selects ts for a .ts URL', function () {
    expect(ctx.iptvPlay.getEng('http://h.test/live/u/p/1.ts')).toBe('ts');
  });

  it('selects ts for a .ts URL with a query string', function () {
    expect(ctx.iptvPlay.getEng('http://h.test/1.ts?ext=.m3u8')).toBe('ts');
  });

  it('selects ts for an extension-less URL', function () {
    expect(ctx.iptvPlay.getEng('http://h.test/stream/1')).toBe('ts');
  });

  it('is case-insensitive on the extension', function () {
    expect(ctx.iptvPlay.getEng('http://h.test/LIVE.M3U8')).toBe('hls');
  });
});

// ---------------------------------------------------------------------------
// getPrx() — proxy URL wrapping
// ---------------------------------------------------------------------------
describe('getPrx() — proxy wrapping', function () {
  let ctx;

  beforeEach(function () {
    ctx = loadPlay({ hls: mkHlsStub(true), ts: null, native: false });
  });

  it('wraps an absolute URL as /api/xtream?url=<encoded>', function () {
    const url = 'http://h.test/live/u/p/1.ts';
    expect(ctx.iptvPlay.getPrx(url)).toBe(prxOf(url));
  });

  it('leaves an already-relative URL untouched', function () {
    expect(ctx.iptvPlay.getPrx('/api/xtream?url=x')).toBe('/api/xtream?url=x');
  });
});

// ---------------------------------------------------------------------------
// loadPlay() — Hls.isSupported() = true
// ---------------------------------------------------------------------------
describe('loadPlay() — Hls supported', function () {
  let ctx;
  let stub;

  beforeEach(function () {
    stub = mkHlsStub(true);
    ctx  = loadPlay({ hls: stub, ts: null, native: false });
  });

  it('returns { ok: true, val: null }', function () {
    const res = ctx.iptvPlay.loadPlay('http://stream.test/live.m3u8');
    expect(res).toEqual({ ok: true, val: null });
  });

  it('calls hls.loadSource with the proxied url', function () {
    const url = 'http://stream.test/live.m3u8';
    ctx.iptvPlay.loadPlay(url);
    expect(stub.log.loadSourceCalls).toContain(prxOf(url));
  });

  it('calls hls.attachMedia with the video element', function () {
    ctx.iptvPlay.loadPlay('http://stream.test/live.m3u8');
    expect(stub.log.attachMediaCalls).toContain(ctx.vid);
  });
});

// ---------------------------------------------------------------------------
// loadPlay() — Hls not supported, native HLS available
// ---------------------------------------------------------------------------
describe('loadPlay() — Hls not supported, native fallback', function () {
  let ctx;

  beforeEach(function () {
    ctx = loadPlay({ hls: mkHlsStub(false), ts: null, native: true });
  });

  it('returns { ok: true, val: null }', function () {
    const res = ctx.iptvPlay.loadPlay('http://stream.test/live.m3u8');
    expect(res).toEqual({ ok: true, val: null });
  });

  it('sets vid.src to the proxied url', function () {
    const url = 'http://stream.test/live.m3u8';
    ctx.iptvPlay.loadPlay(url);
    expect(ctx.vid.src).toBe(prxOf(url));
  });
});

// ---------------------------------------------------------------------------
// loadPlay() — neither Hls nor native HLS supported
// ---------------------------------------------------------------------------
describe('loadPlay() — no HLS support', function () {
  let ctx;

  beforeEach(function () {
    ctx = loadPlay({ hls: null, ts: null, native: false });
  });

  it('returns { ok: false, err: "HLS not supported" }', function () {
    const res = ctx.iptvPlay.loadPlay('http://stream.test/live.m3u8');
    expect(res).toEqual({ ok: false, err: 'HLS not supported' });
  });

  it('transitions state to ERR with the message', function () {
    ctx.iptvPlay.loadPlay('http://stream.test/live.m3u8');
    expect(ctx.win.IptvSt.ST.phase).toBe('ERR');
    expect(ctx.win.IptvSt.ST.err).toBe('HLS not supported');
  });
});

// ---------------------------------------------------------------------------
// loadPlay() — mpegts path, feature supported
// ---------------------------------------------------------------------------
describe('loadPlay() — mpegts supported', function () {
  let ctx;
  let ts;

  beforeEach(function () {
    ts  = mkTsStub(true);
    ctx = loadPlay({ hls: mkHlsStub(true), ts, native: false });
  });

  it('returns { ok: true, val: null } for a .ts url', function () {
    const res = ctx.iptvPlay.loadPlay('http://stream.test/live/u/p/1.ts');
    expect(res).toEqual({ ok: true, val: null });
  });

  it('creates the player with type mpegts, isLive true, proxied url', function () {
    const url = 'http://stream.test/live/u/p/1.ts';
    ctx.iptvPlay.loadPlay(url);
    expect(ts.log.createCalls).toEqual([{ type: 'mpegts', isLive: true, url: prxOf(url) }]);
  });

  it('attaches the video element, loads and plays', function () {
    ctx.iptvPlay.loadPlay('http://stream.test/1.ts');
    expect(ts.log.attachCalls).toContain(ctx.vid);
    expect(ts.log.loadCalls).toBe(1);
    expect(ts.log.playCalls).toBe(1);
  });

  it('subscribes to the mpegts ERROR event', function () {
    ctx.iptvPlay.loadPlay('http://stream.test/1.ts');
    const evts = ts.log.onCalls.map(function pick(c) { return c.evt; });
    expect(evts).toContain('tsError');
  });
});

// ---------------------------------------------------------------------------
// loadPlay() — mpegts unsupported (mseLivePlayback false / global absent)
// ---------------------------------------------------------------------------
describe('loadPlay() — mpegts unsupported', function () {
  it('returns the error Result when mseLivePlayback is false', function () {
    const ctx = loadPlay({ hls: mkHlsStub(true), ts: mkTsStub(false), native: false });
    const res = ctx.iptvPlay.loadPlay('http://stream.test/1.ts');
    expect(res).toEqual({ ok: false, err: 'MPEG-TS not supported' });
  });

  it('returns the error Result when window.mpegts is absent', function () {
    const ctx = loadPlay({ hls: mkHlsStub(true), ts: null, native: false });
    const res = ctx.iptvPlay.loadPlay('http://stream.test/1.ts');
    expect(res).toEqual({ ok: false, err: 'MPEG-TS not supported' });
  });

  it('transitions state to ERR with "MPEG-TS not supported"', function () {
    const ctx = loadPlay({ hls: mkHlsStub(true), ts: mkTsStub(false), native: false });
    ctx.iptvPlay.loadPlay('http://stream.test/1.ts');
    expect(ctx.win.IptvSt.ST.phase).toBe('ERR');
    expect(ctx.win.IptvSt.ST.err).toBe('MPEG-TS not supported');
  });
});

// ---------------------------------------------------------------------------
// mpegts fatal error — ERROR event handler transitions to ERR and tears down
// ---------------------------------------------------------------------------
describe('mpegts ERROR event', function () {
  it('sets ERR phase and destroys the player', function () {
    const ts  = mkTsStub(true);
    const ctx = loadPlay({ hls: mkHlsStub(true), ts, native: false });
    ctx.iptvPlay.loadPlay('http://stream.test/1.ts');
    const handler = ts.log.onCalls.find(function byEvt(c) { return c.evt === 'tsError'; });
    handler.cb('NetworkError', 'Exception');
    expect(ctx.win.IptvSt.ST.phase).toBe('ERR');
    expect(ctx.win.IptvSt.ST.err).toBe('Exception');
    expect(ts.log.destroyCalls).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// stopPlay() — destroys whichever engine instance exists
// ---------------------------------------------------------------------------
describe('stopPlay()', function () {
  it('calls hls.destroy when an hls instance exists', function () {
    const stub = mkHlsStub(true);
    const ctx  = loadPlay({ hls: stub, ts: null, native: false });
    ctx.iptvPlay.loadPlay('http://stream.test/live.m3u8');
    ctx.iptvPlay.stopPlay();
    expect(stub.log.destroyCalls).toBe(1);
  });

  it('calls player.destroy when an mpegts instance exists', function () {
    const ts  = mkTsStub(true);
    const ctx = loadPlay({ hls: mkHlsStub(true), ts, native: false });
    ctx.iptvPlay.loadPlay('http://stream.test/1.ts');
    ctx.iptvPlay.stopPlay();
    expect(ts.log.destroyCalls).toBe(1);
  });

  it('clears vid.src after stopPlay', function () {
    const stub = mkHlsStub(true);
    const ctx  = loadPlay({ hls: stub, ts: null, native: false });
    ctx.iptvPlay.loadPlay('http://stream.test/live.m3u8');
    ctx.iptvPlay.stopPlay();
    expect(ctx.vid.src).toBe('');
  });

  it('does not throw when no engine instance exists', function () {
    const ctx = loadPlay({ hls: null, ts: null, native: false });
    expect(function () { ctx.iptvPlay.stopPlay(); }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// loadPlay() — re-entrant call destroys previous instance, both directions
// ---------------------------------------------------------------------------
describe('loadPlay() — engine switch teardown', function () {
  it('destroys previous hls instance before creating a new one', function () {
    const stub = mkHlsStub(true);
    const ctx  = loadPlay({ hls: stub, ts: null, native: false });
    ctx.iptvPlay.loadPlay('http://stream.test/ch1.m3u8');
    ctx.iptvPlay.loadPlay('http://stream.test/ch2.m3u8');
    expect(stub.log.destroyCalls).toBe(1);
  });

  it('destroys the hls instance when switching HLS -> TS', function () {
    const hls = mkHlsStub(true);
    const ts  = mkTsStub(true);
    const ctx = loadPlay({ hls, ts, native: false });
    ctx.iptvPlay.loadPlay('http://stream.test/ch1.m3u8');
    ctx.iptvPlay.loadPlay('http://stream.test/ch2.ts');
    expect(hls.log.destroyCalls).toBe(1);
    expect(ts.log.createCalls.length).toBe(1);
  });

  it('destroys the mpegts instance when switching TS -> HLS', function () {
    const hls = mkHlsStub(true);
    const ts  = mkTsStub(true);
    const ctx = loadPlay({ hls, ts, native: false });
    ctx.iptvPlay.loadPlay('http://stream.test/ch1.ts');
    ctx.iptvPlay.loadPlay('http://stream.test/ch2.m3u8');
    expect(ts.log.destroyCalls).toBe(1);
    expect(hls.log.loadSourceCalls.length).toBe(1);
  });

  it('destroys the previous mpegts instance when switching TS -> TS', function () {
    const ts  = mkTsStub(true);
    const ctx = loadPlay({ hls: mkHlsStub(true), ts, native: false });
    ctx.iptvPlay.loadPlay('http://stream.test/ch1.ts');
    ctx.iptvPlay.loadPlay('http://stream.test/ch2.ts');
    expect(ts.log.destroyCalls).toBe(1);
    expect(ts.log.createCalls.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// loadPlay() — chip rendering hook (IptvUi.rndChip when present)
// ---------------------------------------------------------------------------
describe('loadPlay() — engine chip hook', function () {
  it('calls IptvUi.rndChip with the selected engine', function () {
    const ctx  = loadPlay({ hls: mkHlsStub(true), ts: mkTsStub(true), native: false });
    const engs = [];
    ctx.win.IptvUi = { rndChip: function rndChip(e) { engs.push(e); } };
    ctx.iptvPlay.loadPlay('http://stream.test/a.m3u8');
    ctx.iptvPlay.loadPlay('http://stream.test/b.ts');
    expect(engs).toEqual(['hls', 'ts']);
  });
});
