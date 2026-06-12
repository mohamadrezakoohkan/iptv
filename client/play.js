// ADR: ADR-0004, ADR-0010
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
// onEngErr — shared fatal handler: set ERR, teardown, re-render overlay
// ---------------------------------------------------------------------------
function onEngErr(msg) {
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
// ---------------------------------------------------------------------------
function runHls(url) {
  if (window.Hls && window.Hls.isSupported()) return loadHls(url);
  if (_vid.canPlayType('application/vnd.apple.mpegurl')) return loadNative(url);
  onEngErr('HLS not supported');
  return { ok: false, err: 'HLS not supported' };
}

// ---------------------------------------------------------------------------
// runTs — mpegts.js path gated on feature support; returns Result<T>
// ---------------------------------------------------------------------------
function runTs(url) {
  if (!hasTs()) {
    onEngErr('MPEG-TS not supported');
    return { ok: false, err: 'MPEG-TS not supported' };
  }
  return loadTs(url);
}

// ---------------------------------------------------------------------------
// loadPlay — loads a stream URL via the engine its extension selects
// ---------------------------------------------------------------------------
function loadPlay(url) {
  if (_hls || _ts) stopPlay();
  const eng = getEng(url);
  if (window.IptvUi && window.IptvUi.rndChip) window.IptvUi.rndChip(eng);
  if (eng === 'ts') return runTs(getPrx(url));
  return runHls(getPrx(url));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
window.IptvPlay = { mkPlay, loadPlay, stopPlay, getEng, getPrx };
