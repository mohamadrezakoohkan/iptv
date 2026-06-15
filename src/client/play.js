// ADR: ADR-0004, ADR-0010, ADR-0012, ADR-0023, ADR-0027, ADR-0028, ADR-0036
/* global window */

'use strict';

// ---------------------------------------------------------------------------
// Module-level state — no ST mutation from this file except via IptvSt calls
// ---------------------------------------------------------------------------
let _vid = null;   // video element reference
let _hls = null;   // current Hls instance
let _ts  = null;   // current mpegts.js player instance

// Local proxy prefix — both engines fetch via XHR; stream hosts lack CORS
const PRX = '/api/xtream?url=';

// Server remux prefix — TS→HLS fallback for MSE-less browsers (ADR-0012)
const RMX = '/api/hls?url=';

// ---------------------------------------------------------------------------
// mkPlay — stores video element reference; called once from main.js
// ---------------------------------------------------------------------------
function mkPlay(el) {
  _vid = el;
}

// ---------------------------------------------------------------------------
// getEng — pure: engine id from URL path extension, query ignored (ADR-0010)
// ---------------------------------------------------------------------------
function getEng(url) {
  let path = String(url);
  const q = path.indexOf('?');
  if (q !== -1) path = path.slice(0, q);
  return path.toLowerCase().endsWith('.m3u8') ? 'hls' : 'ts';
}

// ---------------------------------------------------------------------------
// getPrx — pure: wrap an absolute stream URL through the local proxy
// ---------------------------------------------------------------------------
function getPrx(url) {
  if (String(url).charAt(0) === '/') return url;
  return PRX + encodeURIComponent(url);
}

// ---------------------------------------------------------------------------
// getRmx — pure: wrap a raw stream URL through the server remux endpoint
// ---------------------------------------------------------------------------
function getRmx(url) {
  return RMX + encodeURIComponent(url);
}

// ---------------------------------------------------------------------------
// pad2 — pure: zero-pad a number to two digits for the timeshift stamp
// ---------------------------------------------------------------------------
function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

// ---------------------------------------------------------------------------
// getStamp — pure: format a unix-ms instant as the Xtream timeshift local
// stamp YYYY-MM-DD:HH-MM (ADR-0036, specs/catchup-archive.md §2)
// ---------------------------------------------------------------------------
function getStamp(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
    + ':' + pad2(d.getHours()) + '-' + pad2(d.getMinutes());
}

// ---------------------------------------------------------------------------
// getArchDur — pure: program length in whole minutes, minimum 1 (ADR-0036)
// ---------------------------------------------------------------------------
function getArchDur(start, stop) {
  const min = Math.round((stop - start) / 60000);
  return min < 1 ? 1 : min;
}

// ---------------------------------------------------------------------------
// getArchUrl — pure: build the Xtream timeshift archive URL for a program on
// an archive-capable channel, mirroring the live form mkXtCh built
// (<base>/live/<user>/<pass>/<id>.<ext>) → the timeshift form
// <base>/timeshift/<user>/<pass>/<dur>/<YYYY-MM-DD:HH-MM>/<id>.<ext>
// (ADR-0036, specs/catchup-archive.md §2). No DOM, no ST, no fetch.
// opts: { ch:Ch, prg:Prg }
// ---------------------------------------------------------------------------
function getArchUrl(opts) {
  const ch = opts.ch;
  const prg = opts.prg;
  const live = String(ch.url);
  const i = live.indexOf('/live/');
  const base = live.slice(0, i);
  const tail = live.slice(i + 6).split('/');     // [user, pass, id.ext]
  const dot = tail[2].lastIndexOf('.');
  const sid = tail[2].slice(0, dot);
  const ext = tail[2].slice(dot + 1);
  const stamp = getStamp(prg.start);
  const dur = getArchDur(prg.start, prg.stop);
  return base + '/timeshift/' + tail[0] + '/' + tail[1] + '/' + dur + '/' + stamp + '/' + sid + '.' + ext;
}

// ---------------------------------------------------------------------------
// updChip — reflect the engine actually in use on the format chips (ADR-0012)
// ---------------------------------------------------------------------------
function updChip(eng) {
  if (window.IptvUi && window.IptvUi.rndChip) window.IptvUi.rndChip(eng);
}

// ---------------------------------------------------------------------------
// onEngErr — shared fatal handler: capture the failure, set ERR, teardown,
// re-render overlay. The single capture site for the playback-failure log
// (ADR-0027): records exactly one entry for the failed channel (ST.cur) before
// the engine is torn down. Guarded like the IptvUi reads so play.js still works
// when IptvErrLog is absent (test isolation). No success path reaches here, so
// only failures are ever logged.
// ---------------------------------------------------------------------------
function onEngErr(msg) {
  if (window.IptvErrLog) window.IptvErrLog.add(window.IptvErrLog.mkEntry(window.IptvSt.ST.cur, msg));
  if (window.IptvUi && window.IptvUi.rndLog) window.IptvUi.rndLog();
  window.IptvSt.setErr(msg);
  if (window.IptvSt.ST.phase !== 'ERR') window.IptvSt.go('ERR');
  stopPlay();
  if (window.IptvUi && window.IptvUi.rndPhase) window.IptvUi.rndPhase();
}

