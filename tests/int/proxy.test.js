// ADR: ADR-0006
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';

const req = createRequire(import.meta.url);
const express = req('express');
const rtr     = req('../../server/rtr.js');

const LIVE_URL = 'https://iptv-org.github.io/iptv/index.m3u';

let srv  = null;
let base = '';

function getLine(body) {
  const rows = body.split('\n');
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].trim() !== '') return rows[i].trim();
  }
  return '';
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

describe('proxy — live connectivity to the iptv-org playlist', function () {
  it('fetches the live playlist through /api/xtream with HTTP 200 and #EXTM3U body', async function () {
    const res = await fetch(`${base}/api/xtream?url=${encodeURIComponent(LIVE_URL)}`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(getLine(body).startsWith('#EXTM3U')).toBe(true);
  });

  it('rejects an invalid target live with 400 and { err } JSON', async function () {
    const res = await fetch(`${base}/api/xtream?url=not-a-url`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(typeof body.err).toBe('string');
    expect(body.err.length).toBeGreaterThan(0);
  });
});
