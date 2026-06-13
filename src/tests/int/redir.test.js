// ADR: ADR-0011
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';

const req = createRequire(import.meta.url);
const express = req('express');
const rtr     = req('../../server/rtr.js');

// Personal testing portal — specs/integration-testing.md, Xtream tier.
const PORTAL  = 'http://mymax.top:8080';
const USR     = '1ymax5763dy';
const PSS     = '66537535';
const SAMPLE  = 5;       // stream-level flake policy: at least 1 of 5
const READ_SZ = 65536;   // bounded read ~64 KB, then abort

let srv  = null;
let base = '';

function getPrx(url) {
  return `${base}/api/xtream?url=${encodeURIComponent(url)}`;
}

/** Bounded read: pull up to READ_SZ bytes from a live response, then abort. */
async function loadBytes(url) {
  const ctl = new AbortController();
  const tmr = setTimeout(function onLate() { ctl.abort(); }, 15000);
  try {
    const res = await fetch(getPrx(url), { signal: ctl.signal });
    if (res.status !== 200) return { ok: false, err: `status ${res.status}` };
    const rdr  = res.body.getReader();
    let   tot  = 0;
    let   head = null;
    while (tot < READ_SZ) {
      const d = await rdr.read();
      if (d.done) break;
      if (head === null && d.value.length > 0) head = d.value[0];
      tot += d.value.length;
    }
    ctl.abort();
    return { ok: true, val: { head: head, tot: tot } };
  } catch (err) {
    return { ok: false, err: String(err && err.message) };
  } finally {
    clearTimeout(tmr);
  }
}

beforeAll(function onBoot() {
  const app = express();
  app.use(rtr);
  return new Promise(function onWait(done) {
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

describe('proxy — live redirect-following on Xtream .ts streams (personal portal)', function () {
  it('a live channel .ts URL through the proxy yields HTTP 200 and MPEG-TS sync byte 0x47', async function () {
    const api = `${PORTAL}/player_api.php?username=${USR}&password=${PSS}&action=get_live_streams`;
    const res = await fetch(getPrx(api));
    expect(res.status).toBe(200);
    const strms = await res.json();
    expect(Array.isArray(strms)).toBe(true);
    expect(strms.length).toBeGreaterThan(0);

    let hit = null;
    for (let i = 0; i < Math.min(SAMPLE, strms.length); i++) {
      const url = `${PORTAL}/live/${USR}/${PSS}/${strms[i].stream_id}.ts`;
      const out = await loadBytes(url);
      if (out.ok && out.val.head === 0x47 && out.val.tot > 0) { hit = out.val; break; }
    }
    expect(hit).not.toBeNull();
    expect(hit.head).toBe(0x47);
    expect(hit.tot).toBeGreaterThan(0);
  });
});
