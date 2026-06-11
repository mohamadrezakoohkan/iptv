// ADR: ADR-0001
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

  function makeFetch(body) {
    return vi.fn().mockResolvedValue({
      ok:   true,
      json: vi.fn().mockResolvedValue(body),
    });
  }

  it('fetches via /api/xtream?url= (not the portal directly)', async function () {
    const ftch = makeFetch([]);
    const api = loadApi({ fetch: ftch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    await api.connect(BASE, { user: USR, pass: PSS });
    const firstUrl = ftch.mock.calls[0][0];
    expect(firstUrl.startsWith('/api/xtream?url=')).toBe(true);
  });

  it('first request encodes get_live_categories action', async function () {
    const ftch = makeFetch([]);
    const api = loadApi({ fetch: ftch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    await api.connect(BASE, { user: USR, pass: PSS });
    const firstUrl = ftch.mock.calls[0][0];
    expect(decodeURIComponent(firstUrl)).toContain('action=get_live_categories');
  });

  it('second request encodes get_live_streams action', async function () {
    const ftch = makeFetch([]);
    const api = loadApi({ fetch: ftch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    await api.connect(BASE, { user: USR, pass: PSS });
    const secondUrl = ftch.mock.calls[1][0];
    expect(decodeURIComponent(secondUrl)).toContain('action=get_live_streams');
  });

  it('encodes username and password in proxy URL', async function () {
    const ftch = makeFetch([]);
    const api = loadApi({ fetch: ftch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    await api.connect(BASE, { user: USR, pass: PSS });
    const firstUrl = decodeURIComponent(ftch.mock.calls[0][0]);
    expect(firstUrl).toContain('username=' + USR);
    expect(firstUrl).toContain('password=' + PSS);
  });

  it('resolves with ok:true val containing host, user, categories, channels', async function () {
    const cats = [{ name: 'News' }];
    const chs  = [{ id: '1', name: 'World News 24' }];
    const ftch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(cats) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(chs) });
    const api = loadApi({ fetch: ftch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController });
    const res = await api.connect(BASE, { user: USR, pass: PSS });
    expect(res.ok).toBe(true);
    expect(res.val.host).toBe(BASE);
    expect(res.val.user).toBe(USR);
    expect(res.val.categories).toEqual(cats);
    expect(res.val.channels).toEqual(chs);
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
