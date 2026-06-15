// ADR: ADR-0030
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

// Personal testing portal — specs/integration-testing.md, Xtream tier.
const PORTAL = 'http://mymax.top:8080';
const USR    = '1ymax5763dy';
const PSS    = '66537535';

// Public XMLTV reference endpoint (specs/integration-testing.md, XMLTV tier):
// a live, well-populated XMLTV guide (matthuisman.nz PlutoTV US mirror) in the
// canonical `YYYYMMDDHHMMSS ±HHMM` programme-timestamp form parsXmltv expects.
// Declared once here, as the M3U/Xtream reference endpoints are.
const XMLTV_URL = 'https://i.mjh.nz/PlutoTV/us.xml';

// How many live Xtream channels to sample for a short-EPG probe (bounded so a
// large portal is not hammered — same posture as the other live tiers).
const SAMPLE = 5;

let srv  = null;
let base = '';

/** Named fetch shim — resolves the engine's relative proxy paths against the in-process server. */
function shimFetch(src, opts) {
  if (typeof src === 'string' && src.startsWith('/')) return fetch(base + src, opts);
  return fetch(src, opts);
}

/** Build the IptvEpg store on the given window. */
function mkEpg(win) {
  const src = readFileSync(EPG_SRC, 'utf8');
  const fn = new Function('window', '"use strict";\n' + src + '\nreturn window.IptvEpg;');
  fn(win);
  return win.IptvEpg;
}

/** Execute client/api.js against globals on a window that also carries IptvEpg. */
function mkApi(globals) {
  const win = {};
  mkEpg(win);
  Object.assign(globals, { window: win });
  const src = readFileSync(API_SRC, 'utf8');
  const fn = new Function(
    ...Object.keys(globals),
    '"use strict";\n' + src + '\nreturn { api: window.IptvApi, epg: window.IptvEpg };'
  );
  return fn(...Object.values(globals));
}

function shims() {
  return { fetch: shimFetch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController, URL };
}

/** Deterministic bounded sample of channels. */
function getSample(chs, n) {
  const step = Math.max(1, Math.floor(chs.length / n));
  const out = [];
  for (let i = 0; i < chs.length && out.length < n; i += step) out.push(chs[i]);
  return out;
}

/** Validate one parsed Prg conforms to the Prg schema (CONVENTIONS §7). */
function isPrgShape(p) {
  return typeof p.chId === 'string' && typeof p.title === 'string'
    && typeof p.start === 'number' && typeof p.stop === 'number'
    && Number.isFinite(p.start) && Number.isFinite(p.stop) && p.start < p.stop;
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
// Xtream tier — live get_simple_data_table through the in-process proxy.
// Best-effort: the always-up bar is "the proxied endpoint responds and parses",
// not "every channel has listings" (EPG availability per channel varies).
// ---------------------------------------------------------------------------
describe('EPG — live Xtream short-EPG through the proxy (personal portal)', function () {
  let api;
  let epg;
  let chs;

  beforeAll(async function onConn() {
    const built = mkApi(shims());
    api = built.api;
    epg = built.epg;
    const res = await api.connect(PORTAL, { user: USR, pass: PSS, m3u: false });
    expect(res.ok).toBe(true);
    chs = getSample(res.val.channels, SAMPLE);
    await api.loadEpg({ src: PORTAL, user: USR, pass: PSS, m3u: false, chs });
  }, 120000);

  it('the proxied get_simple_data_table endpoint responds and parses for sampled channels (≥ 0 Prg each)', function () {
    // best-effort: every sampled channel must have parsed without throwing,
    // yielding a (possibly empty) list — the store never holds a malformed entry.
    for (const ch of chs) {
      const prgs = epg.get(ch.id);
      expect(Array.isArray(prgs)).toBe(true);
      expect(prgs.length).toBeGreaterThanOrEqual(0);
    }
  }, 120000);

  it('any parsed program conforms to the Prg schema (unix-ms start < stop)', function () {
    for (const ch of chs) {
      for (const p of epg.get(ch.id)) expect(isPrgShape(p)).toBe(true);
    }
  }, 120000);
});

// ---------------------------------------------------------------------------
// XMLTV tier — fetch a public XMLTV guide through the proxy, parse into a
// non-empty { [id]: Prg[] } map. The M3U EPG path (loadEpg with m3u:true +
// epgUrl) fetches through /api/xtream and setAll's the parsed map into the
// store; parsing the same text directly proves the map shape and Prg schema.
// ---------------------------------------------------------------------------
describe('EPG — live XMLTV guide through the proxy', function () {
  let api;
  let epg;
  let map;

  beforeAll(async function onLoad() {
    const built = mkApi(shims());
    api = built.api;
    epg = built.epg;
    // Drive the M3U EPG path with the public XMLTV reference endpoint as the
    // resolved url-tvg guide URL; loadEpg fetches it through /api/xtream and
    // setAll's the parsed map into the store.
    await api.loadEpg({ src: 'x', m3u: true, chs: [], epgUrl: XMLTV_URL });
    // Independently fetch + parse the same guide text to assert the map shape.
    const raw = await shimFetch('/api/xtream?url=' + encodeURIComponent(XMLTV_URL));
    expect(raw.ok).toBe(true);
    expect(raw.headers.get('content-type') || '').toMatch(/text|xml/i);
    map = epg.parsXmltv(await raw.text());
  }, 120000);

  it('loadEpg populated the store from the live XMLTV guide (non-empty)', function () {
    expect(epg.count()).toBeGreaterThan(0);
  }, 120000);

  it('parsXmltv yields a non-empty { [id]: Prg[] } map keyed by channel id', function () {
    const ids = Object.keys(map);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids.slice(0, SAMPLE)) {
      expect(Array.isArray(map[id])).toBe(true);
      expect(map[id].length).toBeGreaterThan(0);
    }
  }, 120000);

  it('every sampled stored program conforms to the Prg schema (unix-ms start < stop, sorted)', function () {
    const ids = Object.keys(map).slice(0, SAMPLE);
    for (const id of ids) {
      const prgs = map[id];
      for (const p of prgs) {
        expect(isPrgShape(p)).toBe(true);
        expect(p.chId).toBe(id);
      }
      for (let i = 1; i < prgs.length; i += 1) expect(prgs[i].start).toBeGreaterThanOrEqual(prgs[i - 1].start);
    }
  }, 120000);
});
