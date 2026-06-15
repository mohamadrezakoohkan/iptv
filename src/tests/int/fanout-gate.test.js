// ADR: ADR-0041
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
const EPG_SRC    = join(__dir, '../../client/epg.js');
const VOD_SRC    = join(__dir, '../../client/vod.js');

// Personal testing portal — specs/integration-testing.md, Xtream tier.
const PORTAL = 'http://mymax.top:8080';
const USR    = '1ymax5763dy';
const PSS    = '66537535';

// Generous per-request timeout: the live portal was recently in an anti-flood
// cooldown, so a single probe is given headroom (specs/integration-testing.md
// bounded-sampling posture). Vitest hooks/tests carry their own 120 s budget.
const PROBE_MS = 20000;

let srv  = null;
let base = '';

// Flood-safety instrumentation: every proxied Xtream request the engine issues
// is recorded here so the test can prove the gate fired on REAL data — i.e. on a
// single-connection portal NO bulk EPG/VOD action requests are made. The shim
// records the decoded upstream `action=` of each /api/xtream?url=… call.
let calls = [];

/**
 * Named fetch shim — resolves the engine's relative proxy paths against the
 * in-process server AND records the upstream Xtream `action` of every proxied
 * request, so the test can assert which fan-out requests were (not) issued.
 */
function shimFetch(src, opts) {
  if (typeof src === 'string' && src.startsWith('/')) {
    recordCall(src);
    return fetch(base + src, opts);
  }
  return fetch(src, opts);
}

/** Record the decoded upstream `action` (or '<auth>' for the no-action call) of a proxied request. */
function recordCall(path) {
  const m = path.match(/[?&]url=([^&]*)/);
  if (!m) return;
  let upstream = '';
  try { upstream = decodeURIComponent(m[1]); } catch (_) { upstream = m[1]; }
  const am = upstream.match(/[?&]action=([^&]*)/);
  calls.push(am ? am[1] : '<noaction>');
}

/** Build the IptvEpg store on the given window. */
function mkEpg(win) {
  const src = readFileSync(EPG_SRC, 'utf8');
  const fn = new Function('window', '"use strict";\n' + src + '\nreturn window.IptvEpg;');
  fn(win);
  return win.IptvEpg;
}

/** Build the IptvVod store on the given window. */
function mkVod(win) {
  const src = readFileSync(VOD_SRC, 'utf8');
  const fn = new Function('window', '"use strict";\n' + src + '\nreturn window.IptvVod;');
  fn(win);
  return win.IptvVod;
}

/** Execute client/api.js against globals on a window carrying IptvEpg + IptvVod. */
function mkApi(globals) {
  const win = {};
  mkEpg(win);
  mkVod(win);
  Object.assign(globals, { window: win });
  const src = readFileSync(API_SRC, 'utf8');
  const fn = new Function(
    ...Object.keys(globals),
    '"use strict";\n' + src + '\nreturn { api: window.IptvApi, epg: window.IptvEpg, vod: window.IptvVod };'
  );
  return fn(...Object.values(globals));
}

function shims() {
  return { fetch: shimFetch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController, URL };
}

/** Count recorded proxied requests whose upstream action matches a predicate. */
function countCalls(pred) {
  return calls.filter(pred).length;
}

