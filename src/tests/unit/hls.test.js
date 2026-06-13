// ADR: ADR-0012
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { EventEmitter } from 'events';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const req = createRequire(import.meta.url);
const cp  = req('child_process');
const hls = req('../../server/hls.js');
const rtr = req('../../server/rtr.js');

const runHls = rtr._runHls;

let origSpawn = null;
let spawnSpy  = null;
let origBoot  = 0;
let origPoll  = 0;

function mkProc() {
  const proc = new EventEmitter();
  proc.kill = vi.fn();
  return proc;
}

function mkRes() {
  const res = {
    status: vi.fn(function status() { return res; }),
    json:   vi.fn(),
    set:    vi.fn(),
    send:   vi.fn(),
  };
  return res;
}

function rmAll() {
  for (const sess of [...hls._sess.values()]) hls._rmSess(sess);
}

beforeEach(function onUp() {
  origSpawn = cp.spawn;
  origBoot  = hls._cfg.bootMs;
  origPoll  = hls._cfg.pollMs;
  hls._cfg.bootMs = 300;
  hls._cfg.pollMs = 20;
  spawnSpy = vi.fn(function fakeSpawn() { return mkProc(); });
  cp.spawn = spawnSpy;
});

afterEach(function onDown() {
  rmAll();
  cp.spawn = origSpawn;
  hls._cfg.bootMs = origBoot;
  hls._cfg.pollMs = origPoll;
  vi.useRealTimers();
});

