// ADR: ADR-0004
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const PLAY_SRC   = join(__dir, '../../client/play.js');
const ST_SRC     = join(__dir, '../../client/st.js');

// ---------------------------------------------------------------------------
// loadPlay — execute play.js in isolated window context
// ---------------------------------------------------------------------------
function loadPlay(hlsStub, canNative) {
  const win = {};

  const stSrc = readFileSync(ST_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  const stFn = new Function('window', '"use strict";\n' + stSrc + '\nreturn window.IptvSt;');
  stFn(win);
  win.IptvSt.go('LOAD');
  win.IptvSt.go('READY');

  if (hlsStub !== null) {
    win.Hls = hlsStub;
  }

  const src = readFileSync(PLAY_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  const fn = new Function('window', '"use strict";\n' + src + '\nreturn window.IptvPlay;');
  const iptvPlay = fn(win);

  const vid = {
    src: '',
    canPlayType: function canPlayType() { return canNative ? 'probably' : ''; },
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
// loadPlay() — Hls.isSupported() = true
// ---------------------------------------------------------------------------
describe('loadPlay() — Hls supported', function () {
  let ctx;
  let stub;

  beforeEach(function () {
    stub = mkHlsStub(true);
    ctx  = loadPlay(stub, false);
  });

  it('returns { ok: true, val: null }', function () {
    const res = ctx.iptvPlay.loadPlay('http://stream.test/live.m3u8');
    expect(res).toEqual({ ok: true, val: null });
  });

  it('calls hls.loadSource with the url', function () {
    const url = 'http://stream.test/live.m3u8';
    ctx.iptvPlay.loadPlay(url);
    expect(stub.log.loadSourceCalls).toContain(url);
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
    const stub = mkHlsStub(false);
    ctx = loadPlay(stub, true);
  });

  it('returns { ok: true, val: null }', function () {
    const res = ctx.iptvPlay.loadPlay('http://stream.test/live.m3u8');
    expect(res).toEqual({ ok: true, val: null });
  });

  it('sets vid.src to the url', function () {
    const url = 'http://stream.test/live.m3u8';
    ctx.iptvPlay.loadPlay(url);
    expect(ctx.vid.src).toBe(url);
  });
});

// ---------------------------------------------------------------------------
// loadPlay() — neither Hls nor native HLS supported
// ---------------------------------------------------------------------------
describe('loadPlay() — no HLS support', function () {
  let ctx;

  beforeEach(function () {
    ctx = loadPlay(null, false);
  });

  it('returns { ok: false, err: "HLS not supported" }', function () {
    const res = ctx.iptvPlay.loadPlay('http://stream.test/live.m3u8');
    expect(res).toEqual({ ok: false, err: 'HLS not supported' });
  });
});

// ---------------------------------------------------------------------------
// stopPlay() — destroys hls instance when one exists
// ---------------------------------------------------------------------------
describe('stopPlay()', function () {
  it('calls hls.destroy when an instance exists', function () {
    const stub = mkHlsStub(true);
    const ctx  = loadPlay(stub, false);
    ctx.iptvPlay.loadPlay('http://stream.test/live.m3u8');
    ctx.iptvPlay.stopPlay();
    expect(stub.log.destroyCalls).toBe(1);
  });

  it('clears vid.src after stopPlay', function () {
    const stub = mkHlsStub(true);
    const ctx  = loadPlay(stub, false);
    ctx.iptvPlay.loadPlay('http://stream.test/live.m3u8');
    ctx.iptvPlay.stopPlay();
    expect(ctx.vid.src).toBe('');
  });

  it('does not throw when no hls instance exists', function () {
    const ctx = loadPlay(null, false);
    expect(function () { ctx.iptvPlay.stopPlay(); }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// loadPlay() — re-entrant call destroys previous instance first
// ---------------------------------------------------------------------------
describe('loadPlay() — re-entrant call destroys previous instance', function () {
  it('destroys previous hls instance before creating a new one', function () {
    const stub = mkHlsStub(true);
    const ctx  = loadPlay(stub, false);
    ctx.iptvPlay.loadPlay('http://stream.test/ch1.m3u8');
    ctx.iptvPlay.loadPlay('http://stream.test/ch2.m3u8');
    expect(stub.log.destroyCalls).toBe(1);
  });
});
