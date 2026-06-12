// ADR: ADR-0001, ADR-0005, ADR-0008, ADR-0009
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir     = dirname(__filename);
const API_SRC   = join(__dir, '../../client/api.js');

/** Execute client/api.js IIFE against the given globals, return window.IptvApi. */
function loadApi(globals) {
  const win = {};
  Object.assign(globals, { window: win });
  const src = readFileSync(API_SRC, 'utf8');
  // eslint-disable-next-line no-eval
  const fn = new Function(
    ...Object.keys(globals),
    '"use strict";\n' + src + '\nreturn window.IptvApi;'
  );
  return fn(...Object.values(globals));
}

// ---------------------------------------------------------------------------
// isDemo
// ---------------------------------------------------------------------------
describe('isDemo', function () {
  let api;
  beforeEach(function () {
    api = loadApi({ fetch: vi.fn(), setTimeout: vi.fn(), clearTimeout: vi.fn(), Promise, encodeURIComponent, AbortController });
  });

  it('returns true for "demo"', function () {
    expect(api.isDemo('demo')).toBe(true);
  });

  it('returns true for "  Demo  " (trimmed, case-insensitive)', function () {
    expect(api.isDemo('  Demo  ')).toBe(true);
  });

  it('returns true for "DEMO"', function () {
    expect(api.isDemo('DEMO')).toBe(true);
  });

  it('returns false for a real URL', function () {
    expect(api.isDemo('http://portal.example.com')).toBe(false);
  });

  it('returns false for empty string', function () {
    expect(api.isDemo('')).toBe(false);
  });

  it('returns false for null', function () {
    expect(api.isDemo(null)).toBe(false);
  });

  it('returns false for undefined', function () {
    expect(api.isDemo(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// connect("demo") — structure
// ---------------------------------------------------------------------------
describe('connect("demo")', function () {
  it('resolves with ok:true and correct structure', async function () {
    // Use real setTimeout/Promise so the 700 ms delay actually fires via fake timers.
    vi.useFakeTimers();
    const api = loadApi({
      fetch:             vi.fn(),
      setTimeout,
      clearTimeout,
      Promise,
      encodeURIComponent,
      AbortController,
    });

    const p = api.connect('demo', { user: 'x', pass: 'x' });
    await vi.runAllTimersAsync();
    const res = await p;

    expect(res.ok).toBe(true);
    expect(res.val).toBeDefined();
    expect(res.val.host).toBe('demo');
    expect(res.val.user).toBe('demo');
    vi.useRealTimers();
  });

  it('categories has exactly 7 entries', async function () {
    vi.useFakeTimers();
    const api = loadApi({ fetch: vi.fn(), setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    const p = api.connect('demo', { user: 'x', pass: 'x' });
    await vi.runAllTimersAsync();
    const res = await p;
    expect(res.val.categories).toHaveLength(7);
    vi.useRealTimers();
  });

  it('channels has exactly 31 entries', async function () {
    vi.useFakeTimers();
    const api = loadApi({ fetch: vi.fn(), setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    const p = api.connect('demo', { user: 'x', pass: 'x' });
    await vi.runAllTimersAsync();
    const res = await p;
    expect(res.val.channels).toHaveLength(31);
    vi.useRealTimers();
  });

  it('each channel has required Ch fields', async function () {
    vi.useFakeTimers();
    const api = loadApi({ fetch: vi.fn(), setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    const p = api.connect('demo', { user: 'x', pass: 'x' });
    await vi.runAllTimersAsync();
    const res = await p;
    for (const ch of res.val.channels) {
      expect(typeof ch.id).toBe('string');
      expect(typeof ch.name).toBe('string');
      expect(typeof ch.grp).toBe('string');
      expect(typeof ch.url).toBe('string');
    }
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// connect(realUrl) — proxy URL construction
// ---------------------------------------------------------------------------
describe('connect(realUrl) — proxy routing', function () {
  const BASE = 'http://portal.example.com';
  const USR  = 'alice';
  const PSS  = 'secret';

  const INF_OK = { user_info: { auth: 1, allowed_output_formats: ['ts'] } };
  const CATS   = [{ category_id: '7', category_name: 'News' }];
  const STRMS  = [{ num: 1, name: 'World News 24', stream_id: 42, stream_icon: 'http://img.example.com/42.png', category_id: '7' }];

  /** Sequential mock: no-action info, categories, streams. opts: {inf, cats, strms} */
  function makeFetch(opts) {
    return vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(opts.inf ?? INF_OK) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(opts.cats ?? CATS) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(opts.strms ?? STRMS) });
  }

  it('fetches via /api/xtream?url= (not the portal directly)', async function () {
    const ftch = makeFetch({});
    const api = loadApi({ fetch: ftch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    await api.connect(BASE, { user: USR, pass: PSS });
    const firstUrl = ftch.mock.calls[0][0];
    expect(firstUrl.startsWith('/api/xtream?url=')).toBe(true);
  });

  it('first request is the no-action player_api.php auth/info call', async function () {
    const ftch = makeFetch({});
    const api = loadApi({ fetch: ftch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    await api.connect(BASE, { user: USR, pass: PSS });
    const firstUrl = decodeURIComponent(ftch.mock.calls[0][0]);
    expect(firstUrl).toContain('player_api.php');
    expect(firstUrl).not.toContain('action=');
  });

  it('second request encodes get_live_categories action', async function () {
    const ftch = makeFetch({});
    const api = loadApi({ fetch: ftch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    await api.connect(BASE, { user: USR, pass: PSS });
    expect(decodeURIComponent(ftch.mock.calls[1][0])).toContain('action=get_live_categories');
  });

  it('third request encodes get_live_streams action', async function () {
    const ftch = makeFetch({});
    const api = loadApi({ fetch: ftch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    await api.connect(BASE, { user: USR, pass: PSS });
    expect(decodeURIComponent(ftch.mock.calls[2][0])).toContain('action=get_live_streams');
  });

  it('encodes username and password in proxy URL', async function () {
    const ftch = makeFetch({});
    const api = loadApi({ fetch: ftch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    await api.connect(BASE, { user: USR, pass: PSS });
    const firstUrl = decodeURIComponent(ftch.mock.calls[0][0]);
    expect(firstUrl).toContain('username=' + USR);
    expect(firstUrl).toContain('password=' + PSS);
  });

  it('resolves with ok:true val containing host, user, normalized categories and channels', async function () {
    const ftch = makeFetch({});
    const api = loadApi({ fetch: ftch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    const res = await api.connect(BASE, { user: USR, pass: PSS });
    expect(res.ok).toBe(true);
    expect(res.val.host).toBe(BASE);
    expect(res.val.user).toBe(USR);
    expect(res.val.categories).toEqual([{ category_id: '7', category_name: 'News' }]);
    expect(res.val.channels).toHaveLength(1);
  });

  it('maps a raw stream entry to the Ch schema per the spec §8 table', async function () {
    const ftch = makeFetch({});
    const api = loadApi({ fetch: ftch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    const res = await api.connect(BASE, { user: USR, pass: PSS });
    const ch = res.val.channels[0];
    expect(ch).toEqual({
      id:   '42',
      name: 'World News 24',
      grp:  'News',
      url:  BASE + '/live/' + USR + '/' + PSS + '/42.ts',
      img:  'http://img.example.com/42.png',
      cat:  '7',
      num:  1,
    });
  });

  it('returns ok:false with a human-readable message when user_info.auth is falsy', async function () {
    const ftch = makeFetch({ inf: { user_info: { auth: 0 } } });
    const api = loadApi({ fetch: ftch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    const res = await api.connect(BASE, { user: USR, pass: 'wrong' });
    expect(res.ok).toBe(false);
    expect(typeof res.err).toBe('string');
    expect(res.err.toLowerCase()).toContain('login failed');
    expect(ftch).toHaveBeenCalledTimes(1);
  });

  it('uses allowed_output_formats[0] as the stream URL extension', async function () {
    const inf = { user_info: { auth: 1, allowed_output_formats: ['m3u8', 'ts'] } };
    const ftch = makeFetch({ inf });
    const api = loadApi({ fetch: ftch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    const res = await api.connect(BASE, { user: USR, pass: PSS });
    expect(res.val.channels[0].url.endsWith('/42.m3u8')).toBe(true);
  });

  it('falls back to ".ts" when allowed_output_formats is absent or empty', async function () {
    const inf = { user_info: { auth: 1, allowed_output_formats: [] } };
    const ftch = makeFetch({ inf });
    const api = loadApi({ fetch: ftch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    const res = await api.connect(BASE, { user: USR, pass: PSS });
    expect(res.val.channels[0].url.endsWith('/42.ts')).toBe(true);
  });

  it('maps an unknown category_id to grp "Uncategorized"', async function () {
    const strms = [{ num: 3, name: 'Mystery TV', stream_id: 9, stream_icon: '', category_id: '999' }];
    const ftch = makeFetch({ strms });
    const api = loadApi({ fetch: ftch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    const res = await api.connect(BASE, { user: USR, pass: PSS });
    expect(res.val.channels[0].grp).toBe('Uncategorized');
    expect(res.val.channels[0].cat).toBe('999');
  });

  it('a trailing slash on the portal base never produces "//" in the stream URL', async function () {
    const ftch = makeFetch({});
    const api = loadApi({ fetch: ftch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    const res = await api.connect(BASE + '/', { user: USR, pass: PSS });
    const url = res.val.channels[0].url;
    expect(url).toBe(BASE + '/live/' + USR + '/' + PSS + '/42.ts');
    expect(url.replace('http://', '')).not.toContain('//');
  });

  it('normalizes numeric category_id values to matching string keys', async function () {
    const cats  = [{ category_id: 7, category_name: 'News' }];
    const strms = [{ num: 1, name: 'World News 24', stream_id: 42, stream_icon: '', category_id: 7 }];
    const ftch = makeFetch({ cats, strms });
    const api = loadApi({ fetch: ftch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    const res = await api.connect(BASE, { user: USR, pass: PSS });
    expect(res.val.categories[0]).toEqual({ category_id: '7', category_name: 'News' });
    expect(res.val.channels[0].grp).toBe('News');
  });
});

// ---------------------------------------------------------------------------
// connect(realUrl) — error paths
// ---------------------------------------------------------------------------
describe('connect(realUrl) — error handling', function () {
  const BASE = 'http://portal.example.com';

  it('returns ok:false on non-2xx HTTP response', async function () {
    const ftch = vi.fn().mockResolvedValue({ ok: false, status: 403, json: vi.fn() });
    const api = loadApi({ fetch: ftch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    const res = await api.connect(BASE, { user: 'u', pass: 'p' });
    expect(res.ok).toBe(false);
    expect(typeof res.err).toBe('string');
    expect(res.err).toContain('403');
  });

  it('returns ok:false with timeout message on AbortError', async function () {
    vi.useFakeTimers();
    const ctrl = { abort: vi.fn(), signal: {} };
    const FakeAbortController = vi.fn().mockReturnValue(ctrl);
    const ftch = vi.fn().mockImplementation(function () {
      return new Promise(function (_, rej) {
        const err = new Error('aborted');
        err.name = 'AbortError';
        rej(err);
      });
    });
    const api = loadApi({
      fetch: ftch,
      setTimeout,
      clearTimeout,
      Promise,
      encodeURIComponent,
      AbortController: FakeAbortController,
    });
    const p = api.connect(BASE, { user: 'u', pass: 'p' });
    await vi.runAllTimersAsync();
    const res = await p;
    expect(res.ok).toBe(false);
    expect(res.err).toContain('timed out');
    vi.useRealTimers();
  });

  it('returns ok:false with network-error message on TypeError', async function () {
    const ftch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const api = loadApi({ fetch: ftch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    const res = await api.connect(BASE, { user: 'u', pass: 'p' });
    expect(res.ok).toBe(false);
    expect(res.err).toContain('reach');
  });
});

// ---------------------------------------------------------------------------
// loadM3u / connect M3U path
// ---------------------------------------------------------------------------
describe('connect(m3uUrl) — loadM3u integration', function () {
  const M3U_URL = 'https://example.com/list.m3u';
  const PROXY_URL = '/api/xtream?url=' + encodeURIComponent(M3U_URL);

  const M3U_FIXTURE = [
    '#EXTM3U',
    '#EXTINF:-1 tvg-id="c1" tvg-name="Channel One" group-title="News",Channel One',
    'http://stream.example.com/c1',
    '#EXTINF:-1 tvg-id="c2" tvg-name="Channel Two" group-title="Sports",Channel Two',
    'http://stream.example.com/c2',
  ].join('\n');

  function baseGlobals(ftch) {
    return { fetch: ftch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController, URL };
  }

  it('resolves ok:true with correct shape on valid M3U text', async function () {
    const ftch = vi.fn().mockResolvedValue({
      ok:   true,
      text: vi.fn().mockResolvedValue(M3U_FIXTURE),
    });
    const api = loadApi(baseGlobals(ftch));
    const res = await api.connect(M3U_URL, { m3u: true });
    expect(res.ok).toBe(true);
    expect(res.val.host).toBe('example.com');
    expect(res.val.user).toBe('');
    expect(res.val.server).toBeNull();
    expect(Array.isArray(res.val.categories)).toBe(true);
    expect(res.val.categories.length).toBeGreaterThan(0);
    expect(Array.isArray(res.val.channels)).toBe(true);
    expect(res.val.channels.length).toBeGreaterThan(0);
  });

  it('resolves ok:false on HTTP 404 response', async function () {
    const ftch = vi.fn().mockResolvedValue({
      ok:     false,
      status: 404,
    });
    const api = loadApi(baseGlobals(ftch));
    const res = await api.connect(M3U_URL, { m3u: true });
    expect(res.ok).toBe(false);
    expect(typeof res.err).toBe('string');
  });

  it('resolves ok:false with "not an M3U file" on non-M3U 200 body', async function () {
    const ftch = vi.fn().mockResolvedValue({
      ok:   true,
      text: vi.fn().mockResolvedValue('not m3u'),
    });
    const api = loadApi(baseGlobals(ftch));
    const res = await api.connect(M3U_URL, { m3u: true });
    expect(res.ok).toBe(false);
    expect(res.err).toBe('not an M3U file');
  });

  it('constructs the correct proxy URL for the M3U fetch', async function () {
    const ftch = vi.fn().mockResolvedValue({
      ok:   true,
      text: vi.fn().mockResolvedValue(M3U_FIXTURE),
    });
    const api = loadApi(baseGlobals(ftch));
    await api.connect(M3U_URL, { m3u: true });
    expect(ftch.mock.calls[0][0]).toBe(PROXY_URL);
  });
});

// ---------------------------------------------------------------------------
// connect — explicit opts.m3u routing (ADR-0008)
// ---------------------------------------------------------------------------
describe('connect — explicit opts.m3u routing', function () {
  const M3U_FIXTURE = [
    '#EXTM3U',
    '#EXTINF:-1 tvg-id="c1" tvg-name="Channel One" group-title="News",Channel One',
    'http://stream.example.com/c1',
  ].join('\n');

  function baseGlobals(ftch) {
    return { fetch: ftch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController, URL };
  }

  /** Sequential Xtream mock: no-action info, empty categories, empty streams. */
  function mkXtFetch() {
    return vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ user_info: { auth: 1, allowed_output_formats: ['ts'] } }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue([]) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue([]) });
  }

  it('m3u: true forces the M3U path for a non-playlist URL despite credentials', async function () {
    const ftch = vi.fn().mockResolvedValue({
      ok:   true,
      text: vi.fn().mockResolvedValue(M3U_FIXTURE),
    });
    const api = loadApi(baseGlobals(ftch));
    const res = await api.connect('https://example.com/list', { user: 'u', pass: 'p', m3u: true });
    expect(res.ok).toBe(true);
    expect(res.val.server).toBeNull();
    expect(res.val.host).toBe('example.com');
    expect(ftch).toHaveBeenCalledTimes(1);
    expect(decodeURIComponent(ftch.mock.calls[0][0])).not.toContain('player_api.php');
  });

  it('m3u: false forces the Xtream path even for a .m3u8 URL', async function () {
    const ftch = mkXtFetch();
    const api = loadApi(baseGlobals(ftch));
    const res = await api.connect('https://example.com/list.m3u8', { user: '', pass: '', m3u: false });
    expect(res.ok).toBe(true);
    expect(decodeURIComponent(ftch.mock.calls[0][0])).toContain('player_api.php');
    expect(decodeURIComponent(ftch.mock.calls[1][0])).toContain('action=get_live_categories');
  });

  it('connect("demo", { m3u: true }) still resolves the demo playlist', async function () {
    vi.useFakeTimers();
    const ftch = vi.fn();
    const api = loadApi(baseGlobals(ftch));
    const p = api.connect('demo', { m3u: true });
    await vi.runAllTimersAsync();
    const res = await p;
    expect(res.ok).toBe(true);
    expect(res.val.host).toBe('demo');
    expect(ftch).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('connect("demo", { m3u: false }) still resolves the demo playlist', async function () {
    vi.useFakeTimers();
    const ftch = vi.fn();
    const api = loadApi(baseGlobals(ftch));
    const p = api.connect('demo', { m3u: false });
    await vi.runAllTimersAsync();
    const res = await p;
    expect(res.ok).toBe(true);
    expect(res.val.host).toBe('demo');
    expect(ftch).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('absent m3u flag defaults to Xtream: credential-less plain URL calls player_api.php', async function () {
    const ftch = mkXtFetch();
    const api = loadApi(baseGlobals(ftch));
    const res = await api.connect('http://portal.example.com', { user: '', pass: '' });
    expect(res.ok).toBe(true);
    expect(decodeURIComponent(ftch.mock.calls[0][0])).toContain('player_api.php');
    expect(decodeURIComponent(ftch.mock.calls[1][0])).toContain('action=get_live_categories');
  });

  it('absent m3u flag defaults to Xtream: even a .m3u URL routes to player_api.php', async function () {
    const ftch = mkXtFetch();
    const api = loadApi(baseGlobals(ftch));
    const res = await api.connect('https://example.com/list.m3u', { user: '', pass: '' });
    expect(res.ok).toBe(true);
    expect(decodeURIComponent(ftch.mock.calls[0][0])).toContain('player_api.php');
  });

  it('absent m3u flag defaults to Xtream: credentialled plain URL routes to player_api.php', async function () {
    const ftch = mkXtFetch();
    const api = loadApi(baseGlobals(ftch));
    const res = await api.connect('http://portal.example.com', { user: 'admin', pass: '1234' });
    expect(res.ok).toBe(true);
    expect(decodeURIComponent(ftch.mock.calls[0][0])).toContain('player_api.php');
  });

  it('connect("demo", {}) with flag absent still resolves the demo playlist', async function () {
    vi.useFakeTimers();
    const ftch = vi.fn();
    const api = loadApi(baseGlobals(ftch));
    const p = api.connect('demo', {});
    await vi.runAllTimersAsync();
    const res = await p;
    expect(res.ok).toBe(true);
    expect(res.val.host).toBe('demo');
    expect(ftch).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// export surface — auto-detect heuristic removed (ADR-0008 / TASK-0020)
// ---------------------------------------------------------------------------
describe('IptvApi export surface', function () {
  let api;
  beforeEach(function () {
    api = loadApi({ fetch: vi.fn(), setTimeout: vi.fn(), clearTimeout: vi.fn(), Promise, encodeURIComponent, AbortController, URL });
  });

  it('exposes exactly connect, isDemo, parsM3u, loadM3u — no auto-detect heuristic', function () {
    expect(Object.keys(api).sort()).toEqual(['connect', 'isDemo', 'loadM3u', 'parsM3u']);
  });

  it('the removed heuristic key is undefined on the export object', function () {
    const removed = 'is' + 'M3u';
    expect(api[removed]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parsM3u
// ---------------------------------------------------------------------------
describe('parsM3u', function () {
  let api;
  beforeEach(function () {
    api = loadApi({ fetch: vi.fn(), setTimeout: vi.fn(), clearTimeout: vi.fn(), Promise, encodeURIComponent, AbortController, URL });
  });

  it('returns ok:false when text does not start with #EXTM3U', function () {
    const res = api.parsM3u('some random text\n#EXTINF:-1,Channel\nhttp://stream.example.com/ch1');
    expect(res.ok).toBe(false);
    expect(res.err).toBe('not an M3U file');
  });

  it('parses a minimal 2-channel M3U fixture correctly', function () {
    const txt = [
      '#EXTM3U',
      '#EXTINF:-1 tvg-id="ch1" tvg-name="Channel One" tvg-logo="http://img.example.com/1.png" group-title="News",Channel One',
      'http://stream.example.com/ch1',
      '#EXTINF:-1 tvg-id="ch2" tvg-name="Channel Two" tvg-logo="" group-title="Sports",Channel Two',
      'http://stream.example.com/ch2',
    ].join('\n');
    const res = api.parsM3u(txt);
    expect(res.ok).toBe(true);
    expect(res.val.channels).toHaveLength(2);
    const ch1 = res.val.channels[0];
    expect(ch1.id).toBe('ch1');
    expect(ch1.name).toBe('Channel One');
    expect(ch1.url).toBe('http://stream.example.com/ch1');
    expect(ch1.img).toBe('http://img.example.com/1.png');
    expect(ch1.grp).toBe('News');
    expect(ch1.num).toBe(1);
    const ch2 = res.val.channels[1];
    expect(ch2.id).toBe('ch2');
    expect(ch2.grp).toBe('Sports');
    expect(ch2.num).toBe(2);
  });

  it('derives deduplicated ordered categories from channels', function () {
    const txt = [
      '#EXTM3U',
      '#EXTINF:-1 group-title="Sports",Sport A',
      'http://stream.example.com/a',
      '#EXTINF:-1 group-title="News",News A',
      'http://stream.example.com/b',
      '#EXTINF:-1 group-title="Sports",Sport B',
      'http://stream.example.com/c',
    ].join('\n');
    const res = api.parsM3u(txt);
    expect(res.ok).toBe(true);
    expect(res.val.categories).toHaveLength(2);
    expect(res.val.categories[0]).toEqual({ category_id: 'Sports', category_name: 'Sports' });
    expect(res.val.categories[1]).toEqual({ category_id: 'News', category_name: 'News' });
  });

  it('defaults grp to "Other" when group-title is absent', function () {
    const txt = [
      '#EXTM3U',
      '#EXTINF:-1 tvg-name="No Group Channel",No Group Channel',
      'http://stream.example.com/nogrp',
    ].join('\n');
    const res = api.parsM3u(txt);
    expect(res.ok).toBe(true);
    expect(res.val.channels[0].grp).toBe('Other');
    expect(res.val.categories[0]).toEqual({ category_id: 'Other', category_name: 'Other' });
  });

  it('skips an #EXTINF entry whose following stream URL line is absent', function () {
    const txt = [
      '#EXTM3U',
      '#EXTINF:-1 group-title="News",Real Channel',
      'http://stream.example.com/real',
      '#EXTINF:-1 group-title="News",Missing URL Channel',
    ].join('\n');
    const res = api.parsM3u(txt);
    expect(res.ok).toBe(true);
    expect(res.val.channels).toHaveLength(1);
    expect(res.val.channels[0].name).toBe('Real Channel');
  });

  it('correctly handles channel name with embedded commas (uses last comma)', function () {
    const txt = [
      '#EXTM3U',
      '#EXTINF:-1 group-title="News",News, Live,Actual Name',
      'http://stream.example.com/actual',
    ].join('\n');
    const res = api.parsM3u(txt);
    expect(res.ok).toBe(true);
    expect(res.val.channels[0].name).toBe('Actual Name');
  });
});