// ---------------------------------------------------------------------------
// onHlsErr — fatal HLS error handler; transitions state to ERR
// ---------------------------------------------------------------------------
function onHlsErr(evt, data) {
  if (!data.fatal) return;
  onEngErr(data.details);
}

// ---------------------------------------------------------------------------
// onTsErr — mpegts.js error handler (every mpegts ERROR is fatal here)
// ---------------------------------------------------------------------------
function onTsErr(typ, det) {
  onEngErr(det ? String(det) : String(typ));
}

// ---------------------------------------------------------------------------
// onManifest — autoplay after manifest is parsed
// ---------------------------------------------------------------------------
function onManifest() {
  _vid.play().catch(function noop() {});
}

// ---------------------------------------------------------------------------
// loadHls — attach hls.js to the video element
// ---------------------------------------------------------------------------
function loadHls(url) {
  const hls = new window.Hls({ maxBufferLength: 30 });
  hls.loadSource(url);
  hls.attachMedia(_vid);
  hls.on(window.Hls.Events.MANIFEST_PARSED, onManifest);
  hls.on(window.Hls.Events.ERROR, onHlsErr);
  _hls = hls;
  return { ok: true, val: null };
}

// ---------------------------------------------------------------------------
// loadNative — set src directly for Safari native HLS
// ---------------------------------------------------------------------------
function loadNative(url) {
  _vid.src = url;
  _vid.play().catch(function noop() {});
  return { ok: true, val: null };
}

// ---------------------------------------------------------------------------
// hasTs — pure predicate: mpegts.js MSE live playback support (ADR-0010)
// ---------------------------------------------------------------------------
function hasTs() {
  return Boolean(window.mpegts
    && window.mpegts.getFeatureList
    && window.mpegts.getFeatureList().mseLivePlayback);
}

// ---------------------------------------------------------------------------
// loadTs — attach mpegts.js live player to the video element
// ---------------------------------------------------------------------------
function loadTs(url) {
  const p = window.mpegts.createPlayer({ type: 'mpegts', isLive: true, url });
  p.attachMediaElement(_vid);
  p.on(window.mpegts.Events.ERROR, onTsErr);
  p.load();
  const res = p.play();
  if (res && res.catch) res.catch(function noop() {});
  _ts = p;
  return { ok: true, val: null };
}

// ---------------------------------------------------------------------------
// stopPlay — destroys whichever engine instance exists, clears video src
// ---------------------------------------------------------------------------
function stopPlay() {
  if (_hls) {
    _hls.destroy();
    _hls = null;
  }
  if (_ts) {
    _ts.destroy();
    _ts = null;
  }
  _vid.src = '';
  _vid.load();
}

// ---------------------------------------------------------------------------
// runHls — hls.js path with native fallback (ADR-0004); returns Result<T>
// msg overrides the failure message (remux fallback double failure, ADR-0012)
// ---------------------------------------------------------------------------
function runHls(url, msg) {
  if (window.Hls && window.Hls.isSupported()) return loadHls(url);
  if (_vid.canPlayType('application/vnd.apple.mpegurl')) return loadNative(url);
  const err = msg ?? 'HLS not supported';
  onEngErr(err);
  return { ok: false, err };
}

// ---------------------------------------------------------------------------
// runTs — mpegts.js direct when MSE live playback exists; otherwise fall
// back to the server TS→HLS remux of the raw URL (ADR-0012). Takes the
// raw (un-proxied) stream URL; the chip reflects the engine actually used.
// ---------------------------------------------------------------------------
function runTs(url) {
  if (hasTs()) {
    updChip('ts');
    return loadTs(getPrx(url));
  }
  updChip('hls');
  return runHls(getRmx(url), 'MPEG-TS not supported');
}

// ---------------------------------------------------------------------------
// loadPlay — loads a stream URL via the engine its extension selects
// ---------------------------------------------------------------------------
function loadPlay(url) {
  if (_hls || _ts) stopPlay();
  if (getEng(url) === 'ts') return runTs(url);
  updChip('hls');
  return runHls(getPrx(url));
}

// ---------------------------------------------------------------------------
// goPlay — Retry entry point (ADR-0023, specs/empty-states.md §3b). Re-attempts
// playback of the current channel after a stream error: clears ST.err, walks the
// phase back through the state machine (ERR→INIT→LOAD→READY→PLAY, §6) so a fresh
// PLAY transition is legal, re-renders the player overlay, then re-runs the
// existing play path for ST.cur. No-op when there is no current channel.
// ---------------------------------------------------------------------------
function goPlay() {
  const st = window.IptvSt;
  if (!st.ST.cur) return;
  st.setErr(null);
  if (st.ST.phase === 'ERR') st.go('INIT');
  if (st.ST.phase === 'INIT') st.go('LOAD');
  if (st.ST.phase === 'LOAD') st.go('READY');
  if (st.ST.phase === 'READY') st.go('PLAY');
  if (window.IptvUi && window.IptvUi.rndPhase) window.IptvUi.rndPhase();
  loadPlay(st.ST.cur.url);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
window.IptvPlay = { mkPlay, loadPlay, goPlay, stopPlay, getEng, getPrx, getRmx, getArchUrl };
