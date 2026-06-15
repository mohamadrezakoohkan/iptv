// ADR: ADR-0037
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const req = createRequire(import.meta.url);
const express = req('express');
const rtr     = req('../../server/rtr.js');

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const API_SRC    = join(__dir, '../../client/api.js');
const VOD_SRC    = join(__dir, '../../client/vod.js');

// Personal testing portal — specs/integration-testing.md, Xtream tier.
const PORTAL = 'http://mymax.top:8080';
const USR    = '1ymax5763dy';
const PSS    = '66537535';

// How many normalized items to sample for a shape probe (bounded — a large
// portal is not iterated in full, same posture as the other live tiers).
const SAMPLE = 5;

let srv  = null;
let base = '';

/** Named fetch shim — resolves the engine's relative proxy paths against the in-process server. */
function shimFetch(src, opts) {
  if (typeof src === 'string' && src.startsWith('/')) return fetch(base + src, opts);
  return fetch(src, opts);
}

/** Build the IptvVod store on the given window. */
function mkVod(win) {
  const src = readFileSync(VOD_SRC, 'utf8');
  const fn = new Function('window', '"use strict";\n' + src + '\nreturn window.IptvVod;');
  fn(win);
  return win.IptvVod;
}

/** Execute client/api.js against globals on a window that also carries IptvVod. */
function mkApi(globals) {
  const win = {};
  mkVod(win);
  Object.assign(globals, { window: win });
  const src = readFileSync(API_SRC, 'utf8');
  const fn = new Function(
    ...Object.keys(globals),
    '"use strict";\n' + src + '\nreturn { api: window.IptvApi, vod: window.IptvVod };'
  );
  return fn(...Object.values(globals));
}

function shims() {
  return { fetch: shimFetch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController, URL };
}

/** Validate one normalized Vod movie conforms to the Vod schema (specs/vod-library.md §1). */
function isVodShape(m) {
  return typeof m.id === 'string' && typeof m.name === 'string' && typeof m.grp === 'string'
    && typeof m.url === 'string' && typeof m.img === 'string' && typeof m.cat === 'string'
    && typeof m.num === 'number' && m.kind === 'movie';
}

/** Validate one normalized Series browse entry conforms to the Series schema (§2). */
function isSerShape(s) {
  return typeof s.id === 'string' && typeof s.name === 'string' && typeof s.grp === 'string'
    && typeof s.img === 'string' && typeof s.cat === 'string' && s.url === undefined;
}

beforeAll(async function onBoot() {
  const app = express();
  app.use(rtr);
  await new Promise(function onWait(done) {
    srv = app.listen(0, '127.0.0.1', function onUp() {
      base = `http://127.0.0.1:${srv.address().port}`;
      done();
    });
  });
});

afterAll(function onDown() {
  return new Promise(function onWait(done) {
    if (srv === null) { done(); return; }
    srv.close(done);
  });
});

// ---------------------------------------------------------------------------
// Xtream VOD tier — live get_vod_streams / get_series through the in-process
// proxy. Best-effort: the always-up bar is "the proxied VOD pass completes and
// the store holds only well-shaped items", not "the portal has VOD". A portal
// that serves no VOD/series (empty / error / timeout) degrades to an empty
// store — never a throw, never a malformed item. The connect Result is
// asserted to be the unchanged live shape (VOD is exposed only via IptvVod).
// ---------------------------------------------------------------------------
describe('VOD — live Xtream movie + series fetch through the proxy (personal portal)', function () {
  let vod;
  let res;

  beforeAll(async function onConn() {
    const built = mkApi(shims());
    vod = built.vod;
    const api = built.api;
    res = await api.connect(PORTAL, { user: USR, pass: PSS, m3u: false });
    expect(res.ok).toBe(true);
    const ext = res.val.channels.length > 0 && res.val.channels[0].url.endsWith('.m3u8') ? 'm3u8' : 'ts';
    // Best-effort VOD pass — never throws; empty/absent VOD leaves the store empty.
    await built.api.loadVod({ src: PORTAL, user: USR, pass: PSS, m3u: false, ext });
  }, 120000);

  it('the connect Result keeps the unchanged live Xtream shape (VOD exposed only via the store)', function () {
    expect(res.val.host).toBe(PORTAL);
    expect(res.val.user).toBe(USR);
    expect(Array.isArray(res.val.channels)).toBe(true);
    expect(res.val.vod).toBeUndefined();
    expect(res.val.movies).toBeUndefined();
    expect(res.val.series).toBeUndefined();
  }, 120000);

  it('the VOD pass completes and the movie store holds only well-shaped Vod items (≥ 0)', function () {
    const movs = vod.movies();
    expect(Array.isArray(movs)).toBe(true);
    expect(movs.length).toBeGreaterThanOrEqual(0);
    for (const m of movs.slice(0, SAMPLE)) expect(isVodShape(m)).toBe(true);
  }, 120000);

  it('any sampled movie URL is the built /movie/ on-demand form against the portal base', function () {
    for (const m of vod.movies().slice(0, SAMPLE)) {
      expect(m.url.startsWith(PORTAL + '/movie/' + USR + '/' + PSS + '/')).toBe(true);
      expect(m.url.replace('http://', '')).not.toContain('//');
    }
  }, 120000);

  it('the series store holds only well-shaped browse-only Series entries (≥ 0)', function () {
    const sers = vod.series();
    expect(Array.isArray(sers)).toBe(true);
    expect(sers.length).toBeGreaterThanOrEqual(0);
    for (const s of sers.slice(0, SAMPLE)) expect(isSerShape(s)).toBe(true);
  }, 120000);

  it('on-demand get_series_info reaches the proxy and yields only well-shaped episode Vod items (when a series exists)', async function () {
    const sers = vod.series();
    if (sers.length === 0) { expect(sers.length).toBe(0); return; } // no series to drill into — silent degrade
    const built = mkApi(shims());
    built.vod.setSers(sers);
    const id = sers[0].id;
    const out = await built.api.loadSerInfo({ src: PORTAL, user: USR, pass: PSS, id, ext: 'ts' });
    expect(out.ok).toBe(true);
    const epis = built.vod.episodes(id);
    expect(Array.isArray(epis)).toBe(true);
    for (const e of epis.slice(0, SAMPLE)) {
      expect(e.kind).toBe('episode');
      expect(e.url.startsWith(PORTAL + '/series/' + USR + '/' + PSS + '/')).toBe(true);
    }
  }, 120000);
});
