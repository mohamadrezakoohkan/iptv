// ADR: ADR-0035
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

// Personal testing portal — specs/integration-testing.md, Xtream tier.
const PORTAL = 'http://mymax.top:8080';
const USR    = '1ymax5763dy';
const PSS    = '66537535';

let srv  = null;
let base = '';
let res  = null; // Result of IptvApi.connect against the live portal

/** Named fetch shim — resolves the engine's relative proxy paths against the in-process server. */
function shimFetch(src, opts) {
  if (typeof src === 'string' && src.startsWith('/')) return fetch(base + src, opts);
  return fetch(src, opts);
}

/** Execute client/api.js IIFE against the given globals, return window.IptvApi. */
function loadApi(globals) {
  const win = {};
  Object.assign(globals, { window: win });
  const src = readFileSync(API_SRC, 'utf8');
  const fn = new Function(
    ...Object.keys(globals),
    '"use strict";\n' + src + '\nreturn window.IptvApi;'
  );
  return fn(...Object.values(globals));
}

/** Deterministic sample: first, middle, last channel. */
function getSample(chs) {
  return [chs[0], chs[Math.floor(chs.length / 2)], chs[chs.length - 1]];
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
  const api = loadApi({ fetch: shimFetch, setTimeout, clearTimeout, Promise, encodeURIComponent, AbortController, URL });
  res = await api.connect(PORTAL, { user: USR, pass: PSS, m3u: false });
});

afterAll(function onDown() {
  return new Promise(function onWait(done) {
    if (srv === null) { done(); return; }
    srv.close(done);
  });
});

describe('catch-up — live Xtream channels carry arch / archDur (personal portal)', function () {
  it('connect resolves the RULE-FN-4 success Result { ok: true, val }', function () {
    expect(res).not.toBeNull();
    expect(res.ok).toBe(true);
    expect(res.val).toBeDefined();
    expect(res.val.channels.length).toBeGreaterThan(1);
  });

  it('every channel carries arch:boolean and archDur:number (full normalized list)', function () {
    for (const ch of res.val.channels) {
      expect(typeof ch.arch).toBe('boolean');
      expect(typeof ch.archDur).toBe('number');
      expect(Number.isFinite(ch.archDur)).toBe(true);
      expect(ch.archDur).toBeGreaterThanOrEqual(0);
    }
  });

  it('sampled channels (first, middle, last) carry well-typed archive fields', function () {
    const smpl = getSample(res.val.channels);
    for (const ch of smpl) {
      expect(typeof ch.arch).toBe('boolean');
      expect(typeof ch.archDur).toBe('number');
      // archDur is positive only when the channel advertises archive support.
      if (ch.arch === false) expect(ch.archDur).toBe(0);
    }
  });
});
