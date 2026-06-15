// ADR: ADR-0004, ADR-0010, ADR-0012, ADR-0023, ADR-0036
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

// Remux wrapping expected for the MSE-less TS fallback (ADR-0012)
function rmxOf(url) {
  return '/api/hls?url=' + encodeURIComponent(url);
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
// getRmx() — remux URL construction (ADR-0012)
// ---------------------------------------------------------------------------
describe('getRmx() — remux URL construction', function () {
  let ctx;

  beforeEach(function () {
    ctx = loadPlay({ hls: mkHlsStub(true), ts: null, native: false });
  });

  it('wraps a raw stream URL as /api/hls?url=<encoded>', function () {
    const url = 'http://h.test/live/u/p/1.ts';
    expect(ctx.iptvPlay.getRmx(url)).toBe(rmxOf(url));
  });

  it('encodes query strings in the raw URL', function () {
    const url = 'http://h.test/1.ts?token=a&b=c';
    expect(ctx.iptvPlay.getRmx(url)).toBe('/api/hls?url=' + encodeURIComponent(url));
  });
});

// ---------------------------------------------------------------------------
// loadPlay() — MSE-less TS fallback to remuxed HLS (ADR-0012)
// ---------------------------------------------------------------------------
describe('loadPlay() — mpegts unsupported, remux fallback', function () {
  it('falls back ok via hls.js when mseLivePlayback is false', function () {
    const hls = mkHlsStub(true);
    const ctx = loadPlay({ hls, ts: mkTsStub(false), native: false });
    const url = 'http://stream.test/1.ts';
    const res = ctx.iptvPlay.loadPlay(url);
    expect(res).toEqual({ ok: true, val: null });
    expect(hls.log.loadSourceCalls).toEqual([rmxOf(url)]);
  });

  it('falls back ok via hls.js when window.mpegts is absent', function () {
    const hls = mkHlsStub(true);
    const ctx = loadPlay({ hls, ts: null, native: false });
    const url = 'http://stream.test/1.ts';
    const res = ctx.iptvPlay.loadPlay(url);
    expect(res).toEqual({ ok: true, val: null });
    expect(hls.log.loadSourceCalls).toEqual([rmxOf(url)]);
  });

  it('hands the remux URL — not the /api/xtream wrapper — to the HLS path', function () {
    const hls = mkHlsStub(true);
    const ctx = loadPlay({ hls, ts: null, native: false });
    const url = 'http://stream.test/live/u/p/9.ts';
    ctx.iptvPlay.loadPlay(url);
    expect(hls.log.loadSourceCalls[0]).toBe(rmxOf(url));
    expect(hls.log.loadSourceCalls[0]).not.toContain('/api/xtream');
    expect(hls.log.loadSourceCalls[0]).not.toContain(encodeURIComponent(prxOf(url)));
  });

  it('falls back to native HLS with the remux URL when hls.js is unsupported', function () {
    const ctx = loadPlay({ hls: mkHlsStub(false), ts: null, native: true });
    const url = 'http://stream.test/1.ts';
    const res = ctx.iptvPlay.loadPlay(url);
    expect(res).toEqual({ ok: true, val: null });
    expect(ctx.vid.src).toBe(rmxOf(url));
  });

  it('does not transition to ERR when the fallback engages', function () {
    const ctx = loadPlay({ hls: mkHlsStub(true), ts: mkTsStub(false), native: false });
    ctx.iptvPlay.loadPlay('http://stream.test/1.ts');
    expect(ctx.win.IptvSt.ST.phase).not.toBe('ERR');
    expect(ctx.win.IptvSt.ST.err).toBe(null);
  });

  it('errors "MPEG-TS not supported" only when the fallback HLS path cannot play', function () {
    const ctx = loadPlay({ hls: null, ts: null, native: false });
    const res = ctx.iptvPlay.loadPlay('http://stream.test/1.ts');
    expect(res).toEqual({ ok: false, err: 'MPEG-TS not supported' });
    expect(ctx.win.IptvSt.ST.phase).toBe('ERR');
    expect(ctx.win.IptvSt.ST.err).toBe('MPEG-TS not supported');
  });

  it('keeps "HLS not supported" for an unplayable .m3u8 URL', function () {
    const ctx = loadPlay({ hls: null, ts: null, native: false });
    const res = ctx.iptvPlay.loadPlay('http://stream.test/live.m3u8');
    expect(res).toEqual({ ok: false, err: 'HLS not supported' });
  });
});

// ---------------------------------------------------------------------------
// getArchUrl() — pure Xtream timeshift archive URL builder (ADR-0036)
// ---------------------------------------------------------------------------

// Expected local-time stamp YYYY-MM-DD:HH-MM, computed the same way the builder
// does so the assertion is timezone-independent.
function stampOf(ts) {
  const d = new Date(ts);
  const p = function p2(n) { return n < 10 ? '0' + n : String(n); };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
    + ':' + p(d.getHours()) + '-' + p(d.getMinutes());
}

describe('getArchUrl() — timeshift archive URL builder', function () {
  let ctx;
  // A fixed reference instant and a 30-minute program around it.
  const START = Date.UTC(2026, 0, 15, 12, 0, 0);   // 2026-01-15 12:00 UTC
  const STOP  = START + 30 * 60000;                 // +30 min

  beforeEach(function () {
    ctx = loadPlay({ hls: mkHlsStub(true), ts: null, native: false });
  });

  it('builds the timeshift form from a TS live URL', function () {
    const ch  = { url: 'http://portal.test:8080/live/usr/pss/42.ts' };
    const prg = { start: START, stop: STOP };
    const url = ctx.iptvPlay.getArchUrl({ ch, prg });
    expect(url).toBe('http://portal.test:8080/timeshift/usr/pss/30/' + stampOf(START) + '/42.ts');
  });

  it('builds the timeshift form from an HLS live URL', function () {
    const ch  = { url: 'https://portal.test/live/usr/pss/7.m3u8' };
    const prg = { start: START, stop: STOP };
    const url = ctx.iptvPlay.getArchUrl({ ch, prg });
    expect(url).toBe('https://portal.test/timeshift/usr/pss/30/' + stampOf(START) + '/7.m3u8');
  });

  it('preserves base/user/pass/stream-id/ext exactly from the live URL', function () {
    const ch  = { url: 'http://a.b.example:25461/live/U-1/P_2/123.ts' };
    const prg = { start: START, stop: STOP };
    const url = ctx.iptvPlay.getArchUrl({ ch, prg });
    expect(url.startsWith('http://a.b.example:25461/timeshift/U-1/P_2/')).toBe(true);
    expect(url.endsWith('/123.ts')).toBe(true);
  });

  it('formats the start stamp as local YYYY-MM-DD:HH-MM', function () {
    const ch  = { url: 'http://portal.test/live/usr/pss/1.ts' };
    const prg = { start: START, stop: STOP };
    const url = ctx.iptvPlay.getArchUrl({ ch, prg });
    expect(url).toContain('/' + stampOf(START) + '/');
    expect(stampOf(START)).toMatch(/^\d{4}-\d{2}-\d{2}:\d{2}-\d{2}$/);
  });

  it('rounds a 30-minute program to a duration of 30', function () {
    const ch  = { url: 'http://portal.test/live/usr/pss/1.ts' };
    const url = ctx.iptvPlay.getArchUrl({ ch, prg: { start: START, stop: START + 30 * 60000 } });
    expect(url).toContain('/timeshift/usr/pss/30/');
  });

  it('rounds duration to the nearest whole minute (89s → 1)', function () {
    const ch  = { url: 'http://portal.test/live/usr/pss/1.ts' };
    const url = ctx.iptvPlay.getArchUrl({ ch, prg: { start: START, stop: START + 89000 } });
    expect(url).toContain('/timeshift/usr/pss/1/');
  });

  it('rounds duration to the nearest whole minute (91s → 2)', function () {
    const ch  = { url: 'http://portal.test/live/usr/pss/1.ts' };
    const url = ctx.iptvPlay.getArchUrl({ ch, prg: { start: START, stop: START + 91000 } });
    expect(url).toContain('/timeshift/usr/pss/2/');
  });

  it('clamps a sub-minute program to a minimum duration of 1', function () {
    const ch  = { url: 'http://portal.test/live/usr/pss/1.ts' };
    const url = ctx.iptvPlay.getArchUrl({ ch, prg: { start: START, stop: START + 5000 } });
    expect(url).toContain('/timeshift/usr/pss/1/');
  });

  it('clamps a zero-length program to a minimum duration of 1', function () {
    const ch  = { url: 'http://portal.test/live/usr/pss/1.ts' };
    const url = ctx.iptvPlay.getArchUrl({ ch, prg: { start: START, stop: START } });
    expect(url).toContain('/timeshift/usr/pss/1/');
  });

  it('getEng(getArchUrl) === getEng(ch.url) for a TS channel', function () {
    const ch  = { url: 'http://portal.test/live/usr/pss/42.ts' };
    const prg = { start: START, stop: STOP };
    const url = ctx.iptvPlay.getArchUrl({ ch, prg });
    expect(ctx.iptvPlay.getEng(url)).toBe(ctx.iptvPlay.getEng(ch.url));
    expect(ctx.iptvPlay.getEng(url)).toBe('ts');
  });

  it('getEng(getArchUrl) === getEng(ch.url) for an HLS channel', function () {
    const ch  = { url: 'https://portal.test/live/usr/pss/7.m3u8' };
    const prg = { start: START, stop: STOP };
    const url = ctx.iptvPlay.getArchUrl({ ch, prg });
    expect(ctx.iptvPlay.getEng(url)).toBe(ctx.iptvPlay.getEng(ch.url));
    expect(ctx.iptvPlay.getEng(url)).toBe('hls');
  });

  it('is pure — no ST mutation, no DOM, returns a plain string', function () {
    const ch  = { url: 'http://portal.test/live/usr/pss/1.ts' };
    const prg = { start: START, stop: STOP };
    const before = ctx.win.IptvSt.ST.phase;
    const url = ctx.iptvPlay.getArchUrl({ ch, prg });
    expect(typeof url).toBe('string');
    expect(ctx.win.IptvSt.ST.phase).toBe(before);
    expect(ctx.win.IptvSt.ST.err).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// loadPlay() — fallback engine teardown across switches (ADR-0012)
// ---------------------------------------------------------------------------
describe('loadPlay() — remux fallback teardown', function () {
  it('destroys the fallback hls instance when switching to another TS channel', function () {
    const hls = mkHlsStub(true);
    const ctx = loadPlay({ hls, ts: null, native: false });
    ctx.iptvPlay.loadPlay('http://stream.test/ch1.ts');
    ctx.iptvPlay.loadPlay('http://stream.test/ch2.ts');
    expect(hls.log.destroyCalls).toBe(1);
    expect(hls.log.loadSourceCalls.length).toBe(2);
  });

  it('destroys the fallback hls instance when switching to a .m3u8 channel', function () {
    const hls = mkHlsStub(true);
    const ctx = loadPlay({ hls, ts: null, native: false });
    ctx.iptvPlay.loadPlay('http://stream.test/ch1.ts');
    ctx.iptvPlay.loadPlay('http://stream.test/ch2.m3u8');
    expect(hls.log.destroyCalls).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// loadPlay() — chip reflects the engine actually in use (ADR-0012)
// ---------------------------------------------------------------------------
describe('loadPlay() — fallback chip rendering', function () {
  it('renders the hls chip when the TS fallback engages', function () {
    const ctx  = loadPlay({ hls: mkHlsStub(true), ts: null, native: false });
    const engs = [];
    ctx.win.IptvUi = { rndChip: function rndChip(e) { engs.push(e); } };
    ctx.iptvPlay.loadPlay('http://stream.test/1.ts');
    expect(engs).toEqual(['hls']);
  });

  it('renders the ts chip when MSE live playback is available', function () {
    const ctx  = loadPlay({ hls: mkHlsStub(true), ts: mkTsStub(true), native: false });
    const engs = [];
    ctx.win.IptvUi = { rndChip: function rndChip(e) { engs.push(e); } };
    ctx.iptvPlay.loadPlay('http://stream.test/1.ts');
    expect(engs).toEqual(['ts']);
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
// goPlay() — Retry entry point re-attempts ST.cur through the play path (ADR-0023)
// ---------------------------------------------------------------------------
describe('goPlay() — retry re-plays the current channel', function () {
  it('re-invokes loadPlay for ST.cur after a stream error', function () {
    const hls = mkHlsStub(true);
    const ctx = loadPlay({ hls, ts: null, native: false });
    const ch  = { id: '7', name: 'Seven', url: 'http://stream.test/seven.m3u8', img: '', cat: '', num: 7 };
    ctx.win.IptvSt.setCur(ch);
    ctx.win.IptvSt.go('ERR');
    ctx.win.IptvSt.setErr('mediaError');
    ctx.iptvPlay.goPlay();
    // a fresh load of ST.cur.url went through the proxied HLS path
    expect(hls.log.loadSourceCalls).toContain(prxOf(ch.url));
  });

  it('clears ST.err and leaves the phase out of ERR', function () {
    const ctx = loadPlay({ hls: mkHlsStub(true), ts: null, native: false });
    const ch  = { id: '8', name: 'Eight', url: 'http://stream.test/eight.m3u8', img: '', cat: '', num: 8 };
    ctx.win.IptvSt.setCur(ch);
    ctx.win.IptvSt.go('ERR');
    ctx.win.IptvSt.setErr('mediaError');
    ctx.iptvPlay.goPlay();
    expect(ctx.win.IptvSt.ST.phase).not.toBe('ERR');
    expect(ctx.win.IptvSt.ST.err).toBe(null);
  });

  it('is a no-op when there is no current channel', function () {
    const hls = mkHlsStub(true);
    const ctx = loadPlay({ hls, ts: null, native: false });
    ctx.win.IptvSt.setCur(null);
    ctx.iptvPlay.goPlay();
    expect(hls.log.loadSourceCalls.length).toBe(0);
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
