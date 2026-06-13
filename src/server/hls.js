// ADR: ADR-0012
'use strict';

const cp   = require('child_process');
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const FFM  = require('ffmpeg-static');

const HCFG = {
  segSec:  2,      // HLS segment duration s
  winSz:   6,      // sliding-window playlist size
  bootMs:  15000,  // max wait for first playlist
  pollMs:  250,    // playlist poll interval ms
  idleMs:  60000,  // unrequested session lifetime ms
  sweepMs: 15000,  // reaper interval ms
};

const SESS = new Map();          // sid -> session
const KEYS = new Map();          // src url -> sid
const SEG_RE = /^seg\d+\.ts$/;   // valid segment names (also blocks traversal)
const PFX    = 'iptv-hls-';

function mkArgs(opts) {
  return [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-user_agent', 'iptv-proxy/1.0',
    '-i', opts.src,
    '-c', 'copy',
    '-f', 'hls',
    '-hls_time', String(HCFG.segSec),
    '-hls_list_size', String(HCFG.winSz),
    '-hls_flags', 'delete_segments',
    '-hls_segment_filename', path.join(opts.dir, 'seg%05d.ts'),
    path.join(opts.dir, 'idx.m3u8'),
  ];
}

function mkSess(src) {
  const dir  = fs.mkdtempSync(path.join(os.tmpdir(), PFX));
  const sid  = path.basename(dir).slice(PFX.length);
  const proc = cp.spawn(FFM, mkArgs({ src: src, dir: dir }), { stdio: ['ignore', 'ignore', 'ignore'] });
  const sess = { sid: sid, src: src, dir: dir, proc: proc, ts: Date.now(), dead: false };
  proc.on('exit',  function onExit() { sess.dead = true; });
  proc.on('error', function onPErr() { sess.dead = true; });
  SESS.set(sid, sess);
  KEYS.set(src, sid);
  return sess;
}

function getSess(src) {
  const cur = SESS.get(KEYS.get(src));
  if (cur && !cur.dead) return cur;
  if (cur) rmSess(cur);
  return mkSess(src);
}

function getPl(sess) {
  let txt = '';
  try {
    txt = fs.readFileSync(path.join(sess.dir, 'idx.m3u8'), 'utf8');
  } catch (_) {
    return null;
  }
  return txt.includes('.ts') ? txt : null;
}

function waitPl(sess) {
  const t0 = Date.now();
  return new Promise(function onWait(done) {
    const tmr = setInterval(function onTick() {
      const txt = getPl(sess);
      if (txt !== null) { clearInterval(tmr); done(txt); return; }
      if (sess.dead || Date.now() - t0 > HCFG.bootMs) { clearInterval(tmr); done(null); }
    }, HCFG.pollMs);
  });
}

function mkBody(sess, txt) {
  return txt.replace(/^(seg\d+\.ts)$/gm, '/api/hls/' + sess.sid + '/$1');
}

async function runPl(req, res) {
  let sess = null;
  try {
    sess = getSess(req.query.url);
  } catch (err) {
    res.status(502).json({ err: err.message });
    return;
  }
  sess.ts = Date.now();
  const txt = await waitPl(sess);
  if (txt === null) {
    rmSess(sess);
    res.status(502).json({ err: 'remux failed' });
    return;
  }
  sess.ts = Date.now();
  res.set('content-type', 'application/vnd.apple.mpegurl');
  res.send(mkBody(sess, txt));
}

function runSeg(req, res) {
  const sess = SESS.get(req.params.sid);
  if (!sess || !SEG_RE.test(req.params.seg)) {
    res.status(404).json({ err: 'not found' });
    return;
  }
  const fp = path.join(sess.dir, req.params.seg);
  let buf = null;
  try {
    buf = fs.readFileSync(fp);
  } catch (_) {
    res.status(404).json({ err: 'not found' });
    return;
  }
  sess.ts = Date.now();
  res.set('content-type', 'video/mp2t');
  res.send(buf);
}

function rmSess(sess) {
  SESS.delete(sess.sid);
  if (KEYS.get(sess.src) === sess.sid) KEYS.delete(sess.src);
  try { sess.proc.kill('SIGKILL'); } catch (_) { /* already gone */ }
  try { fs.rmSync(sess.dir, { recursive: true, force: true }); } catch (_) { /* already gone */ }
}

function runReap() {
  const now = Date.now();
  for (const sess of SESS.values()) {
    if (sess.dead || now - sess.ts > HCFG.idleMs) rmSess(sess);
  }
}

const REAP = setInterval(runReap, HCFG.sweepMs);
REAP.unref();

module.exports = {
  runPl:    runPl,
  runSeg:   runSeg,
  _cfg:     HCFG,
  _sess:    SESS,
  _keys:    KEYS,
  _mkArgs:  mkArgs,
  _mkSess:  mkSess,
  _getSess: getSess,
  _rmSess:  rmSess,
  _runReap: runReap,
};
