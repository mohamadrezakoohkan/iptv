// ADR: ADR-0037, ADR-0041
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const API_SRC    = join(__dir, '../../client/api.js');
const VOD_SRC    = join(__dir, '../../client/vod.js');

/** Build the IptvVod store on the given window (fresh in-memory store). */
function mkVod(win) {
  const src = readFileSync(VOD_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  const fn = new Function('window', '"use strict";\n' + src + '\nreturn window.IptvVod;');
  fn(win);
  return win.IptvVod;
}

/** Execute client/api.js against the given globals on a window that carries IptvVod. */
function mkApi(globals) {
  const win = {};
  mkVod(win);
  Object.assign(globals, { window: win });
  const src = readFileSync(API_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  const fn = new Function(
    ...Object.keys(globals),
    '"use strict";\n' + src + '\nreturn { api: window.IptvApi, vod: window.IptvVod };'
  );
  return fn(...Object.values(globals));
}

/** Standard global shims for the api IIFE. fetch is supplied per test. */
function shims(fetchFn) {
  return { fetch: fetchFn, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController, URL };
}

/** Decode the inner Xtream url of a proxied /api/xtream call. */
function inner(url) {
  return decodeURIComponent(url.replace('/api/xtream?url=', ''));
}

/** Route a fetch by the Xtream action in the proxied URL; payloads keyed by action. */
function routeFetch(payloads) {
  return vi.fn(function onFetch(url) {
    const dec = inner(url);
    let body = [];
    for (const actn of Object.keys(payloads)) {
      if (dec.includes('action=' + actn)) { body = payloads[actn]; break; }
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
  });
}

const VOD_CATS = [{ category_id: '1', category_name: 'Action' }];
const VOD_STRMS = [
  { stream_id: 101, name: 'The Movie', category_id: '1', container_extension: 'mp4', stream_icon: 'http://img/1.png', num: 3 },
  { stream_id: 102, name: 'Another', category_id: '9', num: 5 },
];
const SER_CATS = [{ category_id: '7', category_name: 'Drama' }];
const SERS = [{ series_id: 55, name: 'The Show', category_id: '7', cover: 'http://img/s.png' }];
const SER_INFO = {
  episodes: {
    1: [
      { id: 9001, title: 'Pilot', episode_num: 1, container_extension: 'mkv', info: { movie_image: 'http://img/e.png' } },
      { id: 9002, title: 'Two', episode_num: 2 },
    ],
    2: [{ id: 9003, title: 'Return', episode_num: 1 }],
  },
};

// ---------------------------------------------------------------------------
// loadVod — Xtream path
// ---------------------------------------------------------------------------
describe('loadVod — Xtream path', function () {
  it('fetches get_vod_* + get_series_* through the proxy and populates the store', async function () {
    const fetchFn = routeFetch({
      get_vod_categories: VOD_CATS,
      get_vod_streams: VOD_STRMS,
      get_series_categories: SER_CATS,
      get_series: SERS,
    });
    const { api, vod } = mkApi(shims(fetchFn));
    const res = await api.loadVod({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, ext: 'ts' });

    expect(res.ok).toBe(true);
    const movs = vod.movies();
    expect(movs.length).toBe(2);
    expect(vod.hasMovies()).toBe(true);
    const sers = vod.series();
    expect(sers.length).toBe(1);
    expect(vod.hasSeries()).toBe(true);

    // Every fetch goes through the existing /api/xtream proxy.
    for (const call of fetchFn.mock.calls) {
      expect(call[0].startsWith('/api/xtream?url=')).toBe(true);
      expect(inner(call[0])).toContain('player_api.php');
    }
  });

  it('normalizes a movie into a Vod with the built /movie/ URL (extension preserved) and resolved grp', async function () {
    const fetchFn = routeFetch({ get_vod_categories: VOD_CATS, get_vod_streams: VOD_STRMS, get_series_categories: SER_CATS, get_series: SERS });
    const { api, vod } = mkApi(shims(fetchFn));
    await api.loadVod({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, ext: 'ts' });
    const mov = vod.movies()[0];
    expect(mov.kind).toBe('movie');
    expect(mov.id).toBe('101');
    expect(mov.grp).toBe('Action');
    expect(mov.url).toBe('http://portal:8080/movie/u/p/101.mp4');
    // Unknown category falls back to Uncategorized.
    expect(vod.movies()[1].grp).toBe('Uncategorized');
  });

  it('normalizes a series into a browse-only Series entry (no url) with resolved grp', async function () {
    const fetchFn = routeFetch({ get_vod_categories: VOD_CATS, get_vod_streams: VOD_STRMS, get_series_categories: SER_CATS, get_series: SERS });
    const { api, vod } = mkApi(shims(fetchFn));
    await api.loadVod({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, ext: 'ts' });
    const ser = vod.series()[0];
    expect(ser.id).toBe('55');
    expect(ser.name).toBe('The Show');
    expect(ser.grp).toBe('Drama');
    expect(ser.url).toBeUndefined();
  });

  it('clears any prior store before a fresh connect populates it', async function () {
    const fetchFn = routeFetch({ get_vod_streams: VOD_STRMS, get_vod_categories: VOD_CATS, get_series: SERS, get_series_categories: SER_CATS });
    const { api, vod } = mkApi(shims(fetchFn));
    vod.setMovs([{ id: 'stale', name: 's', grp: '', url: '', img: '', cat: '', num: 0, kind: 'movie' }]);
    await api.loadVod({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, ext: 'ts' });
    expect(vod.movies().some(function s(m) { return m.id === 'stale'; })).toBe(false);
  });

  it('fires onDone on completion (re-render hook)', async function () {
    const fetchFn = routeFetch({ get_vod_streams: VOD_STRMS, get_vod_categories: VOD_CATS, get_series: SERS, get_series_categories: SER_CATS });
    const { api } = mkApi(shims(fetchFn));
    const onDone = vi.fn();
    await api.loadVod({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, ext: 'ts', onDone });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// loadVod — best-effort failure / empty handling (browsing unaffected)
// ---------------------------------------------------------------------------
describe('loadVod — best-effort failure handling', function () {
  it('swallows a rejected fetch: store stays empty, Result still ok, no throw', async function () {
    const fetchFn = vi.fn(function onFetch() { return Promise.reject(new Error('network down')); });
    const { api, vod } = mkApi(shims(fetchFn));
    const res = await api.loadVod({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, ext: 'ts' });
    expect(res.ok).toBe(true);
    expect(vod.movies().length).toBe(0);
    expect(vod.series().length).toBe(0);
    expect(vod.hasMovies()).toBe(false);
  });

  it('swallows a non-ok HTTP response: store stays empty', async function () {
    const fetchFn = vi.fn(function onFetch() {
      return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
    });
    const { api, vod } = mkApi(shims(fetchFn));
    await api.loadVod({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, ext: 'ts' });
    expect(vod.movies().length).toBe(0);
    expect(vod.series().length).toBe(0);
  });

  it('swallows an empty portal (empty arrays) leaving the store empty', async function () {
    const fetchFn = routeFetch({ get_vod_streams: [], get_vod_categories: [], get_series: [], get_series_categories: [] });
    const { api, vod } = mkApi(shims(fetchFn));
    const res = await api.loadVod({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, ext: 'ts' });
    expect(res.ok).toBe(true);
    expect(vod.movies().length).toBe(0);
  });

  it('is a no-op Result when the IptvVod store global is absent', async function () {
    const win = {};
    const globals = Object.assign(shims(vi.fn()), { window: win });
    const src = readFileSync(API_SRC, 'utf8');
    // eslint-disable-next-line no-new-func
    const fn = new Function(...Object.keys(globals), '"use strict";\n' + src + '\nreturn window.IptvApi;');
    const api = fn(...Object.values(globals));
    const res = await api.loadVod({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false });
    expect(res.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// loadVod — demo path synthesizes one offline-playable movie, no series
// ---------------------------------------------------------------------------
describe('loadVod — demo path', function () {
  it('synthesizes exactly one offline-playable movie under a demo category, no network', async function () {
    const fetchFn = vi.fn();
    const { api, vod } = mkApi(shims(fetchFn));
    const res = await api.loadVod({ src: 'demo' });
    expect(res.ok).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
    const movs = vod.movies();
    expect(movs.length).toBe(1);
    expect(movs[0].kind).toBe('movie');
    expect(movs[0].url.length).toBeGreaterThan(0);
    expect(movs[0].cat.length).toBeGreaterThan(0);
    expect(vod.series().length).toBe(0);
    expect(vod.hasSeries()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// loadVod — M3U path leaves the store empty (no VOD concept)
// ---------------------------------------------------------------------------
describe('loadVod — M3U path', function () {
  it('makes no fetch and leaves the store empty', async function () {
    const fetchFn = vi.fn();
    const { api, vod } = mkApi(shims(fetchFn));
    const res = await api.loadVod({ src: 'http://host/pl.m3u', m3u: true });
    expect(res.ok).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(vod.movies().length).toBe(0);
    expect(vod.series().length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// maxConns gate (ADR-0041, TASK-0090): the bulk Xtream VOD/series fan-out is
// SKIPPED entirely on a single-connection portal (maxConns === 1) so the lone
// connection stays free for live playback; it runs unchanged on multi /
// unknown. The store is still cleared but stays empty. Demo + M3U paths are
// never gated, and loadSerInfo (on-demand, user action) is never gated.
// ---------------------------------------------------------------------------
describe('loadVod — single-connection gate (maxConns)', function () {
  /** Count proxied VOD/series fan-out requests among recorded calls. */
  function vodCalls(mockCalls) {
    return mockCalls.filter(function isVod(c) {
      const dec = inner(c[0]);
      return dec.includes('action=get_vod_categories')
        || dec.includes('action=get_vod_streams')
        || dec.includes('action=get_series_categories')
        || dec.includes('action=get_series');
    }).length;
  }

  it('maxConns === 1: issues ZERO VOD/series requests and leaves the store empty (after clear)', async function () {
    const fetchFn = routeFetch({ get_vod_categories: VOD_CATS, get_vod_streams: VOD_STRMS, get_series_categories: SER_CATS, get_series: SERS });
    const { api, vod } = mkApi(shims(fetchFn));
    vod.setMovs([{ id: 'stale', name: 's', grp: '', url: '', img: '', cat: '', num: 0, kind: 'movie' }]);
    const res = await api.loadVod({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, ext: 'ts', maxConns: 1 });

    expect(res.ok).toBe(true);
    expect(vodCalls(fetchFn.mock.calls)).toBe(0);
    expect(vod.movies().length).toBe(0); // cleared, no fan-out repopulated it
    expect(vod.series().length).toBe(0);
  });

  it('maxConns === 2: the Xtream VOD fan-out runs exactly as today', async function () {
    const fetchFn = routeFetch({ get_vod_categories: VOD_CATS, get_vod_streams: VOD_STRMS, get_series_categories: SER_CATS, get_series: SERS });
    const { api, vod } = mkApi(shims(fetchFn));
    await api.loadVod({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, ext: 'ts', maxConns: 2 });

    expect(vodCalls(fetchFn.mock.calls)).toBeGreaterThan(0);
    expect(vod.movies().length).toBe(2);
    expect(vod.series().length).toBe(1);
  });

  it('a larger maxConns (5): the Xtream VOD fan-out runs', async function () {
    const fetchFn = routeFetch({ get_vod_categories: VOD_CATS, get_vod_streams: VOD_STRMS, get_series_categories: SER_CATS, get_series: SERS });
    const { api, vod } = mkApi(shims(fetchFn));
    await api.loadVod({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, ext: 'ts', maxConns: 5 });
    expect(vod.movies().length).toBe(2);
  });

  it('maxConns === 0 (unknown sentinel): conservative default runs the fan-out', async function () {
    const fetchFn = routeFetch({ get_vod_categories: VOD_CATS, get_vod_streams: VOD_STRMS, get_series_categories: SER_CATS, get_series: SERS });
    const { api, vod } = mkApi(shims(fetchFn));
    await api.loadVod({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, ext: 'ts', maxConns: 0 });
    expect(vodCalls(fetchFn.mock.calls)).toBeGreaterThan(0);
    expect(vod.movies().length).toBe(2);
  });

  it('maxConns absent/undefined: conservative default runs the fan-out (no regression)', async function () {
    const fetchFn = routeFetch({ get_vod_categories: VOD_CATS, get_vod_streams: VOD_STRMS, get_series_categories: SER_CATS, get_series: SERS });
    const { api, vod } = mkApi(shims(fetchFn));
    await api.loadVod({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, ext: 'ts' });
    expect(vodCalls(fetchFn.mock.calls)).toBeGreaterThan(0);
    expect(vod.movies().length).toBe(2);
  });

  it('demo path is NEVER gated: maxConns === 1 still synthesizes its one movie', async function () {
    const fetchFn = vi.fn();
    const { api, vod } = mkApi(shims(fetchFn));
    const res = await api.loadVod({ src: 'demo', maxConns: 1 });
    expect(res.ok).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(vod.movies().length).toBe(1);
  });

  it('loadSerInfo is NEVER gated: it fetches regardless of maxConns', async function () {
    let hit = '';
    const fetchFn = vi.fn(function onFetch(url) {
      hit = url;
      return Promise.resolve({ ok: true, json: () => Promise.resolve(SER_INFO), text: () => Promise.resolve('') });
    });
    const { api, vod } = mkApi(shims(fetchFn));
    const res = await api.loadSerInfo({ src: 'http://portal:8080', user: 'u', pass: 'p', id: '55', ext: 'ts', name: 'The Show', maxConns: 1 });
    expect(res.ok).toBe(true);
    expect(inner(hit)).toContain('action=get_series_info');
    expect(vod.episodes('55').length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// loadSerInfo — on-demand per-series episode loader
// ---------------------------------------------------------------------------
describe('loadSerInfo — on-demand episode loader', function () {
  it('fetches get_series_info&series_id=<id> through the proxy, normalizes + stores episodes', async function () {
    let hit = '';
    const fetchFn = vi.fn(function onFetch(url) {
      hit = url;
      return Promise.resolve({ ok: true, json: () => Promise.resolve(SER_INFO), text: () => Promise.resolve('') });
    });
    const { api, vod } = mkApi(shims(fetchFn));
    const res = await api.loadSerInfo({ src: 'http://portal:8080', user: 'u', pass: 'p', id: '55', ext: 'ts', name: 'The Show' });

    expect(res.ok).toBe(true);
    expect(hit.startsWith('/api/xtream?url=')).toBe(true);
    expect(inner(hit)).toContain('action=get_series_info');
    expect(inner(hit)).toContain('series_id=55');

    const epis = vod.episodes('55');
    expect(epis.length).toBe(3); // 2 in season 1 + 1 in season 2
    expect(epis[0].kind).toBe('episode');
    expect(epis[0].id).toBe('9001');
    expect(epis[0].name).toBe('The Show · S1E1 Pilot');
    expect(epis[0].url).toBe('http://portal:8080/series/u/p/9001.mkv');
  });

  it('is idempotent: a re-open does not refetch when episodes are already stored', async function () {
    const fetchFn = vi.fn(function onFetch() {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(SER_INFO), text: () => Promise.resolve('') });
    });
    const { api, vod } = mkApi(shims(fetchFn));
    await api.loadSerInfo({ src: 'http://portal:8080', user: 'u', pass: 'p', id: '55', ext: 'ts', name: 'X' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const before = vod.episodes('55').length;
    await api.loadSerInfo({ src: 'http://portal:8080', user: 'u', pass: 'p', id: '55', ext: 'ts', name: 'X' });
    expect(fetchFn).toHaveBeenCalledTimes(1); // not refetched
    expect(vod.episodes('55').length).toBe(before); // not duplicated
  });

  it('resolves the series display name from the stored Series browse list when name is omitted', async function () {
    const fetchFn = routeFetch({ get_series: SERS, get_series_categories: SER_CATS, get_vod_streams: [], get_vod_categories: [] });
    const { api, vod } = mkApi(shims(fetchFn));
    await api.loadVod({ src: 'http://portal:8080', user: 'u', pass: 'p', m3u: false, ext: 'ts' });
    // now resolve series info using the stored Series name (no explicit name passed)
    const infoFetch = vi.fn(function onFetch() {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(SER_INFO), text: () => Promise.resolve('') });
    });
    // swap fetch on the same window-bound api by re-loading with the info payload
    const fresh = mkApi(shims(infoFetch));
    fresh.vod.setSers(vod.series());
    const res = await fresh.api.loadSerInfo({ src: 'http://portal:8080', user: 'u', pass: 'p', id: '55', ext: 'ts' });
    expect(res.ok).toBe(true);
    expect(fresh.vod.episodes('55')[0].name).toBe('The Show · S1E1 Pilot');
  });

  it('swallows a failed series-info fetch (no throw, empty episodes for that id)', async function () {
    const fetchFn = vi.fn(function onFetch() { return Promise.reject(new Error('down')); });
    const { api, vod } = mkApi(shims(fetchFn));
    const res = await api.loadSerInfo({ src: 'http://portal:8080', user: 'u', pass: 'p', id: '77', ext: 'ts' });
    expect(res.ok).toBe(true);
    expect(vod.episodes('77').length).toBe(0);
  });

  it('is a no-op Result when the IptvVod store global is absent', async function () {
    const win = {};
    const globals = Object.assign(shims(vi.fn()), { window: win });
    const src = readFileSync(API_SRC, 'utf8');
    // eslint-disable-next-line no-new-func
    const fn = new Function(...Object.keys(globals), '"use strict";\n' + src + '\nreturn window.IptvApi;');
    const api = fn(...Object.values(globals));
    const res = await api.loadSerInfo({ src: 'http://portal:8080', user: 'u', pass: 'p', id: '1' });
    expect(res.ok).toBe(false);
  });
});
