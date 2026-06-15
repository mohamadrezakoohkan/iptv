// ADR: ADR-0030, ADR-0036, ADR-0041
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const API_SRC    = join(__dir, '../../client/api.js');
const EPG_SRC    = join(__dir, '../../client/epg.js');

/** Build the IptvEpg store on the given window (fresh in-memory store). */
function mkEpg(win) {
  const src = readFileSync(EPG_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  const fn = new Function('window', '"use strict";\n' + src + '\nreturn window.IptvEpg;');
  fn(win);
  return win.IptvEpg;
}

/** Execute client/api.js against the given globals, return window.IptvApi.
 *  The same window also carries IptvEpg, so loadEpg writes a real store. */
function mkApi(globals) {
  const win = {};
  mkEpg(win);
  Object.assign(globals, { window: win });
  const src = readFileSync(API_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  const fn = new Function(
    ...Object.keys(globals),
    '"use strict";\n' + src + '\nreturn { api: window.IptvApi, epg: window.IptvEpg };'
  );
  return fn(...Object.values(globals));
}

/** Standard global shims for the api IIFE. fetch is supplied per test. */
function shims(fetchFn) {
  return { fetch: fetchFn, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController, URL };
}

/** UTF-8-safe base64 encode (matches epg.js getDec decoder). */
function b64(text) {
  return Buffer.from(text, 'utf8').toString('base64');
}

/** A get_simple_data_table payload with one valid listing for the given window. */
function xtPayload(startSec, stopSec) {
  return {
    epg_listings: [
      { title: b64('On Air'), description: b64('desc'), start_timestamp: String(startSec), stop_timestamp: String(stopSec) },
    ],
  };
}

/** A minimal XMLTV doc with one programme for channel id. */
function xmltvFor(id) {
  return '<?xml version="1.0"?><tv><programme channel="' + id
    + '" start="20260615120000 +0000" stop="20260615130000 +0000">'
    + '<title>News</title></programme></tv>';
}

// ---------------------------------------------------------------------------
// Xtream path
// ---------------------------------------------------------------------------
describe('loadEpg — Xtream path', function () {
  it('builds proxied get_simple_data_table URLs and populates the store', async function () {
    const calls = [];
    const fetchFn = vi.fn(function onFetch(url) {
      calls.push(url);
      return Promise.resolve({ ok: true, json: () => Promise.resolve(xtPayload(1700000000, 1700003600)), text: () => Promise.resolve('') });
    });
    const { api, epg } = mkApi(shims(fetchFn));
    const chs = [{ id: '10', name: 'A' }, { id: '20', name: 'B' }];
    const res = await api.loadEpg({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, chs });

    expect(res.ok).toBe(true);
    expect(epg.has('10')).toBe(true);
    expect(epg.has('20')).toBe(true);
    expect(epg.count()).toBe(2);
    // Each call goes through the existing /api/xtream proxy with the action + stream id.
    for (const url of calls) {
      expect(url.startsWith('/api/xtream?url=')).toBe(true);
      const inner = decodeURIComponent(url.replace('/api/xtream?url=', ''));
      expect(inner).toContain('action=get_simple_data_table');
      expect(inner).toContain('player_api.php');
    }
    expect(decodeURIComponent(calls[0])).toContain('stream_id=10');
    expect(decodeURIComponent(calls[1])).toContain('stream_id=20');
  });

  it('decodes base64 title/description and stores parsed Prg', async function () {
    const fetchFn = vi.fn(function onFetch() {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(xtPayload(1700000000, 1700003600)), text: () => Promise.resolve('') });
    });
    const { api, epg } = mkApi(shims(fetchFn));
    await api.loadEpg({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, chs: [{ id: '10', name: 'A' }] });
    const prgs = epg.get('10');
    expect(prgs.length).toBe(1);
    expect(prgs[0].title).toBe('On Air');
    expect(prgs[0].start).toBe(1700000000 * 1000);
    expect(prgs[0].stop).toBe(1700003600 * 1000);
  });

  it('batches so concurrent in-flight requests never exceed the budget (6)', async function () {
    let inFlight = 0;
    let peak = 0;
    const fetchFn = vi.fn(function onFetch() {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      return new Promise(function settle(resolve) {
        setTimeout(function done() {
          inFlight -= 1;
          resolve({ ok: true, json: () => Promise.resolve(xtPayload(1700000000, 1700003600)), text: () => Promise.resolve('') });
        }, 0);
      });
    });
    const { api } = mkApi(shims(fetchFn));
    const chs = [];
    for (let i = 0; i < 30; i += 1) chs.push({ id: String(i), name: 'C' + i });
    await api.loadEpg({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, chs });
    expect(fetchFn).toHaveBeenCalledTimes(30);
    expect(peak).toBeLessThanOrEqual(6);
  });

  it('caps the number of channels fetched (≤ 120) so a huge portal is not hammered', async function () {
    const fetchFn = vi.fn(function onFetch() {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(xtPayload(1700000000, 1700003600)), text: () => Promise.resolve('') });
    });
    const { api } = mkApi(shims(fetchFn));
    const chs = [];
    for (let i = 0; i < 500; i += 1) chs.push({ id: String(i), name: 'C' + i });
    await api.loadEpg({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, chs });
    expect(fetchFn).toHaveBeenCalledTimes(120);
  });
});

