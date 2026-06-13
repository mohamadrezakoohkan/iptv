// ADR: ADR-0012
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const req = createRequire(import.meta.url);
const express = req('express');
const rtr     = req('../../server/rtr.js');
const hls     = req('../../server/hls.js');

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const API_SRC    = join(__dir, '../../client/api.js');

// Personal testing portal — specs/integration-testing.md, Xtream tier.
const PORTAL  = 'http://mymax.top:8080';
const USR     = '1ymax5763dy';
const PSS     = '66537535';
const MIN_OK  = 1;     // flake policy: >= 1 of the sample must remux
const SEG_LIM = 65536; // bounded segment read (bytes)

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

/** First segment URI listed in a playlist body, or null. */
function getSeg(txt) {
  for (const line of txt.split('\n')) {
    if (line.startsWith('/api/hls/') && line.endsWith('.ts')) return line;
  }
  return null;
}

/** Remux one channel through /api/hls and fetch its first segment. RULE-FN-4 Result. */
async function loadRmx(ch) {
  const rsp = await fetch(base + '/api/hls?url=' + encodeURIComponent(ch.url));
  if (rsp.status !== 200) return { ok: false, err: `${ch.name} -> /api/hls http ${rsp.status}` };
  const txt = await rsp.text();
  if (!txt.startsWith('#EXTM3U')) return { ok: false, err: `${ch.name} -> playlist body is not #EXTM3U` };
  const seg = getSeg(txt);
  if (seg === null) return { ok: false, err: `${ch.name} -> playlist lists no /api/hls segment` };
  const sgr = await fetch(base + seg);
  if (sgr.status !== 200) return { ok: false, err: `${ch.name} -> segment http ${sgr.status}` };
  const buf = new Uint8Array((await sgr.arrayBuffer()).slice(0, SEG_LIM));
  if (buf.length === 0 || buf[0] !== 0x47) return { ok: false, err: `${ch.name} -> segment byte 0 is not 0x47` };
  return { ok: true, val: `${ch.name} -> playlist + segment OK (${buf.length} bytes)` };
}

/** One diagnosable line per outcome. */
function mkMsg(outs) {
  const msg = [];
  for (const d of outs) msg.push(d.ok ? `OK   ${d.val}` : `FAIL ${d.err}`);
  return msg.join('\n');
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
  // Tear every remux session down: ffmpeg killed, temp dirs removed.
  for (const sess of [...hls._sess.values()]) hls._rmSess(sess);
  return new Promise(function onWait(done) {
    if (srv === null) { done(); return; }
    srv.close(done);
  });
});

describe('server — live TS→HLS remux (/api/hls, personal portal)', function () {
  it('portal connect yields channels to sample', function () {
    expect(res).not.toBeNull();
    expect(res.ok).toBe(true);
    expect(res.val.channels.length).toBeGreaterThan(1);
  });

  it('rejects an invalid url with 400 (SSRF gate active on the remux path)', async function () {
    const rsp = await fetch(base + '/api/hls?url=' + encodeURIComponent('http://127.0.0.1/x.ts'));
    expect(rsp.status).toBe(400);
  });

  it(`at least ${MIN_OK} sampled live channel remuxes to a playable HLS playlist + valid TS segment`, async function () {
    const smpl = getSample(res.val.channels);
    const outs = [];
    for (const ch of smpl) {
      const d = await loadRmx(ch);
      outs.push(d);
      if (d.ok) break; // flake policy satisfied; do not hammer the portal
    }
    const msg = mkMsg(outs);
    let cnt = 0;
    for (const d of outs) { if (d.ok) cnt += 1; }
    console.log(`remux sample outcomes (${cnt} ok):\n${msg}`);
    expect(cnt, `expected >= ${MIN_OK} sampled channel to remux\n${msg}`).toBeGreaterThanOrEqual(MIN_OK);
    expect(hls._sess.size).toBeGreaterThan(0);
  });

  it('session teardown removes all remux sessions', function () {
    for (const sess of [...hls._sess.values()]) hls._rmSess(sess);
    expect(hls._sess.size).toBe(0);
    expect(hls._keys.size).toBe(0);
  });
});
