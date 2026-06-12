// ADR: ADR-0011
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';

const req = createRequire(import.meta.url);
const http    = req('http');
const express = req('express');
const rtr     = req('../../server/rtr.js');

let fix     = null; // fixture upstream server
let fixBase = '';
let srv     = null; // express app under test
let base    = '';
let upGone  = false; // fixture saw its long-stream connection close

/** Fixture routes — local in-process upstream standing in for the portal. */
function onFix(rq, rs) {
  if (rq.url === '/single')  { rs.writeHead(302, { location: `${fixBase}/final` }); rs.end(); return; }
  if (rq.url === '/rel')     { rs.writeHead(302, { location: '/final' }); rs.end(); return; }
  if (rq.url.startsWith('/loop')) { rs.writeHead(302, { location: `${fixBase}/loop` }); rs.end(); return; }
  if (rq.url === '/blocked') { rs.writeHead(302, { location: 'http://localhost:9/x' }); rs.end(); return; }
  if (rq.url === '/strm') {
    rs.writeHead(200, { 'content-type': 'video/mp2t' });
    rs.write('chunk-1');
    rq.on('close', function onGone() { upGone = true; });
    return; // never ends — long-lived stream
  }
  rs.writeHead(200, { 'content-type': 'text/plain' });
  rs.end('final-ok');
}

function getUrl(path) {
  return `${base}/api/xtream?url=${encodeURIComponent(fixBase + path)}`;
}

beforeAll(async function onBoot() {
  // Fixtures live on 127.0.0.1 — lift only that entry from the blocklist
  // so the proxy can reach them; 'localhost' stays blocked for the
  // blocked-redirect-target case.
  rtr._blocked.splice(rtr._blocked.indexOf('127.0.0.1'), 1);
  await new Promise(function onWait(done) {
    fix = http.createServer(onFix);
    fix.listen(0, '127.0.0.1', function onUp() {
      fixBase = `http://127.0.0.1:${fix.address().port}`;
      done();
    });
  });
  const app = express();
  app.use(rtr);
  await new Promise(function onWait(done) {
    srv = app.listen(0, '127.0.0.1', function onUp() {
      base = `http://127.0.0.1:${srv.address().port}`;
      done();
    });
  });
});

afterAll(async function onDown() {
  rtr._blocked.push('127.0.0.1');
  await new Promise(function onWait(done) { srv.close(done); });
  fix.closeAllConnections();
  await new Promise(function onWait(done) { fix.close(done); });
});

describe('proxy — redirect following (ADR-0011)', function () {
  it('follows a single 302 and pipes the final 200 body', async function () {
    const res = await fetch(getUrl('/single'));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('final-ok');
  });

  it('resolves a relative Location against the current URL', async function () {
    const res = await fetch(getUrl('/rel'));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('final-ok');
  });

  it('returns 502 { err } when the chain exceeds 5 hops', async function () {
    const res = await fetch(getUrl('/loop'));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(typeof body.err).toBe('string');
  });

  it('returns 400 { err } when a redirect targets a blocked host', async function () {
    const res = await fetch(getUrl('/blocked'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(typeof body.err).toBe('string');
  });

  it('pipes a plain 200 response unchanged (no redirect involved)', async function () {
    const res = await fetch(getUrl('/final'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    expect(await res.text()).toBe('final-ok');
  });

  it('destroys the upstream connection when the client disconnects mid-stream', async function () {
    const ctl = new AbortController();
    const res = await fetch(getUrl('/strm'), { signal: ctl.signal });
    expect(res.status).toBe(200);
    const rdr = res.body.getReader();
    await rdr.read(); // first chunk arrived — stream is live
    ctl.abort();
    for (let i = 0; i < 50 && !upGone; i++) {
      await new Promise(function onWait(done) { setTimeout(done, 100); });
    }
    expect(upGone).toBe(true);
  });
});