describe('/api/hls — URL validation (same SSRF gate as /api/xtream)', function () {
  it('rejects a missing url with 400 and spawns nothing', function () {
    const res = mkRes();
    runHls({ query: {}, params: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ err: 'invalid url' });
    expect(spawnSpy).not.toHaveBeenCalled();
  });

  it('rejects a non-http scheme with 400', function () {
    const res = mkRes();
    runHls({ query: { url: 'file:///etc/passwd' }, params: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(spawnSpy).not.toHaveBeenCalled();
  });

  it('rejects blocked hosts (localhost, 127.0.0.1, ::1) with 400 — no remux bypass', function () {
    for (const url of ['http://localhost/x.ts', 'http://127.0.0.1/x.ts', 'http://[::1]/x.ts']) {
      const res = mkRes();
      runHls({ query: { url: url }, params: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(spawnSpy).not.toHaveBeenCalled();
  });
});

describe('ffmpeg arg construction', function () {
  it('uses stream copy and live HLS flags into the session dir', function () {
    const args = hls._mkArgs({ src: 'http://example.com/live/1.ts', dir: '/tmp/d' });
    const ci = args.indexOf('-c');
    expect(args[ci + 1]).toBe('copy');
    const fi = args.indexOf('-f');
    expect(args[fi + 1]).toBe('hls');
    const hi = args.indexOf('-hls_flags');
    expect(args[hi + 1]).toContain('delete_segments');
    expect(args[args.indexOf('-hls_time') + 1]).toBe(String(hls._cfg.segSec));
    expect(args[args.indexOf('-hls_list_size') + 1]).toBe(String(hls._cfg.winSz));
    expect(args[args.indexOf('-i') + 1]).toBe('http://example.com/live/1.ts');
    expect(args[args.indexOf('-hls_segment_filename') + 1]).toBe('/tmp/d/seg%05d.ts');
    expect(args[args.length - 1]).toBe('/tmp/d/idx.m3u8');
  });
});

describe('playlist response and session reuse', function () {
  it('responds with the playlist (rewritten segment URIs) once produced', async function () {
    const res = mkRes();
    const url = 'http://example.com/live/10.ts';
    const p = hls.runPl({ query: { url: url }, params: {} }, res);
    const sess = hls._sess.get(hls._keys.get(url));
    writeFileSync(join(sess.dir, 'idx.m3u8'), '#EXTM3U\n#EXTINF:2.0,\nseg00001.ts\n');
    await p;
    expect(res.status).not.toHaveBeenCalled();
    expect(res.set).toHaveBeenCalledWith('content-type', 'application/vnd.apple.mpegurl');
    expect(res.send).toHaveBeenCalledWith(
      '#EXTM3U\n#EXTINF:2.0,\n/api/hls/' + sess.sid + '/seg00001.ts\n'
    );
  });

  it('reuses one session (one ffmpeg) for repeated/concurrent same-source requests', async function () {
    const url = 'http://example.com/live/11.ts';
    const r1 = mkRes();
    const r2 = mkRes();
    const p1 = hls.runPl({ query: { url: url }, params: {} }, r1);
    const p2 = hls.runPl({ query: { url: url }, params: {} }, r2);
    expect(hls._sess.size).toBe(1);
    const sess = hls._sess.get(hls._keys.get(url));
    writeFileSync(join(sess.dir, 'idx.m3u8'), '#EXTM3U\nseg00001.ts\n');
    await Promise.all([p1, p2]);
    expect(spawnSpy).toHaveBeenCalledTimes(1);
    expect(r1.send).toHaveBeenCalled();
    expect(r2.send).toHaveBeenCalled();
  });

  it('different source URLs get different sessions', function () {
    hls._getSess('http://example.com/live/a.ts');
    hls._getSess('http://example.com/live/b.ts');
    expect(hls._sess.size).toBe(2);
    expect(spawnSpy).toHaveBeenCalledTimes(2);
  });
});

describe('502 on ffmpeg failure / startup timeout', function () {
  it('returns 502 when ffmpeg exits before producing a playlist', async function () {
    const res = mkRes();
    const url = 'http://example.com/live/12.ts';
    const p = hls.runPl({ query: { url: url }, params: {} }, res);
    const sess = hls._sess.get(hls._keys.get(url));
    sess.proc.emit('exit', 1);
    await p;
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ err: 'remux failed' });
    expect(hls._sess.size).toBe(0);
    expect(existsSync(sess.dir)).toBe(false);
  });

  it('returns 502 when the playlist never appears within the startup window', async function () {
    const res = mkRes();
    const url = 'http://example.com/live/13.ts';
    await hls.runPl({ query: { url: url }, params: {} }, res);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(hls._sess.size).toBe(0);
  });

  it('returns 502 when the spawn itself errors (binary failure)', async function () {
    const res = mkRes();
    const url = 'http://example.com/live/14.ts';
    const p = hls.runPl({ query: { url: url }, params: {} }, res);
    const sess = hls._sess.get(hls._keys.get(url));
    sess.proc.emit('error', new Error('spawn ENOENT'));
    await p;
    expect(res.status).toHaveBeenCalledWith(502);
  });
});

describe('segment route — /api/hls/:sid/:seg', function () {
  it('serves bytes of an existing segment', function () {
    const sess = hls._getSess('http://example.com/live/20.ts');
    writeFileSync(join(sess.dir, 'seg00001.ts'), Buffer.from([0x47, 0x40, 0x11]));
    const res = mkRes();
    hls.runSeg({ params: { sid: sess.sid, seg: 'seg00001.ts' } }, res);
    expect(res.set).toHaveBeenCalledWith('content-type', 'video/mp2t');
    expect(res.send.mock.calls[0][0][0]).toBe(0x47);
  });

  it('404s an unknown session', function () {
    const res = mkRes();
    hls.runSeg({ params: { sid: 'nope', seg: 'seg00001.ts' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ err: 'not found' });
  });

  it('404s a missing segment in a live session', function () {
    const sess = hls._getSess('http://example.com/live/21.ts');
    const res  = mkRes();
    hls.runSeg({ params: { sid: sess.sid, seg: 'seg09999.ts' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects path traversal in the segment name', function () {
    const sess = hls._getSess('http://example.com/live/22.ts');
    writeFileSync(join(sess.dir, 'seg00001.ts'), Buffer.from([0x47]));
    for (const seg of ['../../../etc/passwd', '..%2Fseg00001.ts', 'idx.m3u8', 'seg1.txt', 'seg00001.ts/../seg00001.ts']) {
      const res = mkRes();
      hls.runSeg({ params: { sid: sess.sid, seg: seg } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    }
  });

  it('rejects traversal in the session id (unknown session)', function () {
    const res = mkRes();
    hls.runSeg({ params: { sid: '../..', seg: 'seg00001.ts' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('idle reaping', function () {
  it('reaps a session idle past the window: kills ffmpeg, removes the temp dir', function () {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-12T12:00:00Z'));
    const sess = hls._getSess('http://example.com/live/30.ts');
    expect(existsSync(sess.dir)).toBe(true);
    vi.setSystemTime(new Date(Date.now() + hls._cfg.idleMs + 1000));
    hls._runReap();
    expect(sess.proc.kill).toHaveBeenCalledWith('SIGKILL');
    expect(existsSync(sess.dir)).toBe(false);
    expect(hls._sess.size).toBe(0);
    expect(hls._keys.size).toBe(0);
  });

  it('keeps a recently requested session alive', function () {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-12T12:00:00Z'));
    const sess = hls._getSess('http://example.com/live/31.ts');
    vi.setSystemTime(new Date(Date.now() + hls._cfg.idleMs - 1000));
    hls._runReap();
    expect(sess.proc.kill).not.toHaveBeenCalled();
    expect(hls._sess.size).toBe(1);
  });

  it('reaps a dead (exited) session regardless of idle time', function () {
    const sess = hls._getSess('http://example.com/live/32.ts');
    sess.proc.emit('exit', 0);
    hls._runReap();
    expect(existsSync(sess.dir)).toBe(false);
    expect(hls._sess.size).toBe(0);
  });
});
