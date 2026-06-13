// ADR: ADR-0007, ADR-0008
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

const LIVE_URL = 'https://iptv-org.github.io/iptv/index.m3u';
const SMPL_CNT = 5;     // streams sampled: first, 25 %, 50 %, 75 %, last
const STRM_MS  = 15000; // per-stream fetch timeout
const MIN_OK   = 1;     // ADR-0007 anti-flakiness: >= 1 of 5 must be live

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

/** Deterministic SMPL_CNT stream URLs: indices at 0 %, 25 %, 50 %, 75 %, 100 % of the list. */
function getSmpl(chs) {
  const smpl = [];
  for (let i = 0; i < SMPL_CNT; i += 1) {
    const idx = Math.round((i / (SMPL_CNT - 1)) * (chs.length - 1));
    smpl.push(chs[idx].url);
  }
  return smpl;
}

/** Fetch one stream URL with a STRM_MS abort timeout. Never throws — RULE-FN-4 Result. */
async function loadStrm(url) {
  const ctl = new AbortController();
  const tmr = setTimeout(function onKill() { ctl.abort(); }, STRM_MS);
  try {
    const rsp = await fetch(url, { signal: ctl.signal });
    if (!rsp.ok) return { ok: false, err: `${url} -> http ${rsp.status}` };
    const txt = await rsp.text();
    if (!txt.startsWith('#EXTM3U')) {
      return { ok: false, err: `${url} -> 2xx but body is not an HLS manifest` };
    }
    return { ok: true, val: url };
  } catch (err) {
    return { ok: false, err: `${url} -> ${String(err.message ?? err)}` };
  } finally {
    clearTimeout(tmr);
  }
}

/** One diagnosable line per stream outcome. */
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
  res = await api.connect(LIVE_URL, { user: '', pass: '', m3u: true });
});

afterAll(function onDown() {
  return new Promise(function onWait(done) {
    if (srv === null) { done(); return; }
    srv.close(done);
  });
});

describe('engine — sampled stream reachability (iptv-org index.m3u)', function () {
  it('live playlist yields enough channels to sample', function () {
    expect(res).not.toBeNull();
    expect(res.ok).toBe(true);
    expect(res.val.channels.length).toBeGreaterThanOrEqual(SMPL_CNT);
  });

  it('sample is deterministic and spans first to last channel', function () {
    const chs  = res.val.channels;
    const smpl = getSmpl(chs);
    expect(smpl.length).toBe(SMPL_CNT);
    expect(smpl[0]).toBe(chs[0].url);
    expect(smpl[SMPL_CNT - 1]).toBe(chs[chs.length - 1].url);
    expect(getSmpl(chs)).toEqual(smpl);
  });

  it(`at least ${MIN_OK} of ${SMPL_CNT} sampled streams returns a live HLS manifest`, async function () {
    const smpl = getSmpl(res.val.channels);
    const outs = await Promise.all(smpl.map(loadStrm));
    const msg  = mkMsg(outs);
    let cnt = 0;
    for (const d of outs) { if (d.ok) cnt += 1; }
    console.log(`stream sample outcomes (${cnt}/${SMPL_CNT} live):\n${msg}`);
    expect(cnt, `expected >= ${MIN_OK} of ${SMPL_CNT} sampled streams live\n${msg}`).toBeGreaterThanOrEqual(MIN_OK);
  });
});
