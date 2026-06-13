// ADR: ADR-0027, ADR-0028
// Build-smoke — TASK-0058 acceptance gate (refines TASK-0057). Proves the Fly.io
// deployment artifacts (Dockerfile / fly.toml / .dockerignore) produce a working
// runtime image that *self-binds* 8080: a real `docker build`, a container started
// with NO `-e PORT` (relying solely on the image's `ENV PORT=8080`, ADR-0028) that
// serves `/` over HTTP (200 + `<title>`) on 8080, and a resolvable, executable
// `ffmpeg-static` binary *inside* the image (proves the ADR-0012 remux fallback
// will work on Fly). Running without `-e PORT` is the real proof of self-bind:
// a bare `docker run` of the image must serve on 8080. Isolated to its own runner
// (vitest.smoke.config.js) and skipped cleanly when Docker is absent, so it never
// slows or flakes the normal unit/integration gates.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const ROOT       = join(__dir, '../../..');

const TAG  = 'teeatr-smoke:test';
const CTR  = 'teeatr-smoke-ctr';
const PORT = 8080; // container-internal port (mirrors fly.toml internal_port / [env] PORT)

// Detect Docker once. If the daemon is unreachable the whole suite skips —
// it must never fail merely because Docker is absent (keeps CI portable).
let dockerOk = false;
try {
  execSync('docker info', { stdio: 'ignore', timeout: 30000 });
  dockerOk = true;
} catch (err) {
  // eslint-disable-next-line no-console
  console.log('Docker unavailable — skipping build-smoke:', err && err.message);
}

const itDocker = dockerOk ? it : it.skip;

// One free ephemeral host port, picked up front to avoid collisions.
function getFreePort() {
  return new Promise(function (resolve, reject) {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', function () {
      const p = s.address().port;
      s.close(function () { resolve(p); });
    });
  });
}

// GET a URL, resolving { status, body }. Rejects on socket error.
function httpGet(url) {
  return new Promise(function (resolve, reject) {
    const r = http.get(url, function (res) {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', function (d) { body += d; });
      res.on('end', function () { resolve({ status: res.statusCode, body: body }); });
    });
    r.on('error', reject);
    r.setTimeout(5000, function () { r.destroy(new Error('request timeout')); });
  });
}

const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

// Poll the container's `/` until it answers or the deadline passes.
async function waitForServer(url, deadlineMs) {
  const stop = Date.now() + deadlineMs;
  let last = null;
  while (Date.now() < stop) {
    try {
      const res = await httpGet(url);
      return res;
    } catch (err) {
      last = err;
      await sleep(500);
    }
  }
  throw last || new Error('server never became ready');
}

describe('Docker build-smoke (Fly.io deployment image)', function () {
  let hostPort = 0;

  beforeAll(async function () {
    if (!dockerOk) return;

    // Build the image from the repo root build context (respects .dockerignore).
    execSync(`docker build -t ${TAG} .`, { cwd: ROOT, stdio: 'inherit', timeout: 590000 });

    // Run the container with NO `-e PORT`, relying solely on the image's baked
    // `ENV PORT=8080` (ADR-0028) — this proves the image self-binds 8080. The
    // ephemeral host port is still mapped to the internal 8080 the image binds.
    hostPort = await getFreePort();
    // Clean any stale container from a previous interrupted run.
    try { execSync(`docker rm -f ${CTR}`, { stdio: 'ignore' }); } catch (e) { /* none */ }
    execSync(
      `docker run -d --name ${CTR} -p ${hostPort}:${PORT} ${TAG}`,
      { stdio: 'inherit', timeout: 60000 },
    );
  }, 600000);

  afterAll(function () {
    if (!dockerOk) return;
    // Tear down reliably even on failure: remove container, then image.
    try { execSync(`docker rm -f ${CTR}`, { stdio: 'ignore' }); } catch (e) { /* already gone */ }
    try { execSync(`docker rmi -f ${TAG}`, { stdio: 'ignore' }); } catch (e) { /* already gone */ }
  }, 120000);

  itDocker('the ffmpeg-static binary resolves and is executable inside the image', function () {
    // Throwaway container: resolve ffmpeg-static and assert the binary is X_OK.
    const out = execFileSync(
      'docker',
      [
        'run', '--rm', TAG,
        'node', '-e',
        "const p=require('ffmpeg-static'); const fs=require('fs'); fs.accessSync(p, fs.constants.X_OK); console.log('FFMPEG_OK:'+p)",
      ],
      { encoding: 'utf8', timeout: 60000 },
    );
    expect(out).toContain('FFMPEG_OK:');
  }, 90000);

  itDocker('the self-bound container (no -e PORT) serves / with HTTP 200 and an HTML title', async function () {
    // The container was started with NO `-e PORT`, so a 200 here proves the
    // image's baked `ENV PORT=8080` made `node src/server/srv.js` bind 8080.
    const res = await waitForServer(`http://127.0.0.1:${hostPort}/`, 30000);
    expect(res.status).toBe(200);
    expect(res.body).toContain('<title');
  }, 60000);

  itDocker('the API router is mounted (a real /api route is handled, not the SPA HTML)', async function () {
    // Same-origin only — no live external network. The proxy route with no
    // `url` query param is rejected by rtr.js with 400 { err } *before* any
    // outbound request, proving the router is mounted rather than the request
    // falling through to the index.html catch-all.
    const res = await httpGet(`http://127.0.0.1:${hostPort}/api/xtream`);
    expect(res.status).toBe(400);
    expect(res.body).not.toContain('<title');
    expect(JSON.parse(res.body)).toHaveProperty('err');
  }, 60000);
});