// ---------------------------------------------------------------------------
// M3U / XMLTV path
// ---------------------------------------------------------------------------
describe('loadEpg — M3U XMLTV path', function () {
  it('fetches the guide URL through the proxy and stores by tvg-id', async function () {
    let hit = '';
    const fetchFn = vi.fn(function onFetch(url) {
      hit = url;
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve(xmltvFor('bbc.uk')) });
    });
    const { api, epg } = mkApi(shims(fetchFn));
    const res = await api.loadEpg({ src: 'http://host/pl.m3u', m3u: true, chs: [{ id: 'bbc.uk', name: 'BBC' }], epgUrl: 'http://guide/epg.xml' });

    expect(res.ok).toBe(true);
    expect(hit.startsWith('/api/xtream?url=')).toBe(true);
    expect(decodeURIComponent(hit)).toContain('http://guide/epg.xml');
    expect(epg.has('bbc.uk')).toBe(true);
    expect(epg.get('bbc.uk')[0].title).toBe('News');
  });

  it('does nothing (no fetch) when the M3U playlist carries no guide URL', async function () {
    const fetchFn = vi.fn();
    const { api, epg } = mkApi(shims(fetchFn));
    const res = await api.loadEpg({ src: 'http://host/pl.m3u', m3u: true, chs: [{ id: 'x', name: 'X' }], epgUrl: '' });
    expect(res.ok).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(epg.count()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getTvgUrl — url-tvg extraction from the #EXTM3U header
// ---------------------------------------------------------------------------
describe('getTvgUrl — XMLTV guide URL from M3U header', function () {
  let api;
  beforeEach(function () { api = mkApi(shims(vi.fn())).api; });

  it('reads url-tvg="…" from the header line', function () {
    expect(api.getTvgUrl('#EXTM3U url-tvg="http://g/epg.xml"\n#EXTINF:-1,A\nhttp://s')).toBe('http://g/epg.xml');
  });

  it('reads the x-tvg-url alias', function () {
    expect(api.getTvgUrl('#EXTM3U x-tvg-url="http://g/epg.xml"\n')).toBe('http://g/epg.xml');
  });

  it('returns the first url when comma-separated', function () {
    expect(api.getTvgUrl('#EXTM3U url-tvg="http://a.xml,http://b.xml"\n')).toBe('http://a.xml');
  });

  it('returns "" when absent', function () {
    expect(api.getTvgUrl('#EXTM3U\n#EXTINF:-1,A\nhttp://s')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Demo path
// ---------------------------------------------------------------------------
describe('loadEpg — demo path', function () {
  it('populates a synthetic guide with no network call', async function () {
    const fetchFn = vi.fn();
    const { api, epg } = mkApi(shims(fetchFn));
    const chs = [{ id: 'd1', name: 'Demo One', grp: 'News' }, { id: 'd2', name: 'Demo Two', grp: 'Sports' }];
    const res = await api.loadEpg({ src: 'demo', chs });

    expect(res.ok).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(epg.count()).toBe(2);
    expect(epg.has('d1')).toBe(true);
    // Synthetic guide must span Date.now() so now/next is demonstrable offline.
    const nn = epg.getNowNext('d1', Date.now());
    expect(nn.now).not.toBeNull();
    expect(epg.getSched('d1', Date.now()).length).toBeGreaterThan(0);
  });

  // ADR-0036 §6: so the catch-up Replay affordance is demonstrable offline, the
  // synthetic demo guide must include at least one PAST program (stop <= now) for
  // an archive-capable channel — a past archive row is what carries Replay.
  it('synthesizes ≥1 past program (stop <= now) so a Replay row renders offline', async function () {
    const { api, epg } = mkApi(shims(vi.fn()));
    const now = Date.now();
    await api.loadEpg({ src: 'demo', chs: [{ id: 'arch1', name: 'Arch Demo', grp: 'News' }] });
    const all  = epg.get('arch1');
    const past = all.filter(function isPast(p) { return p.stop <= now; });
    expect(past.length).toBeGreaterThanOrEqual(1);
    // The past program's identity (chId + start) is what data-replay encodes.
    expect(String(past[0].chId)).toBe('arch1');
    expect(typeof past[0].start).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// maxConns gate (ADR-0041, TASK-0090): the bulk Xtream short-EPG fan-out is
// SKIPPED entirely on a single-connection portal (maxConns === 1) so the lone
// connection stays free for live playback; it runs unchanged on multi /
// unknown. Demo + M3U paths are never gated.
// ---------------------------------------------------------------------------
describe('loadEpg — single-connection gate (maxConns)', function () {
  /** A fetch that records every call and returns a valid short-EPG payload. */
  function recFetch(calls) {
    return vi.fn(function onFetch(url) {
      calls.push(url);
      return Promise.resolve({ ok: true, json: () => Promise.resolve(xtPayload(1700000000, 1700003600)), text: () => Promise.resolve('') });
    });
  }

  /** Count proxied get_simple_data_table requests among recorded URLs. */
  function epgCalls(calls) {
    return calls.filter(function isEpg(u) {
      return decodeURIComponent(u).includes('action=get_simple_data_table');
    }).length;
  }

  it('maxConns === 1: Xtream EPG issues ZERO get_simple_data_table requests; store stays empty', async function () {
    const calls = [];
    const { api, epg } = mkApi(shims(recFetch(calls)));
    const chs = [{ id: '10', name: 'A' }, { id: '20', name: 'B' }];
    const res = await api.loadEpg({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, chs, maxConns: 1 });

    expect(res.ok).toBe(true);
    expect(epgCalls(calls)).toBe(0);
    expect(epg.count()).toBe(0);
  });

  it('maxConns === 2: Xtream EPG fan-out runs exactly as today', async function () {
    const calls = [];
    const { api, epg } = mkApi(shims(recFetch(calls)));
    const chs = [{ id: '10', name: 'A' }, { id: '20', name: 'B' }];
    await api.loadEpg({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, chs, maxConns: 2 });

    expect(epgCalls(calls)).toBe(2);
    expect(epg.count()).toBe(2);
  });

  it('a larger maxConns (5): Xtream EPG fan-out runs', async function () {
    const calls = [];
    const { api, epg } = mkApi(shims(recFetch(calls)));
    const chs = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }, { id: '3', name: 'C' }];
    await api.loadEpg({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, chs, maxConns: 5 });

    expect(epgCalls(calls)).toBe(3);
    expect(epg.count()).toBe(3);
  });

  it('maxConns === 0 (unknown sentinel): conservative default runs the fan-out', async function () {
    const calls = [];
    const { api, epg } = mkApi(shims(recFetch(calls)));
    const chs = [{ id: '10', name: 'A' }];
    await api.loadEpg({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, chs, maxConns: 0 });

    expect(epgCalls(calls)).toBe(1);
    expect(epg.count()).toBe(1);
  });

  it('maxConns absent/undefined: conservative default runs the fan-out (no regression)', async function () {
    const calls = [];
    const { api, epg } = mkApi(shims(recFetch(calls)));
    const chs = [{ id: '10', name: 'A' }];
    await api.loadEpg({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, chs });

    expect(epgCalls(calls)).toBe(1);
    expect(epg.count()).toBe(1);
  });

  it('demo path is NEVER gated: maxConns === 1 still synthesizes the in-memory guide', async function () {
    const fetchFn = vi.fn();
    const { api, epg } = mkApi(shims(fetchFn));
    const chs = [{ id: 'd1', name: 'Demo One', grp: 'News' }, { id: 'd2', name: 'Demo Two', grp: 'Sports' }];
    const res = await api.loadEpg({ src: 'demo', chs, maxConns: 1 });

    expect(res.ok).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(epg.count()).toBe(2);
  });

  it('M3U path is NEVER gated: maxConns === 1 still fetches the XMLTV guide', async function () {
    const fetchFn = vi.fn(function onFetch() {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve(xmltvFor('bbc.uk')) });
    });
    const { api, epg } = mkApi(shims(fetchFn));
    const res = await api.loadEpg({ src: 'http://host/pl.m3u', m3u: true, chs: [{ id: 'bbc.uk', name: 'BBC' }], epgUrl: 'http://guide/epg.xml', maxConns: 1 });

    expect(res.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(epg.has('bbc.uk')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Best-effort: failures are swallowed
// ---------------------------------------------------------------------------
describe('loadEpg — best-effort failure handling', function () {
  it('swallows a rejected fetch: store stays empty, no throw', async function () {
    const fetchFn = vi.fn(function onFetch() { return Promise.reject(new Error('network down')); });
    const { api, epg } = mkApi(shims(fetchFn));
    const res = await api.loadEpg({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, chs: [{ id: '1', name: 'A' }] });
    expect(res.ok).toBe(true); // the run completed; per-channel failures were swallowed
    expect(epg.count()).toBe(0);
  });

  it('swallows a non-ok HTTP response: store stays empty', async function () {
    const fetchFn = vi.fn(function onFetch() {
      return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
    });
    const { api, epg } = mkApi(shims(fetchFn));
    await api.loadEpg({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, chs: [{ id: '1', name: 'A' }] });
    expect(epg.count()).toBe(0);
  });

  it('swallows a non-ok XMLTV response on the M3U path', async function () {
    const fetchFn = vi.fn(function onFetch() {
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
    });
    const { api, epg } = mkApi(shims(fetchFn));
    await api.loadEpg({ src: 'http://host/pl.m3u', m3u: true, chs: [{ id: 'x', name: 'X' }], epgUrl: 'http://g/epg.xml' });
    expect(epg.count()).toBe(0);
  });

  it('fires onDone after a successful guide fetch (re-render hook)', async function () {
    const fetchFn = vi.fn(function onFetch() {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(xtPayload(1700000000, 1700003600)), text: () => Promise.resolve('') });
    });
    const { api } = mkApi(shims(fetchFn));
    const onDone = vi.fn();
    await api.loadEpg({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, chs: [{ id: '1', name: 'A' }], onDone });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('is a no-op Result when the IptvEpg store global is absent', async function () {
    // Re-run the api IIFE on a window WITHOUT IptvEpg to prove the guard.
    const win = {};
    const globals = Object.assign(shims(vi.fn()), { window: win });
    const src = readFileSync(API_SRC, 'utf8');
    // eslint-disable-next-line no-new-func
    const fn = new Function(...Object.keys(globals), '"use strict";\n' + src + '\nreturn window.IptvApi;');
    const api = fn(...Object.values(globals));
    const res = await api.loadEpg({ src: 'demo', chs: [{ id: 'd1', name: 'D' }] });
    expect(res.ok).toBe(false);
  });
});
