// ADR: ADR-0007
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

const LIVE_URL  = 'https://iptv-org.github.io/iptv/index.m3u';
const LIVE_HOST = 'iptv-org.github.io';

let srv  = null;
let base = '';
let res  = null; // Result of IptvApi.connect against the live playlist

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
  res = await api.connect(LIVE_URL, { user: '', pass: '' });
});

afterAll(function onDown() {
  return new Promise(function onWait(done) {
    if (srv === null) { done(); return; }
    srv.close(done);
  });
});

describe('engine — live M3U connect + load (iptv-org index.m3u)', function () {
  it('connect resolves the RULE-FN-4 success Result { ok: true, val }', function () {
    expect(res).not.toBeNull();
    expect(res.ok).toBe(true);
    expect(res.val).toBeDefined();
  });

  it('val carries the expected M3U identity: host, empty user, null server', function () {
    expect(res.val.host).toBe(LIVE_HOST);
    expect(res.val.user).toBe('');
    expect(res.val.server).toBeNull();
  });

  it('parses the playlist at real scale: > 100 channels, > 1 categories', function () {
    expect(res.val.channels.length).toBeGreaterThan(100);
    expect(res.val.categories.length).toBeGreaterThan(1);
  });

  it('sampled channels (first, middle, last) conform to CH_DEF', function () {
    const smpl = getSample(res.val.channels);
    for (const ch of smpl) {
      expect(typeof ch.id).toBe('string');
      expect(typeof ch.name).toBe('string');
      expect(typeof ch.grp).toBe('string');
      expect(typeof ch.url).toBe('string');
      expect(typeof ch.img).toBe('string');
      expect(typeof ch.cat).toBe('string');
      expect(typeof ch.num).toBe('number');
      expect(ch.name.length).toBeGreaterThan(0);
      expect(/^https?:\/\//.test(ch.url)).toBe(true);
    }
  });

  it('every category has string category_id and category_name', function () {
    for (const cat of res.val.categories) {
      expect(typeof cat.category_id).toBe('string');
      expect(typeof cat.category_name).toBe('string');
    }
  });
});
