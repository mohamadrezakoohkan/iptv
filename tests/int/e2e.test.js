// ADR: ADR-0010
// Integration — TASK-0024 acceptance gate, full stack:
// engine (IptvApi.connect, Xtream mode) → in-process proxy → live portal,
// then the engine's own normalized channel URLs fetched through the proxy
// must deliver real MPEG-TS bytes (redirects followed server-side).
// Live portal per specs/integration-testing.md, Xtream tier.

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
const PORTAL  = 'http://mymax.top:8080';
const USR     = '1ymax5763dy';
const PSS     = '66537535';
const SAMPLE  = 5;       // stream-level flake policy: at least 1 of 5
const READ_SZ = 65536;   // bounded read ~64 KB, then abort

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

/** Bounded read: pull up to READ_SZ bytes of a proxied stream URL, then abort. */
async function loadBytes(url) {
  const ctl = new AbortController();
  const tmr = setTimeout(function onLate() { ctl.abort(); }, 15000);
  try {
    const out = await fetch(`${base}/api/xtream?url=${encodeURIComponent(url)}`, { signal: ctl.signal });
    if (out.status !== 200) return { ok: false, err: `status ${out.status}` };
    const rdr  = out.body.getReader();
    let   tot  = 0;
    let   head = null;
    while (tot < READ_SZ) {
      const d = await rdr.read();
      if (d.done) break;
      if (head === null && d.value.length > 0) head = d.value[0];
      tot += d.value.length;
    }
    ctl.abort();
    return { ok: true, val: { head, tot } };
  } catch (err) {
    return { ok: false, err: String(err && err.message) };
  } finally {
    clearTimeout(tmr);
  }
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

describe('e2e — live Xtream connect, list, and stream bytes (acceptance gate)', function () {
  it('connect (Xtream mode) resolves ok with more than one category and channel', function () {
    expect(res).not.toBeNull();
    expect(res.ok).toBe(true);
    expect(res.val.categories.length).toBeGreaterThan(1);
    expect(res.val.channels.length).toBeGreaterThan(1);
  });

  it('sampled channels are schema-valid Ch objects', function () {
    const chs  = res.val.channels;
    const smpl = [chs[0], chs[Math.floor(chs.length / 2)], chs[chs.length - 1]];
    for (const ch of smpl) {
      expect(typeof ch.id).toBe('string');
      expect(typeof ch.name).toBe('string');
      expect(typeof ch.grp).toBe('string');
      expect(typeof ch.url).toBe('string');
      expect(typeof ch.img).toBe('string');
      expect(typeof ch.cat).toBe('string');
      expect(typeof ch.num).toBe('number');
      expect(ch.id.length).toBeGreaterThan(0);
      expect(ch.name.length).toBeGreaterThan(0);
      expect(ch.url.startsWith('http')).toBe(true);
    }
  });

  it('a normalized channel url through the proxy returns 200 with TS sync byte 0x47', async function () {
    const chs = res.val.channels;
    let hit = null;
    for (let i = 0; i < Math.min(SAMPLE, chs.length); i++) {
      const out = await loadBytes(chs[i].url);
      if (out.ok && out.val.head === 0x47 && out.val.tot > 0) { hit = out.val; break; }
    }
    expect(hit).not.toBeNull();
    expect(hit.head).toBe(0x47);
    expect(hit.tot).toBeGreaterThan(0);
  });
});