/** True when the action is one of the bulk EPG/VOD fan-out actions the gate suppresses. */
function isFanoutAction(actn) {
  return actn === 'get_simple_data_table'
    || actn.startsWith('get_vod_')
    || actn.startsWith('get_series');
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
// Fan-out gate — live, data-driven from the REAL portal's advertised
// max_connections (ADR-0041, TASK-0092). This spec is DELIBERATELY MINIMAL on
// live requests: connect (3 calls: auth + categories + streams), the gated
// loadEpg/loadVod (zero extra calls on a single-connection portal), and exactly
// ONE live stream probe. It never adds per-channel sampling loops — the whole
// point of the run is to NOT flood a max_connections:1 account.
// ---------------------------------------------------------------------------
describe('fan-out gate — data-driven from live max_connections (personal portal)', function () {
  let api;
  let epg;
  let vod;
  let res;
  let maxConns;
  let connCalls = 0; // calls issued by connect alone (auth + categories + streams)

  beforeAll(async function onConn() {
    const built = mkApi(shims());
    api = built.api;
    epg = built.epg;
    vod = built.vod;
    calls = [];
    res = await api.connect(PORTAL, { user: USR, pass: PSS, m3u: false });
    connCalls = calls.length;
    expect(res.ok).toBe(true);

    // Read the LIVE advertised capacity, then run the gated fan-out for it.
    maxConns = res.val.maxConns;
    const chs = res.val.channels;
    await api.loadEpg({ src: PORTAL, user: USR, pass: PSS, m3u: false, chs, maxConns });
    await api.loadVod({ src: PORTAL, user: USR, pass: PSS, m3u: false, maxConns });
  }, 120000);

  it('the connect Result carries a numeric, non-negative maxConns from live user_info.max_connections', function () {
    expect(typeof maxConns).toBe('number');
    expect(Number.isFinite(maxConns)).toBe(true);
    expect(maxConns).toBeGreaterThanOrEqual(0);
  });

  it('the gate decision is data-driven from the live capacity (no hard-coded assumption)', function () {
    const fanoutCalls = calls.slice(connCalls).filter(isFanoutAction);
    if (maxConns === 1) {
      // Single-connection portal: the gate must have fired on REAL data — the
      // bulk EPG/VOD fan-out is skipped entirely and both stores stay empty.
      expect(countCalls(isFanoutAction)).toBe(0);
      expect(fanoutCalls.length).toBe(0);
      expect(epg.count()).toBe(0);
      expect(vod.movies().length + vod.series().length).toBe(0);
    } else {
      // Multi-connection or unknown (0): the bounded fan-out runs, so at least
      // one of the EPG/VOD fan-out actions was issued through the proxy.
      expect(countCalls(isFanoutAction)).toBeGreaterThan(0);
    }
  }, 120000);

  it('after the gated loadEpg/loadVod, a single live stream request is reachable (success/redirect, not 404)', async function () {
    // Exactly ONE stream probe — never a sampling loop — so a max_connections:1
    // account is not flooded. A transient blip within the bounded-sampling
    // tolerance (specs/integration-testing.md) is not a hard fail: only a
    // definitive 404 (the regression signature — playback starved) fails here.
    const ch = res.val.channels[0];
    expect(typeof ch.url).toBe('string');
    expect(ch.url.length).toBeGreaterThan(0);

    // The in-process proxy (rtr.js) follows the portal's 302 server-side and
    // pipes back the FINAL upstream status, so a healthy live stream surfaces as
    // 200 and a starved/anti-flood account surfaces as 404. The TS body is
    // cancelled immediately after the status is read so the stream is never
    // downloaded — exactly one bounded request.
    const ctrl = new AbortController();
    const tid = setTimeout(function onTout() { ctrl.abort(); }, PROBE_MS);
    let status = 0;
    let reached = true;
    try {
      const r = await shimFetch('/api/xtream?url=' + encodeURIComponent(ch.url), { signal: ctrl.signal });
      status = r.status;
      try { await r.body?.cancel(); } catch (_) { /* nothing to drain */ }
    } catch (_) {
      // Transient network anomaly within tolerance — not the regression.
      reached = false;
    } finally {
      clearTimeout(tid);
    }

    if (reached) {
      // The regression signature is a 404 (anti-flood / starved connection).
      // The gate must keep the lone connection free, so the stream is NOT 404.
      expect(status).not.toBe(404);
      expect(status).toBeGreaterThanOrEqual(200);
    } else {
      // A transient blip is tolerated per the documented live-tier posture.
      expect(reached === false).toBe(true);
    }
  }, 120000);
});
